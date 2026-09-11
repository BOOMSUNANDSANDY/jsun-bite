import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Dog } from '../components/Dog';
import { ActivityEvent } from '../data/activityTypes';
import { colors } from '../theme';

function relativeTime(value: string) {
  const date = new Date(value);
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return '刚刚';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} 小时前`;
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)} 天前`;
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(date);
}

function activityCopy(event: ActivityEvent) {
  if (event.type === 'meal') return { icon: '🍽', title: `${event.actorName} 记了一顿`, detail: event.body || '快去看看 TA 吃了什么呀～' };
  if (event.type === 'reaction') return { icon: '💛', title: `${event.actorName} 回应了你的记录`, detail: event.body || 'TA 给你留了一个反应呀～' };
  if (event.type === 'comment') return { icon: '💬', title: `${event.actorName} 评论了你的记录`, detail: event.body || '点进去看看 TA 说了什么呀～' };
  return { icon: '🍚', title: `${event.actorName} 来催你吃饭啦`, detail: event.body || '别让肚子等太久儿呀～' };
}

export function ActivityScreen({
  activities,
  loading,
  unavailable,
  onBack,
  onOpen,
  onMarkAllRead,
}: {
  activities: ActivityEvent[];
  loading: boolean;
  unavailable: boolean;
  onBack: () => void;
  onOpen: (event: ActivityEvent) => void;
  onMarkAllRead: () => void;
}) {
  const unreadCount = activities.filter((event) => !event.readAt).length;
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
        <View style={styles.heading}><Text style={styles.eyebrow}>你们的动态</Text><Text style={styles.title}>消息</Text></View>
        <Pressable disabled={!unreadCount} onPress={onMarkAllRead} style={styles.readAll}>
          <Text style={[styles.readAllText, !unreadCount && styles.disabledText]}>全部已读</Text>
        </Pressable>
      </View>

      {unavailable ? (
        <View style={styles.stateCard}>
          <Dog size={100} mood="normal" pose="talk" speaking />
          <Text style={styles.stateTitle}>消息中心还差最后一步呀</Text>
          <Text style={styles.stateText}>页面已经准备好啦。完成一次 Supabase 设置后，对方的新记录、Reaction、评论和催饭都会出现在这里。</Text>
        </View>
      ) : loading && !activities.length ? (
        <View style={styles.loading}><ActivityIndicator color={colors.brown} /><Text style={styles.loadingText}>豆包正在看看有没有新消息呀…</Text></View>
      ) : !activities.length ? (
        <View style={styles.stateCard}>
          <Dog size={100} mood="happy" pose="wave" speaking />
          <Text style={styles.stateTitle}>暂时没有新消息呀</Text>
          <Text style={styles.stateText}>TA 发布、回应或评论以后，豆包会把消息好好放在这里。</Text>
        </View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {!!unreadCount && <Text style={styles.summary}>{unreadCount} 条还没看</Text>}
          {activities.map((event) => {
            const copy = activityCopy(event);
            return (
              <Pressable key={event.id} onPress={() => onOpen(event)} style={[styles.item, !event.readAt && styles.unreadItem]}>
                <View style={styles.icon}><Text style={styles.iconText}>{copy.icon}</Text></View>
                <View style={styles.itemCopy}>
                  <Text style={styles.itemTitle}>{copy.title}</Text>
                  <Text style={styles.itemDetail} numberOfLines={2}>{copy.detail}</Text>
                  <Text style={styles.time}>{relativeTime(event.createdAt)}</Text>
                </View>
                {!event.readAt && <View style={styles.dot} />}
                {!!event.mealId && <Text style={styles.chevron}>›</Text>}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  header: { paddingTop: 24, paddingHorizontal: 18, paddingBottom: 16, flexDirection: 'row', alignItems: 'center' },
  back: { width: 42, height: 42, borderRadius: 15, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.ink, fontSize: 32, lineHeight: 33, marginTop: -3 },
  heading: { flex: 1, marginLeft: 13 },
  eyebrow: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  title: { color: colors.ink, fontSize: 25, fontWeight: '900', marginTop: 1 },
  readAll: { paddingVertical: 9, paddingLeft: 10 },
  readAllText: { color: colors.brown, fontSize: 12, fontWeight: '900' },
  disabledText: { color: colors.muted, opacity: 0.45 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 35 },
  summary: { color: colors.muted, fontSize: 11, fontWeight: '700', marginBottom: 9, marginLeft: 3 },
  item: { backgroundColor: colors.paper, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  unreadItem: { backgroundColor: colors.yellowSoft, borderColor: '#EDD892' },
  icon: { width: 43, height: 43, borderRadius: 15, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 21 },
  itemCopy: { flex: 1, marginLeft: 12 },
  itemTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  itemDetail: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 3 },
  time: { color: colors.muted, opacity: 0.8, fontSize: 9, marginTop: 5 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.pinkStrong, marginLeft: 8 },
  chevron: { color: colors.muted, fontSize: 24, marginLeft: 7 },
  stateCard: { marginHorizontal: 18, marginTop: 40, paddingHorizontal: 28, paddingVertical: 28, borderRadius: 26, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center' },
  stateTitle: { color: colors.ink, fontSize: 17, fontWeight: '900', marginTop: 8 },
  stateText: { color: colors.muted, fontSize: 12, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: colors.muted, fontSize: 11, marginTop: 10 },
});
