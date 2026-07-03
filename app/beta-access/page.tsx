"use client";

import { FormEvent, useState } from "react";

function getSafeReturnPath(): string {
  if (typeof window === "undefined") return "/";
  const value = new URLSearchParams(window.location.search).get("returnTo");
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default function BetaAccessPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/beta-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, returnTo: getSafeReturnPath() }),
      });

      const result = (await response.json()) as { error?: string; redirectTo?: string };

      if (!response.ok) {
        setError(result.error || "Access could not be verified.");
        return;
      }

      window.location.assign(result.redirectTo || "/");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="betaGate">
      <section className="betaGateCard" aria-labelledby="beta-title">
        <div className="betaGateBrand" aria-label="ToolTrack">
          <span className="brandMark">TT</span>
          <span className="brandText">Tool<span>Track</span></span>
        </div>

        <p className="betaGateBadge">Private beta</p>
        <h1 id="beta-title">ToolTrack is currently under test.</h1>
        <p className="betaGateLead">
          Enter the private beta access code to continue to the testing site.
        </p>

        <form className="betaGateForm" onSubmit={handleSubmit}>
          <label htmlFor="beta-code">
            Access code
            <input
              id="beta-code"
              name="beta-code"
              type="password"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="current-password"
              autoFocus
              required
            />
          </label>

          {error ? <p className="betaGateError" role="alert">{error}</p> : null}

          <button className="button primary large betaGateButton" type="submit" disabled={submitting || !code}>
            {submitting ? "Checking…" : "Enter ToolTrack"}
          </button>
        </form>

        <p className="betaGateFootnote">
          Restricted to authorised ToolTrack testers. Please do not enter real customer or payment data.
        </p>
      </section>
    </div>
  );
}
