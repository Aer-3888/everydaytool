import { env } from "cloudflare:workers";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { oauthStates, users } from "@/db/schema";
import { appOrigin, createSession, googleClientId, googleClientSecret, isAllowedEmail, makeCookie, readCookie } from "@/lib/auth";

function signInError(request: Request, code: string) {
  return Response.redirect(`${appOrigin(request)}/budget?signIn=${encodeURIComponent(code)}`, 302);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const cookieState = readCookie(request, "edt_oauth_state");
  const clearState = makeCookie("edt_oauth_state", "", request, 0);
  if (!state || !code || !cookieState || state !== cookieState) return signInError(request, "invalid-state");

  const db = getDb();
  const [savedState] = await db.select().from(oauthStates).where(eq(oauthStates.id, state)).limit(1);
  await db.delete(oauthStates).where(eq(oauthStates.id, state));
  if (!savedState || savedState.expiresAt <= Math.floor(Date.now() / 1000)) return signInError(request, "expired-state");

  try {
    const origin = appOrigin(request);
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: googleClientId(),
        client_secret: googleClientSecret(),
        redirect_uri: `${origin}/api/auth/callback/google`,
        grant_type: "authorization_code",
        code_verifier: savedState.codeVerifier,
      }),
    });
    if (!tokenResponse.ok) return signInError(request, "token-failed");
    const tokenPayload = (await tokenResponse.json()) as { id_token?: unknown };
    if (typeof tokenPayload.id_token !== "string") return signInError(request, "token-missing");

    const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
    const { payload } = await jwtVerify(tokenPayload.id_token, jwks, {
      audience: googleClientId(),
      issuer: ["https://accounts.google.com", "accounts.google.com"],
    });
    const email = typeof payload.email === "string" ? payload.email : "";
    const name = typeof payload.name === "string" ? payload.name : null;
    const subject = typeof payload.sub === "string" ? payload.sub : "";
    if (payload.email_verified !== true || !subject || !isAllowedEmail(email)) return signInError(request, "restricted");

    await db.insert(users).values({ id: subject, email, name }).onConflictDoUpdate({
      target: users.id,
      set: { email, name, updatedAt: new Date().toISOString() },
    });
    const response = new Response(null, {
      status: 302,
      headers: { Location: `${origin}/budget` },
    });
    response.headers.append("Set-Cookie", clearState);
    response.headers.append("Set-Cookie", await createSession(subject, request));
    return response;
  } catch {
    if (env.ADMIN_EMAIL) return signInError(request, "verification-failed");
    return Response.json({ error: "Sign-in is unavailable." }, { status: 503 });
  }
}
