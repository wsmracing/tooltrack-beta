"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AlertIcon, DownloadIcon, EditIcon, FileIcon, MoreIcon, PlusIcon, SearchIcon, ToolboxIcon, TransferIcon, UploadIcon } from "@/components/icons";
import { csvEscape, downloadTextFile } from "@/lib/csv";
import { getPlan } from "@/lib/plans";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase-browser";
import type { Asset, AssetLocation, Profile } from "@/lib/types";
import { friendlyError } from "@/lib/user-errors";
import { assetStatusLabel, effectiveMarketStatus } from "@/lib/asset-status";
import { downloadInsuranceSchedule } from "@/lib/pdf-reports";

const defaults = ["Drill / driver","Impact driver","Rotary hammer","Angle grinder","Circular saw","Cut-off saw / consaw","Hand tools","Test equipment","Lawn mower","Chainsaw","Site equipment","Plant / machinery","Tool storage","Other"];
type Filter = "all" | "registered" | "stolen" | "recovered";
type StoredPhoto = { asset_id: string; storage_path: string; original_name: string; created_at: string };

async function signPrivateFiles(bucket: string, paths: string[], token?: string) {
  if (!token || !paths.length) return {} as Record<string, string>;
  const response = await fetch("/api/storage/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ bucket, paths }),
  });
  if (!response.ok) return {} as Record<string, string>;
  const body = await response.json() as { urls?: Record<string, string> };
  return body.urls ?? {};
}

export default function AssetsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetPhotoUrls, setAssetPhotoUrls] = useState<Record<string, string>>({});
  const [locations, setLocations] = useState<AssetLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [bulk, setBulk] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [field, setField] = useState<"status" | "category" | "storage_location">("storage_location");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!isSupabaseConfigured()) { setError("ToolTrack is not connected to its database."); setLoading(false); return; }
    const supabase = getSupabaseBrowser();
    const { data: auth } = await supabase.auth.getUser();
    const { data: sessionData } = await supabase.auth.getSession();
    setUser(auth.user);
    if (!auth.user) { setLoading(false); return; }
    const [assetResponse, profileResponse, locationResponse] = await Promise.all([
      supabase.from("assets").select("*").order("registered_at", { ascending: false }),
      supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle(),
      supabase.from("asset_locations").select("*").order("name"),
    ]);
    if (assetResponse.error) {
      setError(friendlyError(assetResponse.error, "Your assets could not be loaded."));
    } else {
      const loadedAssets = (assetResponse.data ?? []) as Asset[];
      setAssets(loadedAssets);
      setAssetPhotoUrls({});
      if (loadedAssets.length) {
        const assetIds = loadedAssets.map((asset) => asset.id);
        const { data: photoData } = await supabase.from("asset_photos").select("asset_id, storage_path, original_name, created_at").in("asset_id", assetIds).order("created_at", { ascending: true });
        const firstPhotos = new Map<string, StoredPhoto>();
        ((photoData ?? []) as StoredPhoto[]).forEach((photo) => { if (!firstPhotos.has(photo.asset_id)) firstPhotos.set(photo.asset_id, photo); });
        const signed = await signPrivateFiles("asset-photos", [...firstPhotos.values()].map((photo) => photo.storage_path), sessionData.session?.access_token);
        setAssetPhotoUrls(Object.fromEntries([...firstPhotos.entries()].map(([assetId, photo]) => [assetId, signed[photo.storage_path] ?? ""])));
      }
    }
    if (profileResponse.data) setProfile(profileResponse.data as Profile);
    if (locationResponse.data) setLocations(locationResponse.data as AssetLocation[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => assets.filter((asset) => {
    const matchesStatus = filter === "all" || filter === "registered" ? (filter === "all" || asset.status === "safe" || asset.status === "transfer") : asset.status === filter;
    return matchesStatus && `${asset.make} ${asset.model} ${asset.serial_original} ${asset.category} ${asset.storage_location ?? ""}`.toLowerCase().includes(query.toLowerCase());
  }), [assets, filter, query]);
  const canBulk = getPlan(profile?.plan_tier).bulkTools;

  function toggle(id: string) { setSelected((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; }); }
  function selectAll() { setSelected((current) => current.size === filtered.length ? new Set() : new Set(filtered.map((asset) => asset.id))); }

  async function apply() {
    if (!selected.size || !value.trim() || !window.confirm(`Update ${selected.size} selected assets?`)) return;
    setSaving(true); setError("");
    const payload = field === "status" ? { status: value } : field === "category" ? { category: value.trim() } : { storage_location: value.trim(), location_id: locations.find((location) => location.name === value)?.id ?? null };
    const { error: updateError } = await getSupabaseBrowser().from("assets").update(payload).in("id", [...selected]);
    if (updateError) setError(friendlyError(updateError, "The selected assets could not be updated.")); else { setMessage(`${selected.size} assets updated.`); setSelected(new Set()); setValue(""); await load(); }
    setSaving(false);
  }

  function exportCsv() {
    const headers = ["make","model","category","serial","status","storage_location","estimated_value","supplier","purchase_date","purchase_price","invoice_number","registered_at"];
    const lines = [headers.join(","), ...filtered.map((asset) => [asset.make,asset.model,asset.category,asset.serial_original,assetStatusLabel(asset.status),asset.storage_location,asset.estimated_value,asset.supplier,asset.purchase_date,asset.purchase_price,asset.invoice_number,asset.registered_at].map(csvEscape).join(","))];
    downloadTextFile(`tooltrack-assets-${new Date().toISOString().slice(0, 10)}.csv`, lines.join("\n"));
  }

  async function exportPdf() {
    if (!user) return;
    try { await downloadInsuranceSchedule(filtered, { email: user.email, profile }); }
    catch (caught) { setError(friendlyError(caught, "The PDF could not be created.")); }
  }

  if (loading) return <div className="pageWidth pagePad"><div className="skeletonCard" /></div>;
  if (!user) return <div className="pageWidth pagePad narrowPage"><div className="emptyPanel"><ToolboxIcon /><h1>Sign in to view your assets</h1><Link className="button primary" href="/login?next=/assets">Sign in</Link></div></div>;

  const categories = [...new Set([...defaults, ...assets.map((asset) => asset.category)])].sort();
  const locationNames = [...new Set([...locations.map((location) => location.name), ...assets.map((asset) => asset.storage_location).filter(Boolean) as string[]])].sort();

  return <div className="pageWidth pagePad assetsPage">
    <div className="sectionTitleRow assetHeading"><div><h1>My assets</h1><p className="muted">Search and manage your registered equipment.</p></div><div className="compactHeadingActions"><details className="manageMenu"><summary className="button secondary"><MoreIcon /> Manage</summary><div className="manageMenuPanel"><Link href="/transfer"><TransferIcon /> Claim transferred asset</Link>{canBulk && <Link href="/import"><UploadIcon /> Import CSV</Link>}{canBulk && <button onClick={() => { setBulk((current) => !current); setSelected(new Set()); }}><EditIcon /> {bulk ? "Finish bulk edit" : "Bulk edit"}</button>}<button onClick={exportCsv}><DownloadIcon /> Export CSV</button><button onClick={() => void exportPdf()}><DownloadIcon /> Insurance PDF</button></div></details><Link className="button primary" href="/register"><PlusIcon /> Add asset</Link></div></div>
    {message && <div className="notice success">{message}</div>}{error && <div className="notice danger">{error}</div>}

    <div className="assetToolbar v45AssetToolbar"><div className="inputWithIcon"><SearchIcon /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search make, model or serial" /></div><div className="pills"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button><button className={filter === "registered" ? "active" : ""} onClick={() => setFilter("registered")}>Registered</button><button className={filter === "stolen" ? "active" : ""} onClick={() => setFilter("stolen")}>Stolen</button><button className={filter === "recovered" ? "active" : ""} onClick={() => setFilter("recovered")}>Recovered</button></div></div>

    {bulk && canBulk && <div className="bulkPanel"><div className="bulkSummary"><label className="checkRow compact"><input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={selectAll} /><span>Select all visible</span></label><strong>{selected.size} selected</strong></div><div className="bulkControls"><select value={field} onChange={(event) => { setField(event.target.value as typeof field); setValue(""); }}><option value="storage_location">Storage location</option><option value="category">Category</option><option value="status">Status</option></select>{field === "status" ? <select value={value} onChange={(event) => setValue(event.target.value)}><option value="">Choose status</option><option value="safe">Registered</option><option value="stolen">Stolen</option><option value="recovered">Recovered</option></select> : <><input list={field === "category" ? "bulk-categories" : "bulk-locations"} value={value} onChange={(event) => setValue(event.target.value)} placeholder="Choose or type a value" /><datalist id="bulk-categories">{categories.map((item) => <option value={item} key={item} />)}</datalist><datalist id="bulk-locations">{locationNames.map((item) => <option value={item} key={item} />)}</datalist></>}<button className="button primary" disabled={!selected.size || !value.trim() || saving} onClick={() => void apply()}>{saving ? "Updating…" : "Apply"}</button></div></div>}

    {filtered.length ? <div className="assetGrid">{filtered.map((asset) => {
      const market = effectiveMarketStatus(asset);
      const photoUrl = assetPhotoUrls[asset.id];
      return <article className={`assetCard assetCardV4 ${selected.has(asset.id) ? "selected" : ""}`} key={asset.id}>{bulk && canBulk && <label className="assetSelect"><input type="checkbox" checked={selected.has(asset.id)} onChange={() => toggle(asset.id)} /></label>}<Link href={`/asset/${asset.id}`} className="assetCardLink"><div className={`assetIcon assetThumb${photoUrl ? " hasImage" : ""}`}>{photoUrl ? <img src={photoUrl} alt={`${asset.make} ${asset.model}`} /> : <FileIcon />}</div><div className="assetMain"><div className="assetTop"><h3>{asset.make} {asset.model}</h3><span className={`status ${asset.status}`}>{assetStatusLabel(asset.status)}</span></div><p>{asset.category}</p><dl><div><dt>Serial</dt><dd>{asset.serial_original}</dd></div>{market === "for_sale" && <div><dt>Sale</dt><dd>Active</dd></div>}{asset.storage_location && <div><dt>Location</dt><dd>{asset.storage_location}</dd></div>}</dl></div>{asset.status === "stolen" && <AlertIcon className="assetAlert" />}</Link></article>;
    })}</div> : <div className="emptyPanel"><ToolboxIcon /><h2>{assets.length ? "No matching assets" : "No assets registered yet"}</h2><Link className="button primary" href="/register">Register an asset</Link></div>}
  </div>;
}
