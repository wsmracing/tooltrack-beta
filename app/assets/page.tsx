"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { EditIcon, PlusIcon, SearchIcon, ToolboxIcon, TransferIcon, UploadIcon } from "@/components/icons";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase-browser";
import type { Asset, AssetLocation, Profile } from "@/lib/types";
import { friendlyError } from "@/lib/user-errors";
import { getPlan } from "@/lib/plans";
import { assetStatusLabel, effectiveMarketStatus } from "@/lib/asset-status";

const defaults = ["Drill / driver","Impact driver","Rotary hammer","Angle grinder","Circular saw","Cut-off saw / consaw","Test equipment","Lawn mower","Chainsaw","Site equipment","Plant / machinery","Tool storage","Other"];
type Filter = "all" | "registered" | "stolen" | "recovered";
type BulkField = "category" | "storage_location";

export default function AssetsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [locations, setLocations] = useState<AssetLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [bulk, setBulk] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [field, setField] = useState<BulkField>("storage_location");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!isSupabaseConfigured()) { setError("ToolTrack is not connected to its database."); setLoading(false); return; }
    const supabase = getSupabaseBrowser();
    const { data: auth } = await supabase.auth.getUser();
    setUser(auth.user);
    if (!auth.user) { setLoading(false); return; }
    const [assetResponse, profileResponse, locationResponse] = await Promise.all([
      supabase.from("assets").select("*").order("registered_at", { ascending: false }),
      supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle(),
      supabase.from("asset_locations").select("*").order("name"),
    ]);
    if (assetResponse.error) setError(friendlyError(assetResponse.error, "Your assets could not be loaded.")); else setAssets((assetResponse.data ?? []) as Asset[]);
    if (profileResponse.data) setProfile(profileResponse.data as Profile);
    if (locationResponse.data) setLocations(locationResponse.data as AssetLocation[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => assets.filter((asset) => {
    const matchesStatus = filter === "all"
      ? true
      : filter === "registered"
        ? asset.status === "safe" || asset.status === "transfer"
        : asset.status === filter;
    const haystack = `${asset.make} ${asset.model} ${asset.serial_original} ${asset.category} ${asset.storage_location ?? ""}`.toLowerCase();
    return matchesStatus && haystack.includes(query.toLowerCase());
  }), [assets, filter, query]);

  const canBulk = getPlan(profile?.plan_tier).bulkTools;
  const categories = [...new Set([...defaults, ...assets.map((asset) => asset.category)])].sort();
  const locationNames = [...new Set([...locations.map((location) => location.name), ...assets.map((asset) => asset.storage_location).filter(Boolean) as string[]])].sort();

  function toggle(id: string) {
    setSelected((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  function selectAll() {
    setSelected((current) => current.size === filtered.length ? new Set() : new Set(filtered.map((asset) => asset.id)));
  }

  async function apply() {
    if (!selected.size || !value.trim() || !window.confirm(`Update ${selected.size} selected assets?`)) return;
    setSaving(true); setError(""); setMessage("");
    const payload = field === "category"
      ? { category: value.trim() }
      : { storage_location: value.trim(), location_id: locations.find((location) => location.name === value)?.id ?? null };
    const { error: updateError } = await getSupabaseBrowser().from("assets").update(payload).in("id", [...selected]);
    if (updateError) setError(friendlyError(updateError, "The selected assets could not be updated."));
    else { setMessage(`${selected.size} assets updated.`); setSelected(new Set()); setValue(""); await load(); }
    setSaving(false);
  }

  if (loading) return <div className="pageWidth pagePad"><div className="skeletonCard" /></div>;
  if (!user) return <div className="pageWidth pagePad narrowPage"><div className="emptyPanel"><ToolboxIcon /><h1>Sign in to view your assets</h1><Link className="button primary" href="/login?next=/assets">Sign in</Link></div></div>;

  return <div className="pageWidth pagePad assetsPage">
    <div className="sectionTitleRow assetHeading"><div><h1>My assets</h1><p className="muted">Search and manage your registered equipment.</p></div><div className="compactHeadingActions"><Link className="button secondary" href="/transfer"><TransferIcon /> Claim transfer</Link>{canBulk && <Link className="button secondary" href="/import"><UploadIcon /> Import CSV</Link>}{canBulk && <button className="button secondary" onClick={() => { setBulk((current) => !current); setSelected(new Set()); }}><EditIcon /> {bulk ? "Finish bulk edit" : "Bulk edit"}</button>}<Link className="button primary" href="/register"><PlusIcon /> Add asset</Link></div></div>
    {message && <div className="notice success">{message}</div>}{error && <div className="notice danger">{error}</div>}

    <div className="assetToolbar v45AssetToolbar"><div className="inputWithIcon"><SearchIcon /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search make, model or serial" /></div><div className="pills"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button><button className={filter === "registered" ? "active" : ""} onClick={() => setFilter("registered")}>Registered</button><button className={filter === "stolen" ? "active" : ""} onClick={() => setFilter("stolen")}>Stolen</button><button className={filter === "recovered" ? "active" : ""} onClick={() => setFilter("recovered")}>Recovered</button></div></div>

    {bulk && canBulk && <div className="bulkPanel"><div className="bulkSummary"><label className="checkRow compact"><input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={selectAll} /><span>Select all visible</span></label><strong>{selected.size} selected</strong></div><div className="bulkControls"><select value={field} onChange={(event) => { setField(event.target.value as BulkField); setValue(""); }}><option value="storage_location">Storage location</option><option value="category">Category</option></select><input list={field === "category" ? "bulk-categories" : "bulk-locations"} value={value} onChange={(event) => setValue(event.target.value)} placeholder="Choose or type a value" /><datalist id="bulk-categories">{categories.map((item) => <option value={item} key={item} />)}</datalist><datalist id="bulk-locations">{locationNames.map((item) => <option value={item} key={item} />)}</datalist><button className="button primary" disabled={!selected.size || !value.trim() || saving} onClick={() => void apply()}>{saving ? "Updating…" : "Apply"}</button></div><p className="muted">Asset status cannot be changed in bulk. Stolen and recovered states must use the asset detail workflow so theft reports and audit records are preserved.</p></div>}

    {filtered.length ? <div className="assetGrid">{filtered.map((asset) => {
      const market = effectiveMarketStatus(asset);
      return <article className={`assetCard assetCardV4 ${selected.has(asset.id) ? "selected" : ""}`} key={asset.id}>{bulk && canBulk && <label className="assetSelect"><input type="checkbox" checked={selected.has(asset.id)} onChange={() => toggle(asset.id)} /></label>}<Link href={`/asset/${asset.id}`} className="assetCardLink"><div className="assetIcon"><ToolboxIcon /></div><div className="assetMain"><div className="assetTop"><h3>{asset.make} {asset.model}</h3><span className={`status ${asset.status}`}>{assetStatusLabel(asset.status)}</span></div><p>{asset.category}</p><dl><div><dt>Serial</dt><dd>{asset.serial_original}</dd></div>{market === "for_sale" && <div><dt>Sale</dt><dd>Active</dd></div>}{asset.storage_location && <div><dt>Location</dt><dd>{asset.storage_location}</dd></div>}</dl></div></Link></article>;
    })}</div> : <div className="emptyPanel"><ToolboxIcon /><h2>{assets.length ? "No matching assets" : "No assets registered yet"}</h2><Link className="button primary" href="/register">Register an asset</Link></div>}
  </div>;
}
