export type MealType = '早餐' | '午餐' | '晚餐' | '零食' | '饮料' | '其他';

export type LocalMealPhoto = {
  uri: string;
  base64: string;
  mimeType: 'image/jpeg';
};

export type Reaction = {
  id?: string;
  userId?: string;
  author?: string;
  tone?: 'blue' | 'pink';
  emoji: string;
  label: string;
  createdAt?: string;
};

export type Comment = {
  id: string;
  userId?: string;
  author: string;
  tone?: 'blue' | 'pink';
  text: string;
  time: string;
  createdAt?: string;
};

export type Meal = {
  id: string;
  author: string;
  authorId?: string;
  tone: 'blue' | 'pink';
  title: string;
  type: MealType;
  time: string;
  eatenAt?: string;
  calories?: number;
  price?: number;
  place?: string;
  together?: boolean;
  note?: string;
  photoTone: 'noodle' | 'toast' | 'drink' | 'hotpot';
  photoUris?: string[];
  photoPaths?: string[];
  localPhotos?: LocalMealPhoto[];
  reactions: Reaction[];
  comments: Comment[];
};
