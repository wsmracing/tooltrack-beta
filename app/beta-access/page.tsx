"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function BetaAccessPage() {
  const searchParams = useSearchParams();

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const returnTo = searchParams.get("returnTo") || "/";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/beta-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          returnTo,
        }),
      });

      const result = await response.json();

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
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background:
          "radial-gradient(circle at top, #2b1013 0%, #111111 48%, #080808 100%)",
        color: "#ffffff",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "430px",
          padding: "34px",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "18px",
          background: "rgba(18,18,18,0.94)",
          boxShadow: "0 24px 70px rgba(0,0,0,0.45)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            marginBottom: "22px",
            padding: "7px 11px",
            borderRadius: "999px",
            background: "rgba(220,38,38,0.14)",
            color: "#ff7373",
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "0.04em",
          }}
        >
          PRIVATE BETA
        </div>

        <h1
          style={{
            margin: "0 0 10px",
            fontSize: "32px",
            lineHeight: 1.1,
          }}
        >
          ToolTrack
        </h1>

        <p
          style={{
            margin: "0 0 28px",
            color: "#b8b8b8",
            lineHeight: 1.55,
          }}
        >
          Enter the private beta access code to continue.
        </p>

        <form onSubmit={handleSubmit}>
          <label
            htmlFor="beta-code"
            style={{
              display: "block",
              marginBottom: "8px",
              fontSize: "14px",
              fontWeight: 700,
            }}
          >
            Access code
          </label>

          <input
            id="beta-code"
            name="beta-code"
            type="password"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            autoComplete="current-password"
            autoFocus
            required
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "14px 15px",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: "10px",
              background: "#0d0d0d",
              color: "#ffffff",
              fontSize: "16px",
              outline: "none",
            }}
          />

          {error ? (
            <p
              role="alert"
              style={{
                margin: "12px 0 0",
                color: "#ff7777",
                fontSize: "14px",
              }}
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting || !code.trim()}
            style={{
              width: "100%",
              marginTop: "18px",
              padding: "14px 18px",
              border: 0,
              borderRadius: "10px",
              background: "#dc2626",
              color: "#ffffff",
              fontSize: "16px",
              fontWeight: 800,
              cursor: submitting ? "wait" : "pointer",
              opacity: submitting || !code.trim() ? 0.65 : 1,
            }}
          >
            {submitting ? "Checking…" : "Enter ToolTrack"}
          </button>
        </form>

        <p
          style={{
            margin: "22px 0 0",
            color: "#777777",
            fontSize: "12px",
            lineHeight: 1.5,
          }}
        >
          This testing environment is restricted to authorised ToolTrack beta
          users.
        </p>
      </section>
    </main>
  );
}
