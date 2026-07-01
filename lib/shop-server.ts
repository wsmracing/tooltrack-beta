import type { User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function authenticateShopRequest(authorization: string | null) {
  const admin = getSupabaseAdmin();
  if (!admin) return { admin: null, user: null, error: "Server configuration is incomplete." };
  const token = authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return { admin, user: null, error: "Sign in required." };
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return { admin, user: null, error: "Invalid or expired session." };
  return { admin, user: data.user, error: null };
}

export async function isShopAdmin(user: User) {
  const admin = getSupabaseAdmin();
  if (!admin) return false;
  const configured = (process.env.SHOP_ADMIN_EMAILS ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (user.email && configured.includes(user.email.toLowerCase())) return true;
  const { data } = await admin.from("shop_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  return Boolean(data);
}
