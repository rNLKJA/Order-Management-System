/**
 * 全屏 Mesh Gradient 背景，见 DESIGN.md §3。
 * Web：LinearGradient + 3 个 RadialGradient 光斑（用 CSS 实现）。
 * Native：LinearGradient 三段 + 3 个半透明圆形 View 近似径向光。
 */

import { Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../theme/paperTheme';

export function MeshBackground() {
  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundImage: [
              `radial-gradient(800px 520px at 8% 10%, ${COLORS.mesh.spotBlue}, transparent 60%)`,
              `radial-gradient(700px 460px at 92% 14%, ${COLORS.mesh.spotGreen}, transparent 60%)`,
              `radial-gradient(900px 520px at 88% 92%, ${COLORS.mesh.spotOrange}, transparent 60%)`,
              `linear-gradient(135deg, ${COLORS.mesh.a} 0%, ${COLORS.mesh.b} 50%, ${COLORS.mesh.c} 100%)`,
            ].join(','),
          } as any,
        ]}
      />
    );
  }

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <LinearGradient
        colors={[COLORS.mesh.a, COLORS.mesh.b, COLORS.mesh.c]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={[styles.spot, styles.spotTL, { backgroundColor: COLORS.mesh.spotBlue }]} />
      <View style={[styles.spot, styles.spotTR, { backgroundColor: COLORS.mesh.spotGreen }]} />
      <View style={[styles.spot, styles.spotBR, { backgroundColor: COLORS.mesh.spotOrange }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  spot: {
    position: 'absolute',
    width: 480,
    height: 480,
    borderRadius: 240,
    opacity: 1,
  },
  spotTL: { left: -120, top: -120 },
  spotTR: { right: -100, top: -80 },
  spotBR: { right: -140, bottom: -120 },
});
