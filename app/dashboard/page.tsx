"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase-browser";
import type { Asset, Profile, Sighting } from "@/lib/types";
import { getPlan } from "@/lib/plans";
import { AlertIcon, MapPinIcon, PlusIcon, ShopIcon, ToolboxIcon, UploadIcon, UserIcon, UsersIcon } from "@/components/icons";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  async function loadDashboard() {
    if (!isSupabaseConfigured()) { setError("Supabase is not configured."); setLoading(false); return; }
    const supabase = getSupabaseBrowser();
    const { data: auth } = await supabase.auth.getUser();
    setUser(auth.user);
    if (!auth.user) { setLoading(false); return; }
    const [assetResponse, profileResponse, sightingResponse] = await Promise.all([
      supabase.from("assets").select("*").order("registered_at", { ascending: false }),
      supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle(),
      supabase.from("sightings").select("id, asset_id, theft_report_id, reporter_email, location_area, listing_url, details, status, notification_status, notification_sent_at, created_at, assets(make, model, serial_original)").order("created_at", { ascending: false }).limit(10),
    ]);
    if (assetResponse.error) setError(assetResponse.error.message); else setAssets((assetResponse.data ?? []) as Asset[]);
    if (profileResponse.data) setProfile(profileResponse.data as Profile);
    if (!sightingResponse.error) setSightings((sightingResponse.data ?? []) as unknown as Sighting[]);
    setLoading(false);
  }

  useEffect(() => { void loadDashboard(); }, []);
  const plan = getPlan(profile?.plan_tier);
  const greetingName = useMemo(() => {
    const saved = profile?.display_name?.trim();
    if (saved) return saved.split(/\s+/)[0];
    const metadataName = typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
    if (metadataName) return metadataName.split(/\s+/)[0];
    const emailPrefix = user?.email?.split("@")[0] ?? "there";
    return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
  }, [profile, user]);

  async function markReviewed(id: string) {
    const { error: updateError } = await getSupabaseBrowser().from("sightings").update({ status: "reviewed" }).eq("id", id);
    if (updateError) setError(updateError.message); else setSightings((current) => current.map((sighting) => sighting.id === id ? { ...sighting, status: "reviewed" } : sighting));
  }

  async function logout() {
    if (!window.confirm("Log out of ToolTrack?")) return;
    setLoggingOut(true);
    await getSupabaseBrowser().auth.signOut();
    router.replace("/"); router.refresh();
  }

  if (loading) return <div className="pageWidth pagePad"><div className="skeletonCard" /></div>;
  if (!user) return <div className="pageWidth pagePad narrowPage"><div className="emptyPanel"><ToolboxIcon /><h1>Sign in to open your dashboard</h1><p>Your ToolTrack dashboard contains assets, alerts, locations and account information.</p><Link className="button primary" href="/login?next=/dashboard">Sign in or register</Link></div></div>;

  const totalValue = assets.reduce((sum, asset) => sum + Number(asset.estimated_value ?? 0), 0);
  const recentAssets = assets.slice(0, 5);
  return <div className="pageWidth pagePad dashboardV4">
    <div className="sectionTitleRow dashboardHeading"><div><p className="eyebrow red">{plan.name} dashboard</p><h1>Hello, {greetingName}</h1><p className="muted">Your ToolTrack overview, alerts and quick actions.</p></div><div className="headingActions"><Link className="button secondary" href="/account"><UserIcon /> Account</Link><Link className="button primary" href="/register"><PlusIcon /> Add asset</Link></div></div>
    {error && <div className="notice danger">{error}</div>}
    <div className="planUsageBar"><div><strong>{assets.length.toLocaleString()} / {plan.assetLimit.toLocaleString()}</strong><span>assets on {plan.name}</span></div><div className="usageTrack"><span style={{ width: `${Math.min(100, (assets.length / plan.assetLimit) * 100)}%` }} /></div><Link href="/account#plans">Manage plan</Link></div>
    <div className="statsGrid fiveStats"><article><span>Registered</span><strong>{assets.length}</strong></article><article><span>Safe</span><strong>{assets.filter((asset) => asset.status === "safe").length}</strong></article><article className="dangerStat"><span>Stolen</span><strong>{assets.filter((asset) => asset.status === "stolen").length}</strong></article><article><span>Recovered</span><strong>{assets.filter((asset) => asset.status === "recovered").length}</strong></article><article><span>Value</span><strong>€{totalValue.toLocaleString("en-IE", { maximumFractionDigits: 0 })}</strong></article></div>
    <div className="managementGrid"><Link href="/assets"><ToolboxIcon /><span><strong>My assets</strong><small>Search, filter and bulk edit</small></span></Link><Link href="/locations"><MapPinIcon /><span><strong>Locations</strong><small>Vans, sheds, workshops and sites</small></span></Link><Link href="/import"><UploadIcon /><span><strong>Bulk import</strong><small>Load an existing list from CSV</small></span></Link><Link href="/team"><UsersIcon /><span><strong>Team access</strong><small>Invite staff and set permissions</small></span></Link><Link href="/shop"><ShopIcon /><span><strong>Security shop</strong><small>Markers, tags, locks and trackers</small></span></Link></div>
    {sightings.length > 0 && <section className="dashboardSection" id="sightings"><div className="dashboardSectionHeading"><div><p className="eyebrow red">Sighting inbox</p><h2>Reported sightings</h2></div><span className="countBadge">{sightings.filter((sighting) => sighting.status === "new").length} new</span></div><div className="sightingList">{sightings.map((sighting) => <article className={`sightingCard ${sighting.status === "new" ? "new" : ""}`} key={sighting.id}><div className="sightingTop"><div><strong>{sighting.assets?.make} {sighting.assets?.model}</strong><span>{sighting.assets?.serial_original}</span></div><span className={`status ${sighting.status === "new" ? "stolen" : "safe"}`}>{sighting.status}</span></div><p className="sightingLocation"><AlertIcon /> {sighting.location_area}</p><p>{sighting.details}</p>{sighting.listing_url && <a className="textLink" href={sighting.listing_url} target="_blank" rel="noreferrer">Open reported listing</a>}{sighting.reporter_email && <p className="smallText">Reporter contact: {sighting.reporter_email}</p>}<div className="sightingMeta"><span>{new Date(sighting.created_at).toLocaleString("en-IE")}</span>{sighting.status === "new" && <button type="button" onClick={() => void markReviewed(sighting.id)}>Mark reviewed</button>}</div></article>)}</div></section>}
    <section className="dashboardSection"><div className="dashboardSectionHeading"><div><p className="eyebrow red">Recent assets</p><h2>Latest registrations</h2></div><Link className="textLink" href="/assets">View all assets</Link></div>{recentAssets.length ? <div className="assetGrid compactAssetGrid">{recentAssets.map((asset) => <article className="assetCard assetCardV4" key={asset.id}><Link href={`/asset/${asset.id}`} className="assetCardLink"><div className="assetIcon"><ToolboxIcon /></div><div className="assetMain"><div className="assetTop"><h3>{asset.make} {asset.model}</h3><span className={`status ${asset.status}`}>{asset.status}</span></div><p>{asset.category}</p><dl><div><dt>Serial</dt><dd>{asset.serial_original}</dd></div><div><dt>Location</dt><dd>{asset.storage_location || "Not set"}</dd></div></dl></div></Link></article>)}</div> : <div className="emptyPanel"><ToolboxIcon /><h2>No assets registered yet</h2><Link className="button primary" href="/register">Register an asset</Link></div>}</section>
    <div className="dashboardFooterActions"><Link className="button secondary" href="/account">Profile & plan</Link><button className="button textButton" type="button" onClick={() => void logout()} disabled={loggingOut}>{loggingOut ? "Logging out…" : "Log out"}</button></div>
  </div>;
}
