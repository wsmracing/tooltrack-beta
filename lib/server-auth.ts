import type { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function authenticatedUser(request: NextRequest): Promise<{ user: User; token: string } | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return { user: data.user, token };
}
