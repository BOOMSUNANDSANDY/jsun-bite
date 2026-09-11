import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Dog } from '../components/Dog';
import { colors } from '../theme';

export function ResetPasswordScreen({ onSave, onCancel }: { onSave: (password: string) => Promise<void>; onCancel: () => Promise<void> | void }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (password.length < 8) return setError('新密码至少需要 8 位呀。');
    if (password !== confirmation) return setError('两次输入的新密码不一样呀。');
    setSaving(true);
    try {
      await onSave(password);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '新密码没有保存成功，再试一下儿呀。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Dog size={116} mood="happy" pose="wave" speaking />
        <Text style={styles.eyebrow}>找回账号</Text>
        <Text style={styles.title}>设置一个新密码吧</Text>
        <Text style={styles.subtitle}>保存成功后，会直接回到你们原来的情侣空间。</Text>
        <View style={styles.card}>
          <View style={styles.labelRow}><Text style={styles.label}>新密码</Text><Pressable onPress={() => setVisible((value) => !value)}><Text style={styles.show}>{visible ? '隐藏' : '显示'}</Text></Pressable></View>
          <TextInput value={password} onChangeText={setPassword} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} placeholder="至少 8 位" placeholderTextColor={colors.muted} style={styles.input} />
          <Text style={styles.label}>再次输入</Text>
          <TextInput value={confirmation} onChangeText={setConfirmation} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} placeholder="再输入一次新密码" placeholderTextColor={colors.muted} style={styles.input} />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Pressable disabled={saving} onPress={() => void save()} style={[styles.button, saving && styles.disabled]}>{saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>保存新密码</Text>}</Pressable>
          <Pressable disabled={saving} onPress={() => void onCancel()}><Text style={styles.cancel}>取消并返回登录</Text></Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  eyebrow: { color: colors.brown, fontSize: 12, fontWeight: '900', marginTop: 4 },
  title: { color: colors.ink, fontSize: 25, fontWeight: '900', marginTop: 5 },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 7, marginBottom: 18 },
  card: { width: '100%', backgroundColor: colors.paper, borderRadius: 26, borderWidth: 1, borderColor: colors.line, padding: 18 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: colors.ink, fontSize: 11, fontWeight: '900', marginBottom: 7 },
  show: { color: colors.blueStrong, fontSize: 11, fontWeight: '900', marginBottom: 7 },
  input: { height: 50, borderRadius: 15, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.line, color: colors.ink, paddingHorizontal: 14, marginBottom: 15 },
  error: { color: colors.danger, fontSize: 11, lineHeight: 17, textAlign: 'center', marginBottom: 9 },
  button: { height: 52, borderRadius: 17, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: colors.white, fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.65 },
  cancel: { color: colors.muted, fontSize: 11, fontWeight: '800', textAlign: 'center', marginTop: 14 },
});
