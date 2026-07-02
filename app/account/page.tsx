"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { ShieldIcon, ShopIcon, UserIcon, UsersIcon } from "@/components/icons";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase-browser";
import type { Profile } from "@/lib/types";
import { getPlan, plans, type PlanTier } from "@/lib/plans";
import { friendlyError } from "@/lib/user-errors";

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>("starter");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [teamNotifications, setTeamNotifications] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured()) { setError("ToolTrack is not connected to its database."); setLoading(false); return; }
    const supabase = getSupabaseBrowser();
    void (async () => {
      const { data: auth } = await supabase.auth.getUser(); setUser(auth.user);
      if (!auth.user) { setLoading(false); return; }
      const [profileResponse, adminResponse] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle(),
        supabase.from("platform_admins").select("role").eq("user_id", auth.user.id).maybeSingle(),
      ]);
      if (profileResponse.data) {
        const value = profileResponse.data as Profile; setProfile(value); setDisplayName(value.display_name ?? ""); setBusinessName(value.business_name ?? ""); setPhone(value.phone ?? ""); setSelectedPlan(value.plan_tier ?? "starter"); setEmailNotifications(value.email_sighting_notifications !== false); setTeamNotifications(value.email_team_notifications !== false);
      }
      setIsAdmin(Boolean(adminResponse.data)); setLoading(false);
    })();
  }, []);

  async function ensureOrganization(tier: PlanTier, name: string) {
    if (!user) return null;
    const plan = getPlan(tier);
    if (!plan.teamTools) return null;
    const supabase = getSupabaseBrowser();
    if (profile?.active_organization_id) {
      const { error: updateError } = await supabase.from("organizations").update({ name, account_type: plan.accountType, plan_tier: plan.tier }).eq("id", profile.active_organization_id);
      if (updateError) throw updateError;
      return profile.active_organization_id;
    }
    const { data, error: organizationError } = await supabase.from("organizations").insert({ owner_id: user.id, name, account_type: plan.accountType, plan_tier: plan.tier }).select("id").single();
    if (organizationError) throw organizationError;
    const { error: memberError } = await supabase.from("organization_members").insert({ organization_id: data.id, user_id: user.id, role: "owner", status: "active" });
    if (memberError) throw memberError;
    return data.id as string;
  }

  async function save(event?: FormEvent) {
    event?.preventDefault(); if (!user) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const supabase = getSupabaseBrowser();
      const plan = getPlan(selectedPlan);
      const organization = await ensureOrganization(selectedPlan, businessName.trim() || `${displayName.trim() || "My"} ToolTrack`);
      const payload = { id: user.id, display_name: displayName.trim() || null, business_name: businessName.trim() || null, phone: phone.trim() || null, email_sighting_notifications: emailNotifications, email_team_notifications: teamNotifications, account_type: plan.accountType, plan_tier: plan.tier, active_organization_id: plan.teamTools ? organization : null };
      const { data, error: saveError } = await supabase.from("profiles").upsert(payload).select("*").single();
      if (saveError) throw saveError;
      setProfile(data as Profile); setMessage("Account settings saved.");
    } catch (caught) { setError(friendlyError(caught, "Your account settings could not be saved.")); }
    finally { setSaving(false); }
  }

  async function logout() {
    if (!window.confirm("Log out of ToolTrack?")) return;
    await getSupabaseBrowser().auth.signOut(); router.replace("/"); router.refresh();
  }

  async function remove() {
    if (!user || !window.confirm("Delete your ToolTrack account and linked data?")) return;
    if (window.prompt("Type DELETE to confirm.") !== "DELETE") return;
    setSaving(true); setError("");
    const { data: session } = await getSupabaseBrowser().auth.getSession();
    const token = session.session?.access_token;
    if (!token) { setError("Your session has expired. Sign in again."); setSaving(false); return; }
    const response = await fetch("/api/account/delete", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    const body = await response.json();
    if (!response.ok) { setError(body.error || "The account could not be deleted."); setSaving(false); return; }
    await getSupabaseBrowser().auth.signOut(); router.replace("/"); router.refresh();
  }

  if (loading) return <div className="pageWidth pagePad"><div className="skeletonCard" /></div>;
  if (!user) return <div className="pageWidth pagePad narrowPage"><div className="emptyPanel"><UserIcon /><h1>Sign in to manage your account</h1><Link className="button primary" href="/login">Sign in</Link></div></div>;
  const current = getPlan(selectedPlan);

  return <div className="pageWidth pagePad accountSimple">
    <Link className="backLink" href="/dashboard">← Dashboard</Link>
    <div className="sectionTitleRow"><div><h1>Account</h1><p className="muted">Profile, notifications and security.</p></div><UserIcon /></div>
    {message && <div className="notice success">{message}</div>}{error && <div className="notice danger">{error}</div>}

    <form className="accountSections" onSubmit={save}>
      <section className="settingsCard formStack"><div><h2>Profile</h2><p className="muted">Used on your dashboard and reports you choose to download.</p></div><div className="formGrid two"><label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" /></label><label>Phone (optional)<input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" /></label></div><label>Business or trading name (optional)<input value={businessName} onChange={(event) => setBusinessName(event.target.value)} autoComplete="organization" /></label><label>Email address<input value={user.email ?? ""} disabled /></label></section>

      <section className="settingsCard formStack"><div><h2>Account type</h2><p className="muted">Choose the workspace that matches how you manage equipment.</p></div><label>Account type<select value={selectedPlan} onChange={(event) => setSelectedPlan(event.target.value as PlanTier)}>{plans.map((plan) => <option key={plan.tier} value={plan.tier}>{plan.name} — up to {plan.assetLimit.toLocaleString()} assets</option>)}</select></label><div className="accountTypeSummary"><strong>{current.name}</strong><span>{current.description}</span></div></section>

      <section className="settingsCard formStack"><div><h2>Notifications</h2><p className="muted">Choose which important activity reaches your email.</p></div><div className="toggleStack"><label className="toggleRow"><input type="checkbox" checked={emailNotifications} onChange={(event) => setEmailNotifications(event.target.checked)} /><span><strong>Sighting reports</strong><small>The reporter never sees your address.</small></span></label><label className="toggleRow"><input type="checkbox" checked={teamNotifications} onChange={(event) => setTeamNotifications(event.target.checked)} /><span><strong>Team and transfer activity</strong><small>Invitations, access changes and completed transfers.</small></span></label></div></section>

      <div className="cleanFormActions accountSaveBar"><button className="button primary" disabled={saving}>{saving ? "Saving…" : "Save account"}</button></div>
    </form>

    <section className="settingsCard accountLinks"><h2>Related areas</h2><div className="cleanActionGrid">{current.teamTools && <Link href="/team"><UsersIcon /><span><strong>Team access</strong><small>Invitations and permissions</small></span></Link>}<Link href="/account/orders"><ShopIcon /><span><strong>My orders</strong><small>Order requests and status</small></span></Link>{isAdmin && <Link href="/shop/admin"><ShieldIcon /><span><strong>Shop administration</strong><small>Products and orders</small></span></Link>}</div></section>

    <section className="settingsCard securityCard"><div><ShieldIcon /><span><h2>Security</h2><p>Log out on this device. This option is also always visible in the main menu.</p></span></div><button className="button secondary logoutButton" onClick={() => void logout()}>Log out</button></section>

    <section className="dangerZone"><h2>Delete account</h2><p>Permanently removes your account and linked data, subject to any records ToolTrack must retain for disputes or legal obligations.</p><button className="button dangerButton" onClick={() => void remove()} disabled={saving}>Delete account</button></section>
  </div>;
}
