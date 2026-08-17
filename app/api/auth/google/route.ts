import { getDb } from "@/db";
import { oauthStates } from "@/db/schema";
import { appOrigin, googleClientId, makeCookie, randomToken, sha256 } from "@/lib/auth";

function base64UrlDigest(value: string) {
  return sha256(value);
}

export async function GET(request: Request) {
  try {
    const state = randomToken();
    const codeVerifier = randomToken(48);
    const expiresAt = Math.floor(Date.now() / 1000) + 600;
    await getDb().insert(oauthStates).values({ id: state, codeVerifier, expiresAt });

    const origin = appOrigin(request);
    const params = new URLSearchParams({
      client_id: googleClientId(),
      redirect_uri: `${origin}/api/auth/callback/google`,
      response_type: "code",
      scope: "openid email profile",
      state,
      code_challenge: await base64UrlDigest(codeVerifier),
      code_challenge_method: "S256",
      prompt: "select_account",
    });
    const response = new Response(null, {
      status: 302,
      headers: { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` },
    });
    response.headers.append("Set-Cookie", makeCookie("edt_oauth_state", state, request, 600));
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const safeError = message.endsWith("is not configured.")
      ? "Google sign-in is not configured."
      : "Google sign-in is temporarily unavailable.";
    return Response.json({ error: safeError }, { status: 503 });
  }
}
