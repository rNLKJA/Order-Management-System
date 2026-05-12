/**
 * 会员快速资料弹层 —— 订餐 / 出餐 / 送餐 列表里点姓名时弹出。
 *
 * 设计原则：
 *  - 不离开当前页面（厨房/送餐场景下 router.push 会丢上下文）
 *  - 一屏看完关键信息：姓名+昵称、电话、地址、忌口、当前卡进度
 *  - 提供"打开完整资料"快捷入口给真的需要编辑的场景
 */

import { Modal, Pressable, ScrollView, StyleSheet, Text, View, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { IOS_COLORS } from '../theme/paperTheme';
import type { MockMember } from '../constants/mockData';

interface Props {
  visible: boolean;
  member: MockMember | null;
  onClose: () => void;
}

function callPhone(phone: string) {
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned) return;
  if (Platform.OS === 'web') {
    window.location.href = `tel:${cleaned}`;
  } else {
    Linking.openURL(`tel:${cleaned}`).catch(() => {});
  }
}

export function MemberQuickInfoModal({ visible, member, onClose }: Props) {
  if (!member) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose} />
      </Modal>
    );
  }

  const isWalkin = !!member.is_walkin;
  const card = member.active_card;

  const openFull = () => {
    onClose();
    if (isWalkin) {
      router.push({ pathname: '/(app)/walkins/[id]', params: { id: String(member.id) } });
    } else {
      router.push({ pathname: '/(app)/members/[id]', params: { id: String(member.id) } });
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={styles.sheet}
          onPress={(e) => e.stopPropagation()}
        >
          {/* 头部：头像 + 姓名 + 类型 badge */}
          <View style={styles.header}>
            <View
              style={[
                styles.avatar,
                {
                  backgroundColor: isWalkin
                    ? '#FFF4E5'
                    : member.is_hospital
                      ? IOS_COLORS.blueLight
                      : '#E8F8ED',
                },
              ]}
            >
              <Text
                style={[
                  styles.avatarText,
                  {
                    color: isWalkin
                      ? '#FF9500'
                      : member.is_hospital
                        ? IOS_COLORS.blue
                        : '#34C759',
                  },
                ]}
              >
                {(member.nickname || member.name)[0]}
              </Text>
            </View>
            <View style={styles.headerText}>
              <Text style={styles.name}>{member.name}</Text>
              {member.nickname ? (
                <Text style={styles.nickname}>"{member.nickname}"</Text>
              ) : null}
              <View style={styles.tagRow}>
                <View
                  style={[
                    styles.tag,
                    {
                      backgroundColor: isWalkin
                        ? '#FFF4E5'
                        : member.is_hospital
                          ? IOS_COLORS.blueLight
                          : '#E8F8ED',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tagText,
                      {
                        color: isWalkin
                          ? '#FF9500'
                          : member.is_hospital
                            ? IOS_COLORS.blue
                            : '#34C759',
                      },
                    ]}
                  >
                    {isWalkin ? '散客' : member.is_hospital ? '院内会员' : '院外会员'}
                  </Text>
                </View>
              </View>
            </View>
            <Pressable hitSlop={10} onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={IOS_COLORS.labelSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 8 }}>
            {/* 联系方式 */}
            <Section title="联系与送餐">
              <Row icon="call-outline" label="手机">
                {member.phone ? (
                  <Pressable onPress={() => callPhone(member.phone)} hitSlop={6}>
                    <Text style={[styles.value, styles.phoneLink]}>{member.phone}</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.valueMuted}>未填写</Text>
                )}
              </Row>
              {!isWalkin ? (
                <Row icon="logo-wechat" label="微信">
                  <Text style={member.wechat_id ? styles.value : styles.valueMuted}>
                    {member.wechat_id || '未填写'}
                  </Text>
                </Row>
              ) : null}
              <Row icon="location-outline" label="送餐地址" multiline>
                <Text style={member.address ? styles.value : styles.valueMuted}>
                  {member.address || '未填写（会员详情可编辑）'}
                </Text>
              </Row>
            </Section>

            {/* 忌口 */}
            {member.dietary_notes ? (
              <Section title="忌口">
                <View style={styles.dietBox}>
                  <Text style={styles.dietText}>{member.dietary_notes}</Text>
                </View>
              </Section>
            ) : null}

            {/* 当前卡（散客没有） */}
            {!isWalkin && card ? (
              <Section title="当前卡片">
                <View style={styles.cardBox}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardName}>{card.card_name}</Text>
                    <Text style={styles.cardMeta}>
                      {card.is_hospital ? '院内' : '院外'} · ¥{card.unit_price}/份
                    </Text>
                  </View>
                  <View style={styles.progressRow}>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.max(0, Math.min(100, (card.remaining_meals / card.total_meals) * 100))}%`,
                            backgroundColor:
                              card.remaining_meals <= 5
                                ? '#FF3B30'
                                : card.remaining_meals <= 10
                                  ? '#FF9500'
                                  : '#34C759',
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      <Text style={styles.progressRemain}>{card.remaining_meals}</Text>
                      <Text style={styles.progressTotal}> / {card.total_meals} 份</Text>
                    </Text>
                  </View>
                </View>
              </Section>
            ) : !isWalkin ? (
              <Section title="当前卡片">
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>暂无进行中的卡</Text>
                </View>
              </Section>
            ) : null}

            {/* 累计统计 */}
            {!isWalkin && member.stats ? (
              <Section title="累计">
                <View style={styles.statsRow}>
                  <Stat value={member.stats.total_purchased_meals} label="累计购餐" />
                  <Stat value={member.stats.total_consumed_meals} label="已消费" />
                  <Stat value={`¥${member.stats.total_paid_amount}`} label="累计付款" />
                </View>
              </Section>
            ) : null}
          </ScrollView>

          {/* 底部按钮 */}
          <Pressable style={styles.openFullBtn} onPress={openFull}>
            <Text style={styles.openFullText}>
              {isWalkin ? '打开散客详情' : '打开会员详情'}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({
  icon,
  label,
  multiline,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  multiline?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.row, multiline && styles.rowMultiline]}>
      <Ionicons name={icon} size={16} color={IOS_COLORS.labelSecondary} style={styles.rowIcon} />
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowValue}>{children}</View>
    </View>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    backgroundColor: IOS_COLORS.card,
    borderRadius: 18,
    overflow: 'hidden',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separatorLight,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 24, fontWeight: '700' },
  headerText: { flex: 1, gap: 2 },
  name: { fontSize: 20, fontWeight: '700', color: IOS_COLORS.label },
  nickname: { fontSize: 13, color: IOS_COLORS.labelSecondary, fontStyle: 'italic' },
  tagRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagText: { fontSize: 11, fontWeight: '700' },
  closeBtn: { padding: 4 },

  body: { paddingHorizontal: 18, paddingTop: 12 },

  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: IOS_COLORS.labelSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  rowMultiline: { alignItems: 'flex-start' },
  rowIcon: { width: 18, marginTop: 2 },
  rowLabel: { fontSize: 14, color: IOS_COLORS.labelSecondary, width: 56 },
  rowValue: { flex: 1 },
  value: { fontSize: 15, color: IOS_COLORS.label, fontWeight: '500' },
  valueMuted: { fontSize: 15, color: IOS_COLORS.labelTertiary },
  phoneLink: { color: IOS_COLORS.blue, textDecorationLine: 'underline' },

  dietBox: {
    backgroundColor: '#FFF7E6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dietText: { fontSize: 14, color: IOS_COLORS.label, lineHeight: 20 },

  cardBox: {
    backgroundColor: IOS_COLORS.fillLight,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { fontSize: 15, fontWeight: '700', color: IOS_COLORS.label },
  cardMeta: { fontSize: 12, color: IOS_COLORS.labelSecondary },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: IOS_COLORS.separatorLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  progressText: { fontSize: 13 },
  progressRemain: { fontWeight: '700', color: IOS_COLORS.label },
  progressTotal: { color: IOS_COLORS.labelSecondary },

  emptyBox: {
    backgroundColor: IOS_COLORS.fillLight,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  emptyText: { fontSize: 13, color: IOS_COLORS.labelSecondary },

  statsRow: { flexDirection: 'row', gap: 8 },
  statTile: {
    flex: 1,
    backgroundColor: IOS_COLORS.fillLight,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { fontSize: 16, fontWeight: '700', color: IOS_COLORS.label },
  statLabel: { fontSize: 11, color: IOS_COLORS.labelSecondary },

  openFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: IOS_COLORS.blue,
    paddingVertical: 14,
  },
  openFullText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
