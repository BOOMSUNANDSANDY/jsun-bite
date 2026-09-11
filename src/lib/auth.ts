import { AuthInput } from '../data/cloudTypes';
import { supabase, supabasePublishableKey, supabaseUrl } from './supabase';

export function getAuthRedirectUrl() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/?platform=web`;
  }
  return 'jsunbite://auth/confirm';
}

export function getAuthCallbackType(url: string | null) {
  if (!url) return null;
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1).split('#')[0] : '';
  const fragment = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
  const params = new URLSearchParams([query, fragment].filter(Boolean).join('&'));
  return params.get('type');
}

function isTransientNetworkError(error: unknown) {
  return error instanceof Error && /failed to fetch|load failed|network request failed|networkerror/i.test(error.message);
}

async function warmUpAuthConnection() {
  if (!supabaseUrl || !supabasePublishableKey) return;
  const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
    headers: { apikey: supabasePublishableKey },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`连接检测失败（${response.status}）`);
}

async function retryOnce<T>(request: () => Promise<T>) {
  try {
    return await request();
  } catch (error) {
    if (!isTransientNetworkError(error)) throw error;
    await warmUpAuthConnection();
    await new Promise((resolve) => setTimeout(resolve, 450));
    return request();
  }
}

export async function authenticate(input: AuthInput) {
  if (!supabase) return { mode: 'demo' as const };
  const client = supabase;

  if (input.action === 'register') {
    await warmUpAuthConnection();
    const { data, error } = await retryOnce(() => client.auth.signUp({
        email: input.email.trim(),
        password: input.password,
        options: {
          data: { nickname: input.nickname?.trim() || input.email.split('@')[0] },
          emailRedirectTo: getAuthRedirectUrl(),
        },
      }));
    if (error) throw error;
    if (!data.session) {
      return { mode: 'confirmation-required' as const, email: input.email.trim() };
    }
    return { mode: 'cloud' as const, user: data.user };
  }

  await warmUpAuthConnection();
  const { data, error } = await retryOnce(() => client.auth.signInWithPassword({
      email: input.email.trim(),
      password: input.password,
    }));
  if (error) throw error;
  return { mode: 'cloud' as const, user: data.user };
}

export async function resendSignupConfirmation(email: string) {
  if (!supabase) return;
  const client = supabase;
  await warmUpAuthConnection();
  const { error } = await retryOnce(() => client.auth.resend({
    type: 'signup',
    email: email.trim(),
    options: { emailRedirectTo: getAuthRedirectUrl() },
  }));
  if (error) throw error;
}

export async function requestPasswordReset(email: string) {
  if (!supabase) return;
  await warmUpAuthConnection();
  const client = supabase;
  const { error } = await retryOnce(() => client.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: getAuthRedirectUrl(),
  }));
  if (error) throw error;
}

export async function consumeAuthCallback(url: string | null) {
  if (!supabase || !url) return null;

  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1).split('#')[0] : '';
  const fragment = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
  const params = new URLSearchParams([query, fragment].filter(Boolean).join('&'));
  const callbackError = params.get('error_description') ?? params.get('error');
  if (callbackError) throw new Error(decodeURIComponent(callbackError.replace(/\+/g, ' ')));

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return null;

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw error;
  return data.session;
}

export async function getSavedSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function updatePassword(password: string) {
  if (!supabase) return;
  if (password.length < 8) throw new Error('新密码至少需要 8 位呀。');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export function listenForAuthEvents(onSignOut: () => void, onPasswordRecovery: () => void) {
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') onSignOut();
    if (event === 'PASSWORD_RECOVERY') onPasswordRecovery();
  });
  return () => data.subscription.unsubscribe();
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
