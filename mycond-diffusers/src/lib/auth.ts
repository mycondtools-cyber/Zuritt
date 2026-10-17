import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "admin_session";
const MAX_AGE = 60 * 60 * 24 * 14;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET is not set (min 16 chars)");
  return s;
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Buffer.from(sig).toString("base64url");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function checkPassword(password: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return safeEqual(await hmac(password), await hmac(expected));
}

export async function createSession() {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const token = `${exp}.${await hmac(String(exp))}`;
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  return safeEqual(sig, await hmac(exp));
}

/** Для server actions та сторінок адмінки */
export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}
