import { PreparedPhoto } from './photoPicker';
import { supabase } from './supabase';

export type MealAiResult = {
  title: string;
  calories?: number;
  message: string;
};

export async function analyzeMealPhoto(photo: PreparedPhoto): Promise<MealAiResult> {
  if (!supabase) throw new Error('云端还没有连接好，暂时不能识别照片呀。');

  const { data, error } = await supabase.functions.invoke('analyze-meal', {
    body: {
      imageBase64: photo.base64,
      mimeType: photo.mimeType,
    },
  });

  if (error) {
    const context = await error.context?.json?.().catch(() => null);
    throw new Error(context?.error || '豆包刚刚没看清，再试一次儿呀。');
  }

  if (!data || typeof data !== 'object') throw new Error('豆包的回答没接完整，再试一次儿呀。');

  return {
    title: typeof data.title === 'string' ? data.title.trim() : '',
    calories: typeof data.calories === 'number' && Number.isFinite(data.calories)
      ? Math.round(data.calories)
      : undefined,
    message: typeof data.message === 'string' && data.message.trim()
      ? data.message.trim()
      : '我先粗略认了一下，你再确认一眼儿呀～',
  };
}
