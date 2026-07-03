"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase-browser";
import { ShieldIcon } from "@/components/icons";
import { friendlyError } from "@/lib/user-errors";

function requestedDestination() {
  if (typeof window === "undefined") return "/dashboard";
  const requested = new URLSearchParams(window.location.search).get("next") ?? "/dashboard";
  return requested.startsWith("/") && !requested.startsWith("//") ? requested : "/dashboard";
}

async function notifySignup(email: string, name: string, userId?: string) {
  try {
    await fetch("/api/auth/signup-notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, userId }),
    });
  } catch {
    // Non-blocking admin notification only. Account creation should not fail if email notification fails.
  }
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
    const requestedMode = new URLSearchParams(window.location.search).get("mode");
    if (requestedMode === "signup") setMode("signup");
  }, []);

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
        const cleanEmail = email.trim().toLowerCase();
        const cleanName = name.trim();
        const { data, error: authError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${destination}`,
            data: { full_name: cleanName || undefined },
          },
        });
        if (authError) throw authError;
        void notifySignup(cleanEmail, cleanName, data.user?.id);
        if (data.session) { router.replace(destination); router.refresh(); }
        else setMessage("Account created. Check your email for the confirmation link, then sign in.");
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message.toLowerCase() : "";
      setError(raw.includes("invalid login credentials")
        ? "The email address or password is incorrect."
        : raw.includes("email not confirmed")
          ? "Confirm your email address before signing in."
          : friendlyError(err, mode === "login" ? "Sign in failed. Check your details and try again." : "The account could not be created. Check your details and try again."));
    }
    finally { setLoading(false); }
  }

  if (!isSupabaseConfigured()) return <div className="pageWidth pagePad narrowPage"><div className="notice danger">Supabase environment variables are missing.</div></div>;
  if (!sessionChecked) return <div className="pageWidth pagePad narrowPage"><div className="skeletonCard" /></div>;

  return (
    <div className="pageWidth pagePad authPage">
      <div className="authCard">
        <div className="authIcon"><ShieldIcon /></div>
        <p className="eyebrow red">Account</p><h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1><p className="muted">Access your registered assets, transfers and alerts.</p>
        <div className="segmented"><button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Sign in</button><button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>Create account</button></div>
        <form className="formStack" onSubmit={submit}>{mode === "signup" && <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" /></label>}<label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label><label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>{mode === "login" && <div className="forgotPasswordLink"><a href="/forgot-password">Forgot password?</a></div>}<button className="button primary large" disabled={loading}>{loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button></form>
        {message && <div className="notice success">{message}</div>}{error && <div className="notice danger">{error}</div>}<div className="authSecondaryLinks"><a href="/transfer">Have a transfer code?</a><a href="/help">Need help?</a></div>
      </div>
    </div>
  );
}
