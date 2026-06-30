import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function DELETE(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Account deletion is not configured." }, { status: 503 });

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ error: "Your session is invalid or expired." }, { status: 401 });

  const userId = data.user.id;
  const [photos, documents] = await Promise.all([
    admin.from("asset_photos").select("storage_path").eq("owner_id", userId),
    admin.from("asset_documents").select("storage_path").eq("owner_id", userId),
  ]);

  const photoPaths = (photos.data ?? []).map((row) => row.storage_path as string).filter(Boolean);
  const documentPaths = (documents.data ?? []).map((row) => row.storage_path as string).filter(Boolean);

  if (photoPaths.length) await admin.storage.from("asset-photos").remove(photoPaths);
  if (documentPaths.length) await admin.storage.from("ownership-documents").remove(documentPaths);

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) return NextResponse.json({ error: "Could not delete the account." }, { status: 500 });

  return NextResponse.json({ success: true });
}
