import { useEffect, useMemo, useState } from 'react';
import { AppState, Linking, Platform, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BottomNav, MainTab } from './src/components/BottomNav';
import { demoCouple, demoProfiles, initialMeals } from './src/data/mock';
import { ActivityEvent } from './src/data/activityTypes';
import { AuthOutcome, CoupleRecord, ProfileRecord } from './src/data/cloudTypes';
import { Meal } from './src/data/types';
import { petCopy } from './src/data/petCopy';
import { authenticate as authenticateAccount, consumeAuthCallback, getAuthCallbackType, getSavedSession, listenForAuthEvents, requestPasswordReset, resendSignupConfirmation, signOut, updatePassword } from './src/lib/auth';
import { acceptInvite, cancelMyInvite, isPaired, listCoupleProfiles, prepareCoupleAccount, removeMyAvatar, subscribeToProfileChanges, updateCoupleSettings, updateMyAvatar, updateMyNickname } from './src/lib/couples';
import { pickAvatar } from './src/lib/photoPicker';
import { isSupabaseConfigured } from './src/lib/supabase';
import { deleteMeal, getMealById, listCoupleMeals, listCoupleMealsForMonth, publishMeal, subscribeToCoupleMeals, updateMeal } from './src/lib/meals';
import { addMealComment, deleteMealComment, refreshMealInteractions, setMealReaction, subscribeToMealInteractions } from './src/lib/interactions';
import { isActivityBackendMissing, listActivities, markActivityRead, markAllActivitiesRead, sendNudge, subscribeToActivities } from './src/lib/activity';
import { getInitialNotificationMealId, listenForMealNotification, registerDevicePushToken } from './src/lib/notifications';
import { AddMealScreen } from './src/screens/AddMealScreen';
import { ActivityScreen } from './src/screens/ActivityScreen';
import { AuthBindingScreen } from './src/screens/AuthBindingScreen';
import { DetailScreen } from './src/screens/DetailScreen';
import { MemoriesScreen } from './src/screens/MemoriesScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { colors } from './src/theme';

type Overlay = { kind: 'add' } | { kind: 'activity' } | { kind: 'detail'; mealId: string } | { kind: 'edit'; mealId: string } | null;
type AppStatus = 'checking' | 'entry' | 'recovery' | 'ready';
type CloudContext = { userId: string; couple: CoupleRecord };

function upsertMeal(current: Meal[], incoming: Meal) {
  return [incoming, ...current.filter((meal) => meal.id !== incoming.id)];
}

function isPublicDemoRequested() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('demo') === '1';
}

export default function App() {
  const [demoMode] = useState(isPublicDemoRequested);
  const [appStatus, setAppStatus] = useState<AppStatus>(demoMode ? 'ready' : isSupabaseConfigured ? 'checking' : 'entry');
  const [entryMode, setEntryMode] = useState<'login' | 'bind'>('login');
  const [inviteCode, setInviteCode] = useState(isSupabaseConfigured ? '' : 'BITE26');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [cloudContext, setCloudContext] = useState<CloudContext | null>(null);
  const [activeTab, setActiveTab] = useState<MainTab>('today');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [meals, setMeals] = useState<Meal[]>(demoMode || !isSupabaseConfigured ? initialMeals : []);
  const [profiles, setProfiles] = useState<ProfileRecord[]>(demoMode ? demoProfiles : []);
  const [demoCoupleState, setDemoCoupleState] = useState(demoCouple);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityAvailable, setActivityAvailable] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingNotificationMealId, setPendingNotificationMealId] = useState<string | null>(null);

  const selectedMeal = useMemo(() => overlay && 'mealId' in overlay ? meals.find((meal) => meal.id === overlay.mealId) : undefined, [overlay, meals]);
  const loadMemoryMonth = useMemo(() => {
    if (!cloudContext) return undefined;
    return (year: number, month: number) => listCoupleMealsForMonth(cloudContext.couple.id, cloudContext.userId, year, month);
  }, [cloudContext]);

  useEffect(() => {
    if (!isSupabaseConfigured || demoMode) return;
    let active = true;

    void (async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        const callbackType = getAuthCallbackType(initialUrl);
        const callbackSession = await consumeAuthCallback(initialUrl);
        const session = callbackSession ?? await getSavedSession();
        if (!active) return;
        if (!session) {
          setAppStatus('entry');
          return;
        }
        setCurrentUserId(session.user.id);
        setCurrentUserEmail(session.user.email ?? null);
        if (callbackType === 'recovery') {
          setAppStatus('recovery');
          return;
        }
        const couple = await prepareCoupleAccount(
          session.user.id,
          session.user.user_metadata?.nickname ?? session.user.email?.split('@')[0],
        );
        if (!active) return;
        setInviteCode(couple?.invite_code ?? '');
        if (isPaired(couple)) {
          setCloudContext({ userId: session.user.id, couple });
          setAppStatus('ready');
        }
        else {
          setEntryMode('bind');
          setAppStatus('entry');
        }
      } catch {
        if (active) setAppStatus('entry');
      }
    })();

    const stopListening = listenForAuthEvents(() => {
      setEntryMode('login');
      setCurrentUserId(null);
      setCurrentUserEmail(null);
      setCloudContext(null);
      setActivities([]);
      setAppStatus('entry');
    }, () => setAppStatus('recovery'));
    return () => {
      active = false;
      stopListening();
    };
  }, [demoMode]);

  useEffect(() => {
    if (!isSupabaseConfigured || demoMode) return;
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const callbackType = getAuthCallbackType(url);
      void consumeAuthCallback(url)
        .then(async (session) => {
          if (!session) return;
          setAppStatus(callbackType === 'recovery' ? 'recovery' : 'checking');
          setCurrentUserId(session.user.id);
          setCurrentUserEmail(session.user.email ?? null);
          if (callbackType === 'recovery') return;
          const couple = await prepareCoupleAccount(
            session.user.id,
            session.user.user_metadata?.nickname ?? session.user.email?.split('@')[0],
          );
          setInviteCode(couple?.invite_code ?? '');
          if (isPaired(couple)) {
            setCloudContext({ userId: session.user.id, couple });
            setAppStatus('ready');
          } else {
            setEntryMode('bind');
            setAppStatus('entry');
          }
        })
        .catch(() => {
          setEntryMode('login');
          setAppStatus('entry');
          showToast('邮箱确认链接没有接好，再打开一次试试呀。');
        });
    });
    return () => subscription.remove();
  }, [demoMode]);

  useEffect(() => {
    if (demoMode) return;
    const stopListening = listenForMealNotification(setPendingNotificationMealId);
    void getInitialNotificationMealId().then((mealId) => {
      if (mealId) setPendingNotificationMealId(mealId);
    });
    return stopListening;
  }, [demoMode]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => {
    if (appStatus !== 'ready' || !cloudContext) return;
    let active = true;
    let syncing = false;

    const refreshFromCloud = async (showFailure = false) => {
      if (syncing) return;
      syncing = true;
      try {
        const cloudMeals = await listCoupleMeals(cloudContext.couple.id, cloudContext.userId);
        if (active) setMeals(cloudMeals);
      } catch {
        if (active && showFailure) showToast('刚刚没能把云端记录拿回来，再试一下儿呀。');
      } finally {
        syncing = false;
      }
    };

    void refreshFromCloud(true);

    const unsubscribe = subscribeToCoupleMeals(
      cloudContext.couple.id,
      cloudContext.userId,
      (meal) => {
        if (!active) return;
        setMeals((current) => upsertMeal(current, meal));
        if (meal.authorId !== cloudContext.userId) showToast(`${meal.author} 刚记了一顿，快来瞧瞧呀～`);
      },
    );

    // Some corporate Wi-Fi and proxy tools block Realtime WebSockets. Keep the
    // subscription for instant delivery and use a small foreground poll as a
    // reliable fallback so the user never needs to refresh manually.
    const poll = setInterval(() => { void refreshFromCloud(); }, 4_000);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshFromCloud();
    });

    return () => {
      active = false;
      clearInterval(poll);
      appStateSubscription.remove();
      unsubscribe();
    };
  }, [appStatus, cloudContext]);

  useEffect(() => {
    if (appStatus !== 'ready' || !cloudContext) return;
    let active = true;
    let syncing = false;

    const refreshActivities = async () => {
      if (syncing) return;
      syncing = true;
      setActivityLoading(true);
      try {
        const next = await listActivities(cloudContext.userId);
        if (!active) return;
        setActivities(next);
        setActivityAvailable(true);
      } catch (error) {
        if (!active) return;
        if (isActivityBackendMissing(error)) {
          setActivities([]);
          setActivityAvailable(false);
        }
      } finally {
        syncing = false;
        if (active) setActivityLoading(false);
      }
    };

    void refreshActivities();
    const unsubscribe = subscribeToActivities(cloudContext.userId, () => { void refreshActivities(); });
    const poll = setInterval(() => { void refreshActivities(); }, 8_000);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshActivities();
    });
    return () => {
      active = false;
      clearInterval(poll);
      appStateSubscription.remove();
      unsubscribe();
    };
  }, [appStatus, cloudContext]);

  useEffect(() => {
    if (appStatus !== 'ready' || !cloudContext) return;
    let active = true;
    const refreshProfiles = async () => {
      try {
        const next = await listCoupleProfiles(cloudContext.couple);
        if (active) {
          setProfiles(next);
          const names = new Map(next.map((profile) => [profile.id, profile.nickname]));
          setMeals((current) => current.map((meal) => {
            const latestName = meal.authorId ? names.get(meal.authorId) : undefined;
            return latestName && latestName !== meal.author ? { ...meal, author: latestName } : meal;
          }));
        }
      } catch {
        // Meal recording remains available if profile refresh briefly fails.
      }
    };
    void refreshProfiles();
    const unsubscribe = subscribeToProfileChanges(() => { void refreshProfiles(); });
    const poll = setInterval(() => { void refreshProfiles(); }, 3_000);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshProfiles();
    });
    return () => { active = false; clearInterval(poll); appStateSubscription.remove(); unsubscribe(); };
  }, [appStatus, cloudContext]);

  useEffect(() => {
    if (appStatus !== 'ready' || !cloudContext) return;
    void registerDevicePushToken(cloudContext.userId).catch(() => {
      // Push permission or registration issues never block meal recording.
    });
  }, [appStatus, cloudContext]);

  useEffect(() => {
    if (!pendingNotificationMealId || appStatus !== 'ready') return;

    if (!cloudContext) {
      const demoMeal = meals.find((meal) => meal.id === pendingNotificationMealId);
      if (demoMeal) setOverlay({ kind: 'detail', mealId: demoMeal.id });
      setPendingNotificationMealId(null);
      return;
    }

    let active = true;
    void getMealById(pendingNotificationMealId, cloudContext.userId)
      .then((meal) => {
        if (!active || !meal) return;
        setMeals((current) => upsertMeal(current, meal));
        setActiveTab('today');
        setOverlay({ kind: 'detail', mealId: meal.id });
      })
      .catch(() => {
        if (active) showToast('这条记录暂时没打开，再点一次试试呀。');
      })
      .finally(() => {
        if (active) setPendingNotificationMealId(null);
      });
    return () => { active = false; };
  }, [appStatus, cloudContext, pendingNotificationMealId]);

  useEffect(() => {
    if (!selectedMeal || !cloudContext) return;
    return subscribeToMealInteractions(selectedMeal.id, cloudContext.userId, (updated) => {
      setMeals((current) => current.map((meal) => meal.id === updated.id ? updated : meal));
    });
  }, [selectedMeal?.id, cloudContext]);

  const handleNudge = () => {
    if (!cloudContext) {
      showToast(petCopy.nudgeToast);
      return;
    }
    void sendNudge(cloudContext.couple.id)
      .then(() => showToast('已经放进 TA 的消息里啦，记得吃饭儿呀～'))
      .catch((error) => showToast(isActivityBackendMissing(error)
        ? '消息中心还差最后一步设置，完成后就能催 TA 啦。'
        : '刚刚没送到 TA 那里，再试一下儿呀。'));
  };

  const exitDemo = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.assign(`${window.location.origin}/`);
      return;
    }
    setAppStatus('entry');
  };

  const openActivity = (event: ActivityEvent) => {
    if (!cloudContext) return;
    if (!event.readAt) {
      const readAt = new Date().toISOString();
      setActivities((current) => current.map((item) => item.id === event.id ? { ...item, readAt } : item));
      void markActivityRead(event.id, cloudContext.userId).catch(() => undefined);
    }
    if (!event.mealId) return;
    const existing = meals.find((meal) => meal.id === event.mealId);
    if (existing) {
      setOverlay({ kind: 'detail', mealId: existing.id });
      return;
    }
    void getMealById(event.mealId, cloudContext.userId)
      .then((meal) => {
        if (!meal) throw new Error('missing meal');
        setMeals((current) => upsertMeal(current, meal));
        setOverlay({ kind: 'detail', mealId: meal.id });
      })
      .catch(() => showToast('这条记录可能已经被删掉啦。'));
  };

  if (appStatus === 'checking') {
    return <><StatusBar style="dark" /><SafeAreaView style={styles.boot}><View style={styles.bootInner}><Text style={styles.bootDog}>🐶</Text><Text style={styles.bootTitle}>豆包正在把日常接回来呀…</Text><Text style={styles.bootText}>登录状态和情侣关系会自动恢复。</Text></View></SafeAreaView></>;
  }

  if (appStatus === 'recovery') {
    return <><StatusBar style="dark" /><ResetPasswordScreen
      onSave={async (password) => {
        await updatePassword(password);
        const session = await getSavedSession();
        if (!session) throw new Error('重置登录状态已经过期，请重新发送邮件呀。');
        const couple = await prepareCoupleAccount(session.user.id, session.user.user_metadata?.nickname ?? session.user.email?.split('@')[0]);
        setCurrentUserId(session.user.id);
        setCurrentUserEmail(session.user.email ?? null);
        setInviteCode(couple?.invite_code ?? '');
        if (isPaired(couple)) {
          setCloudContext({ userId: session.user.id, couple });
          setAppStatus('ready');
        } else {
          setEntryMode('bind');
          setAppStatus('entry');
        }
      }}
      onCancel={async () => { await signOut(); setEntryMode('login'); setAppStatus('entry'); }}
    /></>;
  }

  if (appStatus === 'entry') {
    return <><StatusBar style="dark" /><AuthBindingScreen
      initialMode={entryMode}
      inviteCode={inviteCode}
      cloudEnabled={isSupabaseConfigured}
      onAuthenticate={async (input) => {
        if (!isSupabaseConfigured) {
          setInviteCode('BITE26');
          setEntryMode('bind');
          return 'authenticated' as AuthOutcome;
        }
        const result = await authenticateAccount(input);
        if (result.mode === 'confirmation-required') return 'confirmation-required' as AuthOutcome;
        if (result.mode !== 'cloud' || !result.user) throw new Error('登录状态没有保存下来，再试一下儿呀。');
        setCurrentUserId(result.user.id);
        setCurrentUserEmail(result.user.email ?? null);
        const couple = await prepareCoupleAccount(
          result.user.id,
          result.user.user_metadata?.nickname ?? result.user.email?.split('@')[0],
        );
        setInviteCode(couple?.invite_code ?? '');
        if (isPaired(couple)) {
          setCloudContext({ userId: result.user.id, couple });
          setAppStatus('ready');
        }
        else setEntryMode('bind');
        return 'authenticated' as AuthOutcome;
      }}
      onResendConfirmation={resendSignupConfirmation}
      onRequestPasswordReset={requestPasswordReset}
      onAcceptInvite={async (code) => {
        if (!isSupabaseConfigured) {
          setAppStatus('ready');
          return;
        }
        const couple = await acceptInvite(code);
        if (!isPaired(couple)) throw new Error('绑定还没有完成，再试一下儿呀。');
        const userId = currentUserId ?? (await getSavedSession())?.user.id;
        if (!userId) throw new Error('登录状态不见了，请重新登录呀。');
        setInviteCode(couple.invite_code);
        setCloudContext({ userId, couple });
        setAppStatus('ready');
      }}
      onCancelInvite={async () => {
        if (isSupabaseConfigured && inviteCode) await cancelMyInvite(inviteCode);
        await signOut();
        setCurrentUserId(null);
        setCurrentUserEmail(null);
        setCloudContext(null);
        setInviteCode('');
        setProfiles([]);
        setMeals([]);
        setActivities([]);
        setEntryMode('login');
        setAppStatus('entry');
      }}
      onChangeAccount={async () => {
        await signOut();
        setCurrentUserId(null);
        setCurrentUserEmail(null);
        setCloudContext(null);
        setInviteCode('');
        setProfiles([]);
        setMeals([]);
        setActivities([]);
        setEntryMode('login');
        setAppStatus('entry');
      }}
      onDemo={() => setAppStatus('ready')}
    /></>;
  }

  if (overlay?.kind === 'activity') {
    return <><StatusBar style="dark" /><ActivityScreen
      activities={activities}
      loading={activityLoading}
      unavailable={!activityAvailable}
      onBack={() => setOverlay(null)}
      onOpen={openActivity}
      onMarkAllRead={() => {
        if (!cloudContext) return;
        const readAt = new Date().toISOString();
        setActivities((current) => current.map((event) => event.readAt ? event : { ...event, readAt }));
        void markAllActivitiesRead(cloudContext.userId).catch(() => showToast('刚刚没有全部标记成功，再试一下儿呀。'));
      }}
    /></>;
  }

  if (overlay?.kind === 'add') {
    return <><StatusBar style="dark" /><AddMealScreen demoMode={demoMode} onClose={() => setOverlay(null)} onPublish={async (meal) => {
      const saved = cloudContext
        ? await publishMeal(meal, cloudContext.couple.id, cloudContext.userId)
        : demoMode
          ? { ...meal, author: demoProfiles[0]!.nickname, authorId: demoProfiles[0]!.id, tone: 'blue' as const, localPhotos: undefined }
          : meal;
      setMeals((current) => upsertMeal(current, saved));
      setOverlay(null);
      setActiveTab('today');
      showToast(cloudContext ? '记好啦！已经同步给 TA 了呀～' : petCopy.publishToast);
    }} /></>;
  }

  if (overlay?.kind === 'edit' && selectedMeal) {
    return <><StatusBar style="dark" /><AddMealScreen initialMeal={selectedMeal} demoMode={demoMode} onClose={() => setOverlay({ kind: 'detail', mealId: selectedMeal.id })} onPublish={async (meal) => {
      const saved = cloudContext ? await updateMeal(meal, cloudContext.couple.id, cloudContext.userId) : meal;
      setMeals((current) => current.map((item) => item.id === saved.id ? saved : item));
      setOverlay({ kind: 'detail', mealId: saved.id });
      showToast('修改保存好啦，统计也一起更新啦～');
    }} /></>;
  }

  if (selectedMeal) {
    return <><StatusBar style="dark" /><DetailScreen
      meal={selectedMeal}
      currentUserId={cloudContext?.userId ?? (demoMode ? demoProfiles[0]!.id : undefined)}
      currentUserName={cloudContext ? '我' : demoMode ? demoProfiles[0]!.nickname : '小晴'}
      currentUserTone={demoMode ? 'blue' : cloudContext ? 'blue' : 'pink'}
      canManage={!cloudContext || selectedMeal.authorId === cloudContext.userId}
      onBack={() => setOverlay(null)}
      onEdit={() => setOverlay({ kind: 'edit', mealId: selectedMeal.id })}
      onDelete={async () => {
        if (cloudContext) await deleteMeal(selectedMeal, cloudContext.userId);
        setMeals((current) => current.filter((meal) => meal.id !== selectedMeal.id));
        setOverlay(null);
        showToast('这条记录已经删掉啦，次数也重新算好啦。');
      }}
      onUpdate={(updated) => setMeals((current) => current.map((meal) => meal.id === updated.id ? updated : meal))}
      onToggleReaction={cloudContext ? async (reaction, active) => {
        await setMealReaction(selectedMeal.id, cloudContext.userId, reaction, active);
        const updated = await refreshMealInteractions(selectedMeal.id, cloudContext.userId);
        if (!updated) throw new Error('这条记录暂时没有刷新出来呀。');
        return updated;
      } : undefined}
      onSendComment={cloudContext ? async (body) => {
        await addMealComment(selectedMeal.id, cloudContext.userId, body);
        const updated = await refreshMealInteractions(selectedMeal.id, cloudContext.userId);
        if (!updated) throw new Error('评论发出了，但页面暂时没有刷新出来呀。');
        return updated;
      } : undefined}
      onDeleteComment={cloudContext ? async (commentId) => {
        await deleteMealComment(commentId, cloudContext.userId);
        const updated = await refreshMealInteractions(selectedMeal.id, cloudContext.userId);
        if (!updated) throw new Error('评论删掉了，但页面暂时没有刷新出来呀。');
        return updated;
      } : undefined}
    /></>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.app}>
        {demoMode && <View style={styles.demoBanner}><View style={styles.demoDot} /><Text style={styles.demoBannerText}>公开体验版 · 演示数据不会上传</Text><Pressable onPress={exitDemo} style={styles.demoExit}><Text style={styles.demoExitText}>正式入口</Text></Pressable></View>}
        {activeTab === 'today' ? (
          <TodayScreen meals={meals} couple={cloudContext?.couple ?? (demoMode ? demoCoupleState : undefined)} profiles={profiles} currentUserId={cloudContext?.userId ?? (demoMode ? demoProfiles[0]!.id : undefined)} unreadCount={activities.filter((event) => !event.readAt).length} onMealPress={(meal) => setOverlay({ kind: 'detail', mealId: meal.id })} onOpenActivity={() => setOverlay({ kind: 'activity' })} onNudge={handleNudge} />
        ) : activeTab === 'memories' ? (
          <MemoriesScreen meals={meals} loadMonth={loadMemoryMonth} onMealPress={(meal) => setOverlay({ kind: 'detail', mealId: meal.id })} />
        ) : cloudContext || demoMode ? (
          <SettingsScreen
            couple={cloudContext?.couple ?? demoCoupleState}
            profiles={profiles}
            currentUserId={cloudContext?.userId ?? demoProfiles[0]!.id}
            email={currentUserEmail ?? undefined}
            onSave={async ({ nickname, petName, anniversary }) => {
              if (demoMode) {
                const normalizedNickname = nickname.trim() || demoProfiles[0]!.nickname;
                setProfiles((current) => current.map((profile) => profile.id === demoProfiles[0]!.id ? { ...profile, nickname: normalizedNickname } : profile));
                setMeals((current) => current.map((meal) => meal.authorId === demoProfiles[0]!.id ? { ...meal, author: normalizedNickname } : meal));
                setDemoCoupleState((current) => ({ ...current, pet_name: petName.trim() || '豆包', anniversary: anniversary || null }));
                return;
              }
              if (!cloudContext) return;
              const normalizedNickname = nickname.trim();
              const currentProfile = profiles.find((profile) => profile.id === cloudContext.userId);
              if (!currentProfile || currentProfile.nickname !== normalizedNickname) {
                const updatedProfile = await updateMyNickname(cloudContext.userId, normalizedNickname);
                setProfiles((current) => [updatedProfile, ...current.filter((profile) => profile.id !== updatedProfile.id)]);
                setMeals((current) => current.map((meal) => meal.authorId === updatedProfile.id
                  ? { ...meal, author: updatedProfile.nickname }
                  : meal));
              }

              const normalizedPetName = petName.trim();
              const normalizedAnniversary = anniversary || null;
              if (cloudContext.couple.pet_name !== normalizedPetName || cloudContext.couple.anniversary !== normalizedAnniversary) {
                const updatedCouple = await updateCoupleSettings(cloudContext.couple.id, normalizedPetName, normalizedAnniversary);
                if (updatedCouple) setCloudContext({ ...cloudContext, couple: updatedCouple });
              }
            }}
            onChangeAvatar={async () => {
              const photo = await pickAvatar();
              if (!photo) return false;
              if (demoMode) {
                setProfiles((current) => current.map((profile) => profile.id === demoProfiles[0]!.id ? { ...profile, avatar_url: photo.uri } : profile));
                return true;
              }
              if (!cloudContext) return false;
              const updatedProfile = await updateMyAvatar(cloudContext.userId, photo);
              setProfiles((current) => [updatedProfile, ...current.filter((profile) => profile.id !== updatedProfile.id)]);
              return true;
            }}
            onRemoveAvatar={async () => {
              if (demoMode) {
                setProfiles((current) => current.map((profile) => profile.id === demoProfiles[0]!.id ? { ...profile, avatar_url: null } : profile));
                return;
              }
              if (!cloudContext) return;
              const updatedProfile = await removeMyAvatar(cloudContext.userId);
              if (updatedProfile) setProfiles((current) => [updatedProfile, ...current.filter((profile) => profile.id !== updatedProfile.id)]);
            }}
            onChangePassword={updatePassword}
            onSignOut={async () => { await signOut(); setActiveTab('today'); setProfiles([]); setMeals([]); setActivities([]); setCurrentUserEmail(null); }}
            demoMode={demoMode}
            onExitDemo={exitDemo}
          />
        ) : (
          <TodayScreen meals={meals} unreadCount={activities.filter((event) => !event.readAt).length} onMealPress={(meal) => setOverlay({ kind: 'detail', mealId: meal.id })} onOpenActivity={() => setOverlay({ kind: 'activity' })} onNudge={handleNudge} />
        )}
        <BottomNav active={activeTab} onChange={setActiveTab} onAdd={() => setOverlay({ kind: 'add' })} />
        {!!toast && <View style={styles.toast}><Text style={styles.toastDog}>🐶</Text><Text style={styles.toastText}>{toast}</Text></View>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  app: { flex: 1 },
  demoBanner: { minHeight: 38, backgroundColor: colors.yellowSoft, borderBottomWidth: 1, borderBottomColor: colors.yellow, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  demoDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.brown, marginRight: 7 },
  demoBannerText: { flex: 1, color: colors.brown, fontSize: 10, fontWeight: '900' },
  demoExit: { borderRadius: 10, backgroundColor: colors.paper, paddingHorizontal: 10, paddingVertical: 6 },
  demoExitText: { color: colors.brown, fontSize: 9, fontWeight: '900' },
  toast: { position: 'absolute', top: 12, left: 22, right: 22, backgroundColor: colors.ink, borderRadius: 17, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  toastDog: { fontSize: 18, marginRight: 8 },
  toastText: { color: colors.white, fontSize: 12, fontWeight: '800', flex: 1 },
  boot: { flex: 1, backgroundColor: colors.cream },
  bootInner: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  bootDog: { fontSize: 44 },
  bootTitle: { color: colors.ink, fontSize: 18, fontWeight: '900', marginTop: 13 },
  bootText: { color: colors.muted, fontSize: 12, marginTop: 7 },
});
