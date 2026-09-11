export type CoupleRecord = {
  id: string;
  member_a: string;
  member_b: string | null;
  invite_code: string;
  anniversary: string | null;
  pet_name: string;
  created_at: string;
};

export type ProfileRecord = {
  id: string;
  nickname: string;
  avatar_url: string | null;
  avatar_path?: string | null;
};

export type AuthInput = {
  email: string;
  password: string;
  nickname?: string;
  action: 'login' | 'register';
};

export type AuthOutcome = 'authenticated' | 'confirmation-required';
