/**
 * 登录页 — v3 玻璃。
 */

import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../api/client';
import { COLORS, GLASS, RADIUS, SPACING, TYPE } from '../../theme/paperTheme';
import { Button, GlassSurface, IconAvatar, MeshBackground } from '../../components/ui';

export default function LoginScreen() {
  const { signIn, user } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 登录成功后（user 被写入全局 store）自动跳到主页
  useEffect(() => {
    if (user) {
      router.replace('/(app)');
    }
  }, [user]);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError('请输入用户名和密码');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signIn(username.trim(), password);
      // 冗余跳转，避免某些 runtime 下 useEffect 未及时触发时点完按钮没反应
      router.replace('/(app)');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <MeshBackground />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.column}>
            <View style={styles.header}>
              <IconAvatar
                icon="restaurant-outline"
                size={72}
                color={COLORS.brand}
                bg="rgba(0,122,255,0.14)"
                style={styles.logo}
              />
              <Text style={styles.appName}>订餐会员管理</Text>
              <Text style={styles.appSubtitle}>健康漂亮餐 · 内部管理系统</Text>
            </View>

            <GlassSurface padding={0} style={styles.card}>
              <View style={styles.field}>
                <Text style={styles.formLabel}>用户名</Text>
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="请输入用户名"
                  placeholderTextColor={COLORS.text.quaternary}
                  returnKeyType="next"
                />
              </View>
              <View style={styles.divider} />
              <View style={styles.field}>
                <Text style={styles.formLabel}>密码</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  placeholder="请输入密码"
                  placeholderTextColor={COLORS.text.quaternary}
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                />
              </View>
            </GlassSurface>

            {error ? (
              <GlassSurface tint="danger" padding={SPACING.md} style={styles.errorBox}>
                <View style={styles.errorRow}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={16}
                    color={COLORS.danger}
                  />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              </GlassSurface>
            ) : null}

            <Button
              label="登录"
              onPress={handleLogin}
              loading={loading}
              fullWidth
              style={styles.loginBtn}
            />

            <Text style={styles.footer}>
              密码由管理员生成，如需重置请联系管理员
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.systemGrouped },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 40,
  },
  column: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  header: { alignItems: 'center', marginBottom: SPACING.xl },
  logo: { marginBottom: SPACING.base },
  appName: { ...TYPE.title1, color: COLORS.text.primary },
  appSubtitle: { ...TYPE.footnote, color: COLORS.text.tertiary, marginTop: 4 },

  card: { marginBottom: SPACING.md },
  field: { paddingHorizontal: SPACING.base, paddingVertical: SPACING.md },
  formLabel: {
    ...TYPE.caption,
    color: COLORS.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  input: {
    fontSize: 17,
    color: COLORS.text.primary,
    minHeight: 32,
    paddingVertical: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: GLASS.outline,
    marginLeft: SPACING.base,
  },

  errorBox: { marginBottom: SPACING.md },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  errorText: { ...TYPE.footnote, color: COLORS.danger, flex: 1 },

  loginBtn: { marginTop: 4, borderRadius: RADIUS.md },

  footer: {
    ...TYPE.footnote,
    color: COLORS.text.tertiary,
    marginTop: SPACING.lg,
    textAlign: 'center',
  },
});
