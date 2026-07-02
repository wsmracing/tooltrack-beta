"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { DownloadIcon, FileIcon, UploadIcon } from "@/components/icons";
import { downloadTextFile, parseCsv } from "@/lib/csv";
import { normaliseSerial, safeFileName } from "@/lib/normalise";
import { getPlan } from "@/lib/plans";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { friendlyError } from "@/lib/user-errors";
import type { Profile } from "@/lib/types";

const requiredHeaders = ["make", "model", "category", "serial"];
const templateHeaders = [
  "make",
  "model",
  "category",
  "serial",
  "storage_location",
  "estimated_value",
  "supplier",
  "purchase_date",
  "purchase_price",
  "invoice_number",
  "colour",
  "notes",
];

type PreviewRow = Record<string, string> & { rowNumber: string; error?: string };

type ImportedAsset = {
  id: string;
  serial_original: string;
  serial_normalized: string;
  make: string;
  model: string;
};

type AttachmentKind = "photo" | "serial_photo" | "document";

type PendingAttachment = {
  id: string;
  file: File;
  kind: AttachmentKind;
  matchedAssetIds: string[];
};

function classifyAttachment(file: File): AttachmentKind {
  const name = file.name.toLowerCase();
  const documentWords = ["invoice", "receipt", "warranty", "proof", "purchase"];
  if (file.type === "application/pdf" || documentWords.some((word) => name.includes(word))) return "document";
  if (name.includes("serial") || name.includes("plate")) return "serial_photo";
  return "photo";
}

function attachmentLabel(kind: AttachmentKind): string {
  if (kind === "document") return "Invoice / document";
  if (kind === "serial_photo") return "Serial plate photo";
  return "Tool photo";
}

function documentType(filename: string): string {
  const name = filename.toLowerCase();
  if (name.includes("receipt")) return "receipt";
  if (name.includes("warranty")) return "warranty";
  if (name.includes("invoice")) return "invoice";
  return "proof_of_ownership";
}

export default function ImportPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [filename, setFilename] = useState("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [importedAssets, setImportedAssets] = useState<ImportedAsset[]>([]);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [attachmentMessage, setAttachmentMessage] = useState("");
  const [attachmentError, setAttachmentError] = useState("");

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      setUser(auth.user);
      if (auth.user) {
        const { data } = await supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
        if (data) setProfile(data as Profile);
      }
      setLoading(false);
    })();
  }, []);

  const plan = getPlan(profile?.plan_tier);
  const validRows = useMemo(() => rows.filter((row) => !row.error), [rows]);
  const matchedAttachments = useMemo(
    () => attachments.filter((attachment) => attachment.matchedAssetIds.length > 0),
    [attachments],
  );
  const unmatchedAttachments = useMemo(
    () => attachments.filter((attachment) => attachment.matchedAssetIds.length === 0),
    [attachments],
  );

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    setMessage("");
    setError("");
    setImportedAssets([]);
    setAttachments([]);
    const parsed = parseCsv(await file.text());
    if (parsed.length < 2) {
      setError("The CSV does not contain any asset rows.");
      setRows([]);
      return;
    }
    const headers = parsed[0].map((header) => header.trim().toLowerCase().replaceAll(" ", "_"));
    const missing = requiredHeaders.filter((header) => !headers.includes(header));
    if (missing.length) {
      setError(`Missing required columns: ${missing.join(", ")}`);
      setRows([]);
      return;
    }
    const next = parsed.slice(1).map((values, index) => {
      const row = Object.fromEntries(
        headers.map((header, position) => [header, values[position]?.trim() ?? ""]),
      ) as PreviewRow;
      row.rowNumber = String(index + 2);
      const serial = normaliseSerial(row.serial ?? "");
      if (!row.make || !row.model || !row.category || !serial) {
        row.error = "Make, model, category and serial are required.";
      } else {
        row.serial = serial;
      }
      return row;
    });
    const duplicates = new Set<string>();
    const seen = new Set<string>();
    next.forEach((row) => {
      if (seen.has(row.serial)) duplicates.add(row.serial);
      seen.add(row.serial);
    });
    next.forEach((row) => {
      if (duplicates.has(row.serial)) row.error = "Duplicate serial in this file.";
    });
    setRows(next);
  }

  function downloadTemplate() {
    const example = [
      "Makita",
      "DHR242",
      "Rotary hammer",
      "EXAMPLE-001",
      "Red van",
      "350",
      "Local supplier",
      "2026-06-01",
      "329.99",
      "INV-1001",
      "Blue",
      "Example row - delete before importing",
    ];
    downloadTextFile(
      "tooltrack-bulk-import-template.csv",
      `${templateHeaders.join(",")}\n${example.join(",")}`,
    );
  }

  async function runImport() {
    if (!user || !validRows.length || !plan.bulkTools) return;
    if (!window.confirm(`Import ${validRows.length} assets into ToolTrack?`)) return;
    setImporting(true);
    setError("");
    setMessage("");
    setImportedAssets([]);
    setAttachments([]);
    try {
      const supabase = getSupabaseBrowser();
      const organizationId = profile?.active_organization_id ?? null;
      const payload = validRows.map((row) => ({
        owner_id: user.id,
        organization_id: organizationId,
        make: row.make,
        model: row.model,
        category: row.category,
        serial_original: row.serial,
        serial_normalized: normaliseSerial(row.serial),
        storage_location: row.storage_location || null,
        estimated_value: row.estimated_value ? Number(row.estimated_value) : null,
        supplier: row.supplier || null,
        purchase_date: row.purchase_date || null,
        purchase_price: row.purchase_price ? Number(row.purchase_price) : null,
        invoice_number: row.invoice_number || null,
        colour: row.colour || null,
        notes: row.notes || null,
        status: "safe",
      }));
      const created: ImportedAsset[] = [];
      for (let index = 0; index < payload.length; index += 100) {
        const batch = payload.slice(index, index + 100);
        const { data, error: insertError } = await supabase
          .from("assets")
          .insert(batch)
          .select("id, serial_original, serial_normalized, make, model");
        if (insertError) throw insertError;
        created.push(...((data ?? []) as ImportedAsset[]));
      }
      setImportedAssets(created);
      setMessage(`${created.length} assets imported successfully. You can now attach matching photos and invoices.`);
      setRows([]);
      setFilename("");
    } catch (caught) {
      setError(friendlyError(caught, "The import could not be completed. Check the file and try again."));
    } finally {
      setImporting(false);
    }
  }

  function selectAttachments(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setAttachmentMessage("");
    setAttachmentError("");
    const next = files.map((file, index): PendingAttachment => {
      const normalizedFilename = normaliseSerial(file.name.replace(/\.[^.]+$/, ""));
      const matches = importedAssets
        .filter((asset) => normalizedFilename.includes(asset.serial_normalized))
        .map((asset) => asset.id);
      return {
        id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
        file,
        kind: classifyAttachment(file),
        matchedAssetIds: matches,
      };
    });
    setAttachments(next);
    event.target.value = "";
  }

  function setManualMatch(attachmentId: string, assetId: string) {
    setAttachments((current) =>
      current.map((attachment) =>
        attachment.id === attachmentId
          ? { ...attachment, matchedAssetIds: assetId ? [assetId] : [] }
          : attachment,
      ),
    );
  }

  function removeAttachment(attachmentId: string) {
    setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
  }

  async function uploadAttachments() {
    if (!user || !matchedAttachments.length) return;
    setUploadingAttachments(true);
    setAttachmentMessage("");
    setAttachmentError("");
    try {
      const supabase = getSupabaseBrowser();
      let linkedFiles = 0;
      let linkedRecords = 0;
      for (const attachment of matchedAttachments) {
        const bucket = attachment.kind === "document" ? "ownership-documents" : "asset-photos";
        const storagePath = `${user.id}/bulk/${Date.now()}-${crypto.randomUUID()}-${safeFileName(attachment.file.name)}`;
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(storagePath, attachment.file, { upsert: false });
        if (uploadError) throw uploadError;

        if (attachment.kind === "document") {
          const records = attachment.matchedAssetIds.map((assetId) => ({
            asset_id: assetId,
            owner_id: user.id,
            storage_path: storagePath,
            original_name: attachment.file.name,
            document_type: documentType(attachment.file.name),
            notes: "Attached during bulk import",
          }));
          const { error: rowError } = await supabase.from("asset_documents").insert(records);
          if (rowError) throw rowError;
          linkedRecords += records.length;
        } else {
          const records = attachment.matchedAssetIds.map((assetId) => ({
            asset_id: assetId,
            owner_id: user.id,
            storage_path: storagePath,
            original_name: attachment.file.name,
            image_type: attachment.kind === "serial_photo" ? "serial_plate" : "additional",
          }));
          const { error: rowError } = await supabase.from("asset_photos").insert(records);
          if (rowError) throw rowError;
          linkedRecords += records.length;
        }
        linkedFiles += 1;
      }
      setAttachmentMessage(`${linkedFiles} files uploaded and linked across ${linkedRecords} asset records.`);
      setAttachments((current) => current.filter((attachment) => !attachment.matchedAssetIds.length));
    } catch (caught) {
      setAttachmentError(caught instanceof Error ? caught.message : "Could not upload the attachments.");
    } finally {
      setUploadingAttachments(false);
    }
  }

  if (loading) return <div className="pageWidth pagePad"><div className="skeletonCard" /></div>;
  if (!user) {
    return <div className="pageWidth pagePad narrowPage"><div className="emptyPanel"><UploadIcon /><h1>Sign in to import assets</h1><Link className="button primary" href="/login">Sign in</Link></div></div>;
  }

  return <div className="pageWidth pagePad importPage">
    <Link className="backLink" href="/dashboard">← Dashboard</Link>
    <div className="sectionTitleRow"><div><p className="eyebrow red">Bulk tools</p><h1>Import an asset list</h1><p className="muted">Create the assets from CSV, then match photos and ownership documents by serial number.</p></div><UploadIcon /></div>

    {!plan.bulkTools && <div className="upgradePanel"><FileIcon /><h2>Bulk import is available on Trade, Business and Fleet accounts</h2><p>Your current {plan.name} account still supports registering assets individually.</p><Link className="button primary" href="/account#plans">Change account type</Link></div>}

    {plan.bulkTools && <>
      <div className="importSteps threeSteps">
        <article><span>1</span><div><strong>Download the template</strong><p>Keep the required column names and add one asset per row.</p><button className="button secondary" type="button" onClick={downloadTemplate}><DownloadIcon /> Download CSV template</button></div></article>
        <article><span>2</span><div><strong>Import the completed CSV</strong><p>Review all rows before anything is saved.</p><label className="button primary fileButton"><UploadIcon /> Choose CSV<input type="file" accept=".csv,text/csv" onChange={(event) => void selectFile(event)} /></label>{filename && <small>{filename}</small>}</div></article>
        <article><span>3</span><div><strong>Add photos and invoices</strong><p>Name each file with the asset serial so ToolTrack can match it automatically.</p><code>EXAMPLE-001-tool.jpg</code><code>EXAMPLE-001-invoice.pdf</code></div></article>
      </div>

      {message && <div className="notice success">{message}</div>}
      {error && <div className="notice danger">{error}</div>}

      {rows.length > 0 && <section className="importPreview"><div className="dashboardSectionHeading"><div><p className="eyebrow red">Preview</p><h2>{validRows.length} ready, {rows.length - validRows.length} need attention</h2></div><button className="button primary" type="button" onClick={() => void runImport()} disabled={!validRows.length || importing}>{importing ? "Importing…" : `Import ${validRows.length} assets`}</button></div><div className="tableScroll"><table><thead><tr><th>Row</th><th>Make / model</th><th>Serial</th><th>Category</th><th>Location</th><th>Result</th></tr></thead><tbody>{rows.slice(0, 250).map((row) => <tr className={row.error ? "rowError" : ""} key={`${row.rowNumber}-${row.serial}`}><td>{row.rowNumber}</td><td><strong>{row.make} {row.model}</strong></td><td>{row.serial}</td><td>{row.category}</td><td>{row.storage_location || "—"}</td><td>{row.error || "Ready"}</td></tr>)}</tbody></table></div>{rows.length > 250 && <p className="muted">Showing the first 250 rows. All valid rows will be imported.</p>}</section>}

      {importedAssets.length > 0 && <section className="bulkAttachmentPanel">
        <div className="dashboardSectionHeading"><div><p className="eyebrow red">Photos and documents</p><h2>Attach files to the imported assets</h2><p className="muted">Upload multiple images or PDFs. ToolTrack checks each filename for a matching serial number.</p></div><label className="button primary fileButton"><UploadIcon /> Choose files<input type="file" multiple accept="image/*,.pdf,application/pdf" onChange={selectAttachments} /></label></div>

        <div className="filenameGuide"><strong>Filename examples</strong><span><code>TT-MAK-DHR242-0001-tool.jpg</code> → tool photo</span><span><code>TT-MAK-DHR242-0001-serial.jpg</code> → serial plate</span><span><code>TT-MAK-DHR242-0001-invoice.pdf</code> → ownership document</span><span>A filename containing two serials can link one invoice to both assets.</span></div>

        {attachmentMessage && <div className="notice success">{attachmentMessage}</div>}
        {attachmentError && <div className="notice danger">{attachmentError}</div>}

        {attachments.length > 0 && <>
          <div className="attachmentSummary"><strong>{matchedAttachments.length} matched</strong><span>{unmatchedAttachments.length} need manual selection</span></div>
          <div className="attachmentReviewList">
            {attachments.map((attachment) => {
              const matchedAssets = importedAssets.filter((asset) => attachment.matchedAssetIds.includes(asset.id));
              return <article key={attachment.id} className={attachment.matchedAssetIds.length ? "matched" : "unmatched"}>
                <div className="attachmentFileIcon"><FileIcon /></div>
                <div className="attachmentDetails"><strong>{attachment.file.name}</strong><span>{attachmentLabel(attachment.kind)} · {(attachment.file.size / 1024).toFixed(0)} KB</span>{matchedAssets.length > 0 ? <small>Matched to {matchedAssets.map((asset) => `${asset.make} ${asset.model} (${asset.serial_original})`).join(", ")}</small> : <small>No serial match found - choose an asset below.</small>}</div>
                {!attachment.matchedAssetIds.length && <select aria-label={`Choose asset for ${attachment.file.name}`} value="" onChange={(event) => setManualMatch(attachment.id, event.target.value)}><option value="">Choose asset</option>{importedAssets.map((asset) => <option value={asset.id} key={asset.id}>{asset.make} {asset.model} - {asset.serial_original}</option>)}</select>}
                <button className="textButton dangerText" type="button" onClick={() => removeAttachment(attachment.id)}>Remove</button>
              </article>;
            })}
          </div>
          <div className="attachmentActions"><button className="button primary" type="button" disabled={!matchedAttachments.length || uploadingAttachments} onClick={() => void uploadAttachments()}>{uploadingAttachments ? "Uploading…" : `Upload ${matchedAttachments.length} matched files`}</button>{unmatchedAttachments.length > 0 && <span className="muted">Unmatched files will stay here until assigned or removed.</span>}</div>
        </>}
      </section>}
    </>}
  </div>;
}
