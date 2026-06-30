"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { CameraIcon, FileIcon, ShieldIcon } from "@/components/icons";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase-browser";
import { normaliseSerial, safeFileName } from "@/lib/normalise";

interface FormDataState {
  make: string; model: string; category: string; serial: string; secondary: string; colour: string; location: string; value: string;
  supplier: string; purchaseDate: string; purchasePrice: string; invoiceNumber: string; securityId: string; documentNotes: string;
}
const initial: FormDataState = { make: "", model: "", category: "", serial: "", secondary: "", colour: "", location: "My van", value: "", supplier: "", purchaseDate: "", purchasePrice: "", invoiceNumber: "", securityId: "", documentNotes: "" };

export default function RegisterPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initial);
  const [photos, setPhotos] = useState<File[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [accuracyConfirmed, setAccuracyConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const querySerial = new URLSearchParams(window.location.search).get("serial")?.trim();
    if (querySerial) setForm((current) => current.serial ? current : { ...current, serial: querySerial.toUpperCase() });
    if (!isSupabaseConfigured()) { setAuthChecked(true); return; }
    getSupabaseBrowser().auth.getUser().then(({ data }) => { setUser(data.user); setAuthChecked(true); });
  }, []);

  const canNext = useMemo(() => {
    if (step === 1) return Boolean(form.make && form.model && form.category && form.serial);
    if (step === 4) return privacyConfirmed;
    if (step === 5) return accuracyConfirmed;
    return true;
  }, [step, form, privacyConfirmed, accuracyConfirmed]);

  function update<K extends keyof FormDataState>(key: K, value: FormDataState[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function selectFiles(event: ChangeEvent<HTMLInputElement>, setter: (files: File[]) => void) { setter(Array.from(event.target.files ?? [])); }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (step < 5) { if (canNext) setStep((s) => s + 1); return; }
    if (!user || !accuracyConfirmed) return;
    setSaving(true); setError("");
    try {
      const supabase = getSupabaseBrowser();
      const { data: asset, error: assetError } = await supabase.from("assets").insert({
        owner_id: user.id, make: form.make.trim(), model: form.model.trim(), category: form.category,
        serial_original: form.serial.trim().toUpperCase(), serial_normalized: normaliseSerial(form.serial),
        secondary_identifier: form.secondary || null, colour: form.colour || null, storage_location: form.location || null,
        estimated_value: form.value ? Number(form.value) : null, supplier: form.supplier || null, purchase_date: form.purchaseDate || null,
        purchase_price: form.purchasePrice ? Number(form.purchasePrice) : null, invoice_number: form.invoiceNumber || null,
        security_id: form.securityId || null, status: "safe",
      }).select("id").single();
      if (assetError) throw assetError;

      for (let index = 0; index < photos.length; index++) {
        const file = photos[index]; const path = `${user.id}/${asset.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
        const { error: uploadError } = await supabase.storage.from("asset-photos").upload(path, file, { upsert: false });
        if (uploadError) throw uploadError;
        const { error: rowError } = await supabase.from("asset_photos").insert({ asset_id: asset.id, owner_id: user.id, storage_path: path, original_name: file.name, image_type: index === 0 ? "full_tool" : "additional" });
        if (rowError) throw rowError;
      }

      for (const file of documents) {
        const path = `${user.id}/${asset.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
        const { error: uploadError } = await supabase.storage.from("ownership-documents").upload(path, file, { upsert: false });
        if (uploadError) throw uploadError;
        const { error: rowError } = await supabase.from("asset_documents").insert({ asset_id: asset.id, owner_id: user.id, storage_path: path, original_name: file.name, document_type: "proof_of_ownership", notes: form.documentNotes || null });
        if (rowError) throw rowError;
      }
      router.push(`/asset/${asset.id}`); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not register the asset."); setSaving(false); }
  }

  if (!authChecked) return <div className="pageWidth pagePad"><div className="skeletonCard" /></div>;
  if (!user) return <div className="pageWidth pagePad narrowPage"><div className="emptyPanel"><ShieldIcon /><h1>Sign in before registering</h1><p>Your tool record and private documents must be attached to an account.</p><Link className="button primary" href={`/login?next=${encodeURIComponent(form.serial ? `/register?serial=${form.serial}` : "/register")}`}>Sign in or create account</Link></div></div>;

  return (
    <div className="pageWidth pagePad registerPage">
      <div className="sectionTitleRow"><div><p className="eyebrow red">New asset</p><h1>Register a tool</h1><p className="muted">Complete the details beside the tool. You can add more later.</p></div><Link className="button secondary" href="/dashboard">Cancel</Link></div>
      <ol className="stepper">{["Details", "Photos", "Purchase", "Documents", "Review"].map((label, index) => <li key={label} className={step === index + 1 ? "active" : step > index + 1 ? "done" : ""}><span>{index + 1}</span><small>{label}</small></li>)}</ol>
      <form className="registrationCard" onSubmit={submit}>
        {step === 1 && <section className="formStep"><div className="formHeading"><h2>Tool details</h2><p>Copy the information from the tool or serial plate.</p></div><div className="formGrid"><Field label="Make / brand" value={form.make} onChange={(v) => update("make", v)} placeholder="Makita" required/><Field label="Model" value={form.model} onChange={(v) => update("model", v)} placeholder="DHR242" required/><label>Category<select value={form.category} onChange={(e) => update("category", e.target.value)} required><option value="">Choose category</option><option>Drill / driver</option><option>Impact driver</option><option>Rotary hammer</option><option>Angle grinder</option><option>Saw</option><option>Test equipment</option><option>Plant / machinery</option><option>Other</option></select></label><Field label="Serial number" value={form.serial} onChange={(v) => update("serial", v)} placeholder="Serial number" required/><Field label="Secondary identifier" value={form.secondary} onChange={(v) => update("secondary", v)} placeholder="Fleet or asset number"/><Field label="Colour" value={form.colour} onChange={(v) => update("colour", v)} placeholder="Red / black"/><label>Storage location<select value={form.location} onChange={(e) => update("location", e.target.value)}><option>My van</option><option>Home</option><option>Workshop</option><option>Site storage</option><option>Other</option></select></label><Field label="Estimated value (€)" value={form.value} onChange={(v) => update("value", v)} type="number" placeholder="0.00"/></div></section>}
        {step === 2 && <section className="formStep"><div className="formHeading"><h2>Add photographs</h2><p>Clear photos make identification much easier.</p></div><label className="bigUpload"><CameraIcon /><strong>Take photos or choose files</strong><span>Full tool, serial plate and unique marks</span><input type="file" accept="image/*" capture="environment" multiple onChange={(e) => selectFiles(e, setPhotos)} /></label>{photos.length > 0 && <div className="fileList">{photos.map((f) => <span key={f.name}>{f.name}</span>)}</div>}<div className="privacyCallout"><ShieldIcon /><div><strong>Private unless you choose otherwise</strong><p>Photos are available to you and authorised staff. Public listings use only approved information.</p></div></div></section>}
        {step === 3 && <section className="formStep"><div className="formHeading"><h2>Purchase details</h2><p>Optional details strengthen the ownership record.</p></div><div className="formGrid"><Field label="Supplier / seller" value={form.supplier} onChange={(v) => update("supplier", v)} placeholder="Screwfix"/><Field label="Purchase date" value={form.purchaseDate} onChange={(v) => update("purchaseDate", v)} type="date"/><Field label="Purchase price (€)" value={form.purchasePrice} onChange={(v) => update("purchasePrice", v)} type="number" placeholder="0.00"/><Field label="Invoice / receipt number" value={form.invoiceNumber} onChange={(v) => update("invoiceNumber", v)} placeholder="Optional"/><Field label="Security marker / tag ID" value={form.securityId} onChange={(v) => update("securityId", v)} placeholder="UV, QR or tracker ID"/></div></section>}
        {step === 4 && <section className="formStep"><div className="formHeading"><h2>Receipts and invoices</h2><p>Upload proof of ownership. Multiple files are allowed.</p></div><div className="privacyCallout strong"><ShieldIcon /><div><strong>Private by default</strong><p>These documents never appear in public searches. Remove bank details, full card numbers and unrelated personal data before uploading.</p></div></div><label className="bigUpload"><FileIcon /><strong>Upload receipt, invoice or proof of sale</strong><span>PDF, JPG, PNG or HEIC</span><input type="file" accept=".pdf,image/*" multiple onChange={(e) => selectFiles(e, setDocuments)} /></label>{documents.length > 0 && <div className="fileList">{documents.map((f) => <span key={f.name}>{f.name}</span>)}</div>}<label>Document notes<textarea value={form.documentNotes} onChange={(e) => update("documentNotes", e.target.value)} rows={3} placeholder="Optional note" /></label><label className="checkRow"><input type="checkbox" checked={privacyConfirmed} onChange={(e) => setPrivacyConfirmed(e.target.checked)} /><span>I understand the documents are private and should contain only information needed to support ownership.</span></label></section>}
        {step === 5 && <section className="formStep"><div className="formHeading"><h2>Review registration</h2><p>Check the main details before saving.</p></div><dl className="reviewGrid"><div><dt>Tool</dt><dd>{form.make} {form.model}</dd></div><div><dt>Category</dt><dd>{form.category}</dd></div><div><dt>Serial</dt><dd>{form.serial.toUpperCase()}</dd></div><div><dt>Photos</dt><dd>{photos.length}</dd></div><div><dt>Documents</dt><dd>{documents.length}</dd></div><div><dt>Supplier</dt><dd>{form.supplier || "Not provided"}</dd></div></dl><div className="testPrice"><div><span>Beta registration</span><strong>€0.00</strong></div><p>No payment is taken during prototype testing.</p></div><label className="checkRow"><input type="checkbox" checked={accuracyConfirmed} onChange={(e) => setAccuracyConfirmed(e.target.checked)} /><span>I confirm that I own this asset and the information supplied is accurate.</span></label></section>}
        {error && <div className="notice danger">{error}</div>}
        <div className="formActions"><button type="button" className="button secondary" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1 || saving}>Back</button>{step < 5 ? <button className="button primary" disabled={!canNext}>Next</button> : <button className="button primary" disabled={!canNext || saving}>{saving ? "Saving…" : "Complete registration"}</button>}</div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, required = false, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean; type?: string }) { return <label>{label}<input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} step={type === "number" ? "0.01" : undefined} /></label>; }
