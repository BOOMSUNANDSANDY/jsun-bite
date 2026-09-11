import { CoupleRecord, ProfileRecord } from './cloudTypes';
import { Meal } from './types';

export const demoCouple: CoupleRecord = {
  id: 'demo-couple',
  member_a: 'demo-a',
  member_b: 'demo-b',
  invite_code: 'DEMO26',
  anniversary: '2024-08-26',
  pet_name: '豆包',
  created_at: '2024-08-26T00:00:00.000Z',
};

export const demoProfiles: ProfileRecord[] = [
  { id: 'demo-a', nickname: '阿屿', avatar_url: null },
  { id: 'demo-b', nickname: '小晴', avatar_url: null },
];

function todayAt(hour: number, minute: number) {
  const value = new Date();
  value.setHours(hour, minute, 0, 0);
  return value.toISOString();
}

export const initialMeals: Meal[] = [
  {
    id: 'meal-1',
    author: '小晴',
    authorId: 'demo-b',
    tone: 'pink',
    title: '牛油果吐司和拿铁',
    type: '早餐',
    time: '09:12',
    eatenAt: todayAt(9, 12),
    calories: 460,
    price: 42,
    place: '楼下咖啡店',
    photoTone: 'toast',
    reactions: [{ userId: 'demo-a', author: '阿屿', tone: 'blue', emoji: '❤️', label: '喜欢' }],
    comments: [],
  },
  {
    id: 'meal-2',
    author: '阿屿',
    authorId: 'demo-a',
    tone: 'blue',
    title: '番茄牛肉面',
    type: '午餐',
    time: '12:38',
    eatenAt: todayAt(12, 38),
    calories: 680,
    price: 32,
    place: '公司附近',
    note: '今天终于没点外卖。',
    photoTone: 'noodle',
    reactions: [
      { userId: 'demo-b', author: '小晴', tone: 'pink', emoji: '🐷', label: '猪猪' },
      { userId: 'demo-b', author: '小晴', tone: 'pink', emoji: '😋', label: '给我吃' },
      { userId: 'demo-b', author: '小晴', tone: 'pink', emoji: '❤️', label: '喜欢' },
    ],
    comments: [
      { id: 'comment-1', userId: 'demo-b', author: '小晴', tone: 'pink', text: '怎么又是面，不过看起来还行 😋', time: '12:42' },
      { id: 'comment-2', userId: 'demo-a', author: '阿屿', tone: 'blue', text: '下次带你吃这家。', time: '12:45' },
    ],
  },
  {
    id: 'meal-3',
    author: '小晴',
    authorId: 'demo-b',
    tone: 'pink',
    title: '桂花乌龙奶茶',
    type: '饮料',
    time: '15:48',
    eatenAt: todayAt(15, 48),
    calories: 390,
    price: 22,
    photoTone: 'drink',
    reactions: [{ userId: 'demo-a', author: '阿屿', tone: 'blue', emoji: '🤨', label: '又吃？' }],
    comments: [],
  },
];

export const allReactions = [
  { emoji: '❤️', label: '喜欢' },
  { emoji: '😋', label: '给我吃' },
  { emoji: '🐷', label: '猪猪' },
  { emoji: '🥺', label: '我也想吃' },
  { emoji: '🤨', label: '又吃？' },
  { emoji: '👏', label: '好好吃饭' },
  { emoji: '🔥', label: '绝了' },
  { emoji: '😤', label: '没叫我' },
];
