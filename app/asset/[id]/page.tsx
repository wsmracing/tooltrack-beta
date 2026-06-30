"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { AlertIcon, ShieldIcon, ToolboxIcon } from "@/components/icons";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import type { Asset } from "@/lib/types";

export default function AssetPage() {
  const { id } = useParams<{ id: string }>();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState("");
  const [gardaRef, setGardaRef] = useState("");
  const [circumstances, setCircumstances] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function load() {
    const supabase = getSupabaseBrowser();
    const { data: auth } = await supabase.auth.getUser(); setUser(auth.user);
    if (!auth.user) { setLoading(false); return; }
    const { data, error: fetchError } = await supabase.from("assets").select("*").eq("id", id).single();
    if (fetchError) setError(fetchError.message); else setAsset(data as Asset);
    setLoading(false);
  }
  useEffect(() => { void load(); }, [id]);

  async function report(event: FormEvent) {
    event.preventDefault(); if (!asset || !user) return; setError("");
    const supabase = getSupabaseBrowser();
    const publicReference = `TT-${Date.now().toString().slice(-8)}`;
    const { error: reportError } = await supabase.from("theft_reports").insert({ asset_id: asset.id, owner_id: user.id, theft_date: date, location_area: location, police_reference: gardaRef || null, circumstances: circumstances || null, public_reference: publicReference });
    if (reportError) { setError(reportError.message); return; }
    const { error: updateError } = await supabase.from("assets").update({ status: "stolen" }).eq("id", asset.id);
    if (updateError) { setError(updateError.message); return; }
    setReportOpen(false); await load();
  }

  async function recover() {
    if (!asset) return; const supabase = getSupabaseBrowser();
    await supabase.from("assets").update({ status: "recovered" }).eq("id", asset.id);
    await supabase.from("theft_reports").update({ recovered_at: new Date().toISOString() }).eq("asset_id", asset.id).is("recovered_at", null);
    await load();
  }

  if (loading) return <div className="pageWidth pagePad"><div className="skeletonCard" /></div>;
  if (!user) return <div className="pageWidth pagePad narrowPage"><div className="emptyPanel"><ShieldIcon /><h1>Sign in required</h1><Link className="button primary" href="/login">Sign in</Link></div></div>;
  if (!asset) return <div className="pageWidth pagePad narrowPage"><div className="notice danger">{error || "Asset not found."}</div></div>;

  return (
    <div className="pageWidth pagePad narrowPage">
      <Link className="backLink" href="/dashboard">← My tools</Link>
      <article className="assetDetailCard"><div className="assetDetailHero"><div className="assetLargeIcon"><ToolboxIcon /></div><div><span className={`status ${asset.status}`}>{asset.status}</span><h1>{asset.make} {asset.model}</h1><p>{asset.category}</p></div></div><dl className="detailList"><div><dt>Serial number</dt><dd>{asset.serial_original}</dd></div><div><dt>Registered</dt><dd>{new Date(asset.registered_at).toLocaleDateString("en-IE")}</dd></div><div><dt>Storage location</dt><dd>{asset.storage_location || "Not recorded"}</dd></div><div><dt>Estimated value</dt><dd>{asset.estimated_value ? `€${asset.estimated_value.toFixed(2)}` : "Not recorded"}</dd></div><div><dt>Supplier</dt><dd>{asset.supplier || "Not recorded"}</dd></div><div><dt>Invoice number</dt><dd>{asset.invoice_number || "Not recorded"}</dd></div></dl><div className="assetDetailActions">{asset.status === "stolen" ? <button className="button primary" onClick={recover}><ShieldIcon /> Mark recovered</button> : <button className="button dangerButton" onClick={() => setReportOpen(true)}><AlertIcon /> Report stolen</button>}<button className="button secondary" onClick={() => router.push(`/lookup?serial=${encodeURIComponent(asset.serial_original)}`)}>Test public lookup</button></div></article>
      {error && <div className="notice danger">{error}</div>}
      {reportOpen && <div className="modalBackdrop" onClick={() => setReportOpen(false)}><div className="modalCard" onClick={(e) => e.stopPropagation()}><div className="modalHeader"><AlertIcon /><div><p className="eyebrow red">Stolen report</p><h2>Report this asset stolen</h2></div></div><p>This will immediately change the public serial lookup result.</p><form className="formStack" onSubmit={report}><label>Date stolen<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label><label>General area<input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Dublin 12" required /></label><label>Garda reference<input value={gardaRef} onChange={(e) => setGardaRef(e.target.value)} placeholder="Optional" /></label><label>Circumstances<textarea value={circumstances} onChange={(e) => setCircumstances(e.target.value)} rows={3} placeholder="Brief private note" /></label><div className="formActions"><button type="button" className="button secondary" onClick={() => setReportOpen(false)}>Cancel</button><button className="button dangerButton">Report as stolen</button></div></form></div></div>}
    </div>
  );
}
