"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AlertIcon, PlusIcon, ToolboxIcon } from "@/components/icons";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase-browser";
import type { Asset, Profile, Sighting } from "@/lib/types";
import { friendlyError } from "@/lib/user-errors";
import { assetStatusLabel } from "@/lib/asset-status";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      if (!isSupabaseConfigured()) {
        setError("ToolTrack is not connected to its database.");
        setLoading(false);
        return;
      }
      const supabase = getSupabaseBrowser();
      const { data: auth } = await supabase.auth.getUser();
      setUser(auth.user);
      if (!auth.user) {
        setLoading(false);
        return;
      }
      const [profileResponse, assetResponse, sightingResponse] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle(),
        supabase.from("assets").select("*").order("registered_at", { ascending: false }),
        supabase
          .from("sightings")
          .select("id, asset_id, theft_report_id, reporter_email, location_area, listing_url, details, status, notification_status, notification_sent_at, created_at, assets(make, model, serial_original)")
          .order("created_at", { ascending: false }),
      ]);
      if (profileResponse.data) setProfile(profileResponse.data as Profile);
      if (assetResponse.error) setError(friendlyError(assetResponse.error, "Your assets could not be loaded."));
      else setAssets((assetResponse.data ?? []) as Asset[]);
      if (sightingResponse.data) setSightings(sightingResponse.data as unknown as Sighting[]);
      setLoading(false);
    })();
  }, []);

  const greeting = useMemo(() => {
    const name = profile?.display_name?.trim() || String(user?.user_metadata?.full_name || "").trim();
    if (name) return name.split(/\s+/)[0];
    const emailName = user?.email?.split("@")[0] || "there";
    return emailName.charAt(0).toUpperCase() + emailName.slice(1);
  }, [profile, user]);

  if (loading) return <div className="pageWidth pagePad"><div className="skeletonCard" /></div>;
  if (!user) return <div className="pageWidth pagePad narrowPage"><div className="emptyPanel"><ToolboxIcon /><h1>Sign in to view your dashboard</h1><Link className="button primary" href="/login">Sign in</Link></div></div>;

  const newSightings = sightings.filter((item) => item.status === "new");
  const recentAssets = assets.slice(0, 3);
  const stolenCount = assets.filter((asset) => asset.status === "stolen").length;
  const value = assets.reduce((sum, asset) => sum + Number(asset.estimated_value ?? 0), 0);

  return <div className="pageWidth pagePad cleanDashboard v44Dashboard">
    <div className="sectionTitleRow dashboardHeading">
      <div>
        <p className="eyebrow red">Dashboard</p>
        <h1>Hello, {greeting}</h1>
        <p className="muted">Your assets and anything needing attention.</p>
      </div>
      <Link className="button primary" href="/register"><PlusIcon /> Add asset</Link>
    </div>

    {error && <div className="notice danger">{error}</div>}

    <section className="summaryStrip v44Summary">
      <Link href="/assets"><span>Assets</span><strong>{assets.length}</strong></Link>
      <Link href="/assets?status=stolen"><span>Stolen</span><strong className={stolenCount ? "redText" : ""}>{stolenCount}</strong></Link>
      <div><span>Estimated value</span><strong>€{value.toLocaleString("en-IE", { maximumFractionDigits: 0 })}</strong></div>
    </section>

    {newSightings.length > 0 && <section className="cleanSection dashboardPriority">
      <div className="cleanSectionHeader"><div><h2>New sightings</h2><p>Reports waiting for your review.</p></div><Link href="/sightings">View all</Link></div>
      <div className="compactList">
        {newSightings.slice(0, 2).map((sighting) => <Link href="/sightings" className="compactRow alertRow" key={sighting.id}>
          <AlertIcon />
          <div><strong>{sighting.assets?.make} {sighting.assets?.model}</strong><span>{sighting.location_area} · {new Date(sighting.created_at).toLocaleDateString("en-IE")}</span></div>
          <span className="status stolen">New</span>
        </Link>)}
      </div>
    </section>}

    <section className="cleanSection">
      <div className="cleanSectionHeader"><div><h2>Recent assets</h2><p>Your latest registrations.</p></div><Link href="/assets">View all</Link></div>
      {recentAssets.length ? <div className="compactList">
        {recentAssets.map((asset) => <Link href={`/asset/${asset.id}`} className="compactRow" key={asset.id}>
          <ToolboxIcon />
          <div><strong>{asset.make} {asset.model}</strong><span>Serial {asset.serial_original}</span></div>
          <span className={`status ${asset.status}`}>{assetStatusLabel(asset.status)}</span>
        </Link>)}
      </div> : <div className="emptyPanel compactEmpty"><ToolboxIcon /><h2>No assets yet</h2><p>Register your first tool or item to start your asset record.</p><Link className="button primary" href="/register">Register an asset</Link></div>}
    </section>
  </div>;
}
