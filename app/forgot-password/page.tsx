"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { MailIcon } from "@/components/icons";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase-browser";
import { friendlyError } from "@/lib/user-errors";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setError(""); setMessage("");
    try {
      if (!isSupabaseConfigured()) throw new Error("Password reset is not configured.");
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error: resetError } = await getSupabaseBrowser().auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
      if (resetError) throw resetError;
      setMessage("Check your email for a password reset link. The link may take a minute to arrive.");
    } catch (caught) {
      setError(friendlyError(caught, "The reset email could not be sent. Please try again."));
    } finally { setLoading(false); }
  }

  return <div className="pageWidth pagePad authPage"><div className="authCard">
    <div className="authIcon"><MailIcon /></div><p className="eyebrow red">Account recovery</p>
    <h1>Reset your password</h1><p className="muted">Enter the email address used for your ToolTrack account.</p>
    <form className="formStack" onSubmit={submit}><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label><button className="button primary large" disabled={loading}>{loading ? "Sending…" : "Send reset link"}</button></form>
    {message && <div className="notice success">{message}</div>}{error && <div className="notice danger">{error}</div>}
    <div className="authSecondaryLinks"><Link href="/login">Back to sign in</Link><Link href="/help">Need help?</Link></div>
  </div></div>;
}
