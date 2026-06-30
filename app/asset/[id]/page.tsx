"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { AlertIcon, DownloadIcon, EditIcon, FileIcon, ShieldIcon, ToolboxIcon, TransferIcon } from "@/components/icons";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import type { Asset, AssetAuditEntry, OwnershipTransfer } from "@/lib/types";

type StoredFile = { id: string; storage_path: string; original_name: string; created_at: string; notes?: string | null };

export default function AssetPage() {
  const { id } = useParams<{ id: string }>();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [photos, setPhotos] = useState<StoredFile[]>([]);
  const [documents, setDocuments] = useState<StoredFile[]>([]);
  const [audit, setAudit] = useState<AssetAuditEntry[]>([]);
  const [transfers, setTransfers] = useState<OwnershipTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState("");
  const [gardaRef, setGardaRef] = useState("");
  const [circumstances, setCircumstances] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [transferCode, setTransferCode] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function load() {
    const supabase = getSupabaseBrowser();
    const { data: auth } = await supabase.auth.getUser(); setUser(auth.user);
    if (!auth.user) { setLoading(false); return; }
    const [assetResponse, photoResponse, documentResponse, auditResponse, transferResponse] = await Promise.all([
      supabase.from("assets").select("*").eq("id", id).single(),
      supabase.from("asset_photos").select("*").eq("asset_id", id).order("created_at"),
      supabase.from("asset_documents").select("*").eq("asset_id", id).order("created_at"),
      supabase.from("asset_audit_log").select("*").eq("asset_id", id).order("created_at", { ascending: false }).limit(20),
      supabase.from("ownership_transfers").select("*").eq("asset_id", id).order("created_at", { ascending: false }).limit(10),
    ]);
    if (assetResponse.error) setError(assetResponse.error.message); else setAsset(assetResponse.data as Asset);
    if (photoResponse.data) setPhotos(photoResponse.data as StoredFile[]);
    if (documentResponse.data) setDocuments(documentResponse.data as StoredFile[]);
    if (auditResponse.data) setAudit(auditResponse.data as AssetAuditEntry[]);
    if (transferResponse.data) setTransfers(transferResponse.data as OwnershipTransfer[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [id]);

  async function openPrivateFile(bucket: string, path: string) {
    const { data, error: signError } = await getSupabaseBrowser().storage.from(bucket).createSignedUrl(path, 120);
    if (signError) setError(signError.message); else window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function report(event: FormEvent) {
    event.preventDefault(); if (!asset || !user || !confirmed) return;
    if (!window.confirm(`Report ${asset.make} ${asset.model} (${asset.serial_original}) as stolen?`)) return;
    setSaving(true); setError(""); setMessage("");
    const supabase = getSupabaseBrowser(); const publicReference = `TT-${Date.now().toString().slice(-8)}`;
    const { error: reportError } = await supabase.from("theft_reports").insert({ asset_id: asset.id, owner_id: asset.owner_id, theft_date: date, location_area: location.trim(), police_reference: gardaRef.trim() || null, circumstances: circumstances.trim() || null, public_reference: publicReference });
    if (!reportError) {
      const { error: updateError } = await supabase.from("assets").update({ status: "stolen" }).eq("id", asset.id);
      if (updateError) setError(updateError.message); else { setReportOpen(false); setConfirmed(false); setMessage("This asset now appears as stolen in public lookup results."); await load(); }
    } else setError(reportError.message);
    setSaving(false);
  }

  async function recover() {
    if (!asset || !window.confirm(`Mark ${asset.make} ${asset.model} as recovered?`)) return;
    setSaving(true); setError(""); setMessage("");
    const supabase = getSupabaseBrowser();
    const { error: assetError } = await supabase.from("assets").update({ status: "recovered" }).eq("id", asset.id);
    const { error: reportError } = await supabase.from("theft_reports").update({ recovered_at: new Date().toISOString() }).eq("asset_id", asset.id).is("recovered_at", null);
    if (assetError || reportError) setError(assetError?.message || reportError?.message || "Could not update the asset."); else { setMessage("Asset marked as recovered."); await load(); }
    setSaving(false);
  }

  async function createTransfer(event: FormEvent) {
    event.preventDefault(); if (!asset || !user) return;
    if (!window.confirm("Create a transfer code? The asset will show as transfer pending until accepted or cancelled.")) return;
    setSaving(true); setError(""); setMessage(""); setTransferCode("");
    try {
      const { data: session } = await getSupabaseBrowser().auth.getSession(); const token = session.session?.access_token;
      if (!token) throw new Error("Your session has expired.");
      const response = await fetch("/api/transfers", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ assetId: asset.id, recipientEmail: recipientEmail.trim() || undefined }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Could not create the transfer.");
      setTransferCode(body.code); setMessage(body.emailStatus === "sent" ? "Transfer created and email sent." : "Transfer created. Share the code manually."); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not create the transfer."); }
    finally { setSaving(false); }
  }

  async function cancelTransfer(transferId: string) {
    if (!asset || !window.confirm("Cancel this transfer?")) return;
    const supabase = getSupabaseBrowser();
    const { error: transferError } = await supabase.from("ownership_transfers").update({ status: "cancelled" }).eq("id", transferId);
    if (!transferError) await supabase.from("assets").update({ status: "safe" }).eq("id", asset.id);
    if (transferError) setError(transferError.message); else { setMessage("Transfer cancelled."); setTransferOpen(false); await load(); }
  }

  if (loading) return <div className="pageWidth pagePad"><div className="skeletonCard" /></div>;
  if (!user) return <div className="pageWidth pagePad narrowPage"><div className="emptyPanel"><ShieldIcon /><h1>Sign in required</h1><Link className="button primary" href="/login">Sign in</Link></div></div>;
  if (!asset) return <div className="pageWidth pagePad narrowPage"><div className="notice danger">{error || "Asset not found."}</div></div>;

  const pendingTransfer = transfers.find((transfer) => transfer.status === "pending");
  return <div className="pageWidth pagePad assetDetailPage">
    <Link className="backLink" href="/dashboard">← My assets</Link>
    <article className="assetDetailCard">
      <div className="assetDetailHero"><div className="assetLargeIcon"><ToolboxIcon /></div><div><span className={`status ${asset.status}`}>{asset.status}</span><h1>{asset.make} {asset.model}</h1><p>{asset.category}</p></div><Link className="button secondary editAssetButton" href={`/asset/${asset.id}/edit`}><EditIcon /> Edit</Link></div>
      <dl className="detailList"><div><dt>Serial number</dt><dd>{asset.serial_original}</dd></div><div><dt>Product barcode</dt><dd>{asset.product_barcode || "Not recorded"}</dd></div><div><dt>Registered</dt><dd>{new Date(asset.registered_at).toLocaleDateString("en-IE")}</dd></div><div><dt>Storage location</dt><dd>{asset.storage_location || "Not recorded"}</dd></div><div><dt>Estimated value</dt><dd>{asset.estimated_value ? `€${Number(asset.estimated_value).toFixed(2)}` : "Not recorded"}</dd></div><div><dt>Supplier</dt><dd>{asset.supplier || "Not recorded"}</dd></div><div><dt>Invoice number</dt><dd>{asset.invoice_number || "Not recorded"}</dd></div><div><dt>Notes</dt><dd>{asset.notes || "None"}</dd></div></dl>
      <div className="assetDetailActions">{asset.status === "stolen" ? <button className="button primary" onClick={() => void recover()} disabled={saving}><ShieldIcon /> {saving ? "Updating…" : "Mark recovered"}</button> : <button className="button dangerButton" onClick={() => setReportOpen(true)} disabled={saving || asset.status === "transfer"}><AlertIcon /> Report stolen</button>}<button className="button secondary" onClick={() => setTransferOpen(true)} disabled={asset.status === "stolen"}><TransferIcon /> Transfer ownership</button><button className="button secondary" onClick={() => router.push(`/lookup?serial=${encodeURIComponent(asset.serial_original)}`)}>Test public lookup</button></div>
    </article>
    {message && <div className="notice success">{message}</div>}{error && <div className="notice danger">{error}</div>}

    <div className="assetSubGrid"><section className="settingsCard"><div className="dashboardSectionHeading"><div><p className="eyebrow red">Private files</p><h2>Photos and documents</h2></div><FileIcon /></div><div className="privateFileList">{photos.map((file) => <button type="button" key={file.id} onClick={() => void openPrivateFile("asset-photos", file.storage_path)}><DownloadIcon /><span><strong>{file.original_name}</strong><small>Photo · {new Date(file.created_at).toLocaleDateString("en-IE")}</small></span></button>)}{documents.map((file) => <button type="button" key={file.id} onClick={() => void openPrivateFile("ownership-documents", file.storage_path)}><FileIcon /><span><strong>{file.original_name}</strong><small>Ownership document · {new Date(file.created_at).toLocaleDateString("en-IE")}</small></span></button>)}{!photos.length && !documents.length && <p className="muted">No private files uploaded.</p>}</div></section>
      <section className="settingsCard"><div className="dashboardSectionHeading"><div><p className="eyebrow red">History</p><h2>Audit trail</h2></div></div><div className="auditList">{audit.length ? audit.map((entry) => <article key={entry.id}><strong>{entry.action.replaceAll("_", " ")}</strong><span>{new Date(entry.created_at).toLocaleString("en-IE")}</span></article>) : <p className="muted">No history entries yet.</p>}</div></section></div>

    {reportOpen && <div className="modalBackdrop" onClick={() => !saving && setReportOpen(false)}><div className="modalCard" onClick={(event) => event.stopPropagation()}><div className="modalHeader"><AlertIcon /><div><p className="eyebrow red">Stolen report</p><h2>Report this asset stolen</h2></div></div><form className="formStack" onSubmit={report}><label>Date stolen<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label><label>General area<input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="e.g. Dublin 12" required /></label><label>Garda reference<input value={gardaRef} onChange={(event) => setGardaRef(event.target.value)} placeholder="Optional" /></label><label>Circumstances<textarea value={circumstances} onChange={(event) => setCircumstances(event.target.value)} rows={3} /></label><label className="checkRow"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I confirm this is the correct asset.</span></label><div className="formActions modalActions"><button type="button" className="button secondary" onClick={() => setReportOpen(false)}>Cancel</button><button className="button dangerButton" disabled={!confirmed || saving}>{saving ? "Reporting…" : "Report as stolen"}</button></div></form></div></div>}

    {transferOpen && <div className="modalBackdrop" onClick={() => !saving && setTransferOpen(false)}><div className="modalCard" onClick={(event) => event.stopPropagation()}><div className="modalHeader"><TransferIcon /><div><p className="eyebrow red">Ownership</p><h2>Transfer this asset</h2></div></div>{pendingTransfer ? <div className="formStack"><div className="transferCodeBox"><span>Transfer code</span><strong>{pendingTransfer.transfer_code}</strong><small>Expires {new Date(pendingTransfer.expires_at).toLocaleDateString("en-IE")}</small></div><button className="button dangerButton" onClick={() => void cancelTransfer(pendingTransfer.id)}>Cancel transfer</button></div> : <form className="formStack" onSubmit={createTransfer}><label>Recipient email (optional)<input type="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} placeholder="buyer@example.com" /></label><p className="muted">Without an email, share the generated code directly with the new owner.</p>{transferCode && <div className="transferCodeBox"><span>Transfer code</span><strong>{transferCode}</strong></div>}<div className="formActions"><button type="button" className="button secondary" onClick={() => setTransferOpen(false)}>Close</button><button className="button primary" disabled={saving}>{saving ? "Creating…" : "Create transfer"}</button></div></form>}</div></div>}
  </div>;
}
