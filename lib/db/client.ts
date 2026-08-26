/**
 * 知径 Pathfinder — PostgreSQL Drizzle 客户端（M1）
 *
 * 仅服务端使用（App Router Route Handlers / Server Components / 脚本）。
 * DATABASE_URL 必须在启动前存在（site/.env.local），且必须指向独立 pathfinder 库。
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL 未配置。请在 site/.env.local 中设置（指向独立 pathfinder 库，严禁 mydb）。",
  );
}

/** 全局单例连接池（Next 服务端复用） */
export const pool = new Pool({ connectionString });

/** Drizzle 实例（含 schema 映射） */
export const db = drizzle(pool, { schema });

/** 关闭连接池（脚本用） */
export async function closeDb(): Promise<void> {
  await pool.end();
}
