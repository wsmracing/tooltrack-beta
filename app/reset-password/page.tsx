"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ShieldIcon } from "@/components/icons";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase-browser";
import { friendlyError } from "@/lib/user-errors";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured()) { setError("Password reset is not configured."); return; }
    const supabase = getSupabaseBrowser();
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else setError("This reset link is invalid or has expired. Request a new one.");
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) { setReady(true); setError(""); }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    if (password.length < 8) { setError("Use at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("The passwords do not match."); return; }
    setLoading(true);
    try {
      const { error: updateError } = await getSupabaseBrowser().auth.updateUser({ password });
      if (updateError) throw updateError;
      setMessage("Your password has been changed. You can now sign in with the new password.");
      setPassword(""); setConfirmPassword("");
    } catch (caught) {
      setError(friendlyError(caught, "The password could not be changed. Request a new reset link and try again."));
    } finally { setLoading(false); }
  }

  return <div className="pageWidth pagePad authPage"><div className="authCard">
    <div className="authIcon"><ShieldIcon /></div><p className="eyebrow red">Account recovery</p><h1>Choose a new password</h1><p className="muted">Use at least 8 characters and avoid reusing an old password.</p>
    {ready && !message && <form className="formStack" onSubmit={submit}><label>New password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoComplete="new-password" required /></label><label>Confirm new password<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} autoComplete="new-password" required /></label><button className="button primary large" disabled={loading}>{loading ? "Saving…" : "Save new password"}</button></form>}
    {message && <div className="notice success">{message}</div>}{error && <div className="notice danger">{error}</div>}
    <div className="authSecondaryLinks"><Link href="/login">Go to sign in</Link><Link href="/forgot-password">Request another link</Link></div>
  </div></div>;
}
