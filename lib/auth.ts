import { env } from "cloudflare:workers";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";

const SESSION_COOKIE = "edt_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

export type SessionUser = { id: string; email: string; name: string | null };

function toBase64Url(bytes: Uint8Array) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

export function randomToken(bytes = 32) {
  const token = new Uint8Array(bytes);
  crypto.getRandomValues(token);
  return toBase64Url(token);
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toBase64Url(new Uint8Array(digest));
}

export function readCookie(request: Request, name: string) {
  const prefix = `${name}=`;
  for (const part of (request.headers.get("Cookie") ?? "").split(";")) {
    const item = part.trim();
    if (item.startsWith(prefix)) return item.slice(prefix.length);
  }
  return null;
}

export function makeCookie(name: string, value: string, request: Request, maxAge: number) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function appOrigin(request: Request) {
  return new URL(request.url).origin;
}

function secret(name: string) {
  const value = Reflect.get(env, name);
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

export function googleClientId() {
  return secret("GOOGLE_CLIENT_ID");
}

export function googleClientSecret() {
  return secret("GOOGLE_CLIENT_SECRET");
}

export async function currentUser(request: Request): Promise<SessionUser | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const now = Math.floor(Date.now() / 1000);
  const db = getDb();
  const [row] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
    .limit(1);
  return row ?? null;
}

export async function createSession(userId: string, request: Request) {
  const token = randomToken();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  await getDb().insert(sessions).values({ tokenHash: await sha256(token), userId, expiresAt });
  return makeCookie(SESSION_COOKIE, token, request, SESSION_MAX_AGE_SECONDS);
}

export async function clearSession(request: Request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) {
    await getDb().delete(sessions).where(eq(sessions.tokenHash, await sha256(token)));
  }
  return makeCookie(SESSION_COOKIE, "", request, 0);
}

export function isAllowedEmail(email: string) {
  return email.toLocaleLowerCase("en-US") === env.ADMIN_EMAIL.toLocaleLowerCase("en-US");
}
