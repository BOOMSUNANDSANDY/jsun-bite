import { useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Dog } from '../components/Dog';
import { Meal, MealType } from '../data/types';
import { analyzeMealPhoto } from '../lib/mealAi';
import { pickPhotos, PreparedPhoto, takePhoto } from '../lib/photoPicker';
import { colors } from '../theme';

const mealTypes: MealType[] = ['早餐', '午餐', '晚餐', '零食', '饮料', '其他'];

type EditablePhoto = { uri: string; path?: string; prepared?: PreparedPhoto };

function defaultMealType(date: Date): MealType {
  const hour = date.getHours();
  if (hour >= 6 && hour < 10.5) return '早餐';
  if (hour >= 10.5 && hour < 14.5) return '午餐';
  if (hour >= 17 && hour < 21.5) return '晚餐';
  return '其他';
}

function datePart(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function timePart(value: Date) {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

export function AddMealScreen({ initialMeal, demoMode = false, onClose, onPublish }: { initialMeal?: Meal; demoMode?: boolean; onClose: () => void; onPublish: (meal: Meal) => Promise<void> | void }) {
  const initialDate = initialMeal?.eatenAt ? new Date(initialMeal.eatenAt) : new Date();
  const [title, setTitle] = useState(initialMeal?.title ?? '');
  const [calories, setCalories] = useState(initialMeal?.calories?.toString() ?? '');
  const [price, setPrice] = useState(initialMeal?.price?.toString() ?? '');
  const [type, setType] = useState<MealType>(initialMeal?.type ?? defaultMealType(initialDate));
  const [date, setDate] = useState(datePart(initialDate));
  const [time, setTime] = useState(timePart(initialDate));
  const [place, setPlace] = useState(initialMeal?.place ?? '');
  const [note, setNote] = useState(initialMeal?.note ?? '');
  const [together, setTogether] = useState(initialMeal?.together ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<EditablePhoto[]>(() => (initialMeal?.photoUris ?? []).map((uri, index) => ({ uri, path: initialMeal?.photoPaths?.[index] })));
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessage, setAiMessage] = useState('选好第一张食物照片后，我就能帮你认菜名、粗估热量啦。');

  const addFromLibrary = async () => {
    if (photos.length >= 2) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const selected = await pickPhotos(2 - photos.length);
      setPhotos((current) => [...current, ...selected.map((prepared) => ({ uri: prepared.uri, prepared }))].slice(0, 2));
    } catch (caught) {
      setPhotoError(caught instanceof Error ? caught.message : '照片没有选成功，再试一下儿呀。');
    } finally {
      setPhotoBusy(false);
    }
  };

  const addFromCamera = async () => {
    if (photos.length >= 2) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const selected = await takePhoto();
      if (selected) setPhotos((current) => [...current, { uri: selected.uri, prepared: selected }].slice(0, 2));
    } catch (caught) {
      setPhotoError(caught instanceof Error ? caught.message : '刚刚没拍成功，再试一下儿呀。');
    } finally {
      setPhotoBusy(false);
    }
  };

  const analyzePhoto = async () => {
    if (demoMode) {
      setAiMessage('体验版不会把你选择的照片发送到云端。登录正式账号后，就可以使用豆包识图啦～');
      return;
    }
    const firstPhoto = photos[0]?.prepared;
    if (!firstPhoto) {
      setPhotoError(photos[0]
        ? '这张是之前保存的照片。重新选择第一张，就可以让豆包识别啦。'
        : '先拍一张或选择一张食物照片呀。');
      return;
    }

    setAiBusy(true);
    setPhotoError(null);
    try {
      const result = await analyzeMealPhoto(firstPhoto);
      if (result.title) setTitle(result.title);
      if (result.calories !== undefined) setCalories(String(result.calories));
      setAiMessage(result.message);
    } catch (caught) {
      setAiMessage(caught instanceof Error ? caught.message : '豆包刚刚没看清，再试一次儿呀。');
    } finally {
      setAiBusy(false);
    }
  };

  const publish = async () => {
    setError(null);
    setSaving(true);
    try {
      const eatenAt = new Date(`${date.trim()}T${time.trim()}:00`);
      if (Number.isNaN(eatenAt.getTime())) throw new Error('日期或时间格式不对，按页面提示填写呀。');
      await onPublish({
        ...(initialMeal ?? {} as Meal),
        id: initialMeal?.id ?? `meal-${Date.now()}`,
        author: initialMeal?.author ?? '我', tone: initialMeal?.tone ?? 'blue', title: title.trim() || '未命名的一顿', type, time: time.trim(),
        eatenAt: eatenAt.toISOString(),
        calories: Number(calories.replace(/\D/g, '')) || undefined,
        price: Number(price) || undefined,
        place: place.trim() || undefined,
        note: note.trim() || undefined,
        together,
        photoTone: initialMeal?.photoTone ?? 'noodle',
        photoUris: photos.map((photo) => photo.uri),
        photoPaths: photos.flatMap((photo) => photo.path ? [photo.path] : []),
        localPhotos: photos.flatMap((photo) => photo.prepared ? [photo.prepared] : []),
        reactions: initialMeal?.reactions ?? [],
        comments: initialMeal?.comments ?? [],
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '这顿还没发布成功，再试一下儿呀。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topbar}><Pressable onPress={onClose}><Text style={styles.cancel}>取消</Text></Pressable><Text style={styles.title}>{initialMeal ? '修改这一顿' : '记录这一顿'}</Text><View style={{ width: 34 }} /></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.photoRow}>
          {[0, 1].map((index) => <View key={index} style={[styles.photoSlot, index === 0 ? styles.photoMain : styles.photoSecond]}>
            {photos[index] ? <><Image source={{ uri: photos[index].uri }} resizeMode="cover" style={styles.photoPreview} /><Pressable accessibilityLabel={`删除第 ${index + 1} 张照片`} onPress={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} style={styles.removePhoto}><Text style={styles.removePhotoText}>×</Text></Pressable><Text style={styles.photoBadge}>第 {index + 1} 张</Text></> : photoBusy ? <ActivityIndicator color={colors.blueStrong} /> : <><Text style={index === 0 ? styles.camera : styles.plus}>{index === 0 ? '⌁' : '＋'}</Text><Text style={styles.photoTitle}>{index === 0 ? '这一顿' : '一起吃 / 合照'}</Text><Text style={styles.photoHint}>{index === 0 ? '照片可以不填' : '最多 2 张'}</Text></>}
          </View>)}
        </View>
        <View style={styles.photoActions}>
          <Pressable disabled={photoBusy || photos.length >= 2} onPress={addFromCamera} style={[styles.photoAction, (photoBusy || photos.length >= 2) && styles.photoActionDisabled]}><Text style={styles.photoActionText}>📷 拍照</Text></Pressable>
          <Pressable disabled={photoBusy || photos.length >= 2} onPress={addFromLibrary} style={[styles.photoAction, (photoBusy || photos.length >= 2) && styles.photoActionDisabled]}><Text style={styles.photoActionText}>▣ 从相册选择</Text></Pressable>
          <Text style={styles.photoCount}>{photos.length} / 2</Text>
        </View>
        {!!photoError && <Text style={styles.photoError}>{photoError}</Text>}

        <View style={styles.aiCard}>
          <Dog size={72} mood={aiBusy ? 'happy' : 'normal'} pose="talk" speaking />
          <View style={styles.aiCopy}>
            <Text style={styles.aiTitle}>{aiBusy ? '豆包正在看看这顿饭…' : demoMode ? '体验版 · 照片不上传' : '豆包识图 · 粗略估算'}</Text>
            <Text style={styles.aiText}>{demoMode ? '可以选择照片体验记录流程，但照片只留在当前页面，不会上传或发送给 AI。' : aiMessage}</Text>
            {!demoMode && <Pressable disabled={aiBusy || !photos[0]} onPress={analyzePhoto} style={[styles.aiButton, (aiBusy || !photos[0]) && styles.aiButtonDisabled]}>
              {aiBusy ? <ActivityIndicator size="small" color={colors.brown} /> : <Text style={styles.aiButtonText}>同意发送第 1 张照片给豆包并识别</Text>}
            </Pressable>}
            <Text style={styles.aiPrivacy}>{demoMode ? '刷新页面后，体验期间的修改会恢复为初始演示数据。' : '照片会发送至火山方舟，仅用于本次识别；结果可以修改或删除。'}</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Field label="吃了什么" value={title} onChangeText={setTitle} placeholder="可以留空" />
          <View style={styles.row}>
            <View style={styles.half}><Field label="卡路里" value={calories} onChangeText={setCalories} suffix="kcal" placeholder="可留空" keyboardType="numeric" /></View>
            <View style={styles.half}><Field label="金额" value={price} onChangeText={setPrice} suffix="元" placeholder="可留空" keyboardType="numeric" /></View>
          </View>
          <Text style={styles.label}>餐次 · 自动按时间选择</Text>
          <View style={styles.chips}>{mealTypes.map((item) => <Pressable key={item} onPress={() => setType(item)} style={[styles.chip, type === item && styles.chipActive]}><Text style={[styles.chipText, type === item && styles.chipTextActive]}>{item}</Text></Pressable>)}</View>
          <View style={styles.row}>
            <View style={styles.half}><Field label="日期" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" /></View>
            <View style={styles.half}><Field label="时间" value={time} onChangeText={setTime} placeholder="HH:mm" /></View>
          </View>
          <Field label="地点" value={place} onChangeText={setPlace} placeholder="可留空" />
          <Text style={styles.label}>想说的话</Text>
          <TextInput value={note} onChangeText={setNote} multiline maxLength={300} placeholder="可留空，写点这一顿的小心情呀～" placeholderTextColor={colors.muted} style={styles.noteInput} />
          <View style={styles.simpleRow}><View style={{ flex: 1 }}><Text style={styles.simpleTitle}>❤️ 和 TA 一起吃</Text><Text style={styles.simpleMeta}>一条记录同时进入双方回忆</Text></View><Switch value={together} onValueChange={setTogether} trackColor={{ false: colors.line, true: colors.pink }} thumbColor={together ? colors.pinkStrong : colors.white} /></View>
        </View>
      </ScrollView>
      <View style={styles.footer}>{!!error && <Text style={styles.publishError}>{error}</Text>}<Pressable disabled={saving} onPress={publish} style={[styles.publish, saving && { opacity: 0.72 }]}>{saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.publishText}>{initialMeal ? '保存修改' : '发布这一顿'}</Text>}</Pressable><Text style={styles.footerHint}>{demoMode ? '体验操作只在当前页面生效，不会上传云端' : saving ? '豆包正在把这一顿送到云端…' : initialMeal ? '修改后会同步更新给 TA' : '发布后会立即同步给 TA'}</Text></View>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChangeText, suffix, placeholder, keyboardType }: { label: string; value: string; onChangeText: (v: string) => void; suffix?: string; placeholder?: string; keyboardType?: 'numeric' }) {
  return <View style={{ marginBottom: 17 }}><Text style={styles.label}>{label}</Text><View style={styles.inputWrap}><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} keyboardType={keyboardType} style={styles.input} placeholderTextColor={colors.muted} /><Text style={styles.suffix}>{suffix}</Text></View></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.cream, paddingTop: 48 },
  topbar: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  cancel: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  title: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  content: { padding: 16, paddingBottom: 132 },
  photoRow: { flexDirection: 'row', gap: 10 },
  photoSlot: { height: 174, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', overflow: 'hidden' },
  photoMain: { flex: 1, backgroundColor: colors.blue, borderColor: colors.blueStrong },
  photoSecond: { width: 110, backgroundColor: colors.paper, borderColor: colors.line },
  photoPreview: { position: 'absolute', width: '100%', height: '100%' },
  removePhoto: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(46,42,39,0.82)', alignItems: 'center', justifyContent: 'center' },
  removePhotoText: { color: colors.white, fontSize: 20, lineHeight: 21 },
  photoBadge: { position: 'absolute', left: 8, bottom: 8, color: colors.white, backgroundColor: 'rgba(46,42,39,0.68)', borderRadius: 9, paddingHorizontal: 7, paddingVertical: 4, fontSize: 9, fontWeight: '800', overflow: 'hidden' },
  camera: { color: colors.blueStrong, fontSize: 38, fontWeight: '300' },
  plus: { color: colors.muted, fontSize: 35, fontWeight: '300' },
  photoTitle: { color: colors.ink, fontSize: 14, fontWeight: '900', marginTop: 4 },
  photoHint: { color: colors.muted, fontSize: 10, marginTop: 4 },
  photoActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9 },
  photoAction: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8 },
  photoActionDisabled: { opacity: 0.42 },
  photoActionText: { color: colors.ink, fontSize: 10, fontWeight: '800' },
  photoCount: { marginLeft: 'auto', color: colors.muted, fontSize: 10, fontWeight: '700' },
  photoError: { color: colors.danger, fontSize: 10, lineHeight: 15, marginTop: 7, textAlign: 'center' },
  aiCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.yellowSoft, borderRadius: 21, marginTop: 12, padding: 10 },
  aiCopy: { flex: 1, marginLeft: 8 },
  aiTitle: { color: colors.brown, fontSize: 12, fontWeight: '900' },
  aiText: { color: colors.ink, fontSize: 12, lineHeight: 18, marginTop: 3 },
  aiButton: { minHeight: 38, borderRadius: 12, backgroundColor: colors.yellow, borderWidth: 1, borderColor: '#E4C96E', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, marginTop: 9 },
  aiButtonDisabled: { opacity: 0.46 },
  aiButtonText: { color: colors.brown, fontSize: 10, lineHeight: 14, fontWeight: '900', textAlign: 'center' },
  aiPrivacy: { color: colors.muted, fontSize: 8, lineHeight: 12, marginTop: 6 },
  formCard: { marginTop: 12, backgroundColor: colors.paper, borderRadius: 26, padding: 16, borderWidth: 1, borderColor: colors.line },
  label: { color: colors.ink, fontSize: 11, fontWeight: '900', marginBottom: 7 },
  inputWrap: { height: 48, borderRadius: 14, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, height: '100%', paddingHorizontal: 13, color: colors.ink, fontSize: 15, fontWeight: '700' },
  suffix: { color: colors.muted, fontSize: 11, paddingRight: 12 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.cream, borderRadius: 14, borderWidth: 1, borderColor: colors.line },
  chipActive: { backgroundColor: colors.yellow, borderColor: colors.brown },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: colors.brown, fontWeight: '900' },
  simpleRow: { minHeight: 59, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', alignItems: 'center' },
  simpleTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  simpleMeta: { color: colors.muted, fontSize: 10, marginTop: 3 },
  chevron: { marginLeft: 'auto', color: colors.muted, fontSize: 24 },
  noteInput: { minHeight: 82, borderRadius: 14, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 13, paddingVertical: 11, color: colors.ink, fontSize: 13, lineHeight: 19, textAlignVertical: 'top', marginBottom: 17 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.paper, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 22, borderTopWidth: 1, borderTopColor: colors.line },
  publish: { height: 52, borderRadius: 17, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  publishText: { color: colors.white, fontSize: 15, fontWeight: '900' },
  footerHint: { textAlign: 'center', color: colors.muted, fontSize: 10, marginTop: 7 },
  publishError: { color: colors.danger, fontSize: 10, lineHeight: 15, textAlign: 'center', marginBottom: 7 },
});
