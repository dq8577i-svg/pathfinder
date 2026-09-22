/**
 * Next.js 16 Proxy：只做廉价 Cookie 门禁，权威会话校验仍由 Node Route Handler 完成。
 */
import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "pf_session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const isApi = pathname.startsWith("/api/v1");

  if (isApi) {
    const isPublicApi =
      pathname.startsWith("/api/v1/auth") || pathname.startsWith("/api/v1/health");
    if (isPublicApi) return NextResponse.next();
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

  if (process.env.AUTH_GATE === "true" && !token) {
    const url = new URL("/login", request.url);
    url.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/v1/:path*",
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
