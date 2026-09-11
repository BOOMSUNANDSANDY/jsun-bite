import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { Dog } from '../components/Dog';
import { CoupleRecord, ProfileRecord } from '../data/cloudTypes';
import { colors } from '../theme';

type SettingsInput = {
  nickname: string;
  petName: string;
  anniversary: string | null;
};

export function SettingsScreen({
  couple,
  profiles,
  currentUserId,
  email,
  onSave,
  onChangeAvatar,
  onRemoveAvatar,
  onChangePassword,
  onSignOut,
  demoMode = false,
  onExitDemo,
}: {
  couple: CoupleRecord;
  profiles: ProfileRecord[];
  currentUserId: string;
  email?: string;
  onSave: (input: SettingsInput) => Promise<void>;
  onChangeAvatar: () => Promise<boolean>;
  onRemoveAvatar: () => Promise<void>;
  onChangePassword: (password: string) => Promise<void>;
  onSignOut: () => Promise<void>;
  demoMode?: boolean;
  onExitDemo?: () => void;
}) {
  const me = useMemo(() => profiles.find((profile) => profile.id === currentUserId), [profiles, currentUserId]);
  const partner = useMemo(() => profiles.find((profile) => profile.id !== currentUserId), [profiles, currentUserId]);
  const [nickname, setNickname] = useState(me?.nickname ?? '');
  const [petName, setPetName] = useState(couple.pet_name);
  const [anniversary, setAnniversary] = useState(couple.anniversary ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [avatarWorking, setAvatarWorking] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);

  useEffect(() => setNickname(me?.nickname ?? ''), [me?.nickname]);
  useEffect(() => setPetName(couple.pet_name), [couple.pet_name]);
  useEffect(() => setAnniversary(couple.anniversary ?? ''), [couple.anniversary]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setMessage(null);
    try {
      if (anniversary && !/^\d{4}-\d{2}-\d{2}$/.test(anniversary)) throw new Error('纪念日请按 YYYY-MM-DD 填写呀。');
      await onSave({ nickname, petName, anniversary: anniversary || null });
      setMessage('保存好啦，两个人都会看到新设置呀～');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : '刚刚没有保存成功，再试一下儿呀。');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    setPasswordMessage(null);
    if (newPassword.length < 8) return setPasswordMessage('新密码至少需要 8 位呀。');
    if (newPassword !== confirmPassword) return setPasswordMessage('两次输入的新密码不一样呀。');
    setSavingPassword(true);
    try {
      await onChangePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
      setPasswordMessage('密码已经修改好啦。');
    } catch (caught) {
      setPasswordMessage(caught instanceof Error ? caught.message : '密码没有修改成功，再试一下儿呀。');
    } finally {
      setSavingPassword(false);
    }
  };

  const changeAvatar = async () => {
    if (avatarWorking) return;
    setAvatarWorking(true);
    setAvatarMessage(null);
    try {
      const changed = await onChangeAvatar();
      if (changed) setAvatarMessage('头像换好啦，TA 很快就能看到呀～');
    } catch (caught) {
      setAvatarMessage(caught instanceof Error ? caught.message : '头像没有保存成功，再试一下儿呀。');
    } finally {
      setAvatarWorking(false);
    }
  };

  const removeAvatar = async () => {
    if (avatarWorking) return;
    setAvatarWorking(true);
    setAvatarMessage(null);
    try {
      await onRemoveAvatar();
      setAvatarMessage('头像已经移除啦，现在显示名字首字母。');
    } catch (caught) {
      setAvatarMessage(caught instanceof Error ? caught.message : '头像没有移除成功，再试一下儿呀。');
    } finally {
      setAvatarWorking(false);
    }
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>我的</Text>
      <Text style={styles.title}>设置你们的小空间</Text>
      <Text style={styles.subtitle}>名字、纪念日和豆包的称呼，都可以慢慢改呀。</Text>

      <View style={styles.profileCard}>
        <Avatar name={me?.nickname || '我'} tone="blue" size={54} uri={me?.avatar_url} />
        <View style={styles.profileCopy}><Text style={styles.profileName}>{me?.nickname || '我'}</Text><Text style={styles.profileMeta}>{demoMode ? `与 ${partner?.nickname || 'TA'} 的公开体验空间 · 不连接真实账号` : `已和 ${partner?.nickname || 'TA'} 绑定 · 云端已连接`}</Text></View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>个人资料</Text>
        <View style={styles.avatarEditor}>
          <Avatar name={me?.nickname || '我'} tone="blue" size={64} uri={me?.avatar_url} />
          <View style={styles.avatarActions}>
            <Pressable disabled={avatarWorking} onPress={() => void changeAvatar()} style={styles.avatarPrimary}><Text style={styles.avatarPrimaryText}>{avatarWorking ? '处理中…' : me?.avatar_url ? '更换头像' : '选择头像'}</Text></Pressable>
            {!!me?.avatar_url && <Pressable disabled={avatarWorking} onPress={() => void removeAvatar()} style={styles.avatarRemove}><Text style={styles.avatarRemoveText}>移除</Text></Pressable>}
          </View>
        </View>
        {!!avatarMessage && <Text style={[styles.avatarMessage, /换好|移除/.test(avatarMessage) && styles.success]}>{avatarMessage}</Text>}
        <Field label="我的昵称" value={nickname} onChangeText={setNickname} placeholder="怎么称呼你" maxLength={20} />
        <View style={styles.readonlyRow}><Text style={styles.readonlyLabel}>伴侣昵称</Text><Text style={styles.readonlyValue}>{partner?.nickname || '等待 TA 设置'}</Text></View>
        <Text style={styles.hint}>{demoMode ? '体验版的修改只在本次浏览期间生效。' : '伴侣的昵称由 TA 在自己的手机上修改。'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>情侣空间</Text>
        <Field label="宠物名字" value={petName} onChangeText={setPetName} placeholder="豆包" maxLength={12} />
        <Field label="恋爱纪念日" value={anniversary} onChangeText={setAnniversary} placeholder="YYYY-MM-DD，可留空" />
        <View style={styles.readonlyRow}><Text style={styles.readonlyLabel}>匹配对象</Text><Text style={styles.readonlyValue}>{partner?.nickname || 'TA'}</Text></View>
        <View style={styles.readonlyRow}><Text style={styles.readonlyLabel}>匹配时的邀请码</Text><Text selectable style={styles.invite}>{couple.invite_code}</Text></View>
        <Text style={styles.hint}>{demoMode ? '这是虚构的演示邀请码，不能用于真实绑定。' : '绑定成功后这是你们共同的空间码，TA 原来未使用的邀请码已经失效，也不能再绑定第三个人。'}</Text>
      </View>

      <View style={styles.petCard}><Dog size={78} mood="happy" pose="wave" speaking /><Text style={styles.petText}>“改好以后，我就用新名字陪你们记饭饭啦～”</Text></View>

      {!!message && <Text style={[styles.message, /成功|保存好/.test(message) && styles.success]}>{message}</Text>}
      <Pressable disabled={saving} onPress={() => void save()} style={[styles.primary, saving && styles.disabled]}>
        {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>保存设置</Text>}
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>账号与应用</Text>
        <View style={styles.readonlyRow}><Text style={styles.readonlyLabel}>登录状态</Text><Text style={styles.email} numberOfLines={1}>{demoMode ? '无需登录 · 公开体验' : email || '未获取到邮箱'}</Text></View>
        <View style={styles.readonlyRow}><Text style={styles.readonlyLabel}>照片空间</Text><Text style={styles.status}>{demoMode ? '仅本页预览 · 不上传' : '私有 · 仅你们可见'}</Text></View>
        <View style={styles.readonlyRow}><Text style={styles.readonlyLabel}>版本</Text><Text style={styles.readonlyValue}>JSun Bite 0.1</Text></View>
        {!demoMode && (!showPasswordForm ? <Pressable onPress={() => { setShowPasswordForm(true); setPasswordMessage(null); }} style={styles.passwordButton}><Text style={styles.passwordButtonText}>修改密码</Text></Pressable> : <View style={styles.passwordBox}>
          <Field label="新密码" value={newPassword} onChangeText={setNewPassword} placeholder="至少 8 位" secure />
          <Field label="再次输入" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="再输入一次新密码" secure />
          <View style={styles.confirmActions}><Pressable disabled={savingPassword} onPress={() => { setShowPasswordForm(false); setNewPassword(''); setConfirmPassword(''); }} style={styles.cancel}><Text style={styles.cancelText}>取消</Text></Pressable><Pressable disabled={savingPassword} onPress={() => void changePassword()} style={styles.confirm}><Text style={styles.confirmButtonText}>{savingPassword ? '保存中…' : '保存新密码'}</Text></Pressable></View>
        </View>)}
        {!demoMode && !!passwordMessage && <Text style={[styles.passwordMessage, passwordMessage.includes('修改好') && styles.success]}>{passwordMessage}</Text>}
        {demoMode ? (
          <Pressable onPress={onExitDemo} style={styles.passwordButton}><Text style={styles.passwordButtonText}>退出体验版，前往正式登录</Text></Pressable>
        ) : !confirmSignOut ? (
          <Pressable onPress={() => setConfirmSignOut(true)} style={styles.signOut}><Text style={styles.signOutText}>退出登录</Text></Pressable>
        ) : (
          <View style={styles.confirmBox}><Text style={styles.confirmText}>确定退出这台设备吗？云端记录不会删除。</Text><View style={styles.confirmActions}><Pressable onPress={() => setConfirmSignOut(false)} style={styles.cancel}><Text style={styles.cancelText}>取消</Text></Pressable><Pressable onPress={() => void onSignOut()} style={styles.confirm}><Text style={styles.confirmButtonText}>确认退出</Text></Pressable></View></View>
        )}
      </View>
    </ScrollView>
  );
}

function Field({ label, value, onChangeText, placeholder, maxLength, secure }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; maxLength?: number; secure?: boolean }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} maxLength={maxLength} secureTextEntry={secure} autoCapitalize="none" autoCorrect={false} placeholder={placeholder} placeholderTextColor={colors.muted} style={styles.input} /></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.cream },
  content: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 112 },
  eyebrow: { color: colors.brown, fontSize: 12, fontWeight: '900' },
  title: { color: colors.ink, fontSize: 26, fontWeight: '900', marginTop: 6 },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 7 },
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.blue, borderRadius: 24, padding: 15, marginTop: 20 },
  profileCopy: { flex: 1, marginLeft: 12 },
  profileName: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  profileMeta: { color: colors.muted, fontSize: 10, marginTop: 4 },
  avatarEditor: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cream, borderRadius: 18, padding: 12, marginBottom: 14 },
  avatarActions: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 13, gap: 8 },
  avatarPrimary: { minHeight: 38, borderRadius: 12, backgroundColor: colors.ink, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  avatarPrimaryText: { color: colors.white, fontSize: 11, fontWeight: '900' },
  avatarRemove: { minHeight: 38, borderRadius: 12, backgroundColor: colors.paper, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  avatarRemoveText: { color: colors.danger, fontSize: 10, fontWeight: '800' },
  avatarMessage: { color: colors.danger, fontSize: 10, lineHeight: 16, marginTop: -7, marginBottom: 12 },
  card: { backgroundColor: colors.paper, borderRadius: 24, padding: 16, borderWidth: 1, borderColor: colors.line, marginTop: 14 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '900', marginBottom: 13 },
  field: { marginBottom: 14 },
  label: { color: colors.ink, fontSize: 11, fontWeight: '900', marginBottom: 7 },
  input: { height: 48, backgroundColor: colors.cream, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 13, color: colors.ink, fontSize: 14, fontWeight: '700' },
  readonlyRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.line },
  readonlyLabel: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  readonlyValue: { marginLeft: 'auto', color: colors.ink, fontSize: 12, fontWeight: '800' },
  invite: { marginLeft: 'auto', color: colors.brown, fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  status: { marginLeft: 'auto', color: colors.blueStrong, fontSize: 11, fontWeight: '900' },
  email: { flex: 1, marginLeft: 16, color: colors.ink, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  hint: { color: colors.muted, fontSize: 9, marginTop: 6 },
  petCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.yellowSoft, borderRadius: 22, padding: 10, marginTop: 14 },
  petText: { flex: 1, color: colors.ink, fontSize: 12, lineHeight: 19, fontWeight: '700', marginLeft: 7 },
  message: { color: colors.danger, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 12 },
  success: { color: colors.blueStrong },
  primary: { height: 52, borderRadius: 17, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  primaryText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.65 },
  passwordButton: { height: 43, borderRadius: 14, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  passwordButtonText: { color: colors.brown, fontSize: 11, fontWeight: '900' },
  passwordBox: { backgroundColor: colors.cream, borderRadius: 16, padding: 12, marginTop: 10 },
  passwordMessage: { color: colors.danger, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 9 },
  signOut: { height: 46, borderRadius: 14, backgroundColor: '#FFF1EE', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  signOutText: { color: colors.danger, fontSize: 12, fontWeight: '900' },
  confirmBox: { backgroundColor: '#FFF1EE', borderRadius: 15, padding: 12, marginTop: 10 },
  confirmText: { color: colors.ink, fontSize: 11, lineHeight: 17 },
  confirmActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  cancel: { flex: 1, height: 38, borderRadius: 12, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  confirm: { flex: 1, height: 38, borderRadius: 12, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  confirmButtonText: { color: colors.white, fontSize: 11, fontWeight: '900' },
});
