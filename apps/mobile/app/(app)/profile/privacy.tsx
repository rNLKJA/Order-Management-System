import { useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AppHeader, GlassSurface, MeshBackground, SectionLabel } from '../../../components/ui';
import { COLORS, SPACING, TYPE } from '../../../theme/paperTheme';
import { useScrollToTopOnFocus } from '../../../hooks/useScrollToTopOnFocus';

const LAST_UPDATED = '2026-04-25';

export default function PrivacyPolicyScreen() {
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTopOnFocus(scrollRef);

  return (
    <View style={styles.root}>
      <MeshBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <AppHeader title="隐私政策" onBack={() => router.back()} />
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
          <View style={styles.container}>
            <GlassSurface padding={SPACING.base} style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>生效日期：{LAST_UPDATED}</Text>
              <Text style={styles.noticeText}>
                本政策说明我们如何收集、使用、存储与保护你的资料。你继续使用本系统即表示你理解并同意本政策。
              </Text>
            </GlassSurface>

            <SectionLabel>我们收集哪些资料</SectionLabel>
            <GlassSurface padding={SPACING.base} style={styles.block}>
              <Text style={styles.paragraph}>
                1) 账号资料：用户名、显示名称、角色权限、头像。{'\n'}
                2) 业务资料：会员信息、订餐记录、卡务记录、财务流水。{'\n'}
                3) 设备与日志：登录状态、操作时间、关键操作审计记录。
              </Text>
            </GlassSurface>

            <SectionLabel>我们如何使用资料</SectionLabel>
            <GlassSurface padding={SPACING.base} style={styles.block}>
              <Text style={styles.paragraph}>
                我们仅将资料用于订餐管理、配送协作、财务核对、账号安全及审计追踪，不会将个人资料用于与业务无关的用途。
              </Text>
            </GlassSurface>

            <SectionLabel>资料共享与披露</SectionLabel>
            <GlassSurface padding={SPACING.base} style={styles.block}>
              <Text style={styles.paragraph}>
                我们不会出售个人资料。仅在以下情形共享：{'\n'}
                - 依法依规或监管要求；{'\n'}
                - 为实现系统服务所必需的受托处理；{'\n'}
                - 经你授权或你主动发起的业务操作。
              </Text>
            </GlassSurface>

            <SectionLabel>资料保存与安全</SectionLabel>
            <GlassSurface padding={SPACING.base} style={styles.block}>
              <Text style={styles.paragraph}>
                我们采用访问控制、鉴权与审计机制保护资料安全。资料仅在满足业务与合规要求的期限内保存，超期后按流程清理或匿名化处理。
              </Text>
            </GlassSurface>

            <SectionLabel>你的权利</SectionLabel>
            <GlassSurface padding={SPACING.base} style={styles.block}>
              <Text style={styles.paragraph}>
                你可以申请查阅、更正与你相关的账号资料；如需修改密码，请联系管理员。若你对资料处理有疑问，可联系系统管理员。
              </Text>
            </GlassSurface>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.systemGrouped },
  scroll: { paddingBottom: 32 },
  container: {
    width: '100%',
    maxWidth: SPACING.maxWidth,
    alignSelf: 'center',
    paddingHorizontal: SPACING.page,
    gap: SPACING.md,
  },
  noticeCard: {
    marginTop: SPACING.sm,
    gap: 6,
  },
  noticeTitle: {
    ...TYPE.callout,
    color: COLORS.text.primary,
    fontWeight: '700',
  },
  noticeText: {
    ...TYPE.footnote,
    color: COLORS.text.secondary,
    lineHeight: 19,
  },
  block: {
    gap: 6,
  },
  paragraph: {
    ...TYPE.body,
    color: COLORS.text.secondary,
    lineHeight: 22,
  },
});
