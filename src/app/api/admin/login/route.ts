import { NextResponse } from "next/server";
import { verifyCredentials, sessionToken, adminConfigured, ADMIN_COOKIE } from "@/lib/admin-auth";

export async function POST(req: Request) {
  if (!adminConfigured()) {
    return NextResponse.json({ error: "Admin is not configured. Set ADMIN_PASSWORD." }, { status: 503 });
  }
  const { username, password } = await req.json().catch(() => ({ username: "", password: "" }));
  if (!verifyCredentials(username ?? "", password ?? "")) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, sessionToken()!, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });
  return res;
}
