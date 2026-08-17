import { currentUser } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return Response.json({ user: null }, { status: 401 });
  return Response.json({ user });
}
