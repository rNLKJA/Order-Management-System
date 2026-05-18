import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '../../theme/paperTheme';
import { memberFormStyles as styles } from './memberFormStyles';

export function MemberFormPageBanner({
  title,
  description,
  icon = 'person-add-outline',
}: {
  title: string;
  description: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.pageBanner}>
      <View style={styles.pageBannerIcon}>
        <Ionicons name={icon} size={22} color={IOS_COLORS.blue} />
      </View>
      <View style={styles.pageBannerText}>
        <Text style={styles.pageBannerTitle}>{title}</Text>
        <Text style={styles.pageBannerDesc} numberOfLines={3}>
          {description}
        </Text>
      </View>
    </View>
  );
}
