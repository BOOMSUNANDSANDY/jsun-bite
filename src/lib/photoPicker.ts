import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export type PreparedPhoto = {
  uri: string;
  width: number;
  height: number;
  base64: string;
  mimeType: 'image/jpeg';
};

async function preparePhoto(asset: ImagePicker.ImagePickerAsset): Promise<PreparedPhoto> {
  const context = ImageManipulator.manipulate(asset.uri);
  const longestSide = Math.max(asset.width, asset.height);
  if (longestSide > 1024) {
    if (asset.width >= asset.height) context.resize({ width: 1024 });
    else context.resize({ height: 1024 });
  }

  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.72, base64: true });
  if (!saved.base64) throw new Error('照片处理失败了，再选一次试试呀。');

  return { uri: saved.uri, width: saved.width, height: saved.height, base64: saved.base64, mimeType: 'image/jpeg' };
}

async function prepareAvatar(asset: ImagePicker.ImagePickerAsset): Promise<PreparedPhoto> {
  const context = ImageManipulator.manipulate(asset.uri);
  const side = Math.min(asset.width, asset.height);
  context.crop({
    originX: Math.max(0, Math.floor((asset.width - side) / 2)),
    originY: Math.max(0, Math.floor((asset.height - side) / 2)),
    width: side,
    height: side,
  });
  context.resize({ width: 512, height: 512 });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.82, base64: true });
  if (!saved.base64) throw new Error('头像处理失败了，再选一次试试呀。');
  return { uri: saved.uri, width: saved.width, height: saved.height, base64: saved.base64, mimeType: 'image/jpeg' };
}

export async function pickPhotos(remaining: number) {
  if (remaining <= 0) return [];
  if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error('需要允许访问你选择的照片，才能记录这一顿呀。');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: remaining > 1,
    selectionLimit: remaining,
    orderedSelection: true,
    quality: 1,
    shouldDownloadFromNetwork: true,
  });

  if (result.canceled) return [];
  return Promise.all(result.assets.slice(0, remaining).map(preparePhoto));
}

export async function takePhoto() {
  if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('需要允许使用相机，豆包才能替你记下这一顿呀。');
  }

  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], cameraType: ImagePicker.CameraType.back, quality: 1 });
  if (result.canceled || !result.assets[0]) return null;
  return preparePhoto(result.assets[0]);
}

export async function pickAvatar() {
  if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error('需要允许访问你选择的照片，才能设置头像呀。');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    quality: 1,
    shouldDownloadFromNetwork: true,
  });
  if (result.canceled || !result.assets[0]) return null;
  return prepareAvatar(result.assets[0]);
}
