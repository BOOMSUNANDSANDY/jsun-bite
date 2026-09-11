import { Meal, Reaction } from '../data/types';
import { getMealById } from './meals';
import { supabase } from './supabase';

export async function setMealReaction(
  mealId: string,
  userId: string,
  reaction: Reaction,
  active: boolean,
) {
  if (!supabase) return;
  const { error } = await supabase.from('reactions').upsert(
    {
      meal_id: mealId,
      user_id: userId,
      emoji: reaction.emoji,
      label: reaction.label,
      is_active: active,
    },
    { onConflict: 'meal_id,user_id,emoji' },
  );
  if (error) throw error;
}

export async function addMealComment(mealId: string, userId: string, body: string) {
  if (!supabase) return;
  const normalized = body.trim();
  if (!normalized || normalized.length > 500) throw new Error('评论需要在 1 到 500 个字之间呀。');
  const { error } = await supabase.from('comments').insert({
    meal_id: mealId,
    user_id: userId,
    body: normalized,
  });
  if (error) throw error;
}

export async function deleteMealComment(commentId: string, userId: string) {
  if (!supabase) return;
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function refreshMealInteractions(mealId: string, currentUserId: string) {
  return getMealById(mealId, currentUserId);
}

export function subscribeToMealInteractions(
  mealId: string,
  currentUserId: string,
  onChange: (meal: Meal) => void,
) {
  if (!supabase) return () => undefined;
  const client = supabase;
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;

  const queueRefresh = () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      void refreshMealInteractions(mealId, currentUserId).then((meal) => meal && onChange(meal));
    }, 120);
  };

  const filter = `meal_id=eq.${mealId}`;
  const channel = client
    .channel(`meal:${mealId}:interactions`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions', filter }, queueRefresh)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reactions', filter }, queueRefresh)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments', filter }, queueRefresh)
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comments', filter }, queueRefresh)
    .subscribe();

  return () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    void client.removeChannel(channel);
  };
}
