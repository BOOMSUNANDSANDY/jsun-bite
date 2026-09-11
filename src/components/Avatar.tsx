import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export function Avatar({ name, tone, size = 42, uri }: { name: string; tone: 'blue' | 'pink'; size?: number; uri?: string | null }) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [uri]);
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: tone === 'blue' ? colors.blue : colors.pink }]}>
      {uri && !imageFailed
        ? <Image source={{ uri }} onError={() => setImageFailed(true)} style={{ width: size, height: size, borderRadius: size / 2 }} />
        : <Text style={[styles.text, { fontSize: size * 0.34 }]}>{name.slice(0, 1)}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white, overflow: 'hidden' },
  text: { color: colors.ink, fontWeight: '800' },
});
