/**
 * 新增会员页 - MEA-10。
 *
 * 提交后若 API 返回 duplicatePhone，用 Dialog 让用户选：
 * - 跳到已有会员详情
 * - 仍然保留新建（已经存了）
 */

import { useState } from 'react';
import { Appbar, Dialog, Portal, Text, Button, Snackbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { MemberForm } from '../../../components/MemberForm';
import { membersApi, type DuplicatePhoneHint } from '../../../api/members';
import { ApiError } from '../../../api/client';

export default function NewMemberScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<
    { hint: DuplicatePhoneHint; newId: number } | null
  >(null);

  return (
    <>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="新增会员" />
      </Appbar.Header>

      <MemberForm
        submitLabel="创建会员"
        submitting={submitting}
        onCancel={() => router.back()}
        onSubmit={async (values) => {
          setSubmitting(true);
          try {
            const res = await membersApi.create(values);
            qc.invalidateQueries({ queryKey: ['members'] });
            if (res.duplicatePhone) {
              setDuplicate({ hint: res.duplicatePhone, newId: res.member.id });
            } else {
              router.replace(`/(app)/members/${res.member.id}`);
            }
          } catch (e) {
            if (e instanceof ApiError) setErrorMsg(e.message);
            else setErrorMsg('创建失败，请稍后重试');
          } finally {
            setSubmitting(false);
          }
        }}
      />

      <Portal>
        <Dialog visible={!!duplicate} onDismiss={() => setDuplicate(null)}>
          <Dialog.Title>手机号已存在</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              这个手机号已属于另一位会员：{duplicate?.hint.existing_uid}
              。新会员已创建（家庭共号属正常情况），你可以：
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                if (!duplicate) return;
                const id = duplicate.hint.existing_member_id;
                setDuplicate(null);
                router.replace(`/(app)/members/${id}`);
              }}
            >
              查看已有会员
            </Button>
            <Button
              mode="contained"
              onPress={() => {
                if (!duplicate) return;
                const id = duplicate.newId;
                setDuplicate(null);
                router.replace(`/(app)/members/${id}`);
              }}
            >
              打开新会员
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={!!errorMsg}
        onDismiss={() => setErrorMsg(null)}
        duration={4000}
      >
        {errorMsg ?? ''}
      </Snackbar>
    </>
  );
}
