import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Meal } from '../data/types';
import { colors, shadow } from '../theme';
import { Avatar } from './Avatar';
import { PhotoPlaceholder } from './PhotoPlaceholder';

export function MealCard({ meal, onPress }: { meal: Meal; onPress: () => void }) {
  const reactionAuthors = [...new Set(meal.reactions.map((item) => item.author).filter(Boolean))];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.88 }]}>
      <View style={styles.header}>
        <Avatar name={meal.author} tone={meal.tone} />
        <View style={styles.grow}>
          <Text style={styles.author}>{meal.author}</Text>
          <Text style={styles.meta}>{meal.time} · {meal.type}{meal.together ? ' · ❤️ 一起吃' : ''}</Text>
        </View>
        <Text style={styles.more}>•••</Text>
      </View>
      <PhotoPlaceholder tone={meal.photoTone} uri={meal.photoUris?.[0]} />
      <Text style={styles.title}>{meal.title}</Text>
      <Text style={styles.details}>
        {meal.calories ? `🔥 ≈${meal.calories} kcal` : '未填写热量'}{meal.price ? `   ·   ¥${meal.price}` : ''}
      </Text>
      {!!meal.reactions.length && <Text style={styles.reactions}><Text style={styles.reactionName}>{reactionAuthors.join('、') || 'TA'}：</Text>{meal.reactions.map((item) => item.emoji).join('  ')}</Text>}
      <View style={styles.actions}>
        <Text style={styles.action}>♡ 反应</Text>
        <Text style={styles.action}>◌ {meal.comments.length ? `${meal.comments.length} 条评论` : '评论'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.paper, borderRadius: 26, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: colors.line, ...shadow },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  grow: { flex: 1, marginLeft: 10 },
  author: { fontSize: 15, fontWeight: '800', color: colors.ink },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  more: { color: colors.muted, letterSpacing: 2 },
  title: { fontSize: 18, fontWeight: '800', color: colors.ink, marginTop: 13 },
  details: { fontSize: 13, color: colors.muted, marginTop: 5 },
  reactions: { marginTop: 12, fontSize: 15, backgroundColor: colors.cream, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 14, overflow: 'hidden' },
  reactionName: { fontSize: 12, fontWeight: '800', color: colors.muted },
  actions: { flexDirection: 'row', gap: 22, paddingTop: 12 },
  action: { fontSize: 13, color: colors.ink, fontWeight: '700' },
});
