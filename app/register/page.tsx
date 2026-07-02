"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { BarcodeIcon, CameraIcon, FileIcon, SearchIcon, ShieldIcon } from "@/components/icons";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase-browser";
import { displaySerial, normaliseSerial, safeFileName } from "@/lib/normalise";
import { friendlyError } from "@/lib/user-errors";
import type { CatalogueItem } from "@/lib/types";

interface FormDataState {
  make: string; model: string; category: string; customCategory: string; serial: string; secondary: string; colour: string;
  location: string; customLocation: string; value: string; supplier: string; purchaseDate: string; purchasePrice: string;
  invoiceNumber: string; securityId: string; documentNotes: string;
}

const categories = ["Drill / driver","Impact driver","Rotary hammer","Angle grinder","Circular saw","Mitre saw","Jigsaw","Cut-off saw / consaw","Nailer / stapler","Cement mixer","Hand tools","Test equipment","Lawn mower","Strimmer / brush cutter","Hedge trimmer","Chainsaw","Leaf blower","Pressure washer","Generator","Compressor","Welding equipment","Ladders / access equipment","Site equipment","Plant / machinery","Tool storage","Battery / charger","Other"];
const storageLocations = ["Van","Shed","Garage","Workshop","Home","Site","Site container","Office","Storage unit","Tool chest","Other"];
const initial: FormDataState = { make:"",model:"",category:"",customCategory:"",serial:"",secondary:"",colour:"",location:"",customLocation:"",value:"",supplier:"",purchaseDate:"",purchasePrice:"",invoiceNumber:"",securityId:"",documentNotes:"" };
const allowedImages = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedDocuments = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

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
  const [catalogueQuery, setCatalogueQuery] = useState("");
  const [catalogueResults, setCatalogueResults] = useState<CatalogueItem[]>([]);
  const [catalogueLoading, setCatalogueLoading] = useState(false);
  const [catalogueMessage, setCatalogueMessage] = useState("");
  const [catalogueItemId, setCatalogueItemId] = useState<string | null>(null);
  const [productBarcode, setProductBarcode] = useState("");
  const [scannerMode, setScannerMode] = useState<"product" | "serial" | null>(null);
  const router = useRouter();

  useEffect(() => {
    const querySerial = new URLSearchParams(window.location.search).get("serial")?.trim();
    if (querySerial) setForm((current) => current.serial ? current : { ...current, serial: displaySerial(querySerial) });
    if (!isSupabaseConfigured()) { setAuthChecked(true); return; }
    void getSupabaseBrowser().auth.getUser().then(({ data }) => { setUser(data.user); setAuthChecked(true); });
  }, []);

  useEffect(() => {
    const query = catalogueQuery.trim();
    if (query.length < 2) { setCatalogueResults([]); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCatalogueLoading(true);
      try {
        const response = await fetch(`/api/catalogue?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "The catalogue could not be searched.");
        setCatalogueResults((body.items ?? []) as CatalogueItem[]);
      } catch (caught) {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) setCatalogueMessage("The catalogue could not be searched. Enter the details manually.");
      } finally { setCatalogueLoading(false); }
    }, 280);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [catalogueQuery]);

  const resolvedCategory = form.category === "Other" ? form.customCategory.trim() : form.category;
  const resolvedLocation = form.location === "Other" ? form.customLocation.trim() : form.location;
  const canNext = useMemo(() => {
    if (step === 1) return Boolean(form.make.trim() && form.model.trim() && resolvedCategory && normaliseSerial(form.serial).length >= 4);
    if (step === 2) return documents.length === 0 || privacyConfirmed;
    return accuracyConfirmed;
  }, [step, form, resolvedCategory, documents.length, privacyConfirmed, accuracyConfirmed]);

  function update<K extends keyof FormDataState>(key: K, value: FormDataState[K]) { setForm((current) => ({ ...current, [key]: value })); }

  function selectFiles(event: ChangeEvent<HTMLInputElement>, kind: "photo" | "document") {
    const incoming = Array.from(event.target.files ?? []);
    const allowed = kind === "photo" ? allowedImages : allowedDocuments;
    const maxBytes = kind === "photo" ? 10 * 1024 * 1024 : 12 * 1024 * 1024;
    const invalid = incoming.find((file) => !allowed.has(file.type) || file.size > maxBytes);
    if (invalid) {
      setError(kind === "photo" ? "Photos must be JPG, PNG or WebP and no larger than 10 MB." : "Evidence files must be PDF, JPG, PNG or WebP and no larger than 12 MB.");
      event.target.value = "";
      return;
    }
    setError("");
    if (kind === "photo") setPhotos(incoming.slice(0, 12)); else setDocuments(incoming.slice(0, 8));
  }

  const applyCatalogueItem = useCallback((item: CatalogueItem, barcodeOverride?: string) => {
    setForm((current) => ({ ...current, make: item.make, model: item.model, category: categories.includes(item.category) ? item.category : "Other", customCategory: categories.includes(item.category) ? "" : item.category }));
    setCatalogueItemId(item.id); setProductBarcode(barcodeOverride || item.gtin || ""); setCatalogueQuery(`${item.make} ${item.model}`); setCatalogueResults([]); setCatalogueMessage(`${item.make} ${item.model} selected.`);
  }, []);

  const handleScan = useCallback(async (value: string) => {
    const mode = scannerMode; setScannerMode(null);
    if (mode === "serial") { setForm((current) => ({ ...current, serial: displaySerial(value) })); setCatalogueMessage("Serial captured. Check it against the rating plate."); return; }
    const barcode = value.trim().replace(/\s+/g, ""); setProductBarcode(barcode); setCatalogueMessage("Checking the catalogue…");
    try {
      const response = await fetch(`/api/catalogue?barcode=${encodeURIComponent(barcode)}`); const body = await response.json();
      if (body.item) applyCatalogueItem(body.item as CatalogueItem, barcode); else { setCatalogueItemId(null); setCatalogueMessage("Barcode captured. Enter the make and model manually."); }
    } catch { setCatalogueMessage("Barcode captured. Enter the make and model manually."); }
  }, [applyCatalogueItem, scannerMode]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (step < 3) { if (canNext) setStep((current) => current + 1); return; }
    if (!user || !accuracyConfirmed) return;
    setSaving(true);
    try {
      const supabase = getSupabaseBrowser();
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Your session has expired. Sign in again.");
      const response = await fetch("/api/assets/register", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ make: form.make, model: form.model, category: resolvedCategory, serial: form.serial, secondaryIdentifier: form.secondary, colour: form.colour, storageLocation: resolvedLocation, estimatedValue: form.value, supplier: form.supplier, purchaseDate: form.purchaseDate, purchasePrice: form.purchasePrice, invoiceNumber: form.invoiceNumber, securityId: form.securityId, catalogueItemId, productBarcode }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The asset could not be registered.");
      const assetId = String(body.id);

      for (let index = 0; index < photos.length; index += 1) {
        const file = photos[index]; const path = `${user.id}/${assetId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
        const { error: uploadError } = await supabase.storage.from("asset-photos").upload(path, file, { upsert: false, contentType: file.type });
        if (uploadError) throw uploadError;
        const { error: rowError } = await supabase.from("asset_photos").insert({ asset_id: assetId, owner_id: user.id, storage_path: path, original_name: file.name, image_type: index === 0 ? "full_tool" : "additional" });
        if (rowError) throw rowError;
      }

      for (const file of documents) {
        const path = `${user.id}/${assetId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
        const { error: uploadError } = await supabase.storage.from("ownership-documents").upload(path, file, { upsert: false, contentType: file.type });
        if (uploadError) throw uploadError;
        const { error: rowError } = await supabase.from("asset_documents").insert({ asset_id: assetId, owner_id: user.id, storage_path: path, original_name: file.name, document_type: "purchase_evidence", notes: form.documentNotes.trim() || null });
        if (rowError) throw rowError;
      }
      if (photos.length || documents.length) await supabase.from("assets").update({ verification_level: "evidence_supplied" }).eq("id", assetId);
      router.push(`/asset/${assetId}`); router.refresh();
    } catch (caught) {
      setError(friendlyError(caught, "The asset could not be registered. Check the details and try again.")); setSaving(false);
    }
  }

  if (!authChecked) return <div className="pageWidth pagePad"><div className="skeletonCard" /></div>;
  if (!user) return <div className="pageWidth pagePad narrowPage"><div className="emptyPanel"><ShieldIcon /><h1>Sign in before registering</h1><p>Your asset record and private evidence must be attached to an account.</p><Link className="button primary" href={`/login?next=${encodeURIComponent(form.serial ? `/register?serial=${form.serial}` : "/register")}`}>Sign in or create account</Link></div></div>;

  return <div className="pageWidth pagePad registerPage">
    <div className="sectionTitleRow"><div><h1>Register an asset</h1><p className="muted">Start with the identifying details. Everything else can be added or updated later.</p></div><Link className="button secondary" href="/assets">Cancel</Link></div>
    <ol className="stepper v45Stepper">{["Identify", "Strengthen", "Review"].map((label, index) => <li key={label} className={step === index + 1 ? "active" : step > index + 1 ? "done" : ""}><span>{index + 1}</span><small>{label}</small></li>)}</ol>
    <form className="registrationCard" onSubmit={submit}>
      {step === 1 && <section className="formStep">
        <div className="formHeading"><h2>Identify the asset</h2><p>Enter the details that distinguish this individual item.</p></div>
        <div className="cataloguePanel">
          <div className="catalogueHeading"><div><strong>Find the model faster</strong><span>Search by make, model or manufacturer part number.</span></div><BarcodeIcon /></div>
          <div className="catalogueSearch inputWithIcon"><SearchIcon /><input value={catalogueQuery} onChange={(event) => { setCatalogueQuery(event.target.value); setCatalogueMessage(""); }} placeholder="Try Makita DHR242" autoComplete="off" /></div>
          {catalogueLoading && <p className="catalogueStatus">Searching…</p>}
          {catalogueResults.length > 0 && <div className="catalogueResults">{catalogueResults.map((item) => <button type="button" key={item.id} onClick={() => applyCatalogueItem(item)}><span><strong>{item.make} {item.model}</strong><small>{item.category}{item.manufacturer_part_number ? ` · ${item.manufacturer_part_number}` : ""}</small></span><em>Select</em></button>)}</div>}
          <div className="scanActions"><button className="button secondary" type="button" onClick={() => setScannerMode("product")}><BarcodeIcon /> Scan product barcode</button><button className="button secondary" type="button" onClick={() => setScannerMode("serial")}><CameraIcon /> Scan serial barcode</button></div>
          {catalogueMessage && <p className="catalogueStatus">{catalogueMessage}</p>}
        </div>
        <div className="formGrid">
          <Field label="Make / brand" value={form.make} onChange={(value) => { update("make", value); setCatalogueItemId(null); }} placeholder="Makita" required />
          <Field label="Model" value={form.model} onChange={(value) => { update("model", value); setCatalogueItemId(null); }} placeholder="DHR242" required />
          <label>Category<select value={form.category} onChange={(event) => update("category", event.target.value)} required><option value="">Choose category</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          {form.category === "Other" && <Field label="Custom category" value={form.customCategory} onChange={(value) => update("customCategory", value)} required />}
          <Field label="Serial number" value={form.serial} onChange={(value) => update("serial", value.toUpperCase())} onBlur={() => update("serial", displaySerial(form.serial))} required />
          <Field label="Product barcode / GTIN" value={productBarcode} onChange={(value) => setProductBarcode(value.replace(/\s+/g, ""))} inputMode="numeric" placeholder="Optional" />
          <Field label="Secondary identifier" value={form.secondary} onChange={(value) => update("secondary", value)} placeholder="Fleet or asset number" />
          <Field label="Colour" value={form.colour} onChange={(value) => update("colour", value)} placeholder="Red / black" />
          <label>Storage location<select value={form.location} onChange={(event) => update("location", event.target.value)}><option value="">Not set</option>{storageLocations.map((location) => <option key={location}>{location}</option>)}</select></label>
          {form.location === "Other" && <Field label="Custom storage location" value={form.customLocation} onChange={(value) => update("customLocation", value)} placeholder="Back shed, red van, rack 2…" />}
          <Field label="Estimated value (€)" value={form.value} onChange={(value) => update("value", value)} type="number" inputMode="decimal" placeholder="0.00" />
        </div>
      </section>}

      {step === 2 && <section className="formStep strengthenStep">
        <div className="formHeading"><h2>Strengthen the record</h2><p>Photos and purchase evidence make a pre-loss record more useful.</p></div>
        <div className="strengthenGrid">
          <div><label className="bigUpload compactUpload"><CameraIcon /><strong>Add photographs</strong><span>Full item, serial plate and unique marks</span><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple onChange={(event) => selectFiles(event, "photo")} /></label>{photos.length > 0 && <div className="fileList">{photos.map((file) => <span key={`${file.name}-${file.lastModified}`}>{file.name}</span>)}</div>}</div>
          <div><label className="bigUpload compactUpload"><FileIcon /><strong>Add purchase evidence</strong><span>PDF, JPG, PNG or WebP</span><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple onChange={(event) => selectFiles(event, "document")} /></label>{documents.length > 0 && <div className="fileList">{documents.map((file) => <span key={`${file.name}-${file.lastModified}`}>{file.name}</span>)}</div>}</div>
        </div>
        <div className="privacyCallout"><ShieldIcon /><div><strong>Private evidence</strong><p>Receipts and invoices never appear in public serial checks. Only upload information needed to support the asset record.</p></div></div>
        <div className="formGrid strengthenFields">
          <Field label="Supplier / seller" value={form.supplier} onChange={(value) => update("supplier", value)} placeholder="Screwfix" />
          <Field label="Purchase date" value={form.purchaseDate} onChange={(value) => update("purchaseDate", value)} type="date" />
          <Field label="Purchase price (€)" value={form.purchasePrice} onChange={(value) => update("purchasePrice", value)} type="number" inputMode="decimal" placeholder="0.00" />
          <Field label="Invoice / receipt number" value={form.invoiceNumber} onChange={(value) => update("invoiceNumber", value)} />
          <Field label="Security marker / tag ID" value={form.securityId} onChange={(value) => update("securityId", value)} placeholder="UV, QR or tracker ID" />
          <label>Evidence notes<textarea value={form.documentNotes} onChange={(event) => update("documentNotes", event.target.value)} rows={3} placeholder="Optional" /></label>
        </div>
        {documents.length > 0 && <label className="checkRow"><input type="checkbox" checked={privacyConfirmed} onChange={(event) => setPrivacyConfirmed(event.target.checked)} /><span>I have removed unnecessary bank, card and personal information from the uploaded evidence.</span></label>}
      </section>}

      {step === 3 && <section className="formStep">
        <div className="formHeading"><h2>Review and save</h2><p>Registration creates a dated record. It is not independent proof of legal ownership.</p></div>
        <dl className="reviewGrid"><div><dt>Asset</dt><dd>{form.make} {form.model}</dd></div><div><dt>Category</dt><dd>{resolvedCategory}</dd></div><div><dt>Serial</dt><dd>{displaySerial(form.serial)}</dd></div><div><dt>Storage</dt><dd>{resolvedLocation || "Not provided"}</dd></div><div><dt>Photos</dt><dd>{photos.length}</dd></div><div><dt>Evidence files</dt><dd>{documents.length}</dd></div><div><dt>Supplier</dt><dd>{form.supplier || "Not provided"}</dd></div><div><dt>Purchase date</dt><dd>{form.purchaseDate || "Not provided"}</dd></div></dl>
        <label className="checkRow ownershipConfirmation"><input type="checkbox" checked={accuracyConfirmed} onChange={(event) => setAccuracyConfirmed(event.target.checked)} /><span>I confirm that I own this asset or am authorised to manage it, and that the information supplied is accurate.</span></label>
      </section>}

      {error && <div className="notice danger formNotice">{error}</div>}
      <div className="formActions"><button type="button" className="button secondary" onClick={() => setStep((current) => Math.max(1, current - 1))} disabled={step === 1 || saving}>Back</button>{step < 3 ? <button className="button primary" disabled={!canNext}>Continue</button> : <button className="button primary" disabled={!canNext || saving}>{saving ? "Saving asset…" : "Save asset"}</button>}</div>
    </form>
    {scannerMode && <BarcodeScanner title={scannerMode === "product" ? "Scan product barcode" : "Scan serial barcode"} helpText={scannerMode === "product" ? "Use the barcode on the tool, box or packaging." : "Use the barcode or QR code beside the serial number on the rating plate."} onDetected={handleScan} onClose={() => setScannerMode(null)} />}
  </div>;
}

function Field({ label, value, onChange, onBlur, placeholder, required = false, type = "text", inputMode }: { label: string; value: string; onChange: (value: string) => void; onBlur?: () => void; placeholder?: string; required?: boolean; type?: string; inputMode?: "text" | "decimal" | "numeric" | "email" | "url"; }) {
  return <label>{label}<input type={type} inputMode={inputMode} value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} placeholder={placeholder} required={required} step={type === "number" ? "0.01" : undefined} /></label>;
}
