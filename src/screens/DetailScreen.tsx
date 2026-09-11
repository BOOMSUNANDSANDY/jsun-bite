import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { PhotoPlaceholder } from '../components/PhotoPlaceholder';
import { allReactions } from '../data/mock';
import { Comment, Meal, Reaction } from '../data/types';
import { colors } from '../theme';

type DetailProps = {
  meal: Meal;
  currentUserId?: string;
  currentUserName?: string;
  currentUserTone?: 'blue' | 'pink';
  onBack: () => void;
  onUpdate: (meal: Meal) => void;
  canManage?: boolean;
  onEdit?: () => void;
  onDelete?: () => Promise<void>;
  onToggleReaction?: (reaction: Reaction, active: boolean) => Promise<Meal>;
  onSendComment?: (body: string) => Promise<Meal>;
  onDeleteComment?: (commentId: string) => Promise<Meal>;
};

export function DetailScreen({
  meal,
  currentUserId,
  currentUserName = '小晴',
  currentUserTone = 'pink',
  onBack,
  onUpdate,
  canManage = false,
  onEdit,
  onDelete,
  onToggleReaction,
  onSendComment,
  onDeleteComment,
}: DetailProps) {
  const [showAll, setShowAll] = useState(false);
  const [comment, setComment] = useState('');
  const [busyReaction, setBusyReaction] = useState<string | null>(null);
  const [sendingComment, setSendingComment] = useState(false);
  const [interactionError, setInteractionError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingCommentDelete, setPendingCommentDelete] = useState<string | null>(null);
  const [deletingComment, setDeletingComment] = useState(false);

  const isMyReaction = (item: Reaction) => item.emoji && (
    currentUserId ? item.userId === currentUserId : !item.userId || item.author === currentUserName
  );
  const hasMyReaction = (emoji: string) => meal.reactions.some((item) => item.emoji === emoji && isMyReaction(item));

  const toggleReaction = async (reaction: Reaction) => {
    const exists = hasMyReaction(reaction.emoji);
    setInteractionError(null);

    if (!onToggleReaction) {
      const ownReaction: Reaction = { ...reaction, userId: currentUserId, author: currentUserName, tone: currentUserTone };
      onUpdate({
        ...meal,
        reactions: exists
          ? meal.reactions.filter((item) => !(item.emoji === reaction.emoji && isMyReaction(item)))
          : [...meal.reactions, ownReaction],
      });
      return;
    }

    setBusyReaction(reaction.emoji);
    try {
      onUpdate(await onToggleReaction(reaction, !exists));
    } catch (caught) {
      setInteractionError(caught instanceof Error ? caught.message : '这个反应没送出去，再点一次试试呀。');
    } finally {
      setBusyReaction(null);
    }
  };
  const sendComment = async () => {
    const body = comment.trim();
    if (!body || sendingComment) return;
    setInteractionError(null);

    if (!onSendComment) {
      const next: Comment = { id: `comment-${Date.now()}`, userId: currentUserId, author: currentUserName, tone: currentUserTone, text: body, time: '刚刚' };
      onUpdate({ ...meal, comments: [...meal.comments, next] });
      setComment('');
      return;
    }

    setSendingComment(true);
    try {
      onUpdate(await onSendComment(body));
      setComment('');
    } catch (caught) {
      setInteractionError(caught instanceof Error ? caught.message : '这句还没发出去，再试一下儿呀。');
    } finally {
      setSendingComment(false);
    }
  };

  const reactionAuthors = [...new Set(meal.reactions.map((item) => item.author).filter(Boolean))];
  const firstReaction = meal.reactions[0];

  const removeComment = async (commentId: string) => {
    if (!onDeleteComment || deletingComment) return;
    setDeletingComment(true);
    setInteractionError(null);
    try {
      onUpdate(await onDeleteComment(commentId));
      setPendingCommentDelete(null);
    } catch (caught) {
      setInteractionError(caught instanceof Error ? caught.message : '评论没有删掉，再试一下儿呀。');
    } finally {
      setDeletingComment(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topbar}><Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><Text style={styles.topTitle}>这一顿</Text>{canManage ? <Pressable onPress={onEdit} style={styles.edit}><Text style={styles.editText}>编辑</Text></Pressable> : <View style={{ width: 46 }} />}</View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.authorRow}><Avatar name={meal.author} tone={meal.tone} size={45} /><View style={{ marginLeft: 10 }}><Text style={styles.author}>{meal.author}</Text><Text style={styles.meta}>今天 {meal.time} · {meal.type}</Text></View>{meal.together && <View style={styles.together}><Text style={styles.togetherText}>♥ 一起吃</Text></View>}</View>
        <PhotoPlaceholder tone={meal.photoTone} height={276} uri={meal.photoUris?.[0]} />
        {!!meal.photoUris?.[1] && <View style={styles.secondPhoto}><PhotoPlaceholder tone={meal.photoTone} height={180} uri={meal.photoUris[1]} /></View>}
        <Text style={styles.mealTitle}>{meal.title}</Text>
        <Text style={styles.mealMeta}>{meal.calories ? `🔥 ≈${meal.calories} kcal` : '未填写热量'}{meal.price ? `   ·   ¥${meal.price}` : ''}{meal.place ? `   ·   ${meal.place}` : ''}</Text>
        {!!meal.note && <Text style={styles.note}>{meal.note}</Text>}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>给个反应</Text>
          <View style={styles.quickRow}>
            {allReactions.slice(0, 2).map((reaction) => <ReactionButton key={reaction.emoji} reaction={reaction} active={hasMyReaction(reaction.emoji)} disabled={busyReaction !== null} onPress={() => void toggleReaction(reaction)} />)}
            <Pressable onPress={() => setShowAll(!showAll)} style={styles.reactionButton}><Text style={styles.reactionEmoji}>{showAll ? '−' : '＋'}</Text><Text style={styles.reactionLabel}>更多</Text></Pressable>
          </View>
          {showAll && <View style={styles.reactionGrid}>{allReactions.slice(2).map((reaction) => <ReactionButton key={reaction.emoji} reaction={reaction} active={hasMyReaction(reaction.emoji)} disabled={busyReaction !== null} onPress={() => void toggleReaction(reaction)} compact />)}</View>}
          {!!meal.reactions.length && <View style={styles.reactionSummary}><Avatar name={firstReaction?.author || '我们'} tone={firstReaction?.tone || 'pink'} size={27} /><Text style={styles.reactionWho}>{reactionAuthors.join('、') || '我们'}</Text><Text style={styles.reactionList}>{meal.reactions.map((item) => item.emoji).join('  ')}</Text></View>}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>评论 <Text style={styles.commentCount}>{meal.comments.length}</Text></Text>
          {meal.comments.length ? meal.comments.map((item) => <View key={item.id} style={styles.comment}><Avatar name={item.author} tone={item.tone || (item.author === '小晴' ? 'pink' : 'blue')} size={34} /><View style={styles.commentBubble}><View style={styles.commentHeader}><Text style={styles.commentAuthor}>{item.author}</Text><Text style={styles.commentTime}>{item.time}</Text>{currentUserId && item.userId === currentUserId && <Pressable disabled={deletingComment} onPress={() => pendingCommentDelete === item.id ? void removeComment(item.id) : setPendingCommentDelete(item.id)}><Text style={[styles.commentDelete, pendingCommentDelete === item.id && styles.commentDeleteConfirm]}>{pendingCommentDelete === item.id ? '确认删除' : '删除'}</Text></Pressable>}</View><Text style={styles.commentText}>{item.text}</Text>{pendingCommentDelete === item.id && <Pressable onPress={() => setPendingCommentDelete(null)}><Text style={styles.commentDeleteCancel}>取消</Text></Pressable>}</View></View>) : <Text style={styles.empty}>还没有评论，先损一句。</Text>}
          {!!interactionError && <Text style={styles.interactionError}>{interactionError}</Text>}
        </View>

        {canManage && <View style={styles.manageSection}>
          {!confirmDelete ? <Pressable onPress={() => setConfirmDelete(true)} style={styles.deleteButton}><Text style={styles.deleteButtonText}>删除这条记录</Text></Pressable> : <View><Text style={styles.deleteConfirmText}>确定删除吗？照片、Reaction 和评论也会一起删除。</Text><View style={styles.deleteActions}><Pressable disabled={deleting} onPress={() => setConfirmDelete(false)} style={styles.deleteCancel}><Text style={styles.deleteCancelText}>先不删</Text></Pressable><Pressable disabled={deleting} onPress={() => { if (!onDelete) return; setDeleting(true); setInteractionError(null); void onDelete().catch((caught) => { setInteractionError(caught instanceof Error ? caught.message : '没有删除成功，再试一下儿呀。'); setDeleting(false); }); }} style={styles.deleteConfirm}><Text style={styles.deleteConfirmButtonText}>{deleting ? '删除中…' : '确认删除'}</Text></Pressable></View></View>}
        </View>}
      </ScrollView>
      <View style={styles.composer}><Avatar name={currentUserName} tone={currentUserTone} size={34} /><TextInput editable={!sendingComment} maxLength={500} value={comment} onChangeText={setComment} placeholder="写点什么，文字和 Emoji 都可以…" placeholderTextColor={colors.muted} style={styles.commentInput} returnKeyType="send" onSubmitEditing={() => void sendComment()} /><Pressable disabled={sendingComment || !comment.trim()} onPress={() => void sendComment()} style={[styles.send, (sendingComment || !comment.trim()) && styles.sendDisabled]}><Text style={styles.sendText}>{sendingComment ? '…' : '↑'}</Text></Pressable></View>
    </KeyboardAvoidingView>
  );
}

function ReactionButton({ reaction, active, disabled, onPress, compact }: { reaction: Reaction; active: boolean; disabled?: boolean; onPress: () => void; compact?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.reactionButton, compact && styles.reactionCompact, active && styles.reactionActive, disabled && styles.reactionDisabled]}><Text style={styles.reactionEmoji}>{reaction.emoji}</Text>{!compact && <Text style={styles.reactionLabel}>{reaction.label}</Text>}</Pressable>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.cream, paddingTop: 48 },
  topbar: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  back: { width: 36, height: 36, borderRadius: 13, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.ink, fontSize: 30, lineHeight: 31 },
  topTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  edit: { minWidth: 46, height: 34, borderRadius: 12, backgroundColor: colors.yellowSoft, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  editText: { color: colors.brown, fontSize: 11, fontWeight: '900' },
  content: { padding: 16, paddingBottom: 105 },
  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 13 },
  author: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  meta: { color: colors.muted, fontSize: 11, marginTop: 3 },
  together: { marginLeft: 'auto', backgroundColor: colors.pink, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  togetherText: { color: colors.pinkStrong, fontSize: 11, fontWeight: '900' },
  mealTitle: { color: colors.ink, fontSize: 24, fontWeight: '900', marginTop: 16 },
  secondPhoto: { marginTop: 10 },
  mealMeta: { color: colors.muted, fontSize: 12, marginTop: 7 },
  note: { color: colors.ink, fontSize: 14, lineHeight: 21, marginTop: 12 },
  section: { backgroundColor: colors.paper, borderRadius: 24, padding: 15, marginTop: 17, borderWidth: 1, borderColor: colors.line },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '900', marginBottom: 12 },
  quickRow: { flexDirection: 'row', gap: 9 },
  reactionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 9 },
  reactionButton: { flex: 1, minWidth: 74, height: 58, borderRadius: 16, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  reactionCompact: { flex: 0, minWidth: 48, width: 48, height: 43 },
  reactionActive: { backgroundColor: colors.yellowSoft, borderColor: colors.yellow },
  reactionDisabled: { opacity: 0.58 },
  reactionEmoji: { fontSize: 21, fontWeight: '800' },
  reactionLabel: { color: colors.muted, fontSize: 9, fontWeight: '700', marginTop: 2 },
  reactionSummary: { flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: colors.cream, borderRadius: 14, padding: 8 },
  reactionWho: { color: colors.muted, fontSize: 11, fontWeight: '800', marginLeft: 7 },
  reactionList: { color: colors.ink, fontSize: 15, marginLeft: 'auto' },
  commentCount: { color: colors.muted, fontSize: 12 },
  comment: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 13 },
  commentBubble: { flex: 1, marginLeft: 8, backgroundColor: colors.cream, borderRadius: 15, padding: 10 },
  commentHeader: { flexDirection: 'row', alignItems: 'center' },
  commentAuthor: { color: colors.ink, fontSize: 11, fontWeight: '900' },
  commentTime: { color: colors.muted, fontSize: 9, marginLeft: 'auto' },
  commentDelete: { color: colors.muted, fontSize: 9, fontWeight: '800', marginLeft: 9 },
  commentDeleteConfirm: { color: colors.danger },
  commentDeleteCancel: { color: colors.blueStrong, fontSize: 9, fontWeight: '800', marginTop: 7 },
  commentText: { color: colors.ink, fontSize: 13, lineHeight: 19, marginTop: 4 },
  empty: { color: colors.muted, fontSize: 12 },
  interactionError: { color: colors.danger, fontSize: 10, lineHeight: 15, marginTop: 7 },
  manageSection: { backgroundColor: colors.paper, borderRadius: 20, padding: 13, marginTop: 16, borderWidth: 1, borderColor: colors.line },
  deleteButton: { height: 44, borderRadius: 14, backgroundColor: '#FFF1EE', alignItems: 'center', justifyContent: 'center' },
  deleteButtonText: { color: colors.danger, fontSize: 12, fontWeight: '900' },
  deleteConfirmText: { color: colors.ink, fontSize: 11, lineHeight: 17 },
  deleteActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  deleteCancel: { flex: 1, height: 40, borderRadius: 12, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  deleteCancelText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  deleteConfirm: { flex: 1, height: 40, borderRadius: 12, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  deleteConfirmButtonText: { color: colors.white, fontSize: 11, fontWeight: '900' },
  composer: { position: 'absolute', bottom: 0, left: 0, right: 0, minHeight: 74, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: 13, paddingTop: 10, paddingBottom: 15, flexDirection: 'row', alignItems: 'center' },
  commentInput: { flex: 1, height: 43, backgroundColor: colors.cream, borderRadius: 16, marginLeft: 8, paddingHorizontal: 12, color: colors.ink, fontSize: 12 },
  send: { width: 37, height: 37, borderRadius: 14, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginLeft: 7 },
  sendDisabled: { opacity: 0.4 },
  sendText: { color: colors.white, fontSize: 18, fontWeight: '900' },
});
