/**
 * 知径 Pathfinder — 认证门禁 middleware（M2）
 *
 * Edge 运行时（无法访问 pg），只做廉价检查：
 *  - /api/v1/*：除认证入口与健康检查外，必须有 pf_session Cookie，否则 401 JSON。
 *  - 受保护页面：仅在 AUTH_GATE=true 时拦截无 Cookie 访问并重定向到 /login。
 *    （默认关闭以保留「演示角色快速进入」体验；M7 前端接真实认证后开启。）
 *
 * 权威的会话校验（过期/吊销/哈希比对）在 Node 侧 lib/auth/require-user.ts 完成。
 * 静态资源 / _next 内部 / / /login /register 不在 matcher 内，天然放行。
 */
import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "pf_session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const isApi = pathname.startsWith("/api/v1");

  if (isApi) {
    // 公开的 /api/v1 子路径：认证入口（register/login/logout）与健康检查
    const isPublicApi =
      pathname.startsWith("/api/v1/auth") || pathname.startsWith("/api/v1/health");

    if (isPublicApi) return NextResponse.next();

    // 其余 /api/v1/* 为业务 API：无 Cookie → 401（与统一信封一致）
    if (!token) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "未登录或会话已失效",
            retryable: false,
            request_id: crypto.randomUUID(),
          },
        },
        { status: 401 },
      );
    }
    return NextResponse.next();
  }

  // 页面门禁（默认关，见文件头注释）
  if (process.env.AUTH_GATE === "true" && !token) {
    const url = new URL("/login", request.url);
    url.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // 业务 API 前缀（auth/health 在函数内放行）
    "/api/v1/:path*",
    // 受保护页面前缀（配合 AUTH_GATE=true）
    "/home/:path*",
    "/path/:path*",
    "/notes/:path*",
    "/practice/:path*",
    "/review/:path*",
    "/labs/:path*",
    "/skills/:path*",
    "/library/:path*",
    "/space/:path*",
    "/paths/:path*",
    "/crews/:path*",
    "/portfolio/:path*",
    "/search/:path*",
    "/org/:path*",
    "/admin/:path*",
  ],
};
