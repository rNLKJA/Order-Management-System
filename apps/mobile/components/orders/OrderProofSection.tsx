/**
 * 订餐凭证截图：相册多选 → data URL，与 API proof_images 对齐。
 *
 * Web：与 lib/avatar.ts 一致——用 document.createElement('input') 挂到 body 再 click()，
 * 不用 RN Web 里的隐藏 input（ref 与 change 在移动端浏览器/Safari 上常失灵）。
 * 原生：先用 expo-image-manipulator 压到长边 ≤1280、JPEG ~0.72，再上传；失败则回退 file-system/base64。
 */

import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat, type Action } from 'expo-image-manipulator';
import { useState } from 'react';
import {
  View,
  Image,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '../../theme/paperTheme';

const MAX_PROOF = 12;
/** 长边上限（凭证需能辨认微信聊天记录，1280 在清晰度与体积间折中） */
const PROOF_MAX_LONG_EDGE = 1280;
const PROOF_JPEG_QUALITY = 0.72;

async function readBrowserFilesAsDataUrls(
  files: FileList,
  maxCount: number,
): Promise<string[]> {
  const list = Array.from(files).slice(0, maxCount);
  return Promise.all(
    list.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const r = reader.result;
            if (typeof r === 'string') resolve(r);
            else reject(new Error('读图失败'));
          };
          reader.onerror = () => reject(reader.error ?? new Error('读图失败'));
          reader.readAsDataURL(file);
        }),
    ),
  );
}

function downscaleProofDataUrlWeb(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined' || !dataUrl.startsWith('data:image/')) {
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        const w0 = img.naturalWidth;
        const h0 = img.naturalHeight;
        if (!w0 || !h0) {
          resolve(dataUrl);
          return;
        }
        const long = Math.max(w0, h0);
        let w = w0;
        let h = h0;
        if (long > PROOF_MAX_LONG_EDGE) {
          const s = PROOF_MAX_LONG_EDGE / long;
          w = Math.max(1, Math.round(w0 * s));
          h = Math.max(1, Math.round(h0 * s));
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', PROOF_JPEG_QUALITY));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Web 选多图：与 pickAvatarWeb 同源写法，避免 React 树内的 <input> 不触发 onChange。
 */
function pickProofImagesWeb(maxCount: number): Promise<string[]> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve([]);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif';
    input.multiple = true;
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    let done = false;
    const finalize = (urls: string[]) => {
      if (done) return;
      done = true;
      try {
        document.body.removeChild(input);
      } catch {
        /* ignore */
      }
      resolve(urls.slice(0, maxCount));
    };
    input.onchange = async () => {
      const files = input.files;
      if (!files?.length) {
        finalize([]);
        return;
      }
      try {
        const urls = await readBrowserFilesAsDataUrls(files, maxCount);
        const shrunk = await Promise.all(urls.map((u) => downscaleProofDataUrlWeb(u)));
        finalize(shrunk);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[order-proof] read failed', err);
        finalize([]);
      }
    };
    document.body.appendChild(input);
    input.click();
  });
}

function normalizeProofMime(mimeType: string | undefined, uri: string): string {
  const m = (mimeType ?? '').toLowerCase();
  if (/^image\/(jpeg|jpg|png|webp|heic|heif)$/.test(m)) {
    return m === 'image/jpg' ? 'image/jpeg' : m;
  }
  const u = uri.toLowerCase();
  if (u.endsWith('.png')) return 'image/png';
  if (u.endsWith('.webp')) return 'image/webp';
  if (u.endsWith('.heic') || u.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

async function nativeAssetToJpegProofDataUrl(asset: ImagePicker.ImagePickerAsset): Promise<string | null> {
  const uri = asset.uri;
  if (!uri) return null;
  const w = asset.width ?? 0;
  const h = asset.height ?? 0;
  let actions: Action[];
  const long = Math.max(w, h);
  if (w > 0 && h > 0 && long > PROOF_MAX_LONG_EDGE) {
    const s = PROOF_MAX_LONG_EDGE / long;
    actions = [
      {
        resize: {
          width: Math.max(1, Math.round(w * s)),
          height: Math.max(1, Math.round(h * s)),
        },
      },
    ];
  } else {
    actions = [{ resize: { width: PROOF_MAX_LONG_EDGE } }];
  }
  try {
    const result = await manipulateAsync(uri, actions, {
      compress: PROOF_JPEG_QUALITY,
      format: SaveFormat.JPEG,
      base64: true,
    });
    if (result.base64) {
      return `data:image/jpeg;base64,${result.base64}`;
    }
    const b64 = await FileSystem.readAsStringAsync(result.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:image/jpeg;base64,${b64}`;
  } catch {
    return null;
  }
}

/**
 * 相册多选：优先压缩 JPEG；失败时再走原图 base64 / 读文件（与 Zod 允许的非 JPEG mime 一致）。
 */
async function imagePickerAssetsToProofDataUrls(
  assets: ImagePicker.ImagePickerAsset[],
): Promise<string[]> {
  const out: string[] = [];
  for (const a of assets) {
    const compressed = await nativeAssetToJpegProofDataUrl(a);
    if (compressed) {
      out.push(compressed);
      continue;
    }
    const mime = normalizeProofMime(a.mimeType, a.uri ?? '');
    let b64 = a.base64 ?? null;
    if (!b64 && a.uri) {
      try {
        b64 = await FileSystem.readAsStringAsync(a.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch {
        b64 = null;
      }
    }
    if (b64) {
      out.push(`data:${mime};base64,${b64}`);
    }
  }
  return out;
}

export async function launchProofImagePicker(): Promise<string[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error('需要相册权限以上传订餐凭证截图');
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: true,
    selectionLimit: MAX_PROOF,
    quality: 0.55,
    base64: true,
  });
  if (res.canceled || !res.assets?.length) return [];
  const out = await imagePickerAssetsToProofDataUrls(res.assets);
  if (out.length === 0 && res.assets.length > 0) {
    Alert.alert(
      '无法读取所选图片',
      '请重试一次，或换用相册里的 JPG/PNG 截图。若仍不行，请截屏后再从相册选择。',
    );
  }
  return out;
}

interface Props {
  images: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  /** 与日期并排：加大「添加」格、省略长说明 */
  compact?: boolean;
  /** 由外层写标题时设为 true，本组件不再渲染标题与提示 */
  hideTitle?: boolean;
  /** 与录入日期同一行双列：无图时铺满整列的添加条，避免小块贴边 */
  pairColumn?: boolean;
}

export function OrderProofSection({
  images,
  onChange,
  disabled,
  compact,
  hideTitle,
  pairColumn,
}: Props) {
  const [picking, setPicking] = useState(false);

  const add = async () => {
    if (disabled || picking) return;
    const room = MAX_PROOF - images.length;
    if (room <= 0) return;

    if (Platform.OS === 'web') {
      setPicking(true);
      try {
        const next = await pickProofImagesWeb(room);
        if (next.length === 0) return;
        onChange([...images, ...next].slice(0, MAX_PROOF));
      } finally {
        setPicking(false);
      }
      return;
    }

    setPicking(true);
    try {
      const next = await launchProofImagePicker();
      if (next.length === 0) return;
      const merged = [...images, ...next].slice(0, MAX_PROOF);
      onChange(merged);
    } finally {
      setPicking(false);
    }
  };

  const removeAt = (idx: number) => {
    onChange(images.filter((_, i) => i !== idx));
  };

  const pairMode = !!pairColumn && !!compact && !!hideTitle;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact, hideTitle && styles.wrapNoTitle]}>
      {!hideTitle ? (
        <>
          <Text variant="titleSmall" style={styles.label}>
            订餐凭证截图（至少 1 张）<Text style={styles.req}>*</Text>
          </Text>
          {!compact ? (
            <Text variant="bodySmall" style={styles.hint}>
              请上传聊天/订单截图以便核对份数与审计
            </Text>
          ) : null}
        </>
      ) : null}
      {pairMode ? (
        images.length === 0 ? (
          <Pressable
            style={[styles.addStripe, disabled && styles.addTileDisabled]}
            onPress={add}
            disabled={disabled || picking}
          >
            {picking ? (
              <ActivityIndicator size="small" color={IOS_COLORS.blue} />
            ) : (
              <View style={styles.addStripeInner}>
                <Ionicons name="images-outline" size={24} color={IOS_COLORS.blue} />
                <View>
                  <Text style={styles.addStripeText}>添加截图</Text>
                  <Text style={styles.addStripeSub}>相册可多选</Text>
                </View>
              </View>
            )}
          </Pressable>
        ) : (
          <View style={styles.pairGrid}>
            {images.map((uri, idx) => (
              <View key={`${idx}-${uri.slice(0, 32)}`} style={styles.pairThumbWrap}>
                <Image source={{ uri }} style={styles.pairThumb} resizeMode="cover" />
                <Pressable
                  style={styles.removeBtn}
                  onPress={() => removeAt(idx)}
                  disabled={disabled}
                  hitSlop={8}
                >
                  <Ionicons name="close-circle" size={20} color={IOS_COLORS.red} />
                </Pressable>
              </View>
            ))}
            {images.length < MAX_PROOF ? (
              <Pressable
                style={[styles.pairAddMini, disabled && styles.addTileDisabled]}
                onPress={add}
                disabled={disabled || picking}
              >
                {picking ? (
                  <ActivityIndicator size="small" color={IOS_COLORS.blue} />
                ) : (
                  <>
                    <Ionicons name="images-outline" size={22} color={IOS_COLORS.blue} />
                    <Text variant="labelSmall" style={styles.pairAddMiniText}>
                      添加
                    </Text>
                  </>
                )}
              </Pressable>
            ) : null}
          </View>
        )
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.row, compact && styles.rowCompact]}
          style={compact ? styles.scrollCompact : undefined}
        >
          {images.map((uri, idx) => (
            <View key={`${idx}-${uri.slice(0, 32)}`} style={styles.thumbWrap}>
              <Image
                source={{ uri }}
                style={[styles.thumb, compact && styles.thumbCompact]}
                resizeMode="cover"
              />
              <Pressable
                style={styles.removeBtn}
                onPress={() => removeAt(idx)}
                disabled={disabled}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={22} color={IOS_COLORS.red} />
              </Pressable>
            </View>
          ))}
          {images.length < MAX_PROOF ? (
            <Pressable
              style={[
                styles.addTile,
                compact && styles.addTileCompact,
                disabled && styles.addTileDisabled,
              ]}
              onPress={add}
              disabled={disabled || picking}
            >
              {picking ? (
                <ActivityIndicator size="small" />
              ) : (
                <>
                  <Ionicons
                    name="images-outline"
                    size={compact ? 30 : 28}
                    color={IOS_COLORS.blue}
                  />
                  <Text variant="labelSmall" style={[styles.addText, compact && styles.addTextCompact]}>
                    添加
                  </Text>
                </>
              )}
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, marginBottom: 12 },
  wrapCompact: {
    marginTop: 0,
    marginBottom: 0,
    alignSelf: 'stretch',
  },
  wrapNoTitle: { marginTop: 0 },
  addStripe: {
    alignSelf: 'stretch',
    minHeight: 52,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,122,255,0.22)',
    backgroundColor: 'rgba(0,122,255,0.06)',
    justifyContent: 'center',
  },
  addStripeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  addStripeText: { fontWeight: '700', color: IOS_COLORS.blue, fontSize: 16 },
  addStripeSub: { marginTop: 2, color: IOS_COLORS.labelSecondary, fontSize: 12 },
  pairGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignSelf: 'stretch',
    width: '100%',
  },
  pairThumbWrap: { position: 'relative' },
  pairThumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.fillLight,
  },
  pairAddMini: {
    width: 72,
    height: 72,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,122,255,0.22)',
    backgroundColor: 'rgba(0,122,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  pairAddMiniText: { fontSize: 11, fontWeight: '700', color: IOS_COLORS.blue, marginTop: 2 },
  label: { fontWeight: '600', marginBottom: 4 },
  req: { color: IOS_COLORS.red },
  hint: { color: IOS_COLORS.labelSecondary, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  rowCompact: {
    alignItems: 'center',
    paddingVertical: 6,
    flexGrow: 0,
    gap: 10,
  },
  scrollCompact: {},
  thumbWrap: { position: 'relative' },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: IOS_COLORS.fillLight },
  thumbCompact: { width: 88, height: 88, borderRadius: 12 },
  removeBtn: { position: 'absolute', top: -6, right: -6 },
  addTile: {
    width: 72,
    height: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: IOS_COLORS.separator,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_COLORS.fillLight,
  },
  addTileCompact: {
    width: 112,
    height: 112,
    minWidth: 112,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(0,122,255,0.28)',
    backgroundColor: 'rgba(0,122,255,0.07)',
  },
  addTileDisabled: { opacity: 0.5 },
  addText: { marginTop: 4, color: IOS_COLORS.blue },
  addTextCompact: { marginTop: 8, fontSize: 16, fontWeight: '700' },
});
