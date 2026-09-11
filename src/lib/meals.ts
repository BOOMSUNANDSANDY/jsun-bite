import { decode } from 'base64-arraybuffer';
import { Comment, Meal, MealType, Reaction } from '../data/types';
import { createUuid } from './createUuid';
import { supabase } from './supabase';

const photoBucket = 'meal-photos';
const signedUrlLifetimeSeconds = 60 * 60;

type MealRow = {
  id: string;
  author_id: string;
  title: string | null;
  meal_type: MealType;
  eaten_at: string;
  calories: number | null;
  price_cents: number | null;
  place: string | null;
  note: string | null;
  is_together: boolean;
  photo_paths: string[] | null;
  author?: { nickname?: string } | { nickname?: string }[] | null;
  reactions?: ReactionRow[] | null;
  comments?: CommentRow[] | null;
};

type RelatedProfile = { nickname?: string } | { nickname?: string }[] | null | undefined;

type ReactionRow = {
  id: string;
  user_id: string;
  emoji: string;
  label: string;
  is_active: boolean;
  created_at: string;
  author?: RelatedProfile;
};

type CommentRow = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  author?: RelatedProfile;
};

const mealSelection = `
  id,
  author_id,
  title,
  meal_type,
  eaten_at,
  calories,
  price_cents,
  place,
  note,
  is_together,
  photo_paths,
  author:profiles!meals_author_id_fkey(nickname),
  reactions(
    id,
    user_id,
    emoji,
    label,
    is_active,
    created_at,
    author:profiles!reactions_user_id_fkey(nickname)
  ),
  comments(
    id,
    user_id,
    body,
    created_at,
    author:profiles!comments_user_id_fkey(nickname)
  )
`;

function photoTone(type: MealType): Meal['photoTone'] {
  if (type === '饮料') return 'drink';
  if (type === '早餐') return 'toast';
  if (type === '晚餐') return 'hotpot';
  return 'noodle';
}

function authorNickname(author: RelatedProfile) {
  if (Array.isArray(author)) return author[0]?.nickname;
  return author?.nickname;
}

function displayTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
}

function interactionTime(value: string) {
  const date = new Date(value);
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (elapsedMinutes < 1) return '刚刚';
  if (elapsedMinutes < 60) return `${elapsedMinutes} 分钟前`;
  if (date.toDateString() === new Date().toDateString()) return displayTime(value);
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(date);
}

function mapReactions(rows: ReactionRow[] | null | undefined, currentUserId: string): Reaction[] {
  return (rows ?? [])
    .filter((row) => row.is_active)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((row) => ({
      id: row.id,
      userId: row.user_id,
      author: authorNickname(row.author) || (row.user_id === currentUserId ? '我' : 'TA'),
      tone: row.user_id === currentUserId ? 'blue' : 'pink',
      emoji: row.emoji,
      label: row.label,
      createdAt: row.created_at,
    }));
}

function mapComments(rows: CommentRow[] | null | undefined, currentUserId: string): Comment[] {
  return (rows ?? [])
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((row) => ({
      id: row.id,
      userId: row.user_id,
      author: authorNickname(row.author) || (row.user_id === currentUserId ? '我' : 'TA'),
      tone: row.user_id === currentUserId ? 'blue' : 'pink',
      text: row.body,
      time: interactionTime(row.created_at),
      createdAt: row.created_at,
    }));
}

function mapMeal(row: MealRow, currentUserId: string, signedUrls = new Map<string, string>()): Meal {
  const mine = row.author_id === currentUserId;
  const photoPaths = row.photo_paths ?? [];
  return {
    id: row.id,
    authorId: row.author_id,
    author: authorNickname(row.author) || (mine ? '我' : 'TA'),
    tone: mine ? 'blue' : 'pink',
    title: row.title?.trim() || '未命名的一顿',
    type: row.meal_type,
    time: displayTime(row.eaten_at),
    eatenAt: row.eaten_at,
    calories: row.calories ?? undefined,
    price: row.price_cents === null ? undefined : row.price_cents / 100,
    place: row.place ?? undefined,
    note: row.note ?? undefined,
    together: row.is_together,
    photoTone: photoTone(row.meal_type),
    photoPaths,
    photoUris: photoPaths.flatMap((path) => {
      const signedUrl = signedUrls.get(path);
      return signedUrl ? [signedUrl] : [];
    }),
    reactions: mapReactions(row.reactions, currentUserId),
    comments: mapComments(row.comments, currentUserId),
  };
}

async function createPhotoUrlMap(rows: MealRow[]) {
  const paths = [...new Set(rows.flatMap((row) => row.photo_paths ?? []))];
  const urls = new Map<string, string>();
  if (!supabase || paths.length === 0) return urls;

  try {
    const { data, error } = await supabase.storage
      .from(photoBucket)
      .createSignedUrls(paths, signedUrlLifetimeSeconds);

    if (error || !data) return urls;
    data.forEach((item, index) => {
      const path = item.path || paths[index];
      if (path && item.signedUrl) urls.set(path, item.signedUrl);
    });
  } catch {
    // The meal remains usable if a temporary network issue prevents URL signing.
  }
  return urls;
}

async function uploadMealPhotos(meal: Meal, coupleId: string, mealId: string) {
  if (!supabase) return [];
  const uploadedPaths: string[] = [];

  try {
    for (const photo of (meal.localPhotos ?? []).slice(0, 2)) {
      const path = `${coupleId}/${mealId}/${createUuid()}.jpg`;
      const { error } = await supabase.storage
        .from(photoBucket)
        .upload(path, decode(photo.base64), {
          contentType: photo.mimeType,
          cacheControl: '3600',
          upsert: false,
        });
      if (error) throw error;
      uploadedPaths.push(path);
    }
    return uploadedPaths;
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await supabase.storage.from(photoBucket).remove(uploadedPaths);
    }
    throw error;
  }
}

export async function listCoupleMeals(coupleId: string, currentUserId: string) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('meals')
    .select(mealSelection)
    .eq('couple_id', coupleId)
    .order('eaten_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  const rows = data as unknown as MealRow[];
  const signedUrls = await createPhotoUrlMap(rows);
  return rows.map((row) => mapMeal(row, currentUserId, signedUrls));
}

export async function listCoupleMealsForMonth(
  coupleId: string,
  currentUserId: string,
  year: number,
  month: number,
) {
  if (!supabase) return [];
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);
  const { data, error } = await supabase
    .from('meals')
    .select(mealSelection)
    .eq('couple_id', coupleId)
    .gte('eaten_at', start.toISOString())
    .lt('eaten_at', end.toISOString())
    .order('eaten_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  const rows = data as unknown as MealRow[];
  const signedUrls = await createPhotoUrlMap(rows);
  return rows.map((row) => mapMeal(row, currentUserId, signedUrls));
}

export async function getMealById(mealId: string, currentUserId: string) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('meals')
    .select(mealSelection)
    .eq('id', mealId)
    .single();
  if (error) throw error;
  const row = data as unknown as MealRow;
  const signedUrls = await createPhotoUrlMap([row]);
  return mapMeal(row, currentUserId, signedUrls);
}

export async function publishMeal(meal: Meal, coupleId: string, authorId: string) {
  if (!supabase) return meal;
  const client = supabase;
  const mealId = createUuid();
  const uploadedPaths = await uploadMealPhotos(meal, coupleId, mealId);

  try {
    const { data, error } = await client
      .from('meals')
      .insert({
        id: mealId,
        couple_id: coupleId,
        author_id: authorId,
        title: meal.title || null,
        meal_type: meal.type,
        eaten_at: meal.eatenAt ?? new Date().toISOString(),
        calories: meal.calories ?? null,
        price_cents: meal.price === undefined ? null : Math.round(meal.price * 100),
        place: meal.place ?? null,
        is_together: meal.together ?? false,
        note: meal.note ?? null,
        photo_paths: uploadedPaths,
      })
      .select(mealSelection)
      .single();

    if (error) throw error;
    const row = data as unknown as MealRow;
    const signedUrls = await createPhotoUrlMap([row]);
    const published = mapMeal(row, authorId, signedUrls);

    if (published.photoUris?.length !== uploadedPaths.length) {
      published.photoUris = meal.photoUris;
    }
    return published;
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await client.storage.from(photoBucket).remove(uploadedPaths);
    }
    throw error;
  }
}

export async function updateMeal(meal: Meal, coupleId: string, authorId: string) {
  if (!supabase) return meal;
  const client = supabase;
  const { data: existing, error: existingError } = await client
    .from('meals')
    .select('author_id,photo_paths')
    .eq('id', meal.id)
    .single();
  if (existingError) throw existingError;
  if (existing.author_id !== authorId) throw new Error('只能修改自己发布的记录呀。');

  const oldPaths = (existing.photo_paths ?? []) as string[];
  const retainedPaths = (meal.photoPaths ?? []).filter((path) => oldPaths.includes(path)).slice(0, 2);
  const availableSlots = Math.max(0, 2 - retainedPaths.length);
  const uploadedPaths = await uploadMealPhotos(
    { ...meal, localPhotos: (meal.localPhotos ?? []).slice(0, availableSlots) },
    coupleId,
    meal.id,
  );
  const nextPaths = [...retainedPaths, ...uploadedPaths];

  try {
    const { data, error } = await client
      .from('meals')
      .update({
        title: meal.title || null,
        meal_type: meal.type,
        eaten_at: meal.eatenAt ?? new Date().toISOString(),
        calories: meal.calories ?? null,
        price_cents: meal.price === undefined ? null : Math.round(meal.price * 100),
        place: meal.place?.trim() || null,
        is_together: meal.together ?? false,
        note: meal.note?.trim() || null,
        photo_paths: nextPaths,
      })
      .eq('id', meal.id)
      .eq('author_id', authorId)
      .select(mealSelection)
      .single();
    if (error) throw error;

    const removedPaths = oldPaths.filter((path) => !nextPaths.includes(path));
    if (removedPaths.length) await client.storage.from(photoBucket).remove(removedPaths);
    const row = data as unknown as MealRow;
    const signedUrls = await createPhotoUrlMap([row]);
    return mapMeal(row, authorId, signedUrls);
  } catch (error) {
    if (uploadedPaths.length) await client.storage.from(photoBucket).remove(uploadedPaths);
    throw error;
  }
}

export async function deleteMeal(meal: Meal, authorId: string) {
  if (!supabase) return;
  if (meal.authorId && meal.authorId !== authorId) throw new Error('只能删除自己发布的记录呀。');
  const client = supabase;
  const { error } = await client
    .from('meals')
    .delete()
    .eq('id', meal.id)
    .eq('author_id', authorId);
  if (error) throw error;
  if (meal.photoPaths?.length) await client.storage.from(photoBucket).remove(meal.photoPaths);
}

export function subscribeToCoupleMeals(
  coupleId: string,
  currentUserId: string,
  onInsert: (meal: Meal) => void,
  onStatus?: (status: string) => void,
) {
  if (!supabase) return () => undefined;
  const client = supabase;

  const channel = client
    .channel(`couple:${coupleId}:meals`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'meals', filter: `couple_id=eq.${coupleId}` },
      (payload) => {
        const id = (payload.new as { id?: string }).id;
        if (!id) return;
        void getMealById(id, currentUserId).then((meal) => meal && onInsert(meal));
      },
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'meals', filter: `couple_id=eq.${coupleId}` },
      (payload) => {
        const id = (payload.new as { id?: string }).id;
        if (!id) return;
        void getMealById(id, currentUserId).then((meal) => meal && onInsert(meal));
      },
    )
    .subscribe((status) => onStatus?.(status));

  return () => { void client.removeChannel(channel); };
}
