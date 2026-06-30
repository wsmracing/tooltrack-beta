"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase-browser";
import { ShieldIcon } from "@/components/icons";

function requestedDestination() {
  if (typeof window === "undefined") return "/dashboard";
  const requested = new URLSearchParams(window.location.search).get("next") ?? "/dashboard";
  return requested.startsWith("/") && !requested.startsWith("//") ? requested : "/dashboard";
}

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured()) { setSessionChecked(true); return; }
    const supabase = getSupabaseBrowser();
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace(requestedDestination());
      else setSessionChecked(true);
    });
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError(""); setMessage("");
    try {
      const supabase = getSupabaseBrowser();
      const destination = requestedDestination();
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        router.replace(destination); router.refresh();
      } else {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${destination}`,
            data: { full_name: name.trim() || undefined },
          },
        });
        if (authError) throw authError;
        if (data.session) { router.replace(destination); router.refresh(); }
        else setMessage("Account created. Check your email for the confirmation link, then sign in.");
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Authentication failed."); }
    finally { setLoading(false); }
  }

  if (!isSupabaseConfigured()) return <div className="pageWidth pagePad narrowPage"><div className="notice danger">Supabase environment variables are missing.</div></div>;
  if (!sessionChecked) return <div className="pageWidth pagePad narrowPage"><div className="skeletonCard" /></div>;

  return (
    <div className="pageWidth pagePad authPage">
      <div className="authCard">
        <div className="authIcon"><ShieldIcon /></div>
        <p className="eyebrow red">ToolTrack beta</p><h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1><p className="muted">Use a test email account for the prototype.</p>
        <div className="segmented"><button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Sign in</button><button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>Register</button></div>
        <form className="formStack" onSubmit={submit}>{mode === "signup" && <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" placeholder="Daniel" /></label>}<label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label><label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoComplete={mode === "login" ? "current-password" : "new-password"} /></label><button className="button primary large" disabled={loading}>{loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button></form>
        {message && <div className="notice success">{message}</div>}{error && <div className="notice danger">{error}</div>}
      </div>
    </div>
  );
}
