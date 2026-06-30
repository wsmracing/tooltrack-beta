"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { BuildingIcon, CheckIcon, DownloadIcon, MailIcon, MapPinIcon, ShieldIcon, UploadIcon, UserIcon, UsersIcon } from "@/components/icons";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase-browser";
import type { Asset, Profile } from "@/lib/types";
import { getPlan, plans, type PlanTier } from "@/lib/plans";

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>("starter");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [teamNotifications, setTeamNotifications] = useState(true);
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
      const [profileResponse, assetResponse] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle(),
        supabase.from("assets").select("*").order("registered_at", { ascending: true }),
      ]);
      if (profileResponse.data) {
        const loaded = profileResponse.data as Profile;
        setProfile(loaded);
        setDisplayName(loaded.display_name ?? "");
        setBusinessName(loaded.business_name ?? "");
        setPhone(loaded.phone ?? "");
        setSelectedPlan(loaded.plan_tier ?? "starter");
        setEmailNotifications(loaded.email_sighting_notifications !== false);
        setTeamNotifications(loaded.email_team_notifications !== false);
      }
      if (assetResponse.data) setAssets(assetResponse.data as Asset[]);
      setLoading(false);
    })();
  }, []);

  async function ensureOrganization(planTier: PlanTier, name: string) {
    if (!user) return null;
    const plan = getPlan(planTier);
    if (!plan.teamTools) return null;
    const supabase = getSupabaseBrowser();
    if (profile?.active_organization_id) {
      await supabase.from("organizations").update({ name, account_type: plan.accountType, plan_tier: plan.tier }).eq("id", profile.active_organization_id);
      return profile.active_organization_id;
    }
    const { data, error: organizationError } = await supabase.from("organizations").insert({ owner_id: user.id, name, account_type: plan.accountType, plan_tier: plan.tier }).select("id").single();
    if (organizationError) throw organizationError;
    await supabase.from("organization_members").insert({ organization_id: data.id, user_id: user.id, role: "owner", status: "active" });
    return data.id as string;
  }

  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const supabase = getSupabaseBrowser();
      const plan = getPlan(selectedPlan);
      const organizationId = await ensureOrganization(selectedPlan, businessName.trim() || `${displayName.trim() || "My"} ToolTrack`);
      const payload = {
        id: user.id,
        display_name: displayName.trim() || null,
        business_name: businessName.trim() || null,
        phone: phone.trim() || null,
        email_sighting_notifications: emailNotifications,
        email_team_notifications: teamNotifications,
        account_type: plan.accountType,
        plan_tier: plan.tier,
        active_organization_id: plan.teamTools ? organizationId : null,
      };
      const { data, error: saveError } = await supabase.from("profiles").upsert(payload).select("*").single();
      if (saveError) throw saveError;
      setProfile(data as Profile);
      setMessage("Account and plan settings saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the account.");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    if (!window.confirm("Log out of ToolTrack?")) return;
    await getSupabaseBrowser().auth.signOut();
    router.replace("/");
    router.refresh();
  }

  async function sendTestEmail() {
    if (!user) return;
    setSendingTest(true); setMessage(""); setError("");
    try {
      const { data: session } = await getSupabaseBrowser().auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Your session has expired. Please sign in again.");
      const response = await fetch("/api/email/test", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not send the test email.");
      setMessage(body.message || "Test email sent.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send the test email.");
    } finally { setSendingTest(false); }
  }

  async function exportPdf() {
    if (!user) return;
    setExportingPdf(true); setMessage(""); setError("");
    try {
      const supabase = getSupabaseBrowser();
      const [assetResponse, theftReports, sightings] = await Promise.all([
        supabase.from("assets").select("*").order("registered_at", { ascending: true }),
        supabase.from("theft_reports").select("*").order("reported_at", { ascending: true }),
        supabase.from("sightings").select("*").order("created_at", { ascending: true }),
      ]);
      const failed = [assetResponse, theftReports, sightings].find((response) => response.error);
      if (failed?.error) throw failed.error;
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const left = 16; const right = 194; const lineHeight = 5.2; let y = 18;
      const ensureSpace = (height = 12) => { if (y + height > 282) { doc.addPage(); y = 18; } };
      const textLine = (value: string, size = 10, bold = false) => {
        doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size);
        const lines = doc.splitTextToSize(value, right - left); ensureSpace(lines.length * lineHeight + 2); doc.text(lines, left, y); y += lines.length * lineHeight + 2;
      };
      doc.setTextColor(215, 25, 32); textLine("ToolTrack Asset Register", 20, true); doc.setTextColor(40, 40, 40);
      textLine(`Generated: ${new Date().toLocaleString("en-IE")}`, 9); textLine(`Account: ${displayName.trim() || user.email || "ToolTrack user"}`, 11, true);
      if (businessName.trim()) textLine(`Business: ${businessName.trim()}`, 10); if (user.email) textLine(`Email: ${user.email}`, 10); y += 4;
      const rows = assetResponse.data ?? []; textLine(`Registered assets (${rows.length})`, 15, true);
      for (const asset of rows) {
        ensureSpace(38); doc.setDrawColor(220, 220, 220); doc.line(left, y, right, y); y += 6;
        textLine(`${asset.make} ${asset.model}`, 12, true); textLine(`Category: ${asset.category} | Status: ${String(asset.status).toUpperCase()}`, 9);
        textLine(`Serial: ${asset.serial_original}`, 10, true); if (asset.storage_location) textLine(`Storage: ${asset.storage_location}`, 9);
        if (asset.estimated_value != null) textLine(`Estimated value: €${Number(asset.estimated_value).toFixed(2)}`, 9);
        textLine(`Registered: ${new Date(asset.registered_at).toLocaleDateString("en-IE")}`, 9);
        const reports = (theftReports.data ?? []).filter((report) => report.asset_id === asset.id);
        reports.forEach((report) => textLine(`Theft report ${report.public_reference}: ${report.location_area} — ${report.recovered_at ? "recovered" : "open"}`, 9));
        const reportsSightings = (sightings.data ?? []).filter((sighting) => sighting.asset_id === asset.id);
        if (reportsSightings.length) textLine(`Sightings: ${reportsSightings.length}`, 9, true);
      }
      y += 5; ensureSpace(20); doc.setDrawColor(215, 25, 32); doc.line(left, y, right, y); y += 7;
      textLine("This summary supports record keeping and insurance discussions, but is not by itself proof of legal ownership.", 8);
      doc.save(`tooltrack-asset-register-${new Date().toISOString().slice(0, 10)}.pdf`);
      setMessage("PDF asset register downloaded.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not create the PDF."); }
    finally { setExportingPdf(false); }
  }

  async function deleteAccount() {
    if (!user || !window.confirm("Delete your ToolTrack account and all beta data? This cannot be undone.")) return;
    if (window.prompt("Type DELETE to confirm.") !== "DELETE") return;
    setSaving(true); setError("");
    const { data: session } = await getSupabaseBrowser().auth.getSession();
    const token = session.session?.access_token;
    if (!token) { setError("Your session has expired."); setSaving(false); return; }
    const response = await fetch("/api/account/delete", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    const body = await response.json();
    if (!response.ok) { setError(body.error || "Could not delete the account."); setSaving(false); return; }
    await getSupabaseBrowser().auth.signOut(); router.replace("/"); router.refresh();
  }

  if (loading) return <div className="pageWidth pagePad narrowPage"><div className="skeletonCard" /></div>;
  if (!user) return <div className="pageWidth pagePad narrowPage"><div className="emptyPanel"><UserIcon /><h1>Sign in to manage your account</h1><Link className="button primary" href="/login">Sign in</Link></div></div>;

  const currentPlan = getPlan(selectedPlan);

  return (
    <div className="pageWidth pagePad accountV4">
      <Link className="backLink" href="/dashboard">← Dashboard</Link>
      <div className="sectionTitleRow"><div><p className="eyebrow red">Account and access</p><h1>Your ToolTrack account</h1><p className="muted">Manage your profile, account type, notifications and exports.</p></div><UserIcon /></div>

      {message && <div className="notice success">{message}</div>}
      {error && <div className="notice danger">{error}</div>}

      <form className="settingsCard formStack" onSubmit={save}>
        <h2>Profile</h2>
        <div className="formGrid two"><label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Daniel" autoComplete="name" /></label><label>Phone (optional)<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="08x xxx xxxx" inputMode="tel" autoComplete="tel" /></label></div>
        <label>Business or trading name (optional)<input value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Company or trading name" autoComplete="organization" /></label>
        <label>Email address<input value={user.email ?? ""} disabled /></label>
        <div className="toggleStack"><label className="toggleRow"><input type="checkbox" checked={emailNotifications} onChange={(event) => setEmailNotifications(event.target.checked)} /><span><strong>Email me when a sighting is reported</strong><small>The reporter never sees your email.</small></span></label><label className="toggleRow"><input type="checkbox" checked={teamNotifications} onChange={(event) => setTeamNotifications(event.target.checked)} /><span><strong>Email me about team and transfer activity</strong><small>Invitations, accepted transfers and access changes.</small></span></label></div>
        <button className="button primary" disabled={saving}>{saving ? "Saving…" : "Save account settings"}</button>
      </form>

      <section className="planSection" id="plans">
        <div className="dashboardSectionHeading"><div><p className="eyebrow red">Account types</p><h2>Choose how you use ToolTrack</h2><p className="muted">Plans are unlocked for prototype testing. No payment is taken.</p></div></div>
        <div className="planGrid">{plans.map((plan) => <button type="button" className={`planCard ${selectedPlan === plan.tier ? "selected" : ""}`} key={plan.tier} onClick={() => setSelectedPlan(plan.tier)}>
          <div className="planCardTop"><span>{plan.audience}</span>{selectedPlan === plan.tier && <CheckIcon />}</div><h3>{plan.name}</h3><p>{plan.description}</p><strong>{plan.assetLimit.toLocaleString()} assets</strong><ul>{plan.features.map((feature) => <li key={feature}><CheckIcon /> {feature}</li>)}</ul>
        </button>)}</div>
        <div className="selectedPlanBar"><div><strong>{currentPlan.name}</strong><span>{assets.length} of {currentPlan.assetLimit.toLocaleString()} assets used</span></div><button className="button primary" type="button" onClick={() => void save()} disabled={saving}>Save selected account type</button></div>
      </section>

      <section className="accountToolsGrid">
        <Link className="settingsCard toolLinkCard" href="/locations"><MapPinIcon /><span><strong>Locations</strong><small>Vans, sheds, workshops and sites</small></span></Link>
        <Link className="settingsCard toolLinkCard" href="/team"><UsersIcon /><span><strong>Team access</strong><small>Invite and manage users</small></span></Link>
        <Link className="settingsCard toolLinkCard" href="/import"><UploadIcon /><span><strong>Bulk import</strong><small>Upload a CSV tool list</small></span></Link>
        <Link className="settingsCard toolLinkCard" href="/transfer"><BuildingIcon /><span><strong>Accept transfer</strong><small>Claim an asset using a code</small></span></Link>
      </section>

      <section className="settingsCard accountActionsCard"><div><DownloadIcon /><span><strong>PDF asset register</strong><small>Readable summary for records or insurance.</small></span></div><button className="button secondary" type="button" onClick={() => void exportPdf()} disabled={exportingPdf}>{exportingPdf ? "Creating PDF…" : "Download PDF summary"}</button></section>
      <section className="settingsCard accountActionsCard"><div><MailIcon /><span><strong>Email notifications</strong><small>Confirm sighting email delivery is connected.</small></span></div><button className="button secondary" type="button" onClick={() => void sendTestEmail()} disabled={sendingTest}>{sendingTest ? "Sending…" : "Send test email"}</button></section>
      <section className="settingsCard accountActionsCard"><div><ShieldIcon /><span><strong>Session</strong><small>Sign out on this device.</small></span></div><button className="button secondary" type="button" onClick={() => void logout()}>Log out</button></section>

      <section className="dangerZone"><h2>Delete beta account</h2><p>This permanently removes the account and linked beta data.</p><button className="button dangerButton" type="button" onClick={() => void deleteAccount()} disabled={saving}>Delete account</button></section>
    </div>
  );
}
