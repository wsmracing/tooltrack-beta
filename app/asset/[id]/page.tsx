"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { AlertIcon, DownloadIcon, EditIcon, FileIcon, MoreIcon, ShieldIcon, TagIcon, ToolboxIcon, TransferIcon } from "@/components/icons";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import type { Asset, AssetAuditEntry, OwnershipTransfer, Profile } from "@/lib/types";
import { friendlyError } from "@/lib/user-errors";
import { assetStatusLabel, effectiveMarketStatus, verificationLabel } from "@/lib/asset-status";
import { downloadGardaEvidenceReport, downloadInsuranceSchedule } from "@/lib/pdf-reports";

type StoredFile = { id: string; storage_path: string; original_name: string; created_at: string; notes?: string | null };
type TheftReport = { theft_date?: string | null; location_area?: string | null; police_reference?: string | null; circumstances?: string | null; public_reference?: string | null; reported_at?: string | null; recovered_at?: string | null };

async function signPrivateFiles(bucket: string, paths: string[], token?: string) {
  if (!token || !paths.length) return {} as Record<string, string>;
  const response = await fetch("/api/storage/sign", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ bucket, paths }) });
  if (!response.ok) return {} as Record<string, string>;
  const body = await response.json() as { urls?: Record<string, string> };
  return body.urls ?? {};
}

export default function AssetPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [photos, setPhotos] = useState<StoredFile[]>([]);
  const [documents, setDocuments] = useState<StoredFile[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [audit, setAudit] = useState<AssetAuditEntry[]>([]);
  const [transfers, setTransfers] = useState<OwnershipTransfer[]>([]);
  const [theftReport, setTheftReport] = useState<TheftReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [saleOpen, setSaleOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState("");
  const [gardaRef, setGardaRef] = useState("");
  const [circumstances, setCircumstances] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [transferCode, setTransferCode] = useState("");
  const [buyerCode, setBuyerCode] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const supabase = getSupabaseBrowser();
    const { data: auth } = await supabase.auth.getUser();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    setUser(auth.user);
    if (!auth.user) { setLoading(false); return; }
    const [assetResponse, profileResponse, photoResponse, documentResponse, auditResponse, transferResponse, theftResponse] = await Promise.all([
      supabase.from("assets").select("*").eq("id", id).single(),
      supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle(),
      supabase.from("asset_photos").select("*").eq("asset_id", id).order("created_at"),
      supabase.from("asset_documents").select("*").eq("asset_id", id).order("created_at"),
      supabase.from("asset_audit_log").select("*").eq("asset_id", id).order("created_at", { ascending: false }).limit(30),
      supabase.from("ownership_transfers").select("*").eq("asset_id", id).order("created_at", { ascending: false }).limit(10),
      supabase.from("theft_reports").select("*").eq("asset_id", id).order("reported_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (assetResponse.error) setError(friendlyError(assetResponse.error, "This asset could not be loaded.")); else setAsset(assetResponse.data as Asset);
    if (profileResponse.data) setProfile(profileResponse.data as Profile);
    const loadedPhotos = (photoResponse.data ?? []) as StoredFile[];
    const loadedDocuments = (documentResponse.data ?? []) as StoredFile[];
    setPhotos(loadedPhotos); setDocuments(loadedDocuments);
    setPhotoUrls(await signPrivateFiles("asset-photos", loadedPhotos.map((photo) => photo.storage_path), token));
    setDocumentUrls(await signPrivateFiles("ownership-documents", loadedDocuments.map((document) => document.storage_path), token));
    if (auditResponse.data) setAudit(auditResponse.data as AssetAuditEntry[]);
    if (transferResponse.data) setTransfers(transferResponse.data as OwnershipTransfer[]);
    if (theftResponse.data) setTheftReport(theftResponse.data as TheftReport);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [id]);

  async function accessToken() {
    const { data } = await getSupabaseBrowser().auth.getSession();
    if (!data.session?.access_token) throw new Error("Your session has expired. Sign in again.");
    return data.session.access_token;
  }

  async function openPrivateFile(bucket: string, path: string) {
    const token = await accessToken();
    const urls = await signPrivateFiles(bucket, [path], token);
    const url = urls[path];
    if (!url) { setError("The private file could not be opened."); return; }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function assetAction(body: Record<string, unknown>) {
    const token = await accessToken();
    const response = await fetch(`/api/assets/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "The asset could not be updated.");
    setMessage(result.message || "Asset updated."); await load();
  }

  async function report(event: FormEvent) { event.preventDefault(); if (!asset || !confirmed) return; if (!window.confirm(`Report ${asset.make} ${asset.model} (${asset.serial_original}) as stolen?`)) return; setSaving(true); setError(""); setMessage(""); try { await assetAction({ action: "report_stolen", theftDate: date, locationArea: location, gardaReference: gardaRef, circumstances }); setReportOpen(false); setConfirmed(false); } catch (caught) { setError(friendlyError(caught, "The stolen report could not be saved.")); } finally { setSaving(false); } }
  async function recover() { if (!asset || !window.confirm(`Mark ${asset.make} ${asset.model} as recovered?`)) return; setSaving(true); setError(""); setMessage(""); try { await assetAction({ action: "recover" }); } catch (caught) { setError(friendlyError(caught, "The asset could not be marked recovered.")); } finally { setSaving(false); } }
  async function markForSale() { setSaving(true); setError(""); setMessage(""); try { await assetAction({ action: "mark_for_sale", days: 14 }); setSaleOpen(false); } catch (caught) { setError(friendlyError(caught, "Sale status could not be activated.")); } finally { setSaving(false); } }
  async function removeFromSale() { setSaving(true); setError(""); setMessage(""); try { await assetAction({ action: "remove_from_sale" }); setSaleOpen(false); } catch (caught) { setError(friendlyError(caught, "Sale status could not be removed.")); } finally { setSaving(false); } }

  async function createTransfer(event: FormEvent) {
    event.preventDefault(); if (!asset || !user) return;
    if (!window.confirm("Create a one-time transfer code? The asset will show as transfer pending until accepted or cancelled.")) return;
    setSaving(true); setError(""); setMessage(""); setTransferCode("");
    try {
      const token = await accessToken();
      const response = await fetch("/api/transfers", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ assetId: asset.id, recipientEmail: recipientEmail.trim() || undefined }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The transfer could not be created.");
      setTransferCode(body.code); setMessage(body.emailStatus === "sent" ? "Transfer created and emailed." : "Transfer created. Share the code securely."); await load();
    } catch (caught) { setError(friendlyError(caught, "The transfer could not be created.")); } finally { setSaving(false); }
  }

  async function cancelTransfer(transferId: string) { if (!asset || !window.confirm("Cancel this transfer?")) return; const supabase = getSupabaseBrowser(); const { error: transferError } = await supabase.from("ownership_transfers").update({ status: "cancelled" }).eq("id", transferId); if (!transferError) await supabase.from("assets").update({ status: "safe" }).eq("id", asset.id); if (transferError) setError(friendlyError(transferError, "The transfer could not be cancelled.")); else { setMessage("Transfer cancelled."); await load(); } }

  async function confirmBuyer(event: FormEvent) {
    event.preventDefault(); if (buyerCode.replace(/\D/g, "").length !== 6) return; setSaving(true); setError("");
    try { const token = await accessToken(); const response = await fetch("/api/seller-confirmations", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ assetId: id, code: buyerCode }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error || "The buyer check could not be confirmed."); setMessage(body.message); setBuyerCode(""); setConfirmOpen(false); await load(); }
    catch (caught) { setError(friendlyError(caught, "The buyer check could not be confirmed.")); } finally { setSaving(false); }
  }

  async function gardaPdf() {
    if (!asset || !user) return; setError("");
    try { const supabase = getSupabaseBrowser(); const photoDataUrls = await Promise.all(photos.slice(0, 6).map(async (photo) => { const { data, error: downloadError } = await supabase.storage.from("asset-photos").download(photo.storage_path); if (downloadError || !data) return null; return await new Promise<string | null>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null); reader.onerror = () => resolve(null); reader.readAsDataURL(data); }); })); await downloadGardaEvidenceReport({ asset, owner: { email: user.email, profile }, theftReport, audit, photoCount: photos.length, documentCount: documents.length, photoDataUrls: photoDataUrls.filter((value): value is string => Boolean(value)) }); }
    catch (caught) { setError(friendlyError(caught, "The theft evidence PDF could not be created.")); }
  }

  async function insurancePdf() { if (!asset || !user) return; try { await downloadInsuranceSchedule([asset], { email: user.email, profile }); } catch (caught) { setError(friendlyError(caught, "The insurance PDF could not be created.")); } }

  if (loading) return <div className="pageWidth pagePad"><div className="skeletonCard" /></div>;
  if (!user) return <div className="pageWidth pagePad narrowPage"><div className="emptyPanel"><ShieldIcon /><h1>Sign in required</h1><Link className="button primary" href="/login">Sign in</Link></div></div>;
  if (!asset) return <div className="pageWidth pagePad narrowPage"><div className="notice danger">{error || "Asset not found."}</div></div>;

  const pendingTransfer = transfers.find((transfer) => transfer.status === "pending");
  const marketStatus = effectiveMarketStatus(asset);
  const galleryPhoto = galleryIndex == null ? null : photos[galleryIndex] ?? null;

  return <div className="pageWidth pagePad assetDetailPage">
    <Link className="backLink" href="/assets">← My assets</Link>
    <article className="assetDetailCard">
      <div className="assetDetailHero v45AssetHero"><div className="assetLargeIcon"><ToolboxIcon /></div><div className="assetHeroText"><div className="assetBadges"><span className={`status ${asset.status}`}>{assetStatusLabel(asset.status)}</span>{marketStatus === "for_sale" && <span className="status forSale">For sale</span>}<span className="verificationBadge">{verificationLabel(asset.verification_level)}</span></div><h1>{asset.make} {asset.model}</h1><p>{asset.category}</p></div><div className="assetHeroActions">{asset.status === "stolen" ? <button className="button primary" onClick={() => void recover()} disabled={saving}><ShieldIcon /> {saving ? "Updating…" : "Mark recovered"}</button> : <button className="button primary" onClick={() => setSaleOpen(true)} disabled={saving}><TagIcon /> {marketStatus === "for_sale" ? "Sale active" : "Sell or transfer"}</button>}<details className="manageMenu assetMoreMenu"><summary className="button secondary" aria-label="More asset actions"><MoreIcon /> More</summary><div className="manageMenuPanel alignRight"><Link href={`/asset/${asset.id}/edit`}><EditIcon /> Edit asset</Link>{asset.status !== "stolen" && <button onClick={() => setReportOpen(true)} disabled={asset.status === "transfer"}><AlertIcon /> Report stolen</button>}<button onClick={() => setSaleOpen(true)} disabled={asset.status === "stolen"}><TransferIcon /> Sell or transfer</button><button onClick={() => setConfirmOpen(true)} disabled={asset.status === "stolen"}><ShieldIcon /> Confirm buyer check</button><button onClick={() => void insurancePdf()}><DownloadIcon /> Insurance report</button><button onClick={() => void gardaPdf()}><DownloadIcon /> Theft evidence report</button><button onClick={() => router.push(`/lookup?serial=${encodeURIComponent(asset.serial_original)}`)}><SearchPublicIcon /> View public record</button></div></details></div></div>
      <dl className="detailList"><div><dt>Serial number</dt><dd>{asset.serial_original}</dd></div><div><dt>Registered</dt><dd>{new Date(asset.registered_at).toLocaleDateString("en-IE")}</dd></div>{asset.storage_location && <div><dt>Storage location</dt><dd>{asset.storage_location}</dd></div>}{asset.estimated_value != null && <div><dt>Estimated value</dt><dd>€{Number(asset.estimated_value).toFixed(2)}</dd></div>}{asset.supplier && <div><dt>Supplier / seller</dt><dd>{asset.supplier}</dd></div>}{asset.invoice_number && <div><dt>Invoice / receipt number</dt><dd>{asset.invoice_number}</dd></div>}{asset.security_id && <div><dt>Security marker</dt><dd>{asset.security_id}</dd></div>}{asset.notes && <div><dt>Identifying notes</dt><dd>{asset.notes}</dd></div>}</dl>
    </article>
    {message && <div className="notice success">{message}</div>}{error && <div className="notice danger">{error}</div>}

    <div className="assetSubGrid">
      <section className="settingsCard evidenceCard"><div className="dashboardSectionHeading"><div><h2>Photos</h2><p className="muted">Private asset photos stored with this record.</p></div><FileIcon /></div>{photos.length ? <div className="assetPhotoGrid">{photos.map((file, index) => <button type="button" key={file.id} onClick={() => setGalleryIndex(index)} aria-label={`Open ${file.original_name}`}><span className="assetPhotoThumb">{photoUrls[file.storage_path] ? <img src={photoUrls[file.storage_path]} alt={file.original_name} /> : <FileIcon />}</span><span><strong>{file.original_name}</strong><small>{new Date(file.created_at).toLocaleDateString("en-IE")}</small></span></button>)}</div> : <p className="muted evidenceEmpty">No asset photos uploaded yet.</p>}</section>
      <section className="settingsCard evidenceCard"><div className="dashboardSectionHeading"><div><h2>Invoice / receipt</h2><p className="muted">Purchase evidence remains private to authorised account members.</p></div><FileIcon /></div>{documents.length ? <div className="privateFileList evidenceDocumentList">{documents.map((file) => <button type="button" key={file.id} onClick={() => void openPrivateFile("ownership-documents", file.storage_path)}><FileIcon /><span><strong>{file.original_name}</strong><small>Purchase evidence · {new Date(file.created_at).toLocaleDateString("en-IE")}</small></span><DownloadIcon /></button>)}</div> : <p className="muted evidenceEmpty">No invoice or receipt uploaded yet.</p>}</section>
      <section className="settingsCard historyCard"><div className="dashboardSectionHeading"><div><h2>Record history</h2><p className="muted">Dated changes connected to this asset.</p></div></div><div className="auditList">{audit.length ? audit.map((entry) => <article key={entry.id}><strong>{entry.action.replaceAll("_", " ")}</strong><span>{new Date(entry.created_at).toLocaleString("en-IE")}</span></article>) : <p className="muted">No history entries yet.</p>}</div></section>
    </div>

    {galleryPhoto && <div className="modalBackdrop galleryBackdrop" onClick={() => setGalleryIndex(null)}><div className="galleryModal" onClick={(event) => event.stopPropagation()}><div className="galleryHeader"><div><strong>{galleryPhoto.original_name}</strong><span>{galleryIndex! + 1} of {photos.length} · {new Date(galleryPhoto.created_at).toLocaleDateString("en-IE")}</span></div><button type="button" className="button secondary" onClick={() => setGalleryIndex(null)}>Close</button></div><div className="galleryImageFrame">{photoUrls[galleryPhoto.storage_path] ? <img src={photoUrls[galleryPhoto.storage_path]} alt={galleryPhoto.original_name} /> : <FileIcon />}</div>{photos.length > 1 && <div className="galleryControls"><button type="button" onClick={() => setGalleryIndex((galleryIndex! - 1 + photos.length) % photos.length)}>Previous</button><div className="galleryThumbStrip">{photos.map((photo, index) => <button type="button" key={photo.id} className={index === galleryIndex ? "active" : ""} onClick={() => setGalleryIndex(index)}>{photoUrls[photo.storage_path] ? <img src={photoUrls[photo.storage_path]} alt="" /> : <FileIcon />}</button>)}</div><button type="button" onClick={() => setGalleryIndex((galleryIndex! + 1) % photos.length)}>Next</button></div>}</div></div>}

    {reportOpen && <div className="modalBackdrop" onClick={() => !saving && setReportOpen(false)}><div className="modalCard" onClick={(event) => event.stopPropagation()}><div className="modalHeader"><AlertIcon /><div><h2>Report this asset stolen</h2><p className="muted">The public record will warn potential buyers.</p></div></div><form className="formStack" onSubmit={report}><label>Date stolen<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label><label>General area<input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Dublin 12" required /></label><label>Garda / incident reference<input value={gardaRef} onChange={(event) => setGardaRef(event.target.value)} placeholder="Optional" /></label><label>Circumstances<textarea value={circumstances} onChange={(event) => setCircumstances(event.target.value)} rows={3} /></label><label className="checkRow"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I confirm this is the correct asset.</span></label><div className="formActions modalActions"><button type="button" className="button secondary" onClick={() => setReportOpen(false)}>Cancel</button><button className="button dangerButton" disabled={!confirmed || saving}>{saving ? "Reporting…" : "Report stolen"}</button></div></form></div></div>}
    {saleOpen && <div className="modalBackdrop" onClick={() => !saving && setSaleOpen(false)}><div className="modalCard saleTransferModal" onClick={(event) => event.stopPropagation()}><div className="modalHeader"><TagIcon /><div><h2>Sell or transfer this asset</h2><p className="muted">Confirm the sale publicly, then transfer the record to the buyer.</p></div></div><section className="modalSection"><h3>Sale status</h3>{marketStatus === "for_sale" ? <><p>The public serial result currently says the registered account holder is offering this asset for sale.</p><button className="button secondary" onClick={() => void removeFromSale()} disabled={saving}>Remove sale status</button></> : <><p>Mark the asset for sale for 14 days. Buyers will still be told to verify the seller and complete a transfer.</p><button className="button primary" onClick={() => void markForSale()} disabled={saving}>Mark for sale</button></>}</section><section className="modalSection"><h3>Ownership transfer</h3>{pendingTransfer ? <div className="formStack"><div className="transferCodeBox"><span>Active transfer code</span><strong>{transferCode || pendingTransfer.transfer_code}</strong><small>Expires {new Date(pendingTransfer.expires_at).toLocaleDateString("en-IE")}</small></div>{!transferCode && <p className="muted">The full code is hidden after creation. The buyer can still use the original code they received.</p>}<button className="button dangerButton" onClick={() => void cancelTransfer(pendingTransfer.id)}>Cancel transfer</button></div> : <form className="formStack" onSubmit={createTransfer}><label>Buyer email (optional)<input type="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} placeholder="buyer@example.com" /></label><p className="muted">Leave blank to share the one-time code directly. The full code is shown only when created.</p><button className="button primary" disabled={saving}>{saving ? "Creating…" : "Create transfer code"}</button></form>}</section><button type="button" className="button secondary modalCloseButton" onClick={() => setSaleOpen(false)}>Close</button></div></div>}
    {confirmOpen && <div className="modalBackdrop" onClick={() => !saving && setConfirmOpen(false)}><div className="modalCard" onClick={(event) => event.stopPropagation()}><div className="modalHeader"><ShieldIcon /><div><h2>Confirm a buyer check</h2><p className="muted">Ask the buyer for the temporary six-digit code shown on their serial result.</p></div></div><form className="formStack" onSubmit={confirmBuyer}><label>Buyer confirmation code<input value={buyerCode} onChange={(event) => setBuyerCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="123 456" required /></label><div className="formActions modalActions"><button type="button" className="button secondary" onClick={() => setConfirmOpen(false)}>Cancel</button><button className="button primary" disabled={buyerCode.length !== 6 || saving}>{saving ? "Confirming…" : "Confirm seller account"}</button></div></form></div></div>}
  </div>;
}

function SearchPublicIcon() { return <ShieldIcon />; }
