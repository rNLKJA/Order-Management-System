/**
 * 订餐凭证截图：相册多选 → data URL，与 API proof_images 对齐。
 *
 * Web：expo-image-picker 在部分浏览器下拿不到 base64，改用隐藏 file input + FileReader。
 */

import * as ImagePicker from 'expo-image-picker';
import {
  createElement,
  useCallback,
  useRef,
  useState,
  type ChangeEventHandler,
} from 'react';
import { View, Image, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '../../theme/paperTheme';

const MAX_PROOF = 12;

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

export async function launchProofImagePicker(): Promise<string[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error('需要相册权限以上传订餐凭证截图');
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: true,
    selectionLimit: MAX_PROOF,
    quality: 0.35,
    base64: true,
  });
  if (res.canceled || !res.assets?.length) return [];
  const out: string[] = [];
  for (const a of res.assets) {
    if (!a.base64) continue;
    const mime = a.mimeType && /^image\//.test(a.mimeType) ? a.mimeType : 'image/jpeg';
    out.push(`data:${mime};base64,${a.base64}`);
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
  const webFileInputRef = useRef<HTMLInputElement | null>(null);

  const onWebFileChange: ChangeEventHandler<HTMLInputElement> = useCallback(
    async (e) => {
      const files = e.target.files;
      e.target.value = '';
      if (disabled || !files?.length) return;
      setPicking(true);
      try {
        const room = MAX_PROOF - images.length;
        if (room <= 0) return;
        const next = await readBrowserFilesAsDataUrls(files, room);
        if (next.length === 0) return;
        onChange([...images, ...next].slice(0, MAX_PROOF));
      } finally {
        setPicking(false);
      }
    },
    [disabled, images, onChange],
  );

  const add = async () => {
    if (disabled || picking) return;
    if (Platform.OS === 'web') {
      webFileInputRef.current?.click();
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

  const pairStripe =
    !!pairColumn && !!compact && !!hideTitle && images.length === 0;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact, hideTitle && styles.wrapNoTitle]}>
      {Platform.OS === 'web'
        ? createElement('input', {
            type: 'file',
            accept: 'image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif',
            multiple: true,
            style: { display: 'none' },
            ref: (el: HTMLInputElement | null) => {
              webFileInputRef.current = el;
            },
            onChange: onWebFileChange,
          })
        : null}
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
      {pairStripe ? (
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.row,
            compact && styles.rowCompact,
            pairColumn && styles.rowPairWithThumbs,
          ]}
          style={pairColumn && images.length > 0 ? styles.scrollPair : compact ? styles.scrollCompact : undefined}
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
                compact && !pairColumn && styles.addTileCompact,
                compact && pairColumn && styles.addTilePairScroll,
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
  rowPairWithThumbs: {
    flexGrow: 1,
    minHeight: 88,
    alignItems: 'center',
  },
  scrollCompact: {},
  scrollPair: { alignSelf: 'stretch' },
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
  addTilePairScroll: {
    width: 80,
    height: 88,
    minWidth: 80,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(0,122,255,0.22)',
    backgroundColor: 'rgba(0,122,255,0.06)',
  },
  addTileDisabled: { opacity: 0.5 },
  addText: { marginTop: 4, color: IOS_COLORS.blue },
  addTextCompact: { marginTop: 8, fontSize: 16, fontWeight: '700' },
});
