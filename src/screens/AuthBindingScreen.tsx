import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Dog } from '../components/Dog';
import { AuthInput, AuthOutcome } from '../data/cloudTypes';
import { colors } from '../theme';

type EntryMode = 'login' | 'bind';

type Props = {
  initialMode: EntryMode;
  inviteCode: string;
  cloudEnabled: boolean;
  onAuthenticate: (input: AuthInput) => Promise<AuthOutcome>;
  onResendConfirmation: (email: string) => Promise<void>;
  onRequestPasswordReset: (email: string) => Promise<void>;
  onAcceptInvite: (code: string) => Promise<void>;
  onCancelInvite: () => Promise<void>;
  onChangeAccount: () => Promise<void>;
  onDemo: () => void;
};

export function AuthBindingScreen({ initialMode, inviteCode, cloudEnabled, onAuthenticate, onResendConfirmation, onRequestPasswordReset, onAcceptInvite, onCancelInvite, onChangeAccount, onDemo }: Props) {
  const [mode, setMode] = useState<EntryMode>(initialMode);
  const [action, setAction] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState(cloudEnabled ? '' : 'wenchang@example.com');
  const [password, setPassword] = useState(cloudEnabled ? '' : 'demo-password');
  const [confirmPassword, setConfirmPassword] = useState(cloudEnabled ? '' : 'demo-password');
  const [showPassword, setShowPassword] = useState(false);
  const [nickname, setNickname] = useState(cloudEnabled ? '' : '阿屿');
  const [partnerCode, setPartnerCode] = useState(cloudEnabled ? '' : 'SUN826');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [confirmCancelInvite, setConfirmCancelInvite] = useState(false);

  useEffect(() => setMode(initialMode), [initialMode]);

  const submitAuth = async () => {
    setError(null);
    if (!email.includes('@') || password.length < 6) {
      setError('请检查邮箱，密码至少需要 6 位呀。');
      return;
    }
    if (action === 'register' && password !== confirmPassword) {
      setError('两次密码不一样呀，再确认一下儿。');
      return;
    }
    setWorking(true);
    try {
      const outcome = await onAuthenticate({ email, password, nickname, action });
      if (outcome === 'confirmation-required') {
        setConfirmationEmail(email.trim());
        setResent(false);
      } else {
        setMode('bind');
      }
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setWorking(false);
    }
  };

  const resendConfirmation = async () => {
    if (!confirmationEmail) return;
    setError(null);
    setWorking(true);
    try {
      await onResendConfirmation(confirmationEmail);
      setResent(true);
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setWorking(false);
    }
  };

  const sendPasswordReset = async () => {
    setError(null);
    setResetSent(false);
    if (!email.includes('@')) {
      setError('先把需要找回的邮箱填好呀。');
      return;
    }
    setWorking(true);
    try {
      await onRequestPasswordReset(email);
      setResetSent(true);
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setWorking(false);
    }
  };

  const submitCode = async () => {
    setError(null);
    if (partnerCode.trim().length !== 6) {
      setError('邀请码是 6 位的，再看一眼儿呀。');
      return;
    }
    setWorking(true);
    try {
      await onAcceptInvite(partnerCode);
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setWorking(false);
    }
  };

  const changeAccount = async () => {
    if (working) return;
    setWorking(true);
    setError(null);
    try {
      await onChangeAccount();
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setNickname('');
      setPartnerCode('');
      setAction('login');
      setMode('login');
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setWorking(false);
    }
  };

  const cancelInvite = async () => {
    if (!confirmCancelInvite) {
      setConfirmCancelInvite(true);
      setError(null);
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await onCancelInvite();
      setConfirmCancelInvite(false);
      setMode('login');
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setWorking(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}><Text style={styles.brandText}>J</Text></View>
            <Text style={styles.brand}>JSun Bite</Text>
            <View style={[styles.status, cloudEnabled ? styles.statusCloud : styles.statusDemo]}><View style={[styles.statusDot, { backgroundColor: cloudEnabled ? colors.blueStrong : colors.yellow }]} /><Text style={styles.statusText}>{cloudEnabled ? '云端已连接' : '演示模式'}</Text></View>
          </View>

          <View style={styles.hero}>
            <Dog size={mode === 'login' ? 118 : 108} mood="happy" pose="wave" speaking={mode === 'login'} />
            <Text style={styles.eyebrow}>{mode === 'login' ? (action === 'login' ? '欢迎回来' : '第一次见呀') : '只差一个人'}</Text>
            <Text style={styles.title}>{mode === 'login' ? (action === 'login' ? '今天也要好好吃饭。' : '先认识一下你。') : '把你们的日常连起来。'}</Text>
            <Text style={styles.subtitle}>{mode === 'login' ? '两个人的吃喝、互动和回忆，都放在这里。' : '把邀请码发给 TA，或者输入 TA 发来的邀请码。'}</Text>
          </View>

          <View style={styles.card}>
            {confirmationEmail ? (
              <>
                <View style={styles.successIcon}><Text style={styles.successIconText}>✓</Text></View>
                <Text style={styles.successTitle}>确认邮件已经发出啦</Text>
                <Text style={styles.successEmail}>{confirmationEmail}</Text>
                <Text style={styles.successText}>打开邮件里的确认链接后，再回到这里登录。链接最后显示空白或无法连接，也可能已经确认成功，可以直接回来试试呀。</Text>
                {resent && <View style={styles.successNotice}><Text style={styles.successNoticeText}>新邮件已经重新发送啦，请稍等一会儿。</Text></View>}
                {!!error && <ErrorMessage text={error} />}
                <PrimaryButton label="我已确认，去登录" onPress={() => { setConfirmationEmail(null); setAction('login'); setError(null); }} />
                <Pressable onPress={resendConfirmation} disabled={working}><Text style={styles.secondaryAction}>{working ? '正在重新发送…' : '没有收到？重新发送'}</Text></Pressable>
              </>
            ) : mode === 'login' ? (
              <>
                <View style={styles.actionTabs}>
                  <Pressable onPress={() => { setAction('login'); setError(null); }} style={[styles.actionTab, action === 'login' && styles.actionTabActive]}><Text style={[styles.actionTabText, action === 'login' && styles.actionTabTextActive]}>登录</Text></Pressable>
                  <Pressable onPress={() => { setAction('register'); setError(null); }} style={[styles.actionTab, action === 'register' && styles.actionTabActive]}><Text style={[styles.actionTabText, action === 'register' && styles.actionTabTextActive]}>注册</Text></Pressable>
                </View>
                {action === 'register' && <Field label="昵称" value={nickname} onChangeText={setNickname} placeholder="以后也可以修改" />}
                <Field label="邮箱" value={email} onChangeText={setEmail} keyboardType="email-address" />
                <Field label="密码" value={password} onChangeText={setPassword} secure={!showPassword} actionLabel={showPassword ? '隐藏' : '显示'} onAction={() => setShowPassword((current) => !current)} />
                {action === 'register' && <Field label="确认密码" value={confirmPassword} onChangeText={setConfirmPassword} secure={!showPassword} />}
                {resetSent && <View style={styles.successNotice}><Text style={styles.successNoticeText}>重置邮件已经发出啦。请在这台电脑上打开邮件链接，然后设置新密码。</Text></View>}
                {!!error && <ErrorMessage text={error} />}
                <PrimaryButton label={action === 'login' ? '登录' : '注册并继续'} onPress={submitAuth} loading={working} />
                <Text style={styles.hint}>{cloudEnabled ? '登录状态会安全保存在这台手机上。' : '还没有填写云端配置，点击后会进入可交互演示。'}</Text>
                {action === 'login' && <Pressable onPress={sendPasswordReset} disabled={working}><Text style={styles.forgotPassword}>{working ? '正在发送…' : '忘记密码'}</Text></Pressable>}
                {!cloudEnabled && <Pressable onPress={onDemo} disabled={working}><Text style={styles.demoEntry}>先进入体验版</Text></Pressable>}
              </>
            ) : (
              <>
                <Text style={styles.codeLabel}>我的邀请码</Text>
                <View style={styles.codeBox}><Text style={styles.code}>{inviteCode || 'BITE26'}</Text><Text style={styles.copy}>发给 TA</Text></View>
                <Text style={styles.waiting}>邀请码在完成绑定前一直有效，不需要反复生成。</Text>
                <View style={styles.divider}><View style={styles.line} /><Text style={styles.or}>或者</Text><View style={styles.line} /></View>
                <Text style={styles.inputLabel}>输入 TA 的邀请码</Text>
                <TextInput value={partnerCode} onChangeText={(value) => setPartnerCode(value.toUpperCase())} autoCapitalize="characters" maxLength={6} placeholder="6 位邀请码" placeholderTextColor={colors.muted} style={styles.codeInput} />
                {!!error && <ErrorMessage text={error} />}
                <PrimaryButton label="绑定并进入" onPress={submitCode} loading={working} />
                {cloudEnabled && confirmCancelInvite && <View style={styles.cancelNotice}><Text style={styles.cancelNoticeText}>旧邀请码会立即失效，你也会退出当前账号。已经绑定成功的空间不会在这里被删除。</Text></View>}
                {cloudEnabled && <Pressable onPress={() => void cancelInvite()} disabled={working} style={styles.cancelInviteButton}><Text style={styles.cancelInviteText}>{confirmCancelInvite ? '确认取消邀请码并退出' : '取消这个邀请码'}</Text></Pressable>}
                {cloudEnabled && <Pressable onPress={() => void changeAccount()} disabled={working} style={styles.changeAccountButton}><Text style={styles.changeAccountText}>退出并换一个账号</Text></Pressable>}
                {!cloudEnabled && <Pressable onPress={onDemo} disabled={working}><Text style={styles.demo}>进入演示数据</Text></Pressable>}
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function readableError(error: unknown) {
  const details = error && typeof error === 'object' ? error as { message?: unknown; code?: unknown; details?: unknown } : null;
  const message = error instanceof Error
    ? error.message
    : typeof details?.message === 'string'
      ? details.message
      : '';
  const code = typeof details?.code === 'string' ? details.code : '';

  if (message) {
    if (/invalid login credentials/i.test(message)) {
      return '这个邮箱和密码对不上呀。请确认使用的是刚才注册时填写的真实邮箱和同一组密码。';
    }
    if (/email not confirmed/i.test(message)) {
      return '邮箱还没有确认好呀，请先打开确认邮件里的链接。';
    }
    if (/user already registered/i.test(message)) {
      return '这个邮箱已经注册过啦，请切换到“登录”。';
    }
    if (/rate limit|too many requests|email rate/i.test(message)) {
      return '邮件发送得有点频繁呀，请稍等一分钟再试。';
    }
    if (/failed to fetch|load failed|network request failed|networkerror|连接检测失败/i.test(message)) {
      return '手机暂时没连上云端呀。请保持与电脑同一 Wi-Fi，关闭 VPN 或内容拦截后，再点一次。';
    }
    if (code === '23503' || /foreign key constraint/i.test(message)) {
      return '账号已经登录，但个人资料还没准备好呀。请刷新页面再登录一次。';
    }
    if (code === 'PGRST202' || /could not find the function/i.test(message)) {
      return '账号已经登录，但情侣绑定服务还没连接好。请把这句提示发给我呀。';
    }
    return code ? `${message}（${code}）` : message;
  }
  return '刚刚没有成功，再试一下儿呀。';
}

function Field({ label, value, onChangeText, secure, placeholder, keyboardType, actionLabel, onAction }: { label: string; value: string; onChangeText: (value: string) => void; secure?: boolean; placeholder?: string; keyboardType?: 'email-address'; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}><Text style={styles.inputLabel}>{label}</Text>{actionLabel && onAction && <Pressable onPress={onAction}><Text style={styles.fieldAction}>{actionLabel}</Text></Pressable>}</View>
      <TextInput value={value} onChangeText={onChangeText} secureTextEntry={secure} placeholder={placeholder} placeholderTextColor={colors.muted} keyboardType={keyboardType} style={styles.input} autoCapitalize="none" autoCorrect={false} />
    </View>
  );
}

function ErrorMessage({ text }: { text: string }) {
  return <View style={styles.errorBox}><Text style={styles.errorText}>{text}</Text></View>;
}

function PrimaryButton({ label, onPress, loading }: { label: string; onPress: () => void; loading?: boolean }) {
  return <Pressable disabled={loading} onPress={onPress} style={({ pressed }) => [styles.button, (pressed || loading) && { opacity: 0.7 }]}>{loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{label}</Text>}</Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  page: { flex: 1 },
  scroll: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 28 },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  brandMark: { width: 31, height: 31, borderRadius: 10, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.brown },
  brandText: { color: colors.brown, fontWeight: '900', fontSize: 17 },
  brand: { marginLeft: 9, fontSize: 17, fontWeight: '900', color: colors.ink, flex: 1 },
  status: { borderRadius: 14, paddingHorizontal: 9, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  statusCloud: { backgroundColor: '#EDF8FC', borderColor: colors.blue },
  statusDemo: { backgroundColor: colors.white, borderColor: colors.line },
  statusDot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  statusText: { color: colors.muted, fontSize: 9, fontWeight: '800' },
  hero: { alignItems: 'center', paddingTop: 17, paddingBottom: 16 },
  eyebrow: { color: colors.brown, fontSize: 13, fontWeight: '800', marginTop: 4 },
  title: { color: colors.ink, fontSize: 27, lineHeight: 34, fontWeight: '900', marginTop: 4, textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 6, textAlign: 'center', paddingHorizontal: 18 },
  card: { backgroundColor: colors.paper, borderRadius: 28, padding: 20, borderWidth: 1, borderColor: colors.line },
  actionTabs: { flexDirection: 'row', backgroundColor: colors.cream, padding: 4, borderRadius: 15, marginBottom: 16 },
  actionTab: { flex: 1, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionTabActive: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  actionTabText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  actionTabTextActive: { color: colors.ink },
  field: { marginBottom: 14 },
  fieldLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  inputLabel: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  fieldAction: { color: colors.blueStrong, fontSize: 11, fontWeight: '800' },
  input: { height: 50, borderRadius: 15, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 15, fontSize: 15, color: colors.ink },
  button: { height: 52, borderRadius: 17, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: '900' },
  hint: { textAlign: 'center', color: colors.muted, fontSize: 10, marginTop: 12, lineHeight: 16 },
  codeLabel: { textAlign: 'center', color: colors.muted, fontSize: 12, fontWeight: '700' },
  codeBox: { backgroundColor: colors.yellowSoft, borderRadius: 17, padding: 15, flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  code: { flex: 1, textAlign: 'center', color: colors.brown, fontSize: 24, fontWeight: '900', letterSpacing: 5 },
  copy: { color: colors.brown, fontSize: 10, fontWeight: '800' },
  waiting: { textAlign: 'center', color: colors.muted, fontSize: 9, marginTop: 8 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  line: { height: 1, backgroundColor: colors.line, flex: 1 },
  or: { color: colors.muted, fontSize: 11, marginHorizontal: 10 },
  codeInput: { height: 50, borderRadius: 15, borderWidth: 1.5, borderColor: colors.blueStrong, textAlign: 'center', letterSpacing: 5, fontSize: 18, fontWeight: '800', color: colors.ink, marginBottom: 8 },
  demo: { textAlign: 'center', color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 13 },
  changeAccountButton: { alignSelf: 'center', marginTop: 14, paddingVertical: 6, paddingHorizontal: 10 },
  changeAccountText: { textAlign: 'center', color: colors.blueStrong, fontSize: 12, fontWeight: '800' },
  cancelNotice: { marginTop: 12, backgroundColor: '#FFF0EE', borderRadius: 13, paddingHorizontal: 12, paddingVertical: 10 },
  cancelNoticeText: { color: colors.danger, fontSize: 10, lineHeight: 16, textAlign: 'center', fontWeight: '700' },
  cancelInviteButton: { alignSelf: 'center', marginTop: 12, paddingVertical: 6, paddingHorizontal: 10 },
  cancelInviteText: { textAlign: 'center', color: colors.danger, fontSize: 12, fontWeight: '800' },
  errorBox: { backgroundColor: '#FFF0EE', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 9, marginBottom: 8 },
  errorText: { color: colors.danger, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  successIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#EAF7EF', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  successIconText: { color: '#3D8A5B', fontSize: 24, fontWeight: '900' },
  successTitle: { color: colors.ink, fontSize: 19, fontWeight: '900', textAlign: 'center', marginTop: 12 },
  successEmail: { color: colors.brown, fontSize: 12, fontWeight: '800', textAlign: 'center', marginTop: 7 },
  successText: { color: colors.muted, fontSize: 12, lineHeight: 20, textAlign: 'center', marginTop: 12, marginBottom: 10 },
  successNotice: { backgroundColor: '#EAF7EF', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 9, marginBottom: 8 },
  successNoticeText: { color: '#3D8A5B', fontSize: 11, lineHeight: 16, fontWeight: '700', textAlign: 'center' },
  secondaryAction: { textAlign: 'center', color: colors.blueStrong, fontSize: 12, fontWeight: '800', marginTop: 14 },
  demoEntry: { textAlign: 'center', color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 10, textDecorationLine: 'underline' },
  forgotPassword: { textAlign: 'center', color: colors.blueStrong, fontSize: 11, fontWeight: '800', marginTop: 10 },
});
