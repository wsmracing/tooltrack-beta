"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { ShieldIcon, UserIcon } from "@/components/icons";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase-browser";
import type { Profile } from "@/lib/types";

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }
    const supabase = getSupabaseBrowser();
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      setUser(auth.user);
      if (!auth.user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
      if (data) {
        const loaded = data as Profile;
        setProfile(loaded);
        setDisplayName(loaded.display_name ?? "");
        setBusinessName(loaded.business_name ?? "");
        setEmailNotifications(loaded.email_sighting_notifications !== false);
      }
      setLoading(false);
    })();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage("");
    setError("");
    const supabase = getSupabaseBrowser();
    const payload = {
      id: user.id,
      display_name: displayName.trim() || null,
      business_name: businessName.trim() || null,
      email_sighting_notifications: emailNotifications,
      account_type: profile?.account_type ?? "individual",
    };
    const { data, error: saveError } = await supabase.from("profiles").upsert(payload).select("*").single();
    if (saveError) setError(saveError.message);
    else {
      setProfile(data as Profile);
      setMessage("Account settings saved.");
    }
    setSaving(false);
  }

  async function logout() {
    if (!window.confirm("Log out of ToolTrack?")) return;
    await getSupabaseBrowser().auth.signOut();
    router.replace("/");
    router.refresh();
  }

  async function sendTestEmail() {
    if (!user) return;
    setSendingTest(true);
    setMessage("");
    setError("");
    try {
      const { data: session } = await getSupabaseBrowser().auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Your session has expired. Please sign in again.");
      const response = await fetch("/api/email/test", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not send the test email.");
      setMessage(body.message || "Test email sent.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send the test email.");
    } finally {
      setSendingTest(false);
    }
  }

  async function exportPdf() {
    if (!user) return;
    setExportingPdf(true);
    setMessage("");
    setError("");
    try {
      const supabase = getSupabaseBrowser();
      const [assets, theftReports, sightings] = await Promise.all([
        supabase.from("assets").select("*").order("registered_at", { ascending: true }),
        supabase.from("theft_reports").select("*").order("reported_at", { ascending: true }),
        supabase.from("sightings").select("*").order("created_at", { ascending: true }),
      ]);
      const failed = [assets, theftReports, sightings].find((response) => response.error);
      if (failed?.error) throw failed.error;

      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const left = 16;
      const right = 194;
      const lineHeight = 5.2;
      let y = 18;

      function ensureSpace(height = 12) {
        if (y + height <= 282) return;
        doc.addPage();
        y = 18;
      }

      function textLine(value: string, size = 10, bold = false) {
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setFontSize(size);
        const lines = doc.splitTextToSize(value, right - left);
        ensureSpace(lines.length * lineHeight + 2);
        doc.text(lines, left, y);
        y += lines.length * lineHeight + 2;
      }

      doc.setTextColor(215, 25, 32);
      textLine("ToolTrack Asset Summary", 20, true);
      doc.setTextColor(40, 40, 40);
      textLine(`Generated: ${new Date().toLocaleString("en-IE")}`, 9);
      textLine(`Account: ${displayName.trim() || user.email || "ToolTrack user"}`, 11, true);
      if (businessName.trim()) textLine(`Business: ${businessName.trim()}`, 10);
      if (user.email) textLine(`Email: ${user.email}`, 10);
      y += 4;

      const assetRows = assets.data ?? [];
      textLine(`Registered assets (${assetRows.length})`, 15, true);
      if (!assetRows.length) textLine("No assets are currently registered.", 10);

      for (const asset of assetRows) {
        ensureSpace(36);
        doc.setDrawColor(220, 220, 220);
        doc.line(left, y, right, y);
        y += 6;
        textLine(`${asset.make} ${asset.model}`, 12, true);
        textLine(`Category: ${asset.category}   |   Status: ${String(asset.status).toUpperCase()}`, 9);
        textLine(`Serial: ${asset.serial_original}`, 10, true);
        if (asset.product_barcode) textLine(`Product barcode: ${asset.product_barcode}`, 9);
        if (asset.storage_location) textLine(`Storage location: ${asset.storage_location}`, 9);
        if (asset.supplier || asset.purchase_date || asset.purchase_price) {
          const purchase = [
            asset.supplier ? `Supplier: ${asset.supplier}` : "",
            asset.purchase_date ? `Date: ${new Date(asset.purchase_date).toLocaleDateString("en-IE")}` : "",
            asset.purchase_price != null ? `Price: €${Number(asset.purchase_price).toFixed(2)}` : "",
          ].filter(Boolean).join("   |   ");
          textLine(purchase, 9);
        }
        textLine(`Registered: ${new Date(asset.registered_at).toLocaleDateString("en-IE")}`, 9);

        const assetThefts = (theftReports.data ?? []).filter((report) => report.asset_id === asset.id);
        for (const report of assetThefts) {
          textLine(`Theft report ${report.public_reference}: ${report.location_area} on ${new Date(report.theft_date).toLocaleDateString("en-IE")}${report.recovered_at ? " — recovered" : ""}`, 9);
        }
        const assetSightings = (sightings.data ?? []).filter((sighting) => sighting.asset_id === asset.id);
        if (assetSightings.length) textLine(`Sightings recorded: ${assetSightings.length}`, 9, true);
      }

      y += 6;
      ensureSpace(26);
      doc.setDrawColor(215, 25, 32);
      doc.line(left, y, right, y);
      y += 7;
      textLine("This summary is generated from the user's ToolTrack account. It supports record keeping but is not, by itself, proof of legal ownership.", 8);
      doc.save(`tooltrack-asset-summary-${new Date().toISOString().slice(0, 10)}.pdf`);
      setMessage("PDF summary downloaded.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the PDF summary.");
    } finally {
      setExportingPdf(false);
    }
  }

  async function deleteAccount() {
    if (!user) return;
    const confirmed = window.confirm("Delete your ToolTrack account and all test assets? This cannot be undone.");
    if (!confirmed) return;
    const repeated = window.prompt("Type DELETE to confirm account deletion.");
    if (repeated !== "DELETE") return;
    setSaving(true);
    setError("");
    const supabase = getSupabaseBrowser();
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) {
      setError("Your session has expired. Please sign in again.");
      setSaving(false);
      return;
    }
    const response = await fetch("/api/account/delete", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || "Could not delete the account.");
      setSaving(false);
      return;
    }
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  if (loading) return <div className="pageWidth pagePad narrowPage"><div className="skeletonCard" /></div>;
  if (!user) return <div className="pageWidth pagePad narrowPage"><div className="emptyPanel"><UserIcon /><h1>Sign in to manage your account</h1><Link className="button primary" href="/login">Sign in</Link></div></div>;

  return (
    <div className="pageWidth pagePad narrowPage accountPage">
      <Link className="backLink" href="/dashboard">← Dashboard</Link>
      <div className="sectionTitleRow"><div><p className="eyebrow red">Account settings</p><h1>Your profile</h1><p className="muted">Choose the name shown on your dashboard and manage notifications.</p></div><UserIcon /></div>

      <form className="settingsCard formStack" onSubmit={save}>
        <label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Daniel" autoComplete="name" /></label>
        <label>Business name (optional)<input value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Company or trading name" autoComplete="organization" /></label>
        <label>Email address<input value={user.email ?? ""} disabled /></label>
        <label className="toggleRow"><input type="checkbox" checked={emailNotifications} onChange={(event) => setEmailNotifications(event.target.checked)} /><span><strong>Email me when a sighting is reported</strong><small>The reporter never sees your email address.</small></span></label>
        {message && <div className="notice success">{message}</div>}
        {error && <div className="notice danger">{error}</div>}
        <button className="button primary" disabled={saving}>{saving ? "Saving…" : "Save settings"}</button>
      </form>

      <section className="settingsCard accountActionsCard">
        <div><ShieldIcon /><span><strong>Asset summary</strong><small>Download a readable PDF of your registered assets and theft history.</small></span></div>
        <button className="button secondary" type="button" onClick={() => void exportPdf()} disabled={exportingPdf}>{exportingPdf ? "Creating PDF…" : "Download PDF summary"}</button>
      </section>

      <section className="settingsCard accountActionsCard">
        <div><ShieldIcon /><span><strong>Email notifications</strong><small>Send a test to confirm that sighting alerts are connected.</small></span></div>
        <button className="button secondary" type="button" onClick={() => void sendTestEmail()} disabled={sendingTest}>{sendingTest ? "Sending…" : "Send test email"}</button>
      </section>

      <section className="settingsCard accountActionsCard">
        <div><UserIcon /><span><strong>Session</strong><small>Sign out on this device.</small></span></div>
        <button className="button secondary" type="button" onClick={() => void logout()}>Log out</button>
      </section>

      <section className="dangerZone">
        <h2>Delete test account</h2>
        <p>This permanently removes the account and its linked beta data. Use only with test information.</p>
        <button className="button dangerButton" type="button" onClick={() => void deleteAccount()} disabled={saving}>Delete account</button>
      </section>
    </div>
  );
}
