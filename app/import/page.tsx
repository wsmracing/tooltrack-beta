"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { DownloadIcon, FileIcon, UploadIcon } from "@/components/icons";
import { downloadTextFile, parseCsv } from "@/lib/csv";
import { normaliseSerial } from "@/lib/normalise";
import { getPlan } from "@/lib/plans";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import type { Profile } from "@/lib/types";

const requiredHeaders = ["make", "model", "category", "serial"];
const templateHeaders = ["make", "model", "category", "serial", "storage_location", "estimated_value", "supplier", "purchase_date", "purchase_price", "invoice_number", "colour", "notes"];

type PreviewRow = Record<string, string> & { rowNumber: string; error?: string };

export default function ImportPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [filename, setFilename] = useState("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFilename(file.name); setMessage(""); setError("");
    const parsed = parseCsv(await file.text());
    if (parsed.length < 2) { setError("The CSV does not contain any asset rows."); setRows([]); return; }
    const headers = parsed[0].map((header) => header.trim().toLowerCase().replaceAll(" ", "_"));
    const missing = requiredHeaders.filter((header) => !headers.includes(header));
    if (missing.length) { setError(`Missing required columns: ${missing.join(", ")}`); setRows([]); return; }
    const next = parsed.slice(1).map((values, index) => {
      const row = Object.fromEntries(headers.map((header, position) => [header, values[position]?.trim() ?? ""])) as PreviewRow;
      row.rowNumber = String(index + 2);
      const serial = normaliseSerial(row.serial ?? "");
      if (!row.make || !row.model || !row.category || !serial) row.error = "Make, model, category and serial are required.";
      else row.serial = serial;
      return row;
    });
    const duplicates = new Set<string>();
    const seen = new Set<string>();
    next.forEach((row) => { if (seen.has(row.serial)) duplicates.add(row.serial); seen.add(row.serial); });
    next.forEach((row) => { if (duplicates.has(row.serial)) row.error = "Duplicate serial in this file."; });
    setRows(next);
  }

  function downloadTemplate() {
    const example = ["Makita", "DHR242", "Rotary hammer", "EXAMPLE-001", "Red van", "350", "Local supplier", "2026-06-01", "329.99", "INV-1001", "Blue", "Example row - delete before importing"];
    downloadTextFile("tooltrack-bulk-import-template.csv", `${templateHeaders.join(",")}\n${example.join(",")}`);
  }

  async function runImport() {
    if (!user || !validRows.length || !plan.bulkTools) return;
    if (!window.confirm(`Import ${validRows.length} assets into ToolTrack?`)) return;
    setImporting(true); setError(""); setMessage("");
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
      let imported = 0;
      for (let index = 0; index < payload.length; index += 100) {
        const batch = payload.slice(index, index + 100);
        const { error: insertError } = await supabase.from("assets").insert(batch);
        if (insertError) throw insertError;
        imported += batch.length;
      }
      setMessage(`${imported} assets imported successfully.`); setRows([]); setFilename("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not import the file."); }
    finally { setImporting(false); }
  }

  if (loading) return <div className="pageWidth pagePad"><div className="skeletonCard" /></div>;
  if (!user) return <div className="pageWidth pagePad narrowPage"><div className="emptyPanel"><UploadIcon /><h1>Sign in to import assets</h1><Link className="button primary" href="/login">Sign in</Link></div></div>;

  return <div className="pageWidth pagePad importPage">
    <Link className="backLink" href="/dashboard">← Dashboard</Link>
    <div className="sectionTitleRow"><div><p className="eyebrow red">Bulk tools</p><h1>Import an asset list</h1><p className="muted">Upload a CSV from Excel, Google Sheets or another asset system.</p></div><UploadIcon /></div>

    {!plan.bulkTools && <div className="upgradePanel"><FileIcon /><h2>Bulk import is available on Trade, Business and Fleet accounts</h2><p>Your current {plan.name} account still supports registering assets individually.</p><Link className="button primary" href="/account#plans">Change account type</Link></div>}

    {plan.bulkTools && <>
      <div className="importSteps"><article><span>1</span><div><strong>Download the template</strong><p>Keep the required column names and add one asset per row.</p><button className="button secondary" type="button" onClick={downloadTemplate}><DownloadIcon /> Download CSV template</button></div></article><article><span>2</span><div><strong>Choose your completed CSV</strong><p>Nothing is saved until you review and confirm below.</p><label className="button primary fileButton"><UploadIcon /> Choose CSV<input type="file" accept=".csv,text/csv" onChange={(event) => void selectFile(event)} /></label>{filename && <small>{filename}</small>}</div></article></div>

      {message && <div className="notice success">{message}</div>}{error && <div className="notice danger">{error}</div>}

      {rows.length > 0 && <section className="importPreview"><div className="dashboardSectionHeading"><div><p className="eyebrow red">Preview</p><h2>{validRows.length} ready, {rows.length - validRows.length} need attention</h2></div><button className="button primary" type="button" onClick={() => void runImport()} disabled={!validRows.length || importing}>{importing ? "Importing…" : `Import ${validRows.length} assets`}</button></div><div className="tableScroll"><table><thead><tr><th>Row</th><th>Make / model</th><th>Serial</th><th>Category</th><th>Location</th><th>Result</th></tr></thead><tbody>{rows.slice(0, 250).map((row) => <tr className={row.error ? "rowError" : ""} key={`${row.rowNumber}-${row.serial}`}><td>{row.rowNumber}</td><td><strong>{row.make} {row.model}</strong></td><td>{row.serial}</td><td>{row.category}</td><td>{row.storage_location || "—"}</td><td>{row.error || "Ready"}</td></tr>)}</tbody></table></div>{rows.length > 250 && <p className="muted">Showing the first 250 rows. All valid rows will be imported.</p>}</section>}
    </>}
  </div>;
}
