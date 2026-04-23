/**
 * 头像处理：挑选（拍照/相册）+ 压缩 + base64 输出。
 *
 * 两端策略：
 *  - Web：HTMLInputElement (type=file, capture=user) 拿源图 → Canvas 中心裁剪成正方形 →
 *        scale 到 256x256 → toDataURL JPEG 85%。base64 通常 20~60KB。
 *  - Native (iOS/Android)：expo-image-picker 打开系统相机/相册 → base64 直接拿；
 *        Metro 会把 expo-image-picker 只打进 native bundle。
 *
 * 返回统一：`data:image/jpeg;base64,...` 或 null（用户取消）。
 */

import { Platform } from 'react-native';

export interface PickAvatarOptions {
  /** 默认优先"拍照"，true 时弹相册选择。web 下统一由 <input capture> 决定。 */
  fromLibrary?: boolean;
}

export async function pickAvatar(
  options: PickAvatarOptions = {},
): Promise<string | null> {
  if (Platform.OS === 'web') {
    return pickAvatarWeb(options);
  }
  return pickAvatarNative(options);
}

// ============================================================
// Web：HTMLInputElement + Canvas
// ============================================================

function pickAvatarWeb(options: PickAvatarOptions): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    // Mobile 浏览器：不带 library 就调用前置摄像头；带了就走相册
    if (!options.fromLibrary) {
      input.setAttribute('capture', 'user');
    }
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    let done = false;
    const finalize = (v: string | null) => {
      if (done) return;
      done = true;
      try {
        document.body.removeChild(input);
      } catch {
        /* ignore */
      }
      resolve(v);
    };
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return finalize(null);
      try {
        const url = await resizeToJpegDataUrl(file, 256, 0.85);
        finalize(url);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[avatar] resize failed', err);
        finalize(null);
      }
    };
    // 用户关闭系统对话框不会触发 change，只能作罢；onfocus 回来也不一定有 file
    document.body.appendChild(input);
    input.click();
  });
}

/**
 * 用 Canvas 把任意 File 中心裁剪 + 缩放到 size×size JPEG dataURL。
 */
function resizeToJpegDataUrl(
  file: File,
  size: number,
  quality: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) {
          reject(new Error('图片尺寸读取失败'));
          return;
        }
        const side = Math.min(w, h);
        const sx = (w - side) / 2;
        const sy = (h - side) / 2;

        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('canvas 2d 上下文取不到'));
          return;
        }
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        const url = canvas.toDataURL('image/jpeg', quality);
        resolve(url);
      } finally {
        URL.revokeObjectURL(img.src);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('图片加载失败'));
    };
    img.src = URL.createObjectURL(file);
  });
}

// ============================================================
// Native：expo-image-picker
// ============================================================

async function pickAvatarNative(
  options: PickAvatarOptions,
): Promise<string | null> {
  // 动态 require，避免 Web 打包时拉进原生模块
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ImagePicker = require('expo-image-picker') as typeof import('expo-image-picker');

  // 请求权限
  const perm = options.fromLibrary
    ? await ImagePicker.requestMediaLibraryPermissionsAsync()
    : await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;

  const result = options.fromLibrary
    ? await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
        base64: true,
      })
    : await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
        base64: true,
        cameraType: ImagePicker.CameraType.front,
      });

  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset?.base64) return null;

  const mime =
    asset.mimeType ?? (asset.uri?.endsWith('.png') ? 'image/png' : 'image/jpeg');
  return `data:${mime};base64,${asset.base64}`;
}
