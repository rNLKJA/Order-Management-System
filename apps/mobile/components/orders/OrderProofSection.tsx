/**
 * 订餐凭证截图：相册多选 → data URL，与 API proof_images 对齐。
 */

import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { View, Image, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '../../theme/paperTheme';

const MAX_PROOF = 12;

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
}

export function OrderProofSection({ images, onChange, disabled }: Props) {
  const [picking, setPicking] = useState(false);

  const add = async () => {
    if (disabled || picking) return;
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

  return (
    <View style={styles.wrap}>
      <Text variant="titleSmall" style={styles.label}>
        订餐凭证截图（至少 1 张）<Text style={styles.req}>*</Text>
      </Text>
      <Text variant="bodySmall" style={styles.hint}>
        请上传聊天/订单截图以便核对份数与审计
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {images.map((uri, idx) => (
          <View key={`${idx}-${uri.slice(0, 32)}`} style={styles.thumbWrap}>
            <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
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
            style={[styles.addTile, disabled && styles.addTileDisabled]}
            onPress={add}
            disabled={disabled || picking}
          >
            {picking ? (
              <ActivityIndicator size="small" />
            ) : (
              <>
                <Ionicons name="images-outline" size={28} color={IOS_COLORS.blue} />
                <Text variant="labelSmall" style={styles.addText}>
                  添加
                </Text>
              </>
            )}
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, marginBottom: 12 },
  label: { fontWeight: '600', marginBottom: 4 },
  req: { color: IOS_COLORS.red },
  hint: { color: IOS_COLORS.labelSecondary, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  thumbWrap: { position: 'relative' },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: IOS_COLORS.fillLight },
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
  addTileDisabled: { opacity: 0.5 },
  addText: { marginTop: 4, color: IOS_COLORS.blue },
});
