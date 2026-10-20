import { NextResponse } from "next/server";
import { proxyAuth } from "../auth";

export default proxyAuth((request) => {
  const path = request.nextUrl.pathname;
  const publicView = path === "/" || path === "/issues" || path === "/issues/backlog" || /^\/issues\/(?!new$|me$|templates(?:\/|$))[^/]+$/.test(path);
  const publicApi = path === "/api/auth" || path.startsWith("/api/auth/") || ["/api/issues", "/api/reports", "/api/discord/webhooks", "/api/staff-tools/snapshot"].includes(path);
  if (publicView || publicApi || request.auth || (process.env.NODE_ENV !== "production" && process.env.DEV_AUTO_AUTH !== "false")) return NextResponse.next();
  if (path.startsWith("/api/")) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const signIn = new URL("/api/auth/signin", request.url);
  signIn.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(signIn);
});

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|svg|webp|ico|css|js)$).*)"] };
