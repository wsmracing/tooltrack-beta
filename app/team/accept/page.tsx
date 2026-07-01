"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { UsersIcon } from "@/components/icons";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

function AcceptTeamInviteContent() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const loginHref = useMemo(() => `/login?next=${encodeURIComponent(`/team/accept?token=${token}`)}`, [token]);

  useEffect(() => {
    if (!token) { setError("Invitation token is missing."); setSignedIn(false); return; }
    void getSupabaseBrowser().auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
  }, [token]);

  async function acceptInvitation() {
    if (!token) return;
    setAccepting(true); setError(""); setMessage("");
    const { data, error: rpcError } = await getSupabaseBrowser().rpc("accept_team_invitation", { invitation_token: token });
    if (rpcError) setError(rpcError.message); else setMessage(data || "Invitation accepted.");
    setAccepting(false);
  }

  return <div className="pageWidth pagePad narrowPage"><div className="emptyPanel"><UsersIcon /><h1>Team invitation</h1>{signedIn === null ? <p>Checking your account…</p> : error && !signedIn ? <><div className="notice danger">{error}</div><Link className="button primary" href={loginHref}>Sign in or create account</Link></> : !signedIn ? <><p>Sign in using the email address that received this invitation. ToolTrack will return you here automatically.</p><Link className="button primary" href={loginHref}>Continue to sign in</Link></> : message ? <><div className="notice success">{message}</div><Link className="button primary" href="/dashboard">Open dashboard</Link></> : <><p>Accept this invitation to join the shared ToolTrack workspace.</p>{error && <div className="notice danger">{error}</div>}<button className="button primary" type="button" onClick={() => void acceptInvitation()} disabled={accepting}>{accepting ? "Accepting…" : "Accept invitation"}</button></>}</div></div>;
}

export default function AcceptTeamInvitePage() {
  return <Suspense fallback={<div className="pageWidth pagePad"><div className="skeletonCard" /></div>}><AcceptTeamInviteContent /></Suspense>;
}
