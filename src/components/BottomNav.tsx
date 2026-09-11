import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, shadow } from '../theme';

export type MainTab = 'today' | 'memories' | 'settings';

export function BottomNav({ active, onChange, onAdd }: { active: MainTab; onChange: (tab: MainTab) => void; onAdd: () => void }) {
  return (
    <View style={styles.nav}>
      <NavItem label="今天" icon="⌂" active={active === 'today'} onPress={() => onChange('today')} />
      <NavItem label="回忆" icon="▦" active={active === 'memories'} onPress={() => onChange('memories')} />
      <Pressable accessibilityRole="button" accessibilityLabel="新增饮食记录" onPress={onAdd} style={styles.add}>
        <Text style={styles.addText}>＋</Text>
      </Pressable>
      <NavItem label="我的" icon="◎" active={active === 'settings'} onPress={() => onChange('settings')} />
    </View>
  );
}

function NavItem({ label, icon, active, onPress }: { label: string; icon: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.item}>
      <Text style={[styles.icon, active && styles.active]}>{icon}</Text>
      <Text style={[styles.label, active && styles.active]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  nav: { position: 'absolute', left: 14, right: 14, bottom: 10, height: 70, borderRadius: 24, backgroundColor: colors.paper, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderWidth: 1, borderColor: colors.line, ...shadow },
  item: { flex: 1, alignItems: 'center', gap: 3 },
  icon: { fontSize: 22, color: colors.muted, fontWeight: '800' },
  label: { fontSize: 11, color: colors.muted, fontWeight: '700' },
  active: { color: colors.brown },
  add: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.brown, marginTop: -30 },
  addText: { fontSize: 32, lineHeight: 35, color: colors.brown, fontWeight: '500' },
});
