import { ActivityEvent, ActivityType } from '../data/activityTypes';
import { supabase } from './supabase';

type ActivityRow = {
  id: string;
  actor_id: string;
  event_type: ActivityType;
  meal_id: string | null;
  body: string | null;
  created_at: string;
  read_at: string | null;
  actor?: { nickname?: string | null } | { nickname?: string | null }[] | null;
};

function mapActivity(row: ActivityRow): ActivityEvent {
  const actor = Array.isArray(row.actor) ? row.actor[0] : row.actor;
  return {
    id: row.id,
    type: row.event_type,
    actorId: row.actor_id,
    actorName: actor?.nickname?.trim() || 'TA',
    mealId: row.meal_id ?? undefined,
    body: row.body ?? undefined,
    createdAt: row.created_at,
    readAt: row.read_at ?? undefined,
  };
}

export function isActivityBackendMissing(error: unknown) {
  const candidate = error as { code?: string; message?: string } | null;
  const text = `${candidate?.code ?? ''} ${candidate?.message ?? ''}`.toLowerCase();
  return text.includes('pgrst202')
    || text.includes('pgrst205')
    || text.includes('42p01')
    || text.includes('activity_events')
    || text.includes('send_couple_nudge');
}

export async function listActivities(userId: string) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('activity_events')
    .select('id, actor_id, event_type, meal_id, body, created_at, read_at, actor:profiles!activity_events_actor_id_fkey(nickname)')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return ((data ?? []) as ActivityRow[]).map(mapActivity);
}

export async function markActivityRead(activityId: string, userId: string) {
  if (!supabase) return;
  const { error } = await supabase
    .from('activity_events')
    .update({ read_at: new Date().toISOString() })
    .eq('id', activityId)
    .eq('recipient_id', userId)
    .is('read_at', null);
  if (error) throw error;
}

export async function markAllActivitiesRead(userId: string) {
  if (!supabase) return;
  const { error } = await supabase
    .from('activity_events')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', userId)
    .is('read_at', null);
  if (error) throw error;
}

export async function sendNudge(coupleId: string) {
  if (!supabase) return;
  const { error } = await supabase.rpc('send_couple_nudge', { target_couple: coupleId });
  if (error) throw error;
}

export function subscribeToActivities(userId: string, onChange: () => void) {
  if (!supabase) return () => undefined;
  const client = supabase;
  const channel = client
    .channel(`activity:${userId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'activity_events',
      filter: `recipient_id=eq.${userId}`,
    }, onChange)
    .subscribe();

  return () => { void client.removeChannel(channel); };
}
