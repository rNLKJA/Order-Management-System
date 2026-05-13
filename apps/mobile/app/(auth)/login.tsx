/**
 * 登录页 — v3 玻璃。
 */

import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { ApiError, getApiBaseUrl } from '../../api/client';
import { COLORS, GLASS, RADIUS, SPACING, TYPE } from '../../theme/paperTheme';
import { Button, GlassSurface, IconAvatar, MeshBackground } from '../../components/ui';

export default function LoginScreen() {
  const { signIn, user } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        const message = e instanceof Error ? e.message.toLowerCase() : '';
        const looksLikeNetworkError =
          message.includes('failed to fetch') ||
          message.includes('network request failed') ||
          message.includes('networkerror');
        if (looksLikeNetworkError) {
          const base = getApiBaseUrl();
          const isLocalApi =
            /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(base) ||
            /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}/i.test(base);
          setError(
            isLocalApi
              ? `无法连接本机 API（${base}）。请先执行：pnpm --filter @meal/api dev`
              : typeof __DEV__ !== 'undefined' && __DEV__
                ? `无法连接 API（${base}）。请检查网络、VPN 或防火墙后重试。`
                : '无法连接服务器，请检查网络后重试。',
          );
        } else {
          setError('登录失败，请稍后重试');
        }
      }
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
              <View style={styles.headerContent}>
                <GlassSurface
                  level={2}
                  tint="info"
                  padding={SPACING.sm}
                  radius="pill"
                  style={styles.badge}
                >
                  <Text style={styles.badgeText}>内部管理平台</Text>
                </GlassSurface>
                <Text style={styles.appName}>订餐会员管理</Text>
                <Text style={styles.appSubtitle}>健康漂亮餐 · 内部管理系统</Text>
              </View>
            </View>

            <GlassSurface padding={0} style={styles.card}>
              <View style={styles.field}>
                <Text style={styles.formLabel}>用户名</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="person-outline" size={18} color={COLORS.text.tertiary} />
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
              </View>
              <View style={styles.divider} />
              <View style={styles.field}>
                <Text style={styles.formLabel}>密码</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="lock-closed-outline" size={18} color={COLORS.text.tertiary} />
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    placeholder="请输入密码"
                    placeholderTextColor={COLORS.text.quaternary}
                    returnKeyType="go"
                    onSubmitEditing={handleLogin}
                  />
                  <Pressable
                    hitSlop={8}
                    onPress={() => setShowPassword((v) => !v)}
                    style={({ pressed }) => [styles.eyeBtn, pressed && styles.eyeBtnPressed]}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={COLORS.text.tertiary}
                    />
                  </Pressable>
                </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xl,
    gap: SPACING.base,
  },
  headerContent: { flex: 1, alignItems: 'flex-start' },
  logo: { marginBottom: 0 },
  badge: { marginBottom: SPACING.sm },
  badgeText: { ...TYPE.caption, color: COLORS.brand, fontWeight: '700', letterSpacing: 0.4 },
  appName: { ...TYPE.title1, color: COLORS.text.primary, lineHeight: 34 },
  appSubtitle: { ...TYPE.footnote, color: COLORS.text.tertiary, marginTop: 4 },

  card: { marginBottom: SPACING.md, borderWidth: 1, borderColor: GLASS.border },
  field: { paddingHorizontal: SPACING.base, paddingVertical: SPACING.md },
  formLabel: {
    ...TYPE.caption,
    color: COLORS.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  inputRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  input: {
    fontSize: 17,
    color: COLORS.text.primary,
    minHeight: 32,
    flex: 1,
    paddingVertical: 2,
  },
  eyeBtn: { padding: 2, borderRadius: 8 },
  eyeBtnPressed: { opacity: 0.6 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: GLASS.outline,
    marginLeft: SPACING.base,
  },

  errorBox: { marginBottom: SPACING.md },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  errorText: { ...TYPE.footnote, color: COLORS.danger, flex: 1 },

  loginBtn: { marginTop: 6, borderRadius: RADIUS.md },

  footer: {
    ...TYPE.footnote,
    color: COLORS.text.tertiary,
    marginTop: SPACING.lg,
    textAlign: 'center',
  },
});
