/**
 * 知径 Pathfinder — 口令哈希（M2）
 *
 * bcrypt cost 10。绝不存储明文口令。
 * 演示账号口令来自本地 .env.local 的 DEMO_PASSWORD（LOCAL DEV ONLY），不写入 Git。
 */
import bcrypt from "bcryptjs";

export const BCRYPT_ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
