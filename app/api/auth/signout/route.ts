import { clearSession } from "@/lib/auth";

export async function POST(request: Request) {
  const response = Response.json({ ok: true });
  response.headers.append("Set-Cookie", await clearSession(request));
  return response;
}
