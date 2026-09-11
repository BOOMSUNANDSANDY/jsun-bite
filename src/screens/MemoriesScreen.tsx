import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Dog } from '../components/Dog';
import { PhotoPlaceholder } from '../components/PhotoPlaceholder';
import { Meal, MealType } from '../data/types';
import { colors } from '../theme';

type MemoryTab = '日历' | '照片' | 'Together';
type MonthValue = { year: number; month: number };
type Props = {
  meals: Meal[];
  onMealPress: (meal: Meal) => void;
  loadMonth?: (year: number, month: number) => Promise<Meal[]>;
};

const weekDays = ['一', '二', '三', '四', '五', '六', '日'];
const mealTypes: Array<'全部' | MealType> = ['全部', '早餐', '午餐', '晚餐', '零食', '饮料', '其他'];

function mealDate(meal: Meal) {
  return meal.eatenAt ? new Date(meal.eatenAt) : new Date();
}

function belongsToMonth(meal: Meal, month: MonthValue) {
  const date = mealDate(meal);
  return date.getFullYear() === month.year && date.getMonth() === month.month;
}

function monthLabel(month: MonthValue) {
  return `${month.year}年${month.month + 1}月`;
}

function moveMonth(month: MonthValue, amount: number): MonthValue {
  const date = new Date(month.year, month.month + amount, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

function photoCount(meal: Meal) {
  return Math.max(meal.photoPaths?.length ?? 0, meal.photoUris?.length ?? 0, meal.localPhotos?.length ?? 0);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value);
}

function defaultMonth(meals: Meal[]): MonthValue {
  const latest = meals.find((meal) => meal.eatenAt);
  const date = latest ? mealDate(latest) : new Date();
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function MemoriesScreen({ meals, onMealPress, loadMonth }: Props) {
  const [tab, setTab] = useState<MemoryTab>('日历');
  const [selectedMonth, setSelectedMonth] = useState<MonthValue>(() => defaultMonth(meals));
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [monthlyMeals, setMonthlyMeals] = useState(() => meals.filter((meal) => belongsToMonth(meal, defaultMonth(meals))));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'全部' | MealType>('全部');
  const [authorFilter, setAuthorFilter] = useState('全部');

  useEffect(() => {
    let active = true;
    setError(null);

    const useMeals = (nextMeals: Meal[]) => {
      if (!active) return;
      setMonthlyMeals(nextMeals);
      setSelectedDay((current) => {
        if (current !== null) return current;
        const currentDate = new Date();
        const isCurrentMonth = currentDate.getFullYear() === selectedMonth.year && currentDate.getMonth() === selectedMonth.month;
        if (isCurrentMonth) return currentDate.getDate();
        return nextMeals[0] ? mealDate(nextMeals[0]).getDate() : null;
      });
    };

    if (!loadMonth) {
      useMeals(meals.filter((meal) => belongsToMonth(meal, selectedMonth)));
      return () => { active = false; };
    }

    setLoading(true);
    void loadMonth(selectedMonth.year, selectedMonth.month)
      .then(useMeals)
      .catch(() => {
        if (active) {
          setMonthlyMeals([]);
          setError('这个月的回忆暂时没拿回来，再切一次月份试试呀。');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [loadMonth, meals.length, selectedMonth.year, selectedMonth.month]);

  const stats = useMemo(() => {
    const recordedDays = new Set<string>();
    let calories = 0;
    let spending = 0;
    let photos = 0;

    monthlyMeals.forEach((meal) => {
      spending += meal.price ?? 0;
      photos += photoCount(meal);
      if (meal.calories !== undefined) {
        calories += meal.calories;
        const date = mealDate(meal);
        recordedDays.add(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
      }
    });

    const dailyCalories = recordedDays.size ? Math.round((calories / recordedDays.size) / 10) * 10 : 0;
    return {
      records: monthlyMeals.length,
      together: monthlyMeals.filter((meal) => meal.together).length,
      photos,
      spending,
      dailyCalories,
    };
  }, [monthlyMeals]);

  const authors = [...new Set(monthlyMeals.map((meal) => meal.author).filter(Boolean))];
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const hasFilters = Boolean(normalizedQuery || typeFilter !== '全部' || authorFilter !== '全部');
  const filteredMeals = monthlyMeals.filter((meal) => {
    if (typeFilter !== '全部' && meal.type !== typeFilter) return false;
    if (authorFilter !== '全部' && meal.author !== authorFilter) return false;
    if (!normalizedQuery) return true;
    return [meal.title, meal.place, meal.note, meal.author, meal.type]
      .filter(Boolean)
      .some((value) => value!.toLocaleLowerCase().includes(normalizedQuery));
  });
  const dayMeals = hasFilters || selectedDay === null
    ? filteredMeals
    : filteredMeals.filter((meal) => mealDate(meal).getDate() === selectedDay);
  const photoMeals = filteredMeals.filter((meal) => photoCount(meal) > 0);
  const togetherMeals = filteredMeals.filter((meal) => meal.together);
  const visibleMeals = tab === '照片' ? photoMeals : tab === 'Together' ? togetherMeals : dayMeals;
  const listTitle = tab === 'Together'
    ? '一起吃的记录'
    : tab === '照片'
      ? '这个月的照片'
      : hasFilters
        ? '筛选结果'
        : selectedDay === null
        ? `${selectedMonth.month + 1}月的全部记录`
        : `${selectedMonth.month + 1}月${selectedDay}日`;
  const emptyTitle = hasFilters ? '没找到符合条件的记录' : tab === 'Together' ? '这个月还没有一起吃' : tab === '照片' ? '这个月还没有照片' : '这一天还没有记录';
  const emptyText = hasFilters ? '换个关键词或清除筛选，再找找看呀～' : tab === 'Together' ? '下次见面一起吃顿好的呀，豆包先替你们留个位置～' : tab === '照片' ? '下一顿拍一张吧，以后翻到这里会很有意思呀。' : '慢慢来呀，日子不是每天都需要填满的。';
  const monthlyQuote = stats.records
    ? `这个月认真记下了 ${stats.records} 顿呀，零零碎碎的小日子，豆包都替你们收好啦～`
    : '这个月还是空白页呀，等你们用下一顿把它填起来～';

  const changeMonth = (amount: number) => {
    setSelectedDay(null);
    setMonthlyMeals([]);
    setSelectedMonth((current) => moveMonth(current, amount));
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View><Text style={styles.kicker}>我们吃过的</Text><Text style={styles.title}>Memories</Text></View>
        <View style={styles.monthSwitch}>
          <Pressable accessibilityLabel="上一个月" onPress={() => changeMonth(-1)}><Text style={styles.arrow}>‹</Text></Pressable>
          <Text style={styles.month}>{monthLabel(selectedMonth)}</Text>
          <Pressable accessibilityLabel="下一个月" onPress={() => changeMonth(1)}><Text style={styles.arrow}>›</Text></Pressable>
        </View>
      </View>
      <View style={styles.tabs}>{(['日历', '照片', 'Together'] as MemoryTab[]).map((item) => <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.tabActive]}><Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item}</Text></Pressable>)}</View>

      <View style={styles.filters}>
        <View style={styles.searchRow}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput value={query} onChangeText={setQuery} placeholder="搜索菜名、地点或备注" placeholderTextColor={colors.muted} returnKeyType="search" style={styles.searchInput} />
          {!!query && <Pressable accessibilityLabel="清空搜索" onPress={() => setQuery('')} style={styles.clearSearch}><Text style={styles.clearSearchText}>×</Text></Pressable>}
        </View>
        <Text style={styles.filterLabel}>餐次</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {mealTypes.map((item) => <Pressable key={item} onPress={() => setTypeFilter(item)} style={[styles.chip, typeFilter === item && styles.chipActive]}><Text style={[styles.chipText, typeFilter === item && styles.chipTextActive]}>{item}</Text></Pressable>)}
        </ScrollView>
        {!!authors.length && <><Text style={styles.filterLabel}>成员</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {['全部', ...authors].map((item) => <Pressable key={item} onPress={() => setAuthorFilter(item)} style={[styles.chip, authorFilter === item && styles.chipActive]}><Text style={[styles.chipText, authorFilter === item && styles.chipTextActive]}>{item}</Text></Pressable>)}
        </ScrollView></>}
        {hasFilters && <View style={styles.filterResult}><Text style={styles.filterResultText}>找到 {filteredMeals.length} 条</Text><Pressable onPress={() => { setQuery(''); setTypeFilter('全部'); setAuthorFilter('全部'); }}><Text style={styles.resetFilters}>清除筛选</Text></Pressable></View>}
      </View>

      {loading && <View style={styles.loading}><ActivityIndicator color={colors.brown} /><Text style={styles.loadingText}>豆包正在翻这个月的相册呀…</Text></View>}
      {!!error && <Text style={styles.error}>{error}</Text>}

      {!loading && tab === '日历' && <Calendar month={selectedMonth} meals={monthlyMeals} selectedDay={selectedDay} onSelectDay={setSelectedDay} />}
      {!loading && tab !== '日历' && (visibleMeals.length
        ? <View style={styles.photoGrid}>{visibleMeals.map((meal) => <Pressable key={meal.id} onPress={() => onMealPress(meal)} style={styles.gridItem}><PhotoPlaceholder tone={meal.photoTone} height={142} uri={meal.photoUris?.[0]} /><Text style={styles.gridTitle} numberOfLines={1}>{meal.title}</Text><Text style={styles.gridMeta}>{mealDate(meal).getDate()}日 {meal.time} · {meal.type}</Text></Pressable>)}</View>
        : <EmptyState title={emptyTitle} text={emptyText} />)}

      <View style={styles.summaryCard}>
        <View style={styles.summaryTop}><View><Text style={styles.summaryKicker}>本月小结</Text><Text style={styles.summaryTitle}>{monthLabel(selectedMonth)}</Text></View><Dog size={80} mood="side-eye" pose="judge" /></View>
        <View style={styles.metrics}><Metric value={`${stats.records}`} label="次记录" /><Metric value={`${stats.together}`} label="一起吃" /><Metric value={`${stats.photos}`} label="张照片" /></View>
        <View style={styles.metrics}><Metric value={`¥${formatMoney(stats.spending)}`} label="吃喝花费" wide /><Metric value={stats.dailyCalories ? `≈${stats.dailyCalories}` : '—'} label="记录日均 kcal" wide /></View>
        <Text style={styles.quote}>“{monthlyQuote}”</Text>
      </View>

      <View style={styles.listHeader}><Text style={styles.listTitle}>{listTitle}</Text><Text style={styles.listCount}>{visibleMeals.length} 条</Text></View>
      {visibleMeals.length
        ? visibleMeals.map((meal) => <Pressable key={meal.id} onPress={() => onMealPress(meal)} style={styles.memoryRow}><View style={[styles.thumb, { backgroundColor: meal.tone === 'blue' ? colors.blue : colors.pink }]}><Text style={styles.thumbEmoji}>{meal.type === '饮料' ? '🧋' : '🍽'}</Text></View><View style={{ flex: 1 }}><Text style={styles.memoryTitle}>{meal.title}</Text><Text style={styles.memoryMeta}>{meal.author} · {meal.time} · {meal.calories ? `≈${meal.calories} kcal` : '未填热量'}</Text></View><Text style={styles.rowArrow}>›</Text></Pressable>)
        : tab === '日历' && <EmptyState title={emptyTitle} text={emptyText} compact />}
    </ScrollView>
  );
}

function Calendar({ month, meals, selectedDay, onSelectDay }: { month: MonthValue; meals: Meal[]; selectedDay: number | null; onSelectDay: (day: number) => void }) {
  const firstWeekday = (new Date(month.year, month.month, 1).getDay() + 6) % 7;
  const dayCount = new Date(month.year, month.month + 1, 0).getDate();
  const cellCount = Math.ceil((firstWeekday + dayCount) / 7) * 7;
  const cells = Array.from({ length: cellCount }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day >= 1 && day <= dayCount ? day : null;
  });
  const tonesByDay = new Map<number, Set<'blue' | 'pink'>>();
  meals.forEach((meal) => {
    const day = mealDate(meal).getDate();
    const tones = tonesByDay.get(day) ?? new Set<'blue' | 'pink'>();
    tones.add(meal.tone);
    tonesByDay.set(day, tones);
  });

  return <View style={styles.calendar}><View style={styles.week}>{weekDays.map((day) => <Text key={day} style={styles.weekText}>{day}</Text>)}</View><View style={styles.dateGrid}>{cells.map((day, index) => <View key={index} style={styles.dateCell}>{day !== null && <Pressable accessibilityLabel={`${month.month + 1}月${day}日`} onPress={() => onSelectDay(day)} style={styles.datePress}><View style={[styles.dateCircle, day === selectedDay && styles.dateSelected]}><Text style={[styles.dateText, day === selectedDay && styles.dateTextSelected]}>{day}</Text></View><View style={styles.mealDots}>{[...(tonesByDay.get(day) ?? [])].map((tone) => <View key={tone} style={[styles.mealDot, { backgroundColor: tone === 'blue' ? colors.blueStrong : colors.pinkStrong }]} />)}</View></Pressable>}</View>)}</View></View>;
}

function EmptyState({ title, text, compact }: { title: string; text: string; compact?: boolean }) {
  return <View style={[styles.empty, compact && styles.emptyCompact]}><Dog size={compact ? 64 : 86} mood="normal" pose="talk" speaking /><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyText}>{text}</Text></View>;
}

function Metric({ value, label, wide }: { value: string; label: string; wide?: boolean }) {
  return <View style={[styles.metric, wide && { flex: 1 }]}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.cream },
  content: { paddingTop: 54, paddingHorizontal: 16, paddingBottom: 110 },
  header: { flexDirection: 'row', alignItems: 'flex-end' },
  kicker: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  title: { color: colors.ink, fontSize: 28, fontWeight: '900', marginTop: 2 },
  monthSwitch: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', backgroundColor: colors.paper, borderRadius: 15, paddingHorizontal: 5, paddingVertical: 5, borderWidth: 1, borderColor: colors.line },
  arrow: { color: colors.muted, fontSize: 20, width: 28, paddingVertical: 3, textAlign: 'center' },
  month: { color: colors.ink, fontSize: 11, fontWeight: '900' },
  tabs: { flexDirection: 'row', backgroundColor: colors.paper, borderRadius: 17, padding: 4, marginTop: 18, borderWidth: 1, borderColor: colors.line },
  tab: { flex: 1, height: 37, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: colors.yellow },
  tabText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  tabTextActive: { color: colors.brown },
  filters: { backgroundColor: colors.paper, borderRadius: 20, padding: 12, marginTop: 10, borderWidth: 1, borderColor: colors.line },
  searchRow: { height: 43, borderRadius: 14, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11 },
  searchIcon: { color: colors.muted, fontSize: 19, marginRight: 7 },
  searchInput: { flex: 1, height: 43, color: colors.ink, fontSize: 12, paddingVertical: 0 },
  clearSearch: { width: 27, height: 27, borderRadius: 14, backgroundColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  clearSearchText: { color: colors.muted, fontSize: 18, lineHeight: 20 },
  filterLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', marginTop: 10, marginBottom: 6 },
  chips: { gap: 7, paddingRight: 5 },
  chip: { height: 31, borderRadius: 12, backgroundColor: colors.cream, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  chipActive: { backgroundColor: colors.yellowSoft, borderColor: '#E6C96E' },
  chipText: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  chipTextActive: { color: colors.brown },
  filterResult: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: colors.line },
  filterResultText: { flex: 1, color: colors.muted, fontSize: 10, fontWeight: '700' },
  resetFilters: { color: colors.blueStrong, fontSize: 10, fontWeight: '900' },
  loading: { height: 104, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, borderRadius: 22, marginTop: 12 },
  loadingText: { color: colors.muted, fontSize: 10, marginTop: 8 },
  error: { color: colors.danger, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 10 },
  calendar: { backgroundColor: colors.paper, borderRadius: 24, padding: 14, marginTop: 12, borderWidth: 1, borderColor: colors.line },
  week: { flexDirection: 'row' },
  weekText: { width: '14.285%', textAlign: 'center', color: colors.muted, fontSize: 10, fontWeight: '800', paddingVertical: 6 },
  dateGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dateCell: { width: '14.285%', height: 49, alignItems: 'center' },
  datePress: { alignItems: 'center', width: '100%' },
  dateCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  dateSelected: { backgroundColor: colors.ink },
  dateText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  dateTextSelected: { color: colors.white },
  mealDots: { height: 6, flexDirection: 'row', gap: 2, marginTop: 2 },
  mealDot: { width: 4, height: 4, borderRadius: 2 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  gridItem: { width: '48.5%', backgroundColor: colors.paper, borderRadius: 19, padding: 8 },
  gridTitle: { color: colors.ink, fontSize: 12, fontWeight: '900', marginTop: 7 },
  gridMeta: { color: colors.muted, fontSize: 9, marginTop: 2 },
  empty: { width: '100%', alignItems: 'center', backgroundColor: colors.paper, borderRadius: 22, padding: 22, marginTop: 12 },
  emptyCompact: { paddingVertical: 14, marginTop: 0 },
  emptyTitle: { color: colors.ink, fontWeight: '900', fontSize: 14 },
  emptyText: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 5 },
  summaryCard: { backgroundColor: colors.yellowSoft, borderRadius: 26, padding: 15, marginTop: 14, borderWidth: 1, borderColor: '#EDD892' },
  summaryTop: { flexDirection: 'row', alignItems: 'center' },
  summaryKicker: { color: colors.brown, fontSize: 10, fontWeight: '800' },
  summaryTitle: { color: colors.ink, fontSize: 20, fontWeight: '900', marginTop: 2 },
  metrics: { flexDirection: 'row', gap: 7, marginTop: 8 },
  metric: { flex: 1, backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 14, paddingVertical: 9, alignItems: 'center' },
  metricValue: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  metricLabel: { color: colors.muted, fontSize: 8, marginTop: 2 },
  quote: { color: colors.brown, fontSize: 11, lineHeight: 17, marginTop: 11, fontWeight: '700' },
  listHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 23, marginBottom: 9 },
  listTitle: { color: colors.ink, fontSize: 17, fontWeight: '900', flex: 1 },
  listCount: { color: colors.muted, fontSize: 10 },
  memoryRow: { backgroundColor: colors.paper, borderRadius: 18, padding: 9, flexDirection: 'row', alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: colors.line },
  thumb: { width: 53, height: 53, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  thumbEmoji: { fontSize: 23 },
  memoryTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  memoryMeta: { color: colors.muted, fontSize: 9, marginTop: 4 },
  rowArrow: { color: colors.muted, fontSize: 23, marginRight: 3 },
});
