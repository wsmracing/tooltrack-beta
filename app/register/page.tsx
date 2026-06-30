"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { BarcodeIcon, CameraIcon, FileIcon, SearchIcon, ShieldIcon } from "@/components/icons";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase-browser";
import { displaySerial, normaliseSerial, safeFileName } from "@/lib/normalise";
import type { CatalogueItem } from "@/lib/types";

interface FormDataState {
  make: string;
  model: string;
  category: string;
  customCategory: string;
  serial: string;
  secondary: string;
  colour: string;
  location: string;
  customLocation: string;
  value: string;
  supplier: string;
  purchaseDate: string;
  purchasePrice: string;
  invoiceNumber: string;
  securityId: string;
  documentNotes: string;
}

const categories = [
  "Drill / driver",
  "Impact driver",
  "Rotary hammer",
  "Angle grinder",
  "Circular saw",
  "Mitre saw",
  "Jigsaw",
  "Cut-off saw / consaw",
  "Nailer / stapler",
  "Cement mixer",
  "Hand tools",
  "Test equipment",
  "Lawn mower",
  "Strimmer / brush cutter",
  "Hedge trimmer",
  "Chainsaw",
  "Leaf blower",
  "Pressure washer",
  "Generator",
  "Compressor",
  "Welding equipment",
  "Ladders / access equipment",
  "Site equipment",
  "Plant / machinery",
  "Tool storage",
  "Battery / charger",
  "Other",
];

const storageLocations = [
  "Van",
  "Shed",
  "Garage",
  "Workshop",
  "Home",
  "Site",
  "Site container",
  "Office",
  "Storage unit",
  "Tool chest",
  "Other",
];

const initial: FormDataState = {
  make: "",
  model: "",
  category: "",
  customCategory: "",
  serial: "",
  secondary: "",
  colour: "",
  location: "Van",
  customLocation: "",
  value: "",
  supplier: "",
  purchaseDate: "",
  purchasePrice: "",
  invoiceNumber: "",
  securityId: "",
  documentNotes: "",
};

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
    if (!isSupabaseConfigured()) {
      setAuthChecked(true);
      return;
    }
    getSupabaseBrowser().auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    const query = catalogueQuery.trim();
    if (query.length < 2) {
      setCatalogueResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCatalogueLoading(true);
      try {
        const response = await fetch(`/api/catalogue?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not search the tool catalogue.");
        setCatalogueResults((body.items ?? []) as CatalogueItem[]);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setCatalogueMessage(caught instanceof Error ? caught.message : "Could not search the tool catalogue.");
      } finally {
        setCatalogueLoading(false);
      }
    }, 280);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [catalogueQuery]);

  const resolvedCategory = form.category === "Other" ? form.customCategory.trim() : form.category;
  const resolvedLocation = form.location === "Other" ? form.customLocation.trim() : form.location;

  const canNext = useMemo(() => {
    if (step === 1) return Boolean(form.make.trim() && form.model.trim() && resolvedCategory && normaliseSerial(form.serial));
    if (step === 4) return privacyConfirmed;
    if (step === 5) return accuracyConfirmed;
    return true;
  }, [step, form, privacyConfirmed, accuracyConfirmed, resolvedCategory]);

  function update<K extends keyof FormDataState>(key: K, value: FormDataState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function selectFiles(event: ChangeEvent<HTMLInputElement>, setter: (files: File[]) => void) {
    setter(Array.from(event.target.files ?? []));
  }

  const applyCatalogueItem = useCallback((item: CatalogueItem, barcodeOverride?: string) => {
    setForm((current) => ({
      ...current,
      make: item.make,
      model: item.model,
      category: categories.includes(item.category) ? item.category : "Other",
      customCategory: categories.includes(item.category) ? "" : item.category,
    }));
    setCatalogueItemId(item.id);
    setProductBarcode(barcodeOverride || item.gtin || "");
    setCatalogueQuery(`${item.make} ${item.model}`);
    setCatalogueResults([]);
    setCatalogueMessage(`${item.make} ${item.model} selected from the ToolTrack catalogue.`);
  }, []);

  const handleScan = useCallback(async (value: string) => {
    const mode = scannerMode;
    setScannerMode(null);
    if (mode === "serial") {
      setForm((current) => ({ ...current, serial: displaySerial(value) }));
      setCatalogueMessage("Serial number captured. Check it against the serial plate before saving.");
      return;
    }

    const barcode = value.trim().replace(/\s+/g, "");
    setProductBarcode(barcode);
    setCatalogueMessage("Checking the product catalogue…");
    try {
      const response = await fetch(`/api/catalogue?barcode=${encodeURIComponent(barcode)}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not check the product barcode.");
      if (body.item) applyCatalogueItem(body.item as CatalogueItem, barcode);
      else {
        setCatalogueItemId(null);
        setCatalogueMessage("Barcode captured, but this product is not in the ToolTrack catalogue yet. Enter the make and model manually.");
      }
    } catch (caught) {
      setCatalogueMessage(caught instanceof Error ? caught.message : "Barcode captured. Enter the make and model manually.");
    }
  }, [applyCatalogueItem, scannerMode]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (step < 5) {
      if (canNext) setStep((current) => current + 1);
      return;
    }
    if (!user || !accuracyConfirmed) return;

    setSaving(true);
    try {
      const supabase = getSupabaseBrowser();
      const serialOriginal = displaySerial(form.serial);
      const { data: profileData } = await supabase.from("profiles").select("active_organization_id").eq("id", user.id).maybeSingle();
      const { data: savedLocation } = resolvedLocation ? await supabase.from("asset_locations").select("id").eq("name", resolvedLocation).maybeSingle() : { data: null };
      const { data: asset, error: assetError } = await supabase.from("assets").insert({
        owner_id: user.id,
        organization_id: profileData?.active_organization_id ?? null,
        make: form.make.trim(),
        model: form.model.trim(),
        category: resolvedCategory,
        serial_original: serialOriginal,
        serial_normalized: normaliseSerial(serialOriginal),
        secondary_identifier: form.secondary.trim() || null,
        colour: form.colour.trim() || null,
        storage_location: resolvedLocation || null,
        location_id: savedLocation?.id ?? null,
        estimated_value: form.value ? Number(form.value) : null,
        supplier: form.supplier.trim() || null,
        purchase_date: form.purchaseDate || null,
        purchase_price: form.purchasePrice ? Number(form.purchasePrice) : null,
        invoice_number: form.invoiceNumber.trim() || null,
        security_id: form.securityId.trim() || null,
        catalogue_item_id: catalogueItemId,
        product_barcode: productBarcode || null,
        status: "safe",
      }).select("id").single();
      if (assetError) throw assetError;

      for (let index = 0; index < photos.length; index += 1) {
        const file = photos[index];
        const path = `${user.id}/${asset.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
        const { error: uploadError } = await supabase.storage.from("asset-photos").upload(path, file, { upsert: false });
        if (uploadError) throw uploadError;
        const { error: rowError } = await supabase.from("asset_photos").insert({
          asset_id: asset.id,
          owner_id: user.id,
          storage_path: path,
          original_name: file.name,
          image_type: index === 0 ? "full_tool" : "additional",
        });
        if (rowError) throw rowError;
      }

      for (const file of documents) {
        const path = `${user.id}/${asset.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
        const { error: uploadError } = await supabase.storage.from("ownership-documents").upload(path, file, { upsert: false });
        if (uploadError) throw uploadError;
        const { error: rowError } = await supabase.from("asset_documents").insert({
          asset_id: asset.id,
          owner_id: user.id,
          storage_path: path,
          original_name: file.name,
          document_type: "proof_of_ownership",
          notes: form.documentNotes.trim() || null,
        });
        if (rowError) throw rowError;
      }

      router.push(`/asset/${asset.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register the asset.");
      setSaving(false);
    }
  }

  if (!authChecked) return <div className="pageWidth pagePad"><div className="skeletonCard" /></div>;
  if (!user) return <div className="pageWidth pagePad narrowPage"><div className="emptyPanel"><ShieldIcon /><h1>Sign in before registering</h1><p>Your asset record and private documents must be attached to an account.</p><Link className="button primary" href={`/login?next=${encodeURIComponent(form.serial ? `/register?serial=${form.serial}` : "/register")}`}>Sign in or create account</Link></div></div>;

  return (
    <div className="pageWidth pagePad registerPage">
      <div className="sectionTitleRow">
        <div><p className="eyebrow red">New asset</p><h1>Register an asset</h1><p className="muted">Complete the details beside the item. You can add more later.</p></div>
        <Link className="button secondary" href="/dashboard">Cancel</Link>
      </div>

      <ol className="stepper">{["Details", "Photos", "Purchase", "Documents", "Review"].map((label, index) => <li key={label} className={step === index + 1 ? "active" : step > index + 1 ? "done" : ""}><span>{index + 1}</span><small>{label}</small></li>)}</ol>

      <form className="registrationCard" onSubmit={submit}>
        {step === 1 && <section className="formStep">
          <div className="formHeading"><h2>Asset details</h2><p>Scan a code, search the catalogue, or enter the details manually.</p></div>

          <div className="cataloguePanel">
            <div className="catalogueHeading"><div><strong>Find the tool faster</strong><span>Search by make, model or manufacturer part number.</span></div><BarcodeIcon /></div>
            <div className="catalogueSearch inputWithIcon"><SearchIcon /><input value={catalogueQuery} onChange={(event) => { setCatalogueQuery(event.target.value); setCatalogueMessage(""); }} placeholder="Try Makita DHR242" autoComplete="off" /></div>
            {catalogueLoading && <p className="catalogueStatus">Searching catalogue…</p>}
            {catalogueResults.length > 0 && <div className="catalogueResults">{catalogueResults.map((item) => <button type="button" key={item.id} onClick={() => applyCatalogueItem(item)}><span><strong>{item.make} {item.model}</strong><small>{item.category}{item.manufacturer_part_number ? ` · ${item.manufacturer_part_number}` : ""}</small></span><em>Select</em></button>)}</div>}
            <div className="scanActions"><button className="button secondary" type="button" onClick={() => setScannerMode("product")}><BarcodeIcon /> Scan product barcode</button><button className="button secondary" type="button" onClick={() => setScannerMode("serial")}><CameraIcon /> Scan serial barcode</button></div>
            {catalogueMessage && <p className="catalogueStatus">{catalogueMessage}</p>}
            <p className="fieldHint">A product barcode usually identifies the model. The serial barcode identifies this individual asset.</p>
          </div>

          <div className="formGrid">
            <Field label="Make / brand" value={form.make} onChange={(value) => { update("make", value); setCatalogueItemId(null); }} placeholder="Makita" required />
            <Field label="Model" value={form.model} onChange={(value) => { update("model", value); setCatalogueItemId(null); }} placeholder="DHR242" required />
            <Field label="Product barcode / GTIN" value={productBarcode} onChange={(value) => setProductBarcode(value.replace(/\s+/g, ""))} inputMode="numeric" placeholder="Optional — scan or type" />
            <label>Category<select value={form.category} onChange={(event) => update("category", event.target.value)} required><option value="">Choose category</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
            {form.category === "Other" && <Field label="Custom category" value={form.customCategory} onChange={(value) => update("customCategory", value)} placeholder="Enter your own category" required />}
            <Field label="Serial number" value={form.serial} onChange={(value) => update("serial", value.toUpperCase())} onBlur={() => update("serial", displaySerial(form.serial))} placeholder="Serial number" required />
            <Field label="Secondary identifier" value={form.secondary} onChange={(value) => update("secondary", value)} placeholder="Fleet or asset number" />
            <Field label="Colour" value={form.colour} onChange={(value) => update("colour", value)} placeholder="Red / black" />
            <label>Storage location<select value={form.location} onChange={(event) => update("location", event.target.value)}>{storageLocations.map((location) => <option key={location}>{location}</option>)}</select></label>
            {form.location === "Other" && <Field label="Custom storage location" value={form.customLocation} onChange={(value) => update("customLocation", value)} placeholder="Back shed, red van, rack 2…" />}
            <Field label="Estimated value (€)" value={form.value} onChange={(value) => update("value", value)} type="number" inputMode="decimal" placeholder="0.00" />
          </div>
        </section>}

        {step === 2 && <section className="formStep">
          <div className="formHeading"><h2>Add photographs</h2><p>Clear photos make identification much easier.</p></div>
          <label className="bigUpload"><CameraIcon /><strong>Take photos or choose files</strong><span>Full item, serial plate and unique marks</span><input type="file" accept="image/*" capture="environment" multiple onChange={(event) => selectFiles(event, setPhotos)} /></label>
          {photos.length > 0 && <div className="fileList">{photos.map((file) => <span key={`${file.name}-${file.lastModified}`}>{file.name}</span>)}</div>}
          <div className="privacyCallout"><ShieldIcon /><div><strong>Private unless you choose otherwise</strong><p>Photos are available to you and authorised staff. Public listings use only approved information.</p></div></div>
        </section>}

        {step === 3 && <section className="formStep">
          <div className="formHeading"><h2>Purchase details</h2><p>Optional details strengthen the ownership record.</p></div>
          <div className="formGrid">
            <Field label="Supplier / seller" value={form.supplier} onChange={(value) => update("supplier", value)} placeholder="Screwfix" />
            <Field label="Purchase date" value={form.purchaseDate} onChange={(value) => update("purchaseDate", value)} type="date" />
            <Field label="Purchase price (€)" value={form.purchasePrice} onChange={(value) => update("purchasePrice", value)} type="number" inputMode="decimal" placeholder="0.00" />
            <Field label="Invoice / receipt number" value={form.invoiceNumber} onChange={(value) => update("invoiceNumber", value)} placeholder="Optional" />
            <Field label="Security marker / tag ID" value={form.securityId} onChange={(value) => update("securityId", value)} placeholder="UV, QR or tracker ID" />
          </div>
        </section>}

        {step === 4 && <section className="formStep">
          <div className="formHeading"><h2>Receipts and invoices</h2><p>Upload proof of ownership. Multiple files are allowed.</p></div>
          <div className="privacyCallout strong"><ShieldIcon /><div><strong>Private by default</strong><p>These documents never appear in public searches. Remove bank details, full card numbers and unrelated personal data before uploading.</p></div></div>
          <label className="bigUpload"><FileIcon /><strong>Upload receipt, invoice or proof of sale</strong><span>PDF, JPG, PNG or HEIC</span><input type="file" accept=".pdf,image/*" multiple onChange={(event) => selectFiles(event, setDocuments)} /></label>
          {documents.length > 0 && <div className="fileList">{documents.map((file) => <span key={`${file.name}-${file.lastModified}`}>{file.name}</span>)}</div>}
          <label>Document notes<textarea value={form.documentNotes} onChange={(event) => update("documentNotes", event.target.value)} rows={3} placeholder="Optional note" /></label>
          <label className="checkRow"><input type="checkbox" checked={privacyConfirmed} onChange={(event) => setPrivacyConfirmed(event.target.checked)} /><span>I understand the documents are private and should contain only information needed to support ownership.</span></label>
        </section>}

        {step === 5 && <section className="formStep">
          <div className="formHeading"><h2>Review registration</h2><p>Check the main details before saving.</p></div>
          <dl className="reviewGrid">
            <div><dt>Asset</dt><dd>{form.make} {form.model}</dd></div>
            <div><dt>Category</dt><dd>{resolvedCategory}</dd></div>
            <div><dt>Serial</dt><dd>{displaySerial(form.serial)}</dd></div>
            <div><dt>Product barcode</dt><dd>{productBarcode || "Not provided"}</dd></div>
            <div><dt>Storage</dt><dd>{resolvedLocation || "Not provided"}</dd></div>
            <div><dt>Photos</dt><dd>{photos.length}</dd></div>
            <div><dt>Documents</dt><dd>{documents.length}</dd></div>
            <div><dt>Supplier</dt><dd>{form.supplier || "Not provided"}</dd></div>
          </dl>
          <div className="testPrice"><div><span>Beta registration</span><strong>€0.00</strong></div><p>No payment is taken during prototype testing.</p></div>
          <label className="checkRow"><input type="checkbox" checked={accuracyConfirmed} onChange={(event) => setAccuracyConfirmed(event.target.checked)} /><span>I confirm that I own this asset and the information supplied is accurate.</span></label>
        </section>}

        {error && <div className="notice danger formNotice">{error}</div>}
        <div className="formActions"><button type="button" className="button secondary" onClick={() => setStep((current) => Math.max(1, current - 1))} disabled={step === 1 || saving}>Back</button>{step < 5 ? <button className="button primary" disabled={!canNext}>Next</button> : <button className="button primary" disabled={!canNext || saving}>{saving ? "Saving asset…" : "Complete registration"}</button>}</div>
      </form>

      {scannerMode && <BarcodeScanner
        title={scannerMode === "product" ? "Scan product barcode" : "Scan serial barcode"}
        helpText={scannerMode === "product" ? "Use the barcode on the tool, box or packaging." : "Use the barcode or QR code beside the serial number on the rating plate."}
        onDetected={handleScan}
        onClose={() => setScannerMode(null)}
      />}
    </div>
  );
}

function Field({ label, value, onChange, onBlur, placeholder, required = false, type = "text", inputMode }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  inputMode?: "text" | "decimal" | "numeric" | "email" | "url";
}) {
  return <label>{label}<input type={type} inputMode={inputMode} value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} placeholder={placeholder} required={required} step={type === "number" ? "0.01" : undefined} /></label>;
}
