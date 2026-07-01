"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { BuildingIcon, MailIcon, UsersIcon } from "@/components/icons";
import { getPlan } from "@/lib/plans";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import type { Organization, OrganizationMember, Profile, TeamInvitation } from "@/lib/types";

export default function TeamPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invites, setInvites] = useState<TeamInvitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "editor" | "viewer">("editor");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [lastInviteLink, setLastInviteLink] = useState("");

  async function load() {
    const supabase = getSupabaseBrowser();
    const { data: auth } = await supabase.auth.getUser(); setUser(auth.user);
    if (!auth.user) { setLoading(false); return; }
    const { data: profileData } = await supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
    const loadedProfile = profileData as Profile | null; if (loadedProfile) setProfile(loadedProfile);
    const orgId = loadedProfile?.active_organization_id;
    if (orgId) {
      const [orgResponse, memberResponse, inviteResponse] = await Promise.all([
        supabase.from("organizations").select("*").eq("id", orgId).maybeSingle(),
        supabase.from("organization_members").select("*").eq("organization_id", orgId).order("created_at"),
        supabase.from("team_invitations").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
      ]);
      if (orgResponse.data) setOrganization(orgResponse.data as Organization);
      if (memberResponse.data) setMembers(memberResponse.data as OrganizationMember[]);
      if (inviteResponse.data) setInvites(inviteResponse.data as TeamInvitation[]);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function createOrganization() {
    if (!user || !profile) return;
    setSending(true); setError("");
    const supabase = getSupabaseBrowser(); const plan = getPlan(profile.plan_tier);
    const name = profile.business_name?.trim() || profile.display_name?.trim() || "My ToolTrack team";
    const { data, error: orgError } = await supabase.from("organizations").insert({ owner_id: user.id, name, account_type: plan.accountType, plan_tier: plan.tier }).select("*").single();
    if (orgError) { setError(orgError.message); setSending(false); return; }
    await supabase.from("organization_members").insert({ organization_id: data.id, user_id: user.id, role: "owner", status: "active" });
    await supabase.from("profiles").update({ active_organization_id: data.id }).eq("id", user.id);
    setMessage("Team workspace created."); setSending(false); await load();
  }

  async function invite(event: FormEvent) {
    event.preventDefault();
    if (!organization || !email.trim()) return;
    setSending(true); setError(""); setMessage(""); setLastInviteLink("");
    try {
      const { data: session } = await getSupabaseBrowser().auth.getSession();
      const token = session.session?.access_token; if (!token) throw new Error("Your session has expired.");
      const response = await fetch("/api/team/invite", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ organizationId: organization.id, email, role }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Could not send the invitation.");
      setMessage(body.message); setLastInviteLink(`${window.location.origin}/invite/team?token=${body.token}`); setEmail(""); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not send the invitation."); }
    finally { setSending(false); }
  }

  async function cancelInvite(id: string) {
    const { error: updateError } = await getSupabaseBrowser().from("team_invitations").update({ status: "cancelled" }).eq("id", id);
    if (updateError) setError(updateError.message); else await load();
  }

  if (loading) return <div className="pageWidth pagePad"><div className="skeletonCard" /></div>;
  if (!user) return <div className="pageWidth pagePad narrowPage"><div className="emptyPanel"><UsersIcon /><h1>Sign in to manage your team</h1><Link className="button primary" href="/login">Sign in</Link></div></div>;
  const plan = getPlan(profile?.plan_tier);

  return <div className="pageWidth pagePad teamPage">
    <Link className="backLink" href="/dashboard">← Dashboard</Link>
    <div className="sectionTitleRow"><div><p className="eyebrow red">Shared access</p><h1>Team and permissions</h1><p className="muted">Invite staff without sharing the main account password.</p></div><UsersIcon /></div>
    {message && <div className="notice success">{message}</div>}{error && <div className="notice danger">{error}</div>}
    {!plan.teamTools && <div className="upgradePanel"><UsersIcon /><h2>Team access is included with Business and Fleet accounts</h2><p>Trade accounts still include bulk edit and CSV import for one user.</p><Link className="button primary" href="/account#plans">Choose a team account</Link></div>}
    {plan.teamTools && !organization && <div className="upgradePanel"><BuildingIcon /><h2>Create your shared workspace</h2><p>This groups company assets, locations and staff permissions.</p><button className="button primary" onClick={() => void createOrganization()} disabled={sending}>{sending ? "Creating…" : "Create team workspace"}</button></div>}
    {plan.teamTools && organization && <>
      <div className="organizationBanner"><BuildingIcon /><div><span>Workspace</span><strong>{organization.name}</strong></div><div><span>Seats</span><strong>{members.length} / {plan.memberLimit}</strong></div></div>
      <div className="splitLayout">
        <form className="settingsCard formStack stickyPanel" onSubmit={invite}><h2>Invite a team member</h2><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.ie" required /></label><label>Permission<select value={role} onChange={(event) => setRole(event.target.value as typeof role)}><option value="admin">Admin — manage team and assets</option><option value="editor">Editor — add and edit assets</option><option value="viewer">Viewer — read-only access</option></select></label><button className="button primary" disabled={sending || !email.trim() || members.length >= plan.memberLimit}><MailIcon /> {sending ? "Sending…" : "Send invitation"}</button>{lastInviteLink && <div className="inviteLinkBox"><strong>Prototype fallback link</strong><input readOnly value={lastInviteLink} onFocus={(event) => event.currentTarget.select()} /><small>Use this when test email delivery is rerouted.</small></div>}</form>
        <section><div className="dashboardSectionHeading"><div><p className="eyebrow red">Members</p><h2>Active access</h2></div></div><div className="memberList">{members.map((member) => <article key={member.id}><div className="memberAvatar"><UsersIcon /></div><div><strong>{member.user_id === user.id ? (profile?.display_name || "You") : "Team member"}</strong><span>{member.role}</span></div><span className="status safe">{member.status}</span></article>)}</div>
          <div className="dashboardSectionHeading inviteHeading"><div><p className="eyebrow red">Invitations</p><h2>Pending and recent</h2></div></div>{invites.length === 0 ? <p className="muted">No invitations yet.</p> : <div className="inviteList">{invites.map((item) => <article key={item.id}><div><strong>{item.email}</strong><span>{item.role} · expires {new Date(item.expires_at).toLocaleDateString("en-IE")}</span></div><span className={`status ${item.status === "pending" ? "transfer" : "safe"}`}>{item.status}</span>{item.status === "pending" && <button type="button" onClick={() => void cancelInvite(item.id)}>Cancel</button>}</article>)}</div>}</section>
      </div>
    </>}
  </div>;
}
