/**
 * 知径 Pathfinder — Drizzle Kit 配置（M1）
 *
 * PostgreSQL dialect（严禁使用根目录旧的 sqlite 配置）。
 * 显式加载 .env.local（Next 与脚本共用同一份 DATABASE_URL）。
 */
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./database/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: true,
});
