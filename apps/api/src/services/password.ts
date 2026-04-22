/**
 * 密码哈希：argon2id。
 *
 * 规则（plan §14.2）：
 * - memoryCost=64MB / timeCost=3 / parallelism=1
 * - 不可逆；数据库只存哈希；不打日志；不回显
 */

import { hash, verify } from '@node-rs/argon2';

// argon2id 是 @node-rs/argon2 的默认算法；不显式设置 Algorithm
// 是为了避开 isolatedModules 下不能读取 ambient const enum 的限制。
const ARGON2_OPTIONS = {
  memoryCost: 64 * 1024, // 64 MB
  timeCost: 3,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(plain: string, storedHash: string): Promise<boolean> {
  try {
    return await verify(storedHash, plain);
  } catch {
    return false;
  }
}

/**
 * 生成 12 位随机密码。
 * 保证包含至少 1 个大写、1 个小写、1 个数字、1 个符号。
 *
 * 用于 admin 创建 staff / 重置密码，生成后一次性展示，不入库明文。
 */
export function generateRandomPassword(length = 12): string {
  const lowers = 'abcdefghijkmnopqrstuvwxyz'; // 去掉 l
  const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // 去掉 I O
  const digits = '23456789'; // 去掉 0 1
  const symbols = '!@#$%&*+-=?';
  const all = lowers + uppers + digits + symbols;

  const buf = crypto.getRandomValues(new Uint8Array(length));
  const pick = (set: string, idx: number) => set.charAt(buf[idx]! % set.length);

  const required = [pick(lowers, 0), pick(uppers, 1), pick(digits, 2), pick(symbols, 3)];
  const rest: string[] = [];
  for (let i = 4; i < length; i++) {
    rest.push(pick(all, i));
  }
  const chars = [...required, ...rest];

  // Fisher-Yates 洗牌
  for (let i = chars.length - 1; i > 0; i--) {
    const shuffle = crypto.getRandomValues(new Uint8Array(1))[0]! % (i + 1);
    [chars[i], chars[shuffle]] = [chars[shuffle]!, chars[i]!];
  }
  return chars.join('');
}
