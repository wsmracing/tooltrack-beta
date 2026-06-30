"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { UsersIcon } from "@/components/icons";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

function AcceptTeamInviteContent() {
  const params = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    void (async () => {
      const token = params.get("token");
      if (!token) { setError("Invitation token is missing."); setLoading(false); return; }
      const supabase = getSupabaseBrowser();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { setError("Sign in or create an account using the invited email address, then open this link again."); setLoading(false); return; }
      const { data, error: rpcError } = await supabase.rpc("accept_team_invitation", { invitation_token: token });
      if (rpcError) setError(rpcError.message); else setMessage(data || "Invitation accepted.");
      setLoading(false);
    })();
  }, [params]);
  return <div className="pageWidth pagePad narrowPage"><div className="emptyPanel"><UsersIcon /><h1>Team invitation</h1>{loading ? <p>Checking invitation…</p> : error ? <><div className="notice danger">{error}</div><Link className="button primary" href="/login">Sign in</Link></> : <><div className="notice success">{message}</div><Link className="button primary" href="/dashboard">Open dashboard</Link></>}</div></div>;
}

export default function AcceptTeamInvitePage() {
  return <Suspense fallback={<div className="pageWidth pagePad"><div className="skeletonCard" /></div>}><AcceptTeamInviteContent /></Suspense>;
}
