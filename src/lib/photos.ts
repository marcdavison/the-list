import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { Alert, Linking } from 'react-native';

import { storage } from '@/lib/firebase';

/** Longest side of an uploaded photo, in pixels: plenty to check a label, small to upload. */
const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.7;

/**
 * Opens the camera and returns a resized local JPEG, or null if the user cancelled or
 * refused camera access. Uses only Expo modules, so it works in Expo Go and EAS builds.
 */
export async function takePhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(
      'Camera access needed',
      'To attach a photo, allow camera access for Shopping List.',
      permission.canAskAgain
        ? [{ text: 'OK' }]
        : [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
    );
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
  if (result.canceled) return null;
  const photo = result.assets[0];

  // Shrink the longest side to MAX_DIMENSION (never upscale), then save as compressed JPEG.
  const context = ImageManipulator.manipulate(photo.uri);
  if (Math.max(photo.width, photo.height) > MAX_DIMENSION) {
    context.resize(
      photo.width >= photo.height
        ? { width: MAX_DIMENSION, height: null }
        : { width: null, height: MAX_DIMENSION },
    );
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
  return saved.uri;
}

/** Storage path for a comment's photo. Must match storage.rules and firestore.rules. */
export const commentPhotoPath = (listId: string, commentId: string) =>
  `lists/${listId}/comments/${commentId}.jpg`;

/** Uploads a local JPEG for a comment and returns where it lives. */
export async function uploadCommentPhoto(listId: string, commentId: string, localUri: string) {
  const imagePath = commentPhotoPath(listId, commentId);
  const blob = await (await fetch(localUri)).blob();
  const photoRef = ref(storage, imagePath);
  await uploadBytes(photoRef, blob, { contentType: 'image/jpeg' });
  return { imagePath, imageUrl: await getDownloadURL(photoRef) };
}
