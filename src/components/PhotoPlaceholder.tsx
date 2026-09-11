import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

const palette = {
  noodle: ['#E6A45D', '#F7D391'],
  toast: ['#B8D5A5', '#E7BE73'],
  drink: ['#D9B386', '#F5E3C4'],
  hotpot: ['#D8765A', '#F4C57F'],
};

export function PhotoPlaceholder({ tone, height = 174, uri }: { tone: keyof typeof palette; height?: number; uri?: string }) {
  const [base, accent] = palette[tone];
  if (uri) return <Image source={{ uri }} resizeMode="cover" style={[styles.photo, { height }]} accessibilityLabel="饮食记录照片" />;
  return (
    <View style={[styles.photo, { height, backgroundColor: accent }]}>
      <View style={[styles.plate, { backgroundColor: base }]}>
        <View style={styles.foodOne} />
        <View style={styles.foodTwo} />
        <View style={styles.foodThree} />
      </View>
      <Text style={styles.label}>低保真照片</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  plate: { width: 116, height: 116, borderRadius: 58, borderWidth: 9, borderColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] },
  foodOne: { width: 57, height: 15, borderRadius: 9, backgroundColor: '#FFF0B7', transform: [{ rotate: '14deg' }] },
  foodTwo: { width: 42, height: 17, borderRadius: 9, backgroundColor: '#D76745', marginTop: -2, transform: [{ rotate: '-18deg' }] },
  foodThree: { width: 35, height: 12, borderRadius: 8, backgroundColor: '#7DA66A', marginTop: 1 },
  label: { position: 'absolute', bottom: 10, right: 12, fontSize: 11, color: colors.brown, opacity: 0.6, fontWeight: '700' },
});
