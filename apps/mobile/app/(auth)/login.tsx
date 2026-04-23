/**
 * 登录页 — iOS 风格
 */

import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../api/client';
import { IOS_COLORS } from '../../theme/paperTheme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError('请输入用户名和密码');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signIn(username.trim(), password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo区 */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>🍱</Text>
          </View>
          <Text style={styles.appName}>订餐会员管理</Text>
          <Text style={styles.appSubtitle}>健康漂亮餐 · 内部管理系统</Text>
        </View>

        {/* 表单卡片 */}
        <View style={styles.card}>
          <Text style={styles.formLabel}>用户名</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="请输入用户名"
            placeholderTextColor={IOS_COLORS.labelTertiary}
            returnKeyType="next"
          />
          <View style={styles.divider} />
          <Text style={styles.formLabel}>密码</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholder="请输入密码"
            placeholderTextColor={IOS_COLORS.labelTertiary}
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />
        </View>

        {/* 错误提示 */}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* 登录按钮 */}
        <Pressable
          style={({ pressed }) => [styles.loginBtn, pressed && styles.loginBtnPressed]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.loginBtnText}>登录</Text>
          }
        </Pressable>

        <Text style={styles.footer}>密码由管理员生成，如需重置请联系管理员</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOS_COLORS.systemGrouped },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  header: { alignItems: 'center', marginBottom: 32 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 20,
    backgroundColor: IOS_COLORS.blue,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
    shadowColor: IOS_COLORS.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  logoEmoji: { fontSize: 36 },
  appName: { fontSize: 28, fontWeight: '700', color: IOS_COLORS.label, letterSpacing: -0.5 },
  appSubtitle: { fontSize: 14, color: IOS_COLORS.labelSecondary, marginTop: 4 },

  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: IOS_COLORS.card,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.labelSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  input: {
    fontSize: 17,
    color: IOS_COLORS.label,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: IOS_COLORS.separator,
    marginLeft: 16,
  },

  errorBox: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFF0F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { fontSize: 14, color: IOS_COLORS.red, textAlign: 'center' },

  loginBtn: {
    width: '100%',
    maxWidth: 400,
    height: 50,
    borderRadius: 14,
    backgroundColor: IOS_COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  loginBtnPressed: { opacity: 0.85 },
  loginBtnText: { fontSize: 17, fontWeight: '600', color: '#fff' },

  footer: {
    fontSize: 13,
    color: IOS_COLORS.labelSecondary,
    marginTop: 20,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
