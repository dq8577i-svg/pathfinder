/**
 * 知径 Pathfinder — PostgreSQL Drizzle 客户端（M1）
 *
 * 仅服务端使用（App Router Route Handlers / Server Components / 脚本）。
 *
 * 环境要求：
 *  - api 模式（NEXT_PUBLIC_DATA_SOURCE=api）：DATABASE_URL 必须在启动前存在
 *    （site/.env.local 或部署平台环境变量），且必须指向独立 pathfinder 库。
 *  - demo 模式：零依赖，允许无 DATABASE_URL（构建与运行均不连库）。
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const isApiMode = process.env.NEXT_PUBLIC_DATA_SOURCE === "api";
const connectionString = process.env.DATABASE_URL;

if (isApiMode && !connectionString) {
  throw new Error(
    "DATABASE_URL 未配置。请在 site/.env.local 中设置（指向独立 pathfinder 库，严禁 mydb）。",
  );
}

/**
 * 全局单例连接池（Next 服务端复用）。
 * demo 模式使用占位连接串：pg Pool 惰性建连（首条查询才真正连接），
 * demo 模式前端零查询故零连接；若意外调用 db 会以连接错误明确失败，而非静默连到错误库。
 */
export const pool = new Pool({
  connectionString: connectionString || "postgresql://unused:unused@127.0.0.1:5432/unused",
});

/** Drizzle 实例（含 schema 映射） */
export const db = drizzle(pool, { schema });

/** 关闭连接池（脚本用） */
export async function closeDb(): Promise<void> {
  await pool.end();
}
