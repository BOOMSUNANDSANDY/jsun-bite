import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Avatar } from '../components/Avatar';
import { Dog, DogMood, DogPose } from '../components/Dog';
import { MealCard } from '../components/MealCard';
import { CoupleRecord, ProfileRecord } from '../data/cloudTypes';
import { Meal } from '../data/types';
import { petCopy } from '../data/petCopy';
import { colors } from '../theme';

function sameLocalDay(value: string | undefined, target = new Date()) {
  if (!value) return true;
  const date = new Date(value);
  return date.getFullYear() === target.getFullYear() && date.getMonth() === target.getMonth() && date.getDate() === target.getDate();
}

function daysTogether(anniversary: string | null | undefined) {
  if (!anniversary) return null;
  const start = new Date(`${anniversary}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  return Math.max(1, Math.floor((Date.now() - start.getTime()) / 86_400_000) + 1);
}

function togetherStreak(meals: Meal[], memberIds: string[]) {
  if (memberIds.length < 2) return 0;
  const byDay = new Map<string, Set<string>>();
  meals.forEach((meal) => {
    if (!meal.eatenAt || !meal.authorId) return;
    const day = datePart(new Date(meal.eatenAt));
    const authors = byDay.get(day) ?? new Set<string>();
    authors.add(meal.authorId);
    byDay.set(day, authors);
  });
  let cursor = new Date();
  if (!(byDay.get(datePart(cursor))?.size === memberIds.length)) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (byDay.get(datePart(cursor))?.size === memberIds.length) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

function datePart(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function petState({
  coupled,
  profilesReady,
  myName,
  partnerName,
  myMealCount,
  partnerMealCount,
  ateTogether,
  streak,
  hour,
}: {
  coupled: boolean;
  profilesReady: boolean;
  myName: string;
  partnerName: string;
  myMealCount: number;
  partnerMealCount: number;
  ateTogether: boolean;
  streak: number;
  hour: number;
}): { mood: DogMood; pose: DogPose; line: string } {
  if (!coupled) return { mood: 'side-eye', pose: 'judge', line: petCopy.today };
  if (!profilesReady) return { mood: 'normal', pose: 'talk', line: '你好呀，我正在把你们的名字接回来，再等一小会儿呀～' };
  if (ateTogether) return { mood: 'happy', pose: 'wave', line: `今天还一起吃饭儿啦！${myName} 和 ${partnerName} 的这顿，我可要好好记住呀～` };
  if (myMealCount > 0 && partnerMealCount > 0) {
    return {
      mood: 'happy',
      pose: 'wave',
      line: streak >= 3
        ? `你们已经一起坚持 ${streak} 天啦，今天也都有好好吃饭儿，真不错呀～`
        : `${myName} 和 ${partnerName} 今天都有好好吃饭儿，我就放心啦～`,
    };
  }
  if (partnerMealCount > 0 && myMealCount === 0) return { mood: 'side-eye', pose: 'judge', line: `${partnerName} 都记过饭啦～${myName}，你也要记得吃点儿东西呀。` };
  if (myMealCount > 0 && partnerMealCount === 0) return { mood: 'normal', pose: 'talk', line: `${myName} 已经来报到啦～等 ${partnerName} 吃饭儿的时候，也来告诉我一声呀。` };
  if (hour < 10) return { mood: 'happy', pose: 'wave', line: `早上好呀，${myName}～今天第一顿想吃点儿什么呢？` };
  if (hour < 14) return { mood: 'normal', pose: 'talk', line: `到饭点儿啦，${myName} 和 ${partnerName} 中午都要好好吃饭呀～` };
  if (hour < 18) return { mood: 'side-eye', pose: 'judge', line: `下午啦，今天还没人来报到呢。你们不会偷偷饿着肚子吧？` };
  if (hour < 22) return { mood: 'normal', pose: 'talk', line: `晚上好呀～忙完也要吃点儿热乎的，别让肚子等太久啦。` };
  return { mood: 'normal', pose: 'sit', line: `夜深啦，今天没记也没关系呀。${myName} 和 ${partnerName} 都早点儿休息吧～` };
}

export function TodayScreen({ meals, couple, profiles = [], currentUserId, unreadCount = 0, onMealPress, onOpenActivity, onNudge }: { meals: Meal[]; couple?: CoupleRecord; profiles?: ProfileRecord[]; currentUserId?: string; unreadCount?: number; onMealPress: (meal: Meal) => void; onOpenActivity?: () => void; onNudge: () => void }) {
  const todayMeals = meals.filter((meal) => sameLocalDay(meal.eatenAt));
  const first = profiles.find((profile) => profile.id === couple?.member_a) ?? { id: couple?.member_a || 'demo-a', nickname: couple ? '加载中…' : '阿屿', avatar_url: null };
  const second = profiles.find((profile) => profile.id === couple?.member_b) ?? { id: couple?.member_b || 'demo-b', nickname: couple ? '加载中…' : '小晴', avatar_url: null };
  const today = new Date();
  const formattedDate = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short' }).format(today);
  const togetherDays = daysTogether(couple?.anniversary);
  const stats = [first, second].map((profile) => {
    const mine = todayMeals.filter((meal) => meal.authorId ? meal.authorId === profile.id : meal.author === profile.nickname);
    return {
      name: profile.nickname,
      avatarUrl: profile.avatar_url,
      count: mine.length,
      calories: mine.reduce((sum, meal) => sum + (meal.calories ?? 0), 0),
      price: mine.reduce((sum, meal) => sum + (meal.price ?? 0), 0),
    };
  });
  const firstStats = stats[0]!;
  const secondStats = stats[1]!;
  const myProfile = profiles.find((profile) => profile.id === currentUserId);
  const partnerProfile = profiles.find((profile) => profile.id !== currentUserId);
  const myMealCount = todayMeals.filter((meal) => meal.authorId === currentUserId).length;
  const partnerMealCount = todayMeals.filter((meal) => meal.authorId === partnerProfile?.id).length;
  const streak = togetherStreak(meals, [couple?.member_a, couple?.member_b].filter(Boolean) as string[]);
  const pet = petState({
    coupled: Boolean(couple),
    profilesReady: Boolean(myProfile && partnerProfile),
    myName: myProfile?.nickname || '你',
    partnerName: partnerProfile?.nickname || 'TA',
    myMealCount,
    partnerMealCount,
    ateTogether: todayMeals.some((meal) => meal.together),
    streak,
    hour: today.getHours(),
  });
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.coupleHeader}>
        <View style={styles.avatars}><Avatar name={first.nickname} tone="blue" size={40} uri={first.avatar_url} /><Avatar name={second.nickname} tone="pink" size={40} uri={second.avatar_url} /></View>
        <View style={styles.coupleText}><Text style={styles.names}>{first.nickname}  ♥  {second.nickname}</Text><Text style={styles.days}>{togetherDays ? `Together ${togetherDays} Days` : '去「我的」设置恋爱纪念日呀'}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={`消息${unreadCount ? `，${unreadCount} 条未读` : ''}`} onPress={onOpenActivity} style={styles.bell}>
          <Text style={styles.bellIcon}>✦</Text>
          {!!unreadCount && <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text></View>}
        </Pressable>
      </View>

      <View style={styles.petCard}>
        <Dog size={102} mood={pet.mood} pose={pet.pose} speaking />
        <View style={styles.petCopy}>
          <Text style={styles.petName}>{couple?.pet_name || '豆包'} · Lv.{Math.max(1, Math.floor(meals.length / 10) + 1)}</Text>
          <Text style={styles.petLine}>“{pet.line}”</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>今天</Text><Text style={styles.date}>{formattedDate}</Text></View>
      <View style={styles.statsRow}>
        <StatCard tone="blue" name={firstStats.name} avatarUrl={firstStats.avatarUrl} summary={`${firstStats.count} 次`} meta={`${firstStats.calories ? `≈${firstStats.calories} kcal` : '暂无热量'} · ¥${firstStats.price.toFixed(0)}`} />
        <StatCard tone="pink" name={secondStats.name} avatarUrl={secondStats.avatarUrl} summary={`${secondStats.count} 次`} meta={`${secondStats.calories ? `≈${secondStats.calories} kcal` : '暂无热量'} · ¥${secondStats.price.toFixed(0)}`} />
      </View>
      <View style={styles.streakRow}>
        <View><Text style={styles.streakTop}>🔥 Together Streak</Text><Text style={styles.streak}>{streak} days</Text></View>
        <Pressable onPress={onNudge} style={styles.nudge}><Text style={styles.nudgeText}>🍚 催 TA 吃饭</Text></Pressable>
      </View>

      <View style={[styles.sectionHeader, { marginTop: 26 }]}><Text style={styles.sectionTitle}>今天的我们</Text><Text style={styles.count}>{todayMeals.length} 条记录</Text></View>
      {todayMeals.length ? todayMeals.map((meal) => <MealCard key={meal.id} meal={meal} onPress={() => onMealPress(meal)} />) : <View style={styles.emptyCard}><Text style={styles.emptyTitle}>今天还没有记录呀</Text><Text style={styles.emptyText}>点下面的＋，把第一顿放进你们的时间线。</Text></View>}
    </ScrollView>
  );
}

function StatCard({ tone, name, avatarUrl, summary, meta }: { tone: 'blue' | 'pink'; name: string; avatarUrl?: string | null; summary: string; meta: string }) {
  return (
    <View style={[styles.stat, { backgroundColor: tone === 'blue' ? colors.blue : colors.pink }]}>
      <View style={styles.statName}><Avatar name={name} tone={tone} size={27} uri={avatarUrl} /><Text style={styles.statNameText}>{name}</Text></View>
      <Text style={styles.statMain}>🍽 {summary}</Text>
      <Text style={styles.statMeta}>{meta}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.cream },
  content: { paddingTop: 55, paddingHorizontal: 16, paddingBottom: 108 },
  coupleHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatars: { flexDirection: 'row' },
  coupleText: { flex: 1, marginLeft: 11 },
  names: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  days: { color: colors.muted, fontSize: 11, marginTop: 2 },
  bell: { width: 37, height: 37, borderRadius: 13, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  bellIcon: { color: colors.brown, fontSize: 19, fontWeight: '900' },
  badge: { position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: colors.pinkStrong, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.cream },
  badgeText: { color: colors.white, fontSize: 8, fontWeight: '900' },
  petCard: { backgroundColor: colors.yellowSoft, borderRadius: 26, padding: 13, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#EDD892' },
  petCopy: { flex: 1, marginLeft: 8 },
  petName: { color: colors.brown, fontSize: 13, fontWeight: '900' },
  petLine: { color: colors.ink, fontSize: 14, lineHeight: 21, fontWeight: '700', marginTop: 5 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 24, marginBottom: 12 },
  sectionTitle: { color: colors.ink, fontSize: 22, fontWeight: '900', flex: 1 },
  date: { color: colors.muted, fontSize: 11 },
  count: { color: colors.muted, fontSize: 11 },
  statsRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, borderRadius: 21, padding: 13 },
  statName: { flexDirection: 'row', alignItems: 'center' },
  statNameText: { marginLeft: 7, fontSize: 12, fontWeight: '800', color: colors.ink },
  statMain: { fontSize: 17, fontWeight: '900', color: colors.ink, marginTop: 12 },
  statMeta: { fontSize: 10, color: colors.muted, marginTop: 4 },
  streakRow: { backgroundColor: colors.paper, borderRadius: 20, borderWidth: 1, borderColor: colors.line, marginTop: 10, padding: 13, flexDirection: 'row', alignItems: 'center' },
  streakTop: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  streak: { color: colors.ink, fontSize: 17, fontWeight: '900', marginTop: 2 },
  nudge: { marginLeft: 'auto', backgroundColor: colors.yellow, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 10 },
  nudgeText: { color: colors.brown, fontWeight: '900', fontSize: 12 },
  emptyCard: { backgroundColor: colors.paper, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 18, alignItems: 'center' },
  emptyTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  emptyText: { color: colors.muted, fontSize: 10, marginTop: 5 },
});
