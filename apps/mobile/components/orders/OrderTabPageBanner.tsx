import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { orderTabPageMeta, type TabKey } from './constants';
import { orderScreenStyles as styles } from './orderScreenStyles';
import { IOS_COLORS } from '../../theme/paperTheme';

export function OrderTabPageBanner({ activeTab }: { activeTab: TabKey }) {
  const meta = orderTabPageMeta(activeTab);
  return (
    <View style={styles.tabPageBanner}>
      <View style={styles.tabPageBannerIcon}>
        <Ionicons name={meta.icon} size={22} color={IOS_COLORS.blue} />
      </View>
      <View style={styles.tabPageBannerText}>
        <Text style={styles.tabPageBannerTitle}>{meta.title}</Text>
        <Text style={styles.tabPageBannerDesc} numberOfLines={2}>
          {meta.description}
        </Text>
      </View>
    </View>
  );
}
