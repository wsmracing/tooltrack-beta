"use client";

import type { Asset, AssetAuditEntry, Profile } from "@/lib/types";
import { assetStatusLabel, verificationLabel } from "@/lib/asset-status";

type TheftReport = { theft_date?: string | null; location_area?: string | null; police_reference?: string | null; circumstances?: string | null; public_reference?: string | null; reported_at?: string | null; recovered_at?: string | null };
type Owner = { email?: string | null; profile?: Profile | null };

type Writer = (value: string, size?: number, bold?: boolean) => void;

async function documentBase(title: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 18;
  const line: Writer = (value, size = 10, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(String(value || "—"), 178);
    if (y + lines.length * 5.2 > 282) { doc.addPage(); y = 18; }
    doc.text(lines, 16, y); y += lines.length * 5.2 + 2;
  };
  doc.setTextColor(215, 25, 32); line(title, 20, true); doc.setTextColor(35, 35, 35);
  line(`Generated ${new Date().toLocaleString("en-IE")}`, 8);
  return { doc, line };
}

function ownerLines(line: Writer, owner: Owner) {
  line("Record holder", 12, true);
  line(`Name: ${owner.profile?.display_name || "Not supplied"}`);
  if (owner.profile?.business_name) line(`Business: ${owner.profile.business_name}`);
  line(`Email: ${owner.email || "Not supplied"}`);
  if (owner.profile?.phone) line(`Phone: ${owner.profile.phone}`);
}

function assetLines(line: Writer, asset: Asset) {
  line("Asset details", 12, true);
  line(`${asset.make} ${asset.model}`, 13, true);
  line(`Category: ${asset.category}`);
  line(`Serial number: ${asset.serial_original}`, 11, true);
  line(`Status: ${assetStatusLabel(asset.status)}`);
  line(`Record strength: ${verificationLabel(asset.verification_level)}`);
  line(`Registered: ${new Date(asset.registered_at).toLocaleString("en-IE")}`);
  if (asset.secondary_identifier) line(`Secondary identifier: ${asset.secondary_identifier}`);
  if (asset.colour) line(`Colour: ${asset.colour}`);
  if (asset.storage_location) line(`Recorded storage location: ${asset.storage_location}`);
  if (asset.estimated_value != null) line(`Estimated value: €${Number(asset.estimated_value).toFixed(2)}`);
  if (asset.supplier) line(`Supplier / seller: ${asset.supplier}`);
  if (asset.purchase_date) line(`Purchase date: ${new Date(asset.purchase_date).toLocaleDateString("en-IE")}`);
  if (asset.purchase_price != null) line(`Purchase price: €${Number(asset.purchase_price).toFixed(2)}`);
  if (asset.invoice_number) line(`Invoice / receipt reference: ${asset.invoice_number}`);
  if (asset.security_id) line(`Security marker / tag: ${asset.security_id}`);
  if (asset.notes) line(`Identifying notes: ${asset.notes}`);
}

export async function downloadInsuranceSchedule(assets: Asset[], owner: Owner) {
  const { doc, line } = await documentBase("ToolTrack Insurance Asset Schedule");
  ownerLines(line, owner);
  line(`Assets included: ${assets.length}`, 11, true);
  const total = assets.reduce((sum, asset) => sum + Number(asset.estimated_value || 0), 0);
  line(`Combined estimated value: €${total.toFixed(2)}`, 11, true);
  for (const asset of assets) {
    line("────────────────────────────────", 8);
    assetLines(line, asset);
  }
  line("Record note", 11, true);
  line("This schedule is generated from user-supplied ToolTrack records. It supports record keeping and insurance discussions but is not, by itself, proof of legal ownership, value or policy cover.", 8);
  doc.save(`tooltrack-insurance-schedule-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export async function downloadGardaEvidenceReport({ asset, owner, theftReport, audit, photoCount, documentCount, photoDataUrls = [] }: { asset: Asset; owner: Owner; theftReport?: TheftReport | null; audit: AssetAuditEntry[]; photoCount: number; documentCount: number; photoDataUrls?: string[]; }) {
  const { doc, line } = await documentBase("ToolTrack Theft Evidence Report");
  ownerLines(line, owner);
  assetLines(line, asset);
  line("Evidence held", 12, true);
  line(`Asset photographs recorded: ${photoCount}`);
  line(`Private purchase-evidence files recorded: ${documentCount}`);
  if (theftReport) {
    line("Theft report", 12, true);
    if (theftReport.public_reference) line(`ToolTrack reference: ${theftReport.public_reference}`, 11, true);
    if (theftReport.theft_date) line(`Date stolen: ${new Date(theftReport.theft_date).toLocaleDateString("en-IE")}`);
    if (theftReport.location_area) line(`General area: ${theftReport.location_area}`);
    if (theftReport.police_reference) line(`Garda / incident reference: ${theftReport.police_reference}`);
    if (theftReport.circumstances) line(`Circumstances: ${theftReport.circumstances}`);
    if (theftReport.reported_at) line(`Recorded by ToolTrack: ${new Date(theftReport.reported_at).toLocaleString("en-IE")}`);
    if (theftReport.recovered_at) line(`Marked recovered: ${new Date(theftReport.recovered_at).toLocaleString("en-IE")}`);
  }
  line("Record history", 12, true);
  if (audit.length) audit.slice(0, 20).forEach((entry) => line(`${new Date(entry.created_at).toLocaleString("en-IE")} — ${entry.action.replaceAll("_", " ")}`, 8));
  else line("No audit entries were available.", 8);
  line("Important", 11, true);
  line("This report is a user-controlled evidence summary. Gardaí and insurers should independently verify the identity of the reporter, the original evidence and the circumstances of the loss.", 8);
  for (const [index, dataUrl] of photoDataUrls.slice(0, 6).entries()) {
    try {
      const properties = doc.getImageProperties(dataUrl);
      const maximumWidth = 178;
      const maximumHeight = 245;
      const scale = Math.min(maximumWidth / properties.width, maximumHeight / properties.height);
      const width = properties.width * scale;
      const height = properties.height * scale;
      doc.addPage();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(`Evidence photograph ${index + 1}`, 16, 16);
      doc.addImage(dataUrl, properties.fileType, 16, 24, width, height);
    } catch {
      // Skip an image that the PDF engine cannot safely decode.
    }
  }
  doc.save(`tooltrack-theft-report-${asset.serial_normalized}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
