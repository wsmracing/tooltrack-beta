"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertIcon, SearchIcon, ShieldIcon } from "@/components/icons";
import type { PublicLookupResult } from "@/lib/types";

export function LookupClient() {
  const params = useSearchParams();
  const [serial, setSerial] = useState(params.get("serial") ?? "");
  const [result, setResult] = useState<PublicLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runLookup(value: string) {
    const clean = value.trim();
    if (!clean) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const response = await fetch(`/api/lookup?serial=${encodeURIComponent(clean)}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Lookup failed.");
      setResult(body);
      window.history.replaceState(null, "", `/lookup?serial=${encodeURIComponent(clean)}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Lookup failed."); }
    finally { setLoading(false); }
  }

  useEffect(() => { const initial = params.get("serial"); if (initial) void runLookup(initial); }, []);

  function submit(event: FormEvent) { event.preventDefault(); void runLookup(serial); }

  return (
    <div className="pageWidth pagePad narrowPage">
      <div className="pageIntro"><p className="eyebrow red">Free public lookup</p><h1>Check before you buy.</h1><p>A clean result does not prove ownership. Always inspect the tool and seller details in person.</p></div>
      <form className="lookupPanel" onSubmit={submit}>
        <label htmlFor="serial-search">Serial number</label>
        <div className="lookupInputRow"><div className="inputWithIcon"><SearchIcon /><input id="serial-search" value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="Try MIL-8891 or MAK-4932" autoCapitalize="characters" /></div><button className="button primary" disabled={loading}>{loading ? "Checking…" : "Search"}</button></div>
        <div className="demoSerials"><span>Demo:</span><button type="button" onClick={() => { setSerial("MIL-8891"); void runLookup("MIL-8891"); }}>MIL-8891 stolen</button><button type="button" onClick={() => { setSerial("MAK-4932"); void runLookup("MAK-4932"); }}>MAK-4932 safe</button></div>
      </form>

      {error && <div className="notice danger">{error}</div>}
      {!result && !loading && <div className="emptyPanel"><SearchIcon /><h2>Enter a serial number</h2><p>Spaces, dashes and letter case are ignored.</p></div>}
      {loading && <div className="skeletonCard" />}
      {result && <ResultCard result={result} />}
    </div>
  );
}

function ResultCard({ result }: { result: PublicLookupResult }) {
  const stolen = result.status === "stolen";
  const safe = result.status === "safe" || result.status === "recovered";
  return (
    <article className={`resultCard ${stolen ? "stolen" : safe ? "safe" : result.status === "transfer" ? "warning" : "none"}`}>
      <div className="resultHeader">{stolen ? <AlertIcon /> : <ShieldIcon />}<div><p>{stolen ? "Reported stolen" : result.found ? "Registered asset" : "No stolen record found"}</p><h2>{result.message}</h2></div></div>
      {result.found && <dl className="resultDetails"><div><dt>Make</dt><dd>{result.make}</dd></div><div><dt>Model</dt><dd>{result.model}</dd></div><div><dt>Category</dt><dd>{result.category}</dd></div><div><dt>Serial</dt><dd>{result.serialMasked}</dd></div>{result.locationArea && <div><dt>Reported area</dt><dd>{result.locationArea}</dd></div>}{result.publicReference && <div><dt>Reference</dt><dd>{result.publicReference}</dd></div>}</dl>}
      {stolen && <div className="resultActions"><button className="button primary">Report a sighting</button><p>Do not confront a seller. Record the listing and contact An Garda Síochána where appropriate.</p></div>}
      {!result.found && <p className="resultFootnote">This means no matching stolen report was found. It is not a guarantee that the seller owns the item.</p>}
    </article>
  );
}
