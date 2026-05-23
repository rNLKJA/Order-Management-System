import { StyleSheet } from 'react-native';
import { COLORS, SPACING, TYPE } from '../../theme/paperTheme';

/** 页面顶栏 / Sheet 顶栏共用 token */
export const headerStyles = StyleSheet.create({
  bar: {
    position: 'relative',
    minHeight: 52,
    paddingHorizontal: SPACING.page - 4,
    paddingVertical: SPACING.sm,
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
  },
  side: {
    minWidth: 88,
    maxWidth: '46%',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },
  sideRight: {
    justifyContent: 'flex-end',
    marginLeft: 'auto',
  },
  titleWrap: {
    position: 'absolute',
    left: 88,
    right: 88,
    top: SPACING.sm,
    bottom: SPACING.sm,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  title: {
    ...TYPE.headline,
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  titleSheet: {
    fontSize: 17,
    fontWeight: '600',
  },

  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  backText: {
    ...TYPE.body,
    color: COLORS.brand,
    marginLeft: 2,
  },
  pressed: { opacity: 0.6 },

  textAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  textActionLabel: {
    ...TYPE.body,
    color: COLORS.brand,
    fontWeight: '600',
  },
  textActionDisabled: { opacity: 0.35 },

  sheetSideBtn: {
    minWidth: 56,
    paddingVertical: 4,
  },
  sheetCancel: {
    ...TYPE.body,
    fontSize: 17,
    color: COLORS.text.tertiary,
  },
  sheetConfirm: {
    ...TYPE.body,
    fontSize: 17,
    color: COLORS.brand,
    fontWeight: '600',
    textAlign: 'right',
  },
});
