export type ActivityType = 'meal' | 'reaction' | 'comment' | 'nudge';

export type ActivityEvent = {
  id: string;
  type: ActivityType;
  actorId: string;
  actorName: string;
  mealId?: string;
  body?: string;
  createdAt: string;
  readAt?: string;
};
