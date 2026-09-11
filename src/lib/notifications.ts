import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

function getProjectId() {
  return process.env.EXPO_PUBLIC_EAS_PROJECT_ID
    ?? Constants.easConfig?.projectId
    ?? Constants.expoConfig?.extra?.eas?.projectId;
}

function mealIdFromResponse(response: Notifications.NotificationResponse | null) {
  const value = response?.notification.request.content.data?.mealId;
  return typeof value === 'string' && value.length <= 100 ? value : null;
}

export async function registerDevicePushToken(userId: string) {
  if (
    !supabase
    || Platform.OS === 'web'
    || !Device.isDevice
    || Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  ) return 'unsupported' as const;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('meals', {
      name: '伴侣饮食记录',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 220, 120, 220],
      lightColor: '#F2C96D',
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.status === 'granted'
    ? existing
    : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return 'denied' as const;

  const projectId = getProjectId();
  if (!projectId) return 'unconfigured' as const;

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const { error } = await supabase.from('push_tokens').upsert(
    {
      user_id: userId,
      expo_push_token: token,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'expo_push_token' },
  );
  if (error) throw error;
  return 'registered' as const;
}

export function listenForMealNotification(onMeal: (mealId: string) => void) {
  if (Platform.OS === 'web') return () => undefined;
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const mealId = mealIdFromResponse(response);
    if (mealId) onMeal(mealId);
  });
  return () => subscription.remove();
}

export async function getInitialNotificationMealId() {
  if (Platform.OS === 'web') return null;
  const response = await Notifications.getLastNotificationResponseAsync();
  const mealId = mealIdFromResponse(response);
  if (mealId) await Notifications.clearLastNotificationResponseAsync();
  return mealId;
}
