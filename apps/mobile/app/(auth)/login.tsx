/**
 * 登录页。
 *
 * MVP 设计：
 * - 居中卡片，标题"订餐会员管理"
 * - username + password 两个 TextInput
 * - 主按钮"登录"
 * - 错误消息在表单下方以柔和 rose 色 Banner 展示
 */

import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import {
  Text,
  TextInput,
  Button,
  HelperText,
  Surface,
  useTheme,
} from 'react-native-paper';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../api/client';

export default function LoginScreen() {
  const theme = useTheme();
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onSubmit = async () => {
    Keyboard.dismiss();
    setErrorMsg(null);
    if (!username.trim() || !password) {
      setErrorMsg('请输入用户名和密码');
      return;
    }
    setSubmitting(true);
    try {
      await signIn(username.trim(), password);
      // 登录成功后 root layout 会自动重定向
    } catch (e) {
      if (e instanceof ApiError) setErrorMsg(e.message);
      else setErrorMsg('登录失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { backgroundColor: theme.colors.background }]}
    >
      <Surface
        style={[styles.card, { backgroundColor: theme.colors.surface }]}
        elevation={1}
      >
        <Text variant="headlineSmall" style={styles.title}>
          订餐会员管理
        </Text>
        <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
          请使用管理员分配的账号登录
        </Text>

        <TextInput
          label="用户名"
          value={username}
          onChangeText={setUsername}
          mode="outlined"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          style={styles.input}
        />

        <TextInput
          label="密码"
          value={password}
          onChangeText={setPassword}
          mode="outlined"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={onSubmit}
          style={styles.input}
        />

        {errorMsg ? (
          <HelperText type="error" visible style={styles.errorText}>
            {errorMsg}
          </HelperText>
        ) : null}

        <Button
          mode="contained"
          onPress={onSubmit}
          loading={submitting}
          disabled={submitting}
          style={styles.submit}
          contentStyle={{ paddingVertical: 6 }}
        >
          登录
        </Button>

        <Text variant="bodySmall" style={[styles.footer, { color: theme.colors.onSurfaceVariant }]}>
          忘记密码请联系管理员重置
        </Text>
      </Surface>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 16,
  },
  title: {
    fontWeight: '600',
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 20,
  },
  input: {
    marginBottom: 12,
  },
  errorText: {
    marginBottom: 4,
  },
  submit: {
    marginTop: 12,
    borderRadius: 10,
  },
  footer: {
    marginTop: 16,
    textAlign: 'center',
  },
});
