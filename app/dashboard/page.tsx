"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase-browser";
import type { Asset, Profile, Sighting } from "@/lib/types";
import { AlertIcon, PlusIcon, SearchIcon, ToolboxIcon, UserIcon } from "@/components/icons";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "safe" | "stolen">("all");
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  async function loadDashboard() {
    if (!isSupabaseConfigured()) {
      setError("Supabase is not configured.");
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

    const [assetResponse, profileResponse, sightingResponse] = await Promise.all([
      supabase.from("assets").select("*").order("registered_at", { ascending: false }),
      supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle(),
      supabase.from("sightings").select("id, asset_id, theft_report_id, reporter_email, location_area, listing_url, details, status, notification_status, notification_sent_at, created_at, assets(make, model, serial_original)").order("created_at", { ascending: false }).limit(20),
    ]);

    if (assetResponse.error) setError(assetResponse.error.message);
    else setAssets((assetResponse.data ?? []) as Asset[]);

    if (!profileResponse.error && profileResponse.data) setProfile(profileResponse.data as Profile);
    if (!sightingResponse.error) setSightings((sightingResponse.data ?? []) as unknown as Sighting[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const greetingName = useMemo(() => {
    const saved = profile?.display_name?.trim();
    if (saved) return saved.split(/\s+/)[0];
    const metadataName = typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
    if (metadataName) return metadataName.split(/\s+/)[0];
    const emailPrefix = user?.email?.split("@")[0] ?? "there";
    return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
  }, [profile, user]);

  const filtered = useMemo(() => assets.filter((asset) => {
    const matchesStatus = filter === "all" || asset.status === filter;
    const text = `${asset.make} ${asset.model} ${asset.serial_original} ${asset.category}`.toLowerCase();
    return matchesStatus && text.includes(query.toLowerCase());
  }), [assets, filter, query]);

  async function logout() {
    if (!window.confirm("Log out of ToolTrack?")) return;
    setLoggingOut(true);
    await getSupabaseBrowser().auth.signOut();
    router.replace("/");
    router.refresh();
  }

  async function markReviewed(id: string) {
    const supabase = getSupabaseBrowser();
    const { error: updateError } = await supabase.from("sightings").update({ status: "reviewed" }).eq("id", id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSightings((current) => current.map((sighting) => sighting.id === id ? { ...sighting, status: "reviewed" } : sighting));
  }

  if (loading) return <div className="pageWidth pagePad"><div className="skeletonCard" /></div>;
  if (!user) return <div className="pageWidth pagePad narrowPage"><div className="emptyPanel"><ToolboxIcon /><h1>Sign in to view your assets</h1><p>Your registered assets and private documents are linked to your account.</p><Link className="button primary" href="/login">Sign in or register</Link></div></div>;

  return (
    <div className="pageWidth pagePad">
      <div className="sectionTitleRow dashboardHeading">
        <div><p className="eyebrow red">Your dashboard</p><h1>Hello, {greetingName}</h1><p className="muted">Manage your registered tools, equipment and theft reports.</p></div>
        <div className="headingActions"><Link className="button secondary" href="/account"><UserIcon /> Account</Link><Link className="button primary" href="/register"><PlusIcon /> Add asset</Link></div>
      </div>

      {error && <div className="notice danger">{error}. Have you run the V3.2 Supabase migration?</div>}

      <div className="statsGrid">
        <article><span>Registered</span><strong>{assets.length}</strong></article>
        <article><span>Safe</span><strong>{assets.filter((asset) => asset.status === "safe").length}</strong></article>
        <article className="dangerStat"><span>Stolen</span><strong>{assets.filter((asset) => asset.status === "stolen").length}</strong></article>
      </div>

      {sightings.length > 0 && <section className="dashboardSection" id="sightings">
        <div className="dashboardSectionHeading"><div><p className="eyebrow red">Sighting inbox</p><h2>Reported sightings</h2></div><span className="countBadge">{sightings.filter((sighting) => sighting.status === "new").length} new</span></div>
        <div className="sightingList">{sightings.map((sighting) => <article className={`sightingCard ${sighting.status === "new" ? "new" : ""}`} key={sighting.id}>
          <div className="sightingTop"><div><strong>{sighting.assets?.make} {sighting.assets?.model}</strong><span>{sighting.assets?.serial_original}</span></div><span className={`status ${sighting.status === "new" ? "stolen" : "safe"}`}>{sighting.status}</span></div>
          <p className="sightingLocation"><AlertIcon /> {sighting.location_area}</p>
          <p>{sighting.details}</p>
          {sighting.listing_url && <a className="textLink" href={sighting.listing_url} target="_blank" rel="noreferrer">Open reported listing</a>}
          {sighting.reporter_email && <p className="smallText">Reporter contact: {sighting.reporter_email}</p>}
          <div className="sightingMeta"><span>{new Date(sighting.created_at).toLocaleString("en-IE")}</span>{sighting.status === "new" && <button type="button" onClick={() => void markReviewed(sighting.id)}>Mark reviewed</button>}</div>
        </article>)}</div>
      </section>}

      <section className="dashboardSection">
        <div className="toolbar"><div className="inputWithIcon"><SearchIcon /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search my assets" /></div><div className="pills"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button><button className={filter === "safe" ? "active" : ""} onClick={() => setFilter("safe")}>Safe</button><button className={filter === "stolen" ? "active" : ""} onClick={() => setFilter("stolen")}>Stolen</button></div></div>

        {filtered.length === 0 ? <div className="emptyPanel"><ToolboxIcon /><h2>{assets.length ? "No matching assets" : "No assets registered yet"}</h2><p>{assets.length ? "Try changing the search or filter." : "Register the first asset from your phone."}</p><Link className="button primary" href="/register">Register an asset</Link></div> : <div className="assetGrid">{filtered.map((asset) => <Link href={`/asset/${asset.id}`} className="assetCard" key={asset.id}><div className="assetIcon"><ToolboxIcon /></div><div className="assetMain"><div className="assetTop"><h2>{asset.make} {asset.model}</h2><span className={`status ${asset.status}`}>{asset.status}</span></div><p>{asset.category}</p><dl><div><dt>Serial</dt><dd>{asset.serial_original}</dd></div><div><dt>Registered</dt><dd>{new Date(asset.registered_at).toLocaleDateString("en-IE")}</dd></div></dl></div>{asset.status === "stolen" && <AlertIcon className="assetAlert" />}</Link>)}</div>}
      </section>

      <div className="dashboardFooterActions"><Link className="button secondary" href="/account">Profile settings</Link><button className="button textButton" type="button" onClick={() => void logout()} disabled={loggingOut}>{loggingOut ? "Logging out…" : "Log out"}</button></div>
    </div>
  );
}
