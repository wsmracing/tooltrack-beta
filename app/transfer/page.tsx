"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { TransferIcon } from "@/components/icons";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { friendlyError } from "@/lib/user-errors";

type TransferPreview = {
  make: string;
  model: string;
  category: string;
  serial_masked: string;
  expires_at: string;
  recipient_restricted: boolean;
};

function normaliseCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

function displayCode(value: string) {
  const clean = normaliseCode(value);
  return clean.length > 8 ? `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8)}` : clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

function TransferContent() {
  const params = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<TransferPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setCode(displayCode(params.get("code") ?? ""));
    void getSupabaseBrowser().auth.getUser().then(({ data }) => { setUser(data.user); setLoading(false); });
  }, [params]);

  async function check(event?: FormEvent) {
    event?.preventDefault();
    const clean = normaliseCode(code);
    if (!clean) return;
    setChecking(true);
    setError("");
    setMessage("");
    setPreview(null);
    const { data, error: rpcError } = await getSupabaseBrowser().rpc("get_asset_transfer_preview", { p_code: clean });
    if (rpcError) setError(friendlyError(rpcError, "That transfer code is invalid, expired or already used."));
    else setPreview(data as TransferPreview);
    setChecking(false);
  }

  async function accept() {
    if (!user || !preview) return;
    setAccepting(true);
    setError("");
    const { data, error: rpcError } = await getSupabaseBrowser().rpc("accept_asset_transfer", { p_code: normaliseCode(code) });
    if (rpcError) setError(friendlyError(rpcError, "The asset could not be transferred to this account."));
    else { setMessage(String(data || "Transfer accepted.")); setPreview(null); }
    setAccepting(false);
  }

  if (loading) return <div className="pageWidth pagePad"><div className="skeletonCard" /></div>;
  const next = `/transfer?code=${encodeURIComponent(displayCode(code))}`;

  return <div className="pageWidth pagePad narrowPage transferPage">
    <Link className="backLink" href="/assets">← My assets</Link>
    <div className="emptyPanel transferPanel">
      <TransferIcon />
      <p className="eyebrow red">Ownership transfer</p>
      <h1>Claim an asset</h1>
      <p>Enter the code supplied by the current owner. An email invitation is optional.</p>
      <form className="formStack transferForm" onSubmit={check}>
        <label>Transfer code<input value={code} onChange={(event) => setCode(displayCode(event.target.value))} placeholder="AB12-CD34-EF56" autoCapitalize="characters" required /></label>
        <button className="button primary" disabled={checking || !normaliseCode(code)}>{checking ? "Checking…" : "Check code"}</button>
      </form>

      {preview && <section className="transferPreview">
        <span>Asset ready to transfer</span>
        <h2>{preview.make} {preview.model}</h2>
        <dl><div><dt>Category</dt><dd>{preview.category}</dd></div><div><dt>Serial</dt><dd>{preview.serial_masked}</dd></div><div><dt>Expires</dt><dd>{new Date(preview.expires_at).toLocaleDateString("en-IE")}</dd></div></dl>
        {preview.recipient_restricted && <p className="muted">This code is restricted to the email address chosen by the current owner.</p>}
        {!user ? <Link className="button primary" href={`/login?next=${encodeURIComponent(next)}`}>Sign in to claim</Link> : <button className="button primary" disabled={accepting} onClick={() => void accept()}>{accepting ? "Transferring…" : "Confirm and claim asset"}</button>}
      </section>}

      {message && <div className="notice success">{message}<Link className="button secondary" href="/assets">View my assets</Link></div>}
      {error && <div className="notice danger">{error}</div>}
    </div>
  </div>;
}

export default function TransferPage() {
  return <Suspense fallback={<div className="pageWidth pagePad"><div className="skeletonCard" /></div>}><TransferContent /></Suspense>;
}
