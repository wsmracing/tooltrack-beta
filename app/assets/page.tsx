"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase-browser";
import type { Asset, AssetLocation, Profile } from "@/lib/types";
import { csvEscape, downloadTextFile } from "@/lib/csv";
import { getPlan } from "@/lib/plans";
import { AlertIcon, DownloadIcon, EditIcon, PlusIcon, SearchIcon, ToolboxIcon, UploadIcon } from "@/components/icons";

const defaultCategories = ["Drill / driver", "Impact driver", "Rotary hammer", "Angle grinder", "Circular saw", "Cut-off saw / consaw", "Hand tools", "Test equipment", "Lawn mower", "Chainsaw", "Site equipment", "Plant / machinery", "Tool storage", "Other"];

export default function AssetsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [locations, setLocations] = useState<AssetLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "safe" | "stolen" | "recovered">("all");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkField, setBulkField] = useState<"status" | "category" | "storage_location">("storage_location");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  async function loadAssets() {
    if (!isSupabaseConfigured()) { setError("Supabase is not configured."); setLoading(false); return; }
    const supabase = getSupabaseBrowser();
    const { data: auth } = await supabase.auth.getUser();
    setUser(auth.user);
    if (!auth.user) { setLoading(false); return; }
    const [assetResponse, profileResponse, locationResponse] = await Promise.all([
      supabase.from("assets").select("*").order("registered_at", { ascending: false }),
      supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle(),
      supabase.from("asset_locations").select("*").order("name"),
    ]);
    if (assetResponse.error) setError(assetResponse.error.message); else setAssets((assetResponse.data ?? []) as Asset[]);
    if (profileResponse.data) setProfile(profileResponse.data as Profile);
    if (locationResponse.data) setLocations(locationResponse.data as AssetLocation[]);
    setLoading(false);
  }

  useEffect(() => { void loadAssets(); }, []);

  const plan = getPlan(profile?.plan_tier);
  const canBulk = plan.bulkTools;
  const filtered = useMemo(() => assets.filter((asset) => {
    const matchesStatus = filter === "all" || asset.status === filter;
    const text = `${asset.make} ${asset.model} ${asset.serial_original} ${asset.category} ${asset.storage_location ?? ""}`.toLowerCase();
    return matchesStatus && text.includes(query.toLowerCase());
  }), [assets, filter, query]);
  const categories = Array.from(new Set([...defaultCategories, ...assets.map((asset) => asset.category)])).sort();
  const locationOptions = Array.from(new Set([...locations.map((location) => location.name), ...assets.map((asset) => asset.storage_location).filter(Boolean) as string[]])).sort();

  function toggleSelection(id: string) { setSelected((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; }); }
  function selectAllVisible() { setSelected((current) => current.size === filtered.length ? new Set() : new Set(filtered.map((asset) => asset.id))); }

  async function applyBulkEdit() {
    if (!selected.size || !bulkValue.trim()) return;
    if (!window.confirm(`Update ${selected.size} selected asset${selected.size === 1 ? "" : "s"}?`)) return;
    setBulkSaving(true); setError(""); setMessage("");
    const payload = bulkField === "status" ? { status: bulkValue } : bulkField === "category" ? { category: bulkValue.trim() } : { storage_location: bulkValue.trim(), location_id: locations.find((location) => location.name === bulkValue)?.id ?? null };
    const { error: updateError } = await getSupabaseBrowser().from("assets").update(payload).in("id", Array.from(selected));
    if (updateError) setError(updateError.message); else { setMessage(`${selected.size} asset${selected.size === 1 ? "" : "s"} updated.`); setSelected(new Set()); setBulkValue(""); await loadAssets(); }
    setBulkSaving(false);
  }

  function exportCsv() {
    const headers = ["make", "model", "category", "serial", "status", "storage_location", "estimated_value", "supplier", "purchase_date", "purchase_price", "invoice_number", "registered_at"];
    const lines = [headers.join(","), ...filtered.map((asset) => [asset.make, asset.model, asset.category, asset.serial_original, asset.status, asset.storage_location, asset.estimated_value, asset.supplier, asset.purchase_date, asset.purchase_price, asset.invoice_number, asset.registered_at].map(csvEscape).join(","))];
    downloadTextFile(`tooltrack-assets-${new Date().toISOString().slice(0, 10)}.csv`, lines.join("\n"));
  }

  if (loading) return <div className="pageWidth pagePad"><div className="skeletonCard" /></div>;
  if (!user) return <div className="pageWidth pagePad narrowPage"><div className="emptyPanel"><ToolboxIcon /><h1>Sign in to view your assets</h1><p>Your registered assets and private documents are linked to your account.</p><Link className="button primary" href="/login?next=/assets">Sign in or register</Link></div></div>;

  return <div className="pageWidth pagePad assetsPage">
    <div className="sectionTitleRow"><div><p className="eyebrow red">Asset register</p><h1>My assets</h1><p className="muted">Search, filter and manage every registered tool or asset.</p></div><div className="headingActions"><Link className="button secondary" href="/import"><UploadIcon /> Import CSV</Link><Link className="button primary" href="/register"><PlusIcon /> Add asset</Link></div></div>
    {message && <div className="notice success">{message}</div>}{error && <div className="notice danger">{error}</div>}
    <div className="statsGrid fourStats"><article><span>Registered</span><strong>{assets.length}</strong></article><article><span>Safe</span><strong>{assets.filter((asset) => asset.status === "safe").length}</strong></article><article className="dangerStat"><span>Stolen</span><strong>{assets.filter((asset) => asset.status === "stolen").length}</strong></article><article><span>Recovered</span><strong>{assets.filter((asset) => asset.status === "recovered").length}</strong></article></div>
    <div className="assetHeadingRow"><div className="toolbar v4Toolbar"><div className="inputWithIcon"><SearchIcon /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search make, model, serial or location" /></div><div className="pills"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button><button className={filter === "safe" ? "active" : ""} onClick={() => setFilter("safe")}>Safe</button><button className={filter === "stolen" ? "active" : ""} onClick={() => setFilter("stolen")}>Stolen</button><button className={filter === "recovered" ? "active" : ""} onClick={() => setFilter("recovered")}>Recovered</button></div></div><div className="headingActions"><button className="button secondary" type="button" onClick={exportCsv}><DownloadIcon /> Export CSV</button><button className={`button ${bulkMode ? "primary" : "secondary"}`} type="button" onClick={() => { setBulkMode((value) => !value); setSelected(new Set()); }}><EditIcon /> {bulkMode ? "Exit bulk edit" : "Bulk edit"}</button></div></div>
    {bulkMode && <div className="bulkPanel">{!canBulk ? <div className="bulkLocked"><strong>Bulk tools are included with Trade, Business and Fleet plans.</strong><Link href="/account#plans">View account tiers</Link></div> : <><div className="bulkSummary"><label className="checkRow compact"><input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={selectAllVisible} /><span>Select all visible</span></label><strong>{selected.size} selected</strong></div><div className="bulkControls"><select value={bulkField} onChange={(event) => { setBulkField(event.target.value as typeof bulkField); setBulkValue(""); }}><option value="storage_location">Storage location</option><option value="category">Category</option><option value="status">Status</option></select>{bulkField === "status" ? <select value={bulkValue} onChange={(event) => setBulkValue(event.target.value)}><option value="">Choose status</option><option value="safe">Safe</option><option value="stolen">Stolen</option><option value="recovered">Recovered</option><option value="transfer">Transfer pending</option></select> : bulkField === "category" ? <><input list="bulk-categories" value={bulkValue} onChange={(event) => setBulkValue(event.target.value)} placeholder="Choose or type category" /><datalist id="bulk-categories">{categories.map((value) => <option value={value} key={value} />)}</datalist></> : <><input list="bulk-locations" value={bulkValue} onChange={(event) => setBulkValue(event.target.value)} placeholder="Choose or type location" /><datalist id="bulk-locations">{locationOptions.map((value) => <option value={value} key={value} />)}</datalist></>}<button className="button primary" type="button" onClick={() => void applyBulkEdit()} disabled={!selected.size || !bulkValue.trim() || bulkSaving}>{bulkSaving ? "Updating…" : "Apply update"}</button></div></>}</div>}
    {filtered.length === 0 ? <div className="emptyPanel"><ToolboxIcon /><h2>{assets.length ? "No matching assets" : "No assets registered yet"}</h2><p>{assets.length ? "Try changing the search or filter." : "Register the first asset from your phone."}</p><Link className="button primary" href="/register">Register an asset</Link></div> : <div className="assetGrid">{filtered.map((asset) => <article className={`assetCard assetCardV4 ${selected.has(asset.id) ? "selected" : ""}`} key={asset.id}>{bulkMode && canBulk && <label className="assetSelect" aria-label={`Select ${asset.make} ${asset.model}`}><input type="checkbox" checked={selected.has(asset.id)} onChange={() => toggleSelection(asset.id)} /></label>}<Link href={`/asset/${asset.id}`} className="assetCardLink"><div className="assetIcon"><ToolboxIcon /></div><div className="assetMain"><div className="assetTop"><h3>{asset.make} {asset.model}</h3><span className={`status ${asset.status}`}>{asset.status}</span></div><p>{asset.category}</p><dl><div><dt>Serial</dt><dd>{asset.serial_original}</dd></div><div><dt>Location</dt><dd>{asset.storage_location || "Not set"}</dd></div></dl></div>{asset.status === "stolen" && <AlertIcon className="assetAlert" />}</Link></article>)}</div>}
  </div>;
}
