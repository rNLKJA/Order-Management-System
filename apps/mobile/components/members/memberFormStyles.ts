import { Platform, StyleSheet } from 'react-native';
import { IOS_COLORS } from '../../theme/paperTheme';

export const memberFormStyles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 4,
  },

  pageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(17,17,17,0.06)',
  },
  pageBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: IOS_COLORS.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pageBannerText: { flex: 1, minWidth: 0, gap: 2 },
  pageBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  pageBannerDesc: {
    fontSize: 12,
    lineHeight: 16,
    color: IOS_COLORS.labelTertiary,
  },

  sectionLabelWrap: {
    paddingHorizontal: 6,
    paddingTop: 14,
    paddingBottom: 6,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.labelSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  fieldRequired: { color: IOS_COLORS.red, fontWeight: '700' },
  fieldInput: { fontSize: 16, color: IOS_COLORS.label, paddingVertical: 4 },
  fieldInputMulti: { minHeight: 56, textAlignVertical: 'top' },
  fieldError: { fontSize: 12, color: IOS_COLORS.red, marginTop: 4 },
  fieldHint: { fontSize: 12, color: IOS_COLORS.labelTertiary, marginTop: 4, lineHeight: 16 },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowLabel: { fontSize: 16, color: IOS_COLORS.label, fontWeight: '500' },
  rowHint: { fontSize: 12, color: IOS_COLORS.labelTertiary, marginTop: 2, lineHeight: 16 },

  notesInput: {
    fontSize: 15,
    color: IOS_COLORS.label,
    padding: 14,
    minHeight: 72,
    textAlignVertical: 'top',
  },

  submitBarShell: {
    paddingHorizontal: 14,
    paddingTop: 6,
    backgroundColor: 'transparent',
  },
  submitBarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 14,
    padding: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(17,17,17,0.06)',
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
  submitBtnFlex: { flex: 1, minWidth: 0 },
});
