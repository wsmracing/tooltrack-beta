"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { TransferIcon } from "@/components/icons";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

function TransferContent() {
  const params = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setCode(params.get("code")?.toUpperCase() ?? "");
    void getSupabaseBrowser().auth.getUser().then(({ data }) => { setUser(data.user); setLoading(false); });
  }, [params]);
  async function accept(event: FormEvent) {
    event.preventDefault(); if (!user || !code.trim()) return;
    setAccepting(true); setError(""); setMessage("");
    const { data, error: rpcError } = await getSupabaseBrowser().rpc("accept_asset_transfer", { p_code: code.trim().toUpperCase() });
    if (rpcError) setError(rpcError.message); else setMessage(data || "Transfer accepted.");
    setAccepting(false);
  }
  if (loading) return <div className="pageWidth pagePad"><div className="skeletonCard" /></div>;
  return <div className="pageWidth pagePad narrowPage transferPage"><Link className="backLink" href="/dashboard">← Dashboard</Link><div className="emptyPanel transferPanel"><TransferIcon /><h1>Accept an asset transfer</h1><p>Enter the code supplied by the current owner. You must sign in using the invited email address when one was specified.</p>{!user ? <Link className="button primary" href={`/login?next=${encodeURIComponent(`/transfer?code=${code}`)}`}>Sign in to continue</Link> : <form className="formStack transferForm" onSubmit={accept}><label>Transfer code<input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="AB12-CD34" autoCapitalize="characters" required /></label>{message && <div className="notice success">{message}</div>}{error && <div className="notice danger">{error}</div>}<button className="button primary" disabled={accepting || !code.trim()}>{accepting ? "Accepting…" : "Accept transfer"}</button>{message && <Link className="button secondary" href="/dashboard">View my assets</Link>}</form>}</div></div>;
}

export default function TransferPage() {
  return <Suspense fallback={<div className="pageWidth pagePad"><div className="skeletonCard" /></div>}><TransferContent /></Suspense>;
}
