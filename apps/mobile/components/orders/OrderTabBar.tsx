import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '../../theme/paperTheme';
import { orderScreenStyles as styles } from './orderScreenStyles';
import { TABS, type PrimaryTab, type TabKey } from './constants';

export function OrderTabBar({
  activePrimary,
  activeTab,
  onTabChange,
}: {
  activePrimary: PrimaryTab;
  activeTab: TabKey;
  onTabChange: (t: TabKey) => void;
}) {
  const secondTabs =
    activePrimary === 'manage'
      ? TABS.filter(
          (t) =>
            t.key === 'overview' ||
            t.key === 'entry' ||
            t.key === 'entry_batch' ||
            t.key === 'entry_gift' ||
            t.key === 'retail',
        )
      : TABS.filter((t) => t.key === 'prep' || t.key === 'delivery' || t.key === 'courier');

  const denseTabs = secondTabs.length >= 4;

  return (
    <View style={styles.tabBar}>
      {secondTabs.map((t) => {
        const active = activeTab === t.key;
        return (
          <Pressable
            key={t.key}
            onPress={() => onTabChange(t.key)}
            style={[styles.tabItem, denseTabs && styles.tabItemDense, active && styles.tabItemActive]}
          >
            <Ionicons
              name={t.icon}
              size={denseTabs ? 16 : 18}
              color={active ? IOS_COLORS.blue : IOS_COLORS.labelSecondary}
            />
            <Text
              style={[
                styles.tabLabel,
                denseTabs && styles.tabLabelDense,
                active && styles.tabLabelActive,
              ]}
              numberOfLines={2}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
