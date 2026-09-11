import { decode } from 'base64-arraybuffer';
import * as Crypto from 'expo-crypto';
import { CoupleRecord, ProfileRecord } from '../data/cloudTypes';
import { PreparedPhoto } from './photoPicker';
import { supabase } from './supabase';

const avatarBucket = 'profile-avatars';
const avatarUrlCache = new Map<string, { url: string; expiresAt: number }>();

type ProfileRow = { id: string; nickname: string; avatar_url: string | null };

async function hydrateProfiles(rows: ProfileRow[]) {
  if (!supabase) return rows as ProfileRecord[];
  const now = Date.now();
  const missingPaths = [...new Set(rows.flatMap((row) => {
    if (!row.avatar_url) return [];
    const cached = avatarUrlCache.get(row.avatar_url);
    return cached && cached.expiresAt > now + 60_000 ? [] : [row.avatar_url];
  }))];

  if (missingPaths.length) {
    const { data } = await supabase.storage.from(avatarBucket).createSignedUrls(missingPaths, 86_400);
    data?.forEach((item, index) => {
      const path = item.path || missingPaths[index];
      if (path && item.signedUrl) avatarUrlCache.set(path, { url: item.signedUrl, expiresAt: now + 86_400_000 });
    });
  }

  return rows.map((row) => ({
    ...row,
    avatar_path: row.avatar_url,
    avatar_url: row.avatar_url ? avatarUrlCache.get(row.avatar_url)?.url ?? null : null,
  }));
}

function firstRecord(data: unknown): CoupleRecord | null {
  if (!data) return null;
  return (Array.isArray(data) ? data[0] : data) as CoupleRecord;
}

export async function ensureMyProfile(userId: string, nickname?: string) {
  if (!supabase) return;
  const safeNickname = nickname?.trim() || '新朋友';
  const { error } = await supabase
    .from('profiles')
    .upsert(
      { id: userId, nickname: safeNickname },
      { onConflict: 'id', ignoreDuplicates: true },
    );
  if (error) throw error;
}

export async function getMyCouple() {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_my_couple');
  if (error) throw error;
  return firstRecord(data);
}

export async function getOrCreateInvite() {
  if (!supabase) return null;
  const existing = await getMyCouple();
  if (existing) return existing;

  const { data, error } = await supabase.rpc('create_couple_invite');
  if (error) throw error;
  return firstRecord(data);
}

function cloudErrorText(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const details = error as { message?: unknown; code?: unknown; details?: unknown };
    const message = typeof details.message === 'string' ? details.message : '未知云端错误';
    const code = typeof details.code === 'string' ? ` · ${details.code}` : '';
    const extra = typeof details.details === 'string' && details.details ? ` · ${details.details}` : '';
    return `${message}${code}${extra}`;
  }
  return String(error || '未知云端错误');
}

export async function prepareCoupleAccount(userId: string, nickname?: string) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const existing = await getMyCouple();
      if (existing) return existing;
      await ensureMyProfile(userId, nickname);
      const created = await getOrCreateInvite();
      if (created) return created;
      throw new Error('数据库没有返回情侣邀请码');
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }

  throw new Error(`账号已经登录，但情侣空间初始化失败：${cloudErrorText(lastError)}`);
}

export async function acceptInvite(code: string) {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('accept_couple_invite', { input_code: code.trim().toUpperCase() });
  if (error) throw error;
  return firstRecord(data);
}

export async function cancelMyInvite(code: string) {
  if (!supabase) return;
  const { error } = await supabase.rpc('cancel_my_couple_invite', { expected_invite: code.trim().toUpperCase() });
  if (error) throw error;
}

export function isPaired(couple: CoupleRecord | null): couple is CoupleRecord {
  return Boolean(couple?.member_b);
}

export async function listCoupleProfiles(couple: CoupleRecord) {
  if (!supabase) return [];
  const memberIds = [couple.member_a, couple.member_b].filter(Boolean) as string[];
  const { data, error } = await supabase
    .from('profiles')
    .select('id,nickname,avatar_url')
    .in('id', memberIds);
  if (error) throw error;
  return hydrateProfiles((data ?? []) as ProfileRow[]);
}

export function subscribeToProfileChanges(onChange: () => void) {
  if (!supabase) return () => undefined;
  const client = supabase;
  const channel = client
    .channel('couple-profile-changes')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, onChange)
    .subscribe();
  return () => { void client.removeChannel(channel); };
}

export async function updateMyNickname(userId: string, nickname: string) {
  if (!supabase) return { id: userId, nickname: nickname.trim(), avatar_url: null } as ProfileRecord;
  const safeNickname = nickname.trim();
  if (!safeNickname) throw new Error('昵称不能为空呀。');
  if (safeNickname.length > 20) throw new Error('昵称最多 20 个字呀。');
  const { data, error } = await supabase
    .from('profiles')
    .update({ nickname: safeNickname })
    .eq('id', userId)
    .select('id,nickname,avatar_url')
    .single();
  if (error) throw error;
  await supabase.auth.updateUser({ data: { nickname: safeNickname } });
  return (await hydrateProfiles([data as ProfileRow]))[0]!;
}

export async function updateMyAvatar(userId: string, photo: PreparedPhoto) {
  if (!supabase) throw new Error('头像云端空间还没有连接呀。');
  const client = supabase;
  const { data: current, error: currentError } = await client
    .from('profiles')
    .select('id,nickname,avatar_url')
    .eq('id', userId)
    .single();
  if (currentError) throw currentError;

  const nextPath = `${userId}/${Crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await client.storage.from(avatarBucket).upload(nextPath, decode(photo.base64), {
    contentType: photo.mimeType,
    cacheControl: '86400',
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await client
    .from('profiles')
    .update({ avatar_url: nextPath })
    .eq('id', userId)
    .select('id,nickname,avatar_url')
    .single();
  if (error) {
    await client.storage.from(avatarBucket).remove([nextPath]);
    throw error;
  }

  if (current.avatar_url) {
    avatarUrlCache.delete(current.avatar_url);
    await client.storage.from(avatarBucket).remove([current.avatar_url]);
  }
  return (await hydrateProfiles([data as ProfileRow]))[0]!;
}

export async function removeMyAvatar(userId: string) {
  if (!supabase) return null;
  const client = supabase;
  const { data: current, error: currentError } = await client
    .from('profiles')
    .select('id,nickname,avatar_url')
    .eq('id', userId)
    .single();
  if (currentError) throw currentError;
  const { data, error } = await client
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', userId)
    .select('id,nickname,avatar_url')
    .single();
  if (error) throw error;
  if (current.avatar_url) {
    avatarUrlCache.delete(current.avatar_url);
    await client.storage.from(avatarBucket).remove([current.avatar_url]);
  }
  return (await hydrateProfiles([data as ProfileRow]))[0]!;
}

export async function updateCoupleSettings(coupleId: string, petName: string, anniversary: string | null) {
  if (!supabase) return null;
  const safePetName = petName.trim();
  if (!safePetName) throw new Error('宠物名字不能为空呀。');
  if (safePetName.length > 12) throw new Error('宠物名字最多 12 个字呀。');
  const { data, error } = await supabase.rpc('update_couple_settings', {
    target_couple: coupleId,
    new_pet_name: safePetName,
    new_anniversary: anniversary || null,
  });
  if (error) throw error;
  return firstRecord(data);
}
