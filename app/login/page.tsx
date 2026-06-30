"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase-browser";
import { ShieldIcon } from "@/components/icons";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowser();
    supabase.auth.getUser().then(({ data }) => setSignedInEmail(data.user?.email ?? null));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError(""); setMessage("");
    try {
      const supabase = getSupabaseBrowser();
      if (mode === "login") {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        setSignedInEmail(data.user.email ?? email);
        router.push("/dashboard"); router.refresh();
      } else {
        const { data, error: authError } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/dashboard` } });
        if (authError) throw authError;
        if (data.session) { router.push("/dashboard"); }
        else setMessage("Account created. Check your email for the confirmation link, then sign in.");
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Authentication failed."); }
    finally { setLoading(false); }
  }

  async function signOut() {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut(); setSignedInEmail(null); setMessage("You are signed out.");
  }

  if (!isSupabaseConfigured()) return <div className="pageWidth pagePad narrowPage"><div className="notice danger">Supabase environment variables are missing.</div></div>;

  return (
    <div className="pageWidth pagePad authPage">
      <div className="authCard">
        <div className="authIcon"><ShieldIcon /></div>
        {signedInEmail ? <><h1>You’re signed in</h1><p className="muted">{signedInEmail}</p><div className="stack"><button className="button primary" onClick={() => router.push("/dashboard")}>Open my tools</button><button className="button secondary" onClick={signOut}>Sign out</button></div></> : <>
          <p className="eyebrow red">ToolTrack beta</p><h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1><p className="muted">Use a test email account for the prototype.</p>
          <div className="segmented"><button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Sign in</button><button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>Register</button></div>
          <form className="formStack" onSubmit={submit}><label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label><label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoComplete={mode === "login" ? "current-password" : "new-password"} /></label><button className="button primary large" disabled={loading}>{loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button></form>
        </>}
        {message && <div className="notice success">{message}</div>}{error && <div className="notice danger">{error}</div>}
      </div>
    </div>
  );
}
