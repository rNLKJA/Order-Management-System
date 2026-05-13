/**
 * CORS 白名单单元测试。
 */

import { describe, expect, it } from 'vitest';
import { buildCorsOriginChecker, _internal } from './cors-policy';

describe('buildCorsOriginChecker', () => {
  it('生产 web 域名放行（根 + www + app 子域）', () => {
    const check = buildCorsOriginChecker();
    expect(check('https://anshun-healthy-food.com')).toBe(
      'https://anshun-healthy-food.com',
    );
    expect(check('https://www.anshun-healthy-food.com')).toBe(
      'https://www.anshun-healthy-food.com',
    );
    expect(check('https://app.anshun-healthy-food.com')).toBe(
      'https://app.anshun-healthy-food.com',
    );
  });

  it('本地 Expo / dev 端口放行', () => {
    const check = buildCorsOriginChecker();
    expect(check('http://localhost:8080')).toBe('http://localhost:8080');
    expect(check('http://localhost:8081')).toBe('http://localhost:8081');
    expect(check('http://localhost:8082')).toBe('http://localhost:8082');
    expect(check('http://localhost:19006')).toBe('http://localhost:19006');
    expect(check('http://127.0.0.1:8081')).toBe('http://127.0.0.1:8081');
    expect(check('http://127.0.0.1:8082')).toBe('http://127.0.0.1:8082');
  });

  it('Vercel preview 子域名放行', () => {
    const check = buildCorsOriginChecker();
    expect(check('https://meal-mobile-git-main-foo.vercel.app')).toBe(
      'https://meal-mobile-git-main-foo.vercel.app',
    );
  });

  it('关闭 Vercel preview 后 *.vercel.app 拒绝', () => {
    const check = buildCorsOriginChecker({ allowVercelPreview: false });
    expect(check('https://anything.vercel.app')).toBe('');
  });

  it('http://*.vercel.app（明文）拒绝', () => {
    const check = buildCorsOriginChecker();
    expect(check('http://meal-mobile.vercel.app')).toBe('');
  });

  it('未在白名单 → 拒绝（返回空串，不写头）', () => {
    const check = buildCorsOriginChecker();
    expect(check('https://evil.example.com')).toBe('');
    expect(check('https://anshun-healthy-food.com.evil.com')).toBe('');
  });

  it('空 origin（移动端 / curl / SSR）→ 返回空串，由 hono 跳过头', () => {
    const check = buildCorsOriginChecker();
    expect(check('')).toBe('');
  });

  it('extra 列表追加生效', () => {
    const check = buildCorsOriginChecker({
      extra: ['https://staging.example.com'],
    });
    expect(check('https://staging.example.com')).toBe(
      'https://staging.example.com',
    );
  });

  it('parseExtra 解析逗号分隔，trim 并过滤空串', () => {
    expect(_internal.parseExtra(undefined)).toEqual([]);
    expect(_internal.parseExtra('')).toEqual([]);
    expect(_internal.parseExtra(' a , b ,, c ')).toEqual(['a', 'b', 'c']);
  });

  it('isVercelPreview 仅匹配 https + .vercel.app 结尾', () => {
    expect(_internal.isVercelPreview('https://x.vercel.app')).toBe(true);
    expect(_internal.isVercelPreview('https://x.vercel.app:443')).toBe(true);
    expect(_internal.isVercelPreview('http://x.vercel.app')).toBe(false);
    expect(_internal.isVercelPreview('https://vercel.app.evil.com')).toBe(
      false,
    );
    expect(_internal.isVercelPreview('not a url')).toBe(false);
  });
});
