import { NextRequest, NextResponse } from "next/server";
import { authenticatedUser } from "@/lib/server-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";

const allowedBuckets = new Set(["asset-photos", "ownership-documents"]);

type SignRequest = {
  bucket?: unknown;
  paths?: unknown;
};

function cleanPath(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 600) : "";
}

export async function POST(request: NextRequest) {
  const auth = await authenticatedUser(request);
  if (!auth) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Storage is temporarily unavailable." }, { status: 503 });

  const body = await request.json().catch(() => ({})) as SignRequest;
  const bucket = typeof body.bucket === "string" ? body.bucket : "";
  if (!allowedBuckets.has(bucket)) return NextResponse.json({ error: "Invalid storage bucket." }, { status: 400 });

  const paths = Array.isArray(body.paths)
    ? [...new Set(body.paths.map(cleanPath).filter(Boolean))].slice(0, 80)
    : [];
  if (!paths.length) return NextResponse.json({ urls: {} });

  const table = bucket === "asset-photos" ? "asset_photos" : "asset_documents";
  const { data: records, error } = await admin
    .from(table)
    .select("storage_path")
    .eq("owner_id", auth.user.id)
    .in("storage_path", paths);

  if (error) return NextResponse.json({ error: "Files could not be checked." }, { status: 400 });

  const allowedPaths = new Set((records ?? []).map((record) => record.storage_path as string));
  const entries = await Promise.all(paths.map(async (path) => {
    if (!allowedPaths.has(path)) return [path, ""] as const;
    const { data } = await admin.storage.from(bucket).createSignedUrl(path, 60 * 60);
    return [path, data?.signedUrl ?? ""] as const;
  }));

  return NextResponse.json({ urls: Object.fromEntries(entries.filter(([, url]) => Boolean(url))) });
}
