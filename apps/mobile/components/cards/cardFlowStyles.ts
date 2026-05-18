import { Platform, StyleSheet } from 'react-native';
import { COLORS, IOS_COLORS, SPACING, TYPE } from '../../theme/paperTheme';

/** 开卡 / 升级 / 续卡 Modal — Mesh 底 + 白卡片，与会员档案 / 新增会员一致 */
export const cardFlowStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.systemGrouped },
  safe: { flex: 1, backgroundColor: 'transparent' },
  scrollView: { flex: 1, backgroundColor: 'transparent' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.page - 4,
    paddingVertical: SPACING.sm,
    minHeight: 52,
    backgroundColor: 'transparent',
  },
  headerSide: { flex: 1, minWidth: 72 },
  cancel: { ...TYPE.body, color: COLORS.brand, fontWeight: '600' },
  title: {
    ...TYPE.headline,
    color: COLORS.text.primary,
    textAlign: 'center',
    flex: 2,
    paddingHorizontal: 8,
  },
  disabled: { opacity: 0.35 },

  scroll: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 108,
    gap: 4,
  },

  sectionLabelWrap: {
    paddingHorizontal: 6,
    paddingTop: 14,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.labelSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHint: {
    fontSize: 12,
    color: IOS_COLORS.labelTertiary,
    flexShrink: 1,
    textAlign: 'right',
    maxWidth: '48%',
  },

  card: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(17,17,17,0.06)',
  },
  field: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separatorLight,
  },
  fieldLast: { borderBottomWidth: 0 },
  fieldLabel: { fontSize: 12, color: IOS_COLORS.labelSecondary, marginBottom: 2 },
  fieldInput: { fontSize: 16, color: IOS_COLORS.label, paddingVertical: 4 },
  notesInput: {
    fontSize: 15,
    color: IOS_COLORS.label,
    padding: 14,
    minHeight: 64,
    textAlignVertical: 'top',
  },

  currentCard: {
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: IOS_COLORS.blueLight,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,122,255,0.15)',
    gap: 2,
  },
  currentLabel: { fontSize: 14, fontWeight: '600', color: IOS_COLORS.label },
  currentSub: { fontSize: 12, color: IOS_COLORS.labelSecondary, lineHeight: 16 },

  priceListToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  priceListLabel: { fontSize: 15, fontWeight: '500', color: IOS_COLORS.label, flexShrink: 0 },

  warnBanner: {
    marginHorizontal: 6,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFF4E5',
    borderRadius: 10,
  },
  warnText: { fontSize: 12, color: IOS_COLORS.orange, lineHeight: 17 },

  pickerWrap: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 10,
  },
  pillScroll: {
    paddingHorizontal: 8,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  planPill: {
    minWidth: 76,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.systemGrouped,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(17,17,17,0.08)',
    alignItems: 'center',
    gap: 2,
  },
  planPillActive: {
    backgroundColor: COLORS.brandSoft,
    borderColor: COLORS.brand,
    borderWidth: 1.5,
  },
  planPillDisabled: { opacity: 0.4 },
  planPillText: {
    fontSize: 15,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  planPillTextActive: { color: COLORS.brand },
  planPillSub: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.labelSecondary,
    fontVariant: ['tabular-nums'],
  },
  planPillSubActive: { color: COLORS.brand },

  planDetail: {
    marginHorizontal: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: COLORS.systemGrouped,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(17,17,17,0.06)',
    gap: 6,
  },
  planDetailActive: {
    backgroundColor: COLORS.brandSoft,
    borderColor: 'rgba(0,122,255,0.25)',
  },
  planDetailTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  planDetailName: {
    fontSize: 18,
    fontWeight: '700',
    color: IOS_COLORS.label,
    flex: 1,
  },
  planDetailPrice: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.brand,
    fontVariant: ['tabular-nums'],
  },
  planDetailMeta: {
    fontSize: 14,
    color: IOS_COLORS.labelSecondary,
    lineHeight: 20,
  },
  planDetailHint: {
    marginHorizontal: 8,
    paddingVertical: 20,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: COLORS.systemGrouped,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  planDetailHintText: {
    fontSize: 14,
    color: IOS_COLORS.labelTertiary,
  },

  planOtherRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 8,
    paddingTop: 2,
  },
  planOtherBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.systemGrouped,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(17,17,17,0.08)',
  },
  planOtherBtnActive: {
    backgroundColor: COLORS.brandSoft,
    borderColor: 'rgba(0,122,255,0.3)',
  },
  planOtherBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.labelSecondary,
  },
  planOtherBtnTextActive: {
    color: COLORS.brand,
  },

  disabledReason: { fontSize: 11, color: IOS_COLORS.red, marginTop: 2 },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.systemGrouped,
  },
  chipActive: {
    backgroundColor: COLORS.brand,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: IOS_COLORS.labelSecondary },
  chipTextActive: { color: '#fff' },

  errorBanner: {
    marginHorizontal: 6,
    marginTop: 8,
    padding: 12,
    backgroundColor: '#FFF0F0',
    borderRadius: 10,
  },
  errorText: { fontSize: 14, color: IOS_COLORS.red },

  submitBarShell: {
    paddingHorizontal: 14,
    paddingTop: 6,
    backgroundColor: 'transparent',
  },
  submitBarCard: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 14,
    padding: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(17,17,17,0.06)',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
      default: {},
    }),
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 1px 6px rgba(0,0,0,0.05)',
        } as object)
      : {}),
  },
  submitSummaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
    minWidth: 0,
  },
  submitSummaryCol: { flex: 1, minWidth: 0 },
  summaryMain: { fontSize: 14, color: IOS_COLORS.label, lineHeight: 20 },
  summaryAmount: { fontSize: 22, fontWeight: '700', color: IOS_COLORS.blue },
  summarySub: { fontSize: 12, color: IOS_COLORS.labelTertiary, marginTop: 2, lineHeight: 16 },
  summaryHint: { fontSize: 13, color: IOS_COLORS.labelTertiary },

  submitBtn: {
    height: 46,
    borderRadius: 999,
    backgroundColor: IOS_COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  submitBtnDisabled: { backgroundColor: IOS_COLORS.labelTertiary, opacity: 0.55 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
