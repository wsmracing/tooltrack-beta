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

  async function exportData() {
    if (!user) return;
    setError("");
    const supabase = getSupabaseBrowser();
    const [assets, documents, photos, theftReports, sightings] = await Promise.all([
      supabase.from("assets").select("*"),
      supabase.from("asset_documents").select("*"),
      supabase.from("asset_photos").select("*"),
      supabase.from("theft_reports").select("*"),
      supabase.from("sightings").select("*"),
    ]);
    const failed = [assets, documents, photos, theftReports, sightings].find((response) => response.error);
    if (failed?.error) {
      setError(failed.error.message);
      return;
    }
    const exportPayload = {
      exported_at: new Date().toISOString(),
      account: { email: user.email, profile },
      assets: assets.data,
      documents: documents.data,
      photos: photos.data,
      theft_reports: theftReports.data,
      sightings: sightings.data,
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tooltrack-data-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
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
        <div><ShieldIcon /><span><strong>Your ToolTrack data</strong><small>Download a JSON copy of your account and asset records.</small></span></div>
        <button className="button secondary" type="button" onClick={() => void exportData()}>Download my data</button>
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
