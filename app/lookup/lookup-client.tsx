"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertIcon, SearchIcon, ShieldIcon } from "@/components/icons";
import { displaySerial, normaliseOptionalUrl } from "@/lib/normalise";
import type { PublicLookupResult } from "@/lib/types";

export function LookupClient() {
  const params = useSearchParams();
  const [serial, setSerial] = useState(params.get("serial") ?? "");
  const [result, setResult] = useState<PublicLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runLookup(value: string) {
    const clean = displaySerial(value);
    if (!clean) return;
    setSerial(clean);
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch(`/api/lookup?serial=${encodeURIComponent(clean)}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Lookup failed.");
      setResult(body);
      window.history.replaceState(null, "", `/lookup?serial=${encodeURIComponent(clean)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initial = params.get("serial");
    if (initial) void runLookup(initial);
    // The URL value only needs to trigger the first lookup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    void runLookup(serial);
  }

  return (
    <div className="pageWidth pagePad narrowPage">
      <div className="pageIntro">
        <p className="eyebrow red">Free public lookup</p>
        <h1>Check before you buy.</h1>
        <p>Search a serial number to see whether a matching asset is registered or currently reported stolen.</p>
      </div>
      <form className="lookupPanel" onSubmit={submit}>
        <label htmlFor="serial-search">Serial number</label>
        <div className="lookupInputRow">
          <div className="inputWithIcon">
            <SearchIcon />
            <input
              id="serial-search"
              value={serial}
              onChange={(event) => setSerial(event.target.value.toUpperCase())}
              onBlur={() => setSerial(displaySerial(serial))}
              placeholder="Try MIL-8891 or MAK-4932"
              autoCapitalize="characters"
              autoComplete="off"
            />
          </div>
          <button className="button primary" disabled={loading}>{loading ? "Checking…" : "Search"}</button>
        </div>
        <div className="demoSerials">
          <span>Demo:</span>
          <button type="button" onClick={() => void runLookup("MIL-8891")}>MIL-8891 stolen</button>
          <button type="button" onClick={() => void runLookup("MAK-4932")}>MAK-4932 safe</button>
        </div>
      </form>

      {error && <div className="notice danger">{error}</div>}
      {!result && !loading && <div className="emptyPanel"><SearchIcon /><h2>Enter a serial number</h2><p>Spaces, dashes and letter case are ignored.</p></div>}
      {loading && <div className="skeletonCard" />}
      {result && <ResultCard result={result} serial={serial} />}

      <div className="lookupDisclaimer">
        <strong>Important:</strong> ToolTrack only reports records currently held in this database. A clear result does not prove ownership or guarantee that an item is legitimate.
      </div>
    </div>
  );
}

function ResultCard({ result, serial }: { result: PublicLookupResult; serial: string }) {
  const stolen = result.status === "stolen";
  const safe = result.status === "safe" || result.status === "recovered";
  const [showSightingForm, setShowSightingForm] = useState(false);
  const [locationArea, setLocationArea] = useState("");
  const [listingUrl, setListingUrl] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [details, setDetails] = useState("");
  const [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const [sightingError, setSightingError] = useState("");
  const [sightingSuccess, setSightingSuccess] = useState("");

  function tidyListingUrl() {
    if (!listingUrl.trim()) return;
    const normalised = normaliseOptionalUrl(listingUrl);
    if (normalised) setListingUrl(normalised);
  }

  async function submitSighting(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setSightingError("");
    setSightingSuccess("");
    try {
      const normalisedListing = listingUrl.trim() ? normaliseOptionalUrl(listingUrl) : "";
      if (listingUrl.trim() && !normalisedListing) throw new Error("Enter a valid listing website address or leave it blank.");
      if (normalisedListing) setListingUrl(normalisedListing);

      const response = await fetch("/api/sightings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serial, locationArea, listingUrl: normalisedListing, reporterEmail, details, website }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not report the sighting.");
      setSightingSuccess(body.message || "Thank you. The sighting has been recorded.");
      setLocationArea("");
      setListingUrl("");
      setReporterEmail("");
      setDetails("");
      setShowSightingForm(false);
    } catch (err) {
      setSightingError(err instanceof Error ? err.message : "Could not report the sighting.");
    } finally {
      setSending(false);
    }
  }

  return (
    <article className={`resultCard ${stolen ? "stolen" : safe ? "safe" : result.status === "transfer" ? "warning" : "none"}`}>
      <div className="resultHeader">
        {stolen ? <AlertIcon /> : <ShieldIcon />}
        <div>
          <p>{stolen ? "Reported stolen" : result.found ? "Registered asset" : "No matching record"}</p>
          <h2>{result.message}</h2>
        </div>
      </div>

      {result.found && <dl className="resultDetails">
        <div><dt>Make</dt><dd>{result.make}</dd></div>
        <div><dt>Model</dt><dd>{result.model}</dd></div>
        <div><dt>Category</dt><dd>{result.category}</dd></div>
        <div><dt>Serial</dt><dd>{result.serialMasked}</dd></div>
        {result.locationArea && <div><dt>Reported area</dt><dd>{result.locationArea}</dd></div>}
        {result.publicReference && <div><dt>Reference</dt><dd>{result.publicReference}</dd></div>}
      </dl>}

      {stolen && <div className="resultActions">
        {!showSightingForm && !sightingSuccess && <button className="button primary" type="button" onClick={() => setShowSightingForm(true)}>Report a sighting</button>}
        <p>Do not confront a seller. Record the listing and contact An Garda Síochána where appropriate.</p>
        {showSightingForm && !sightingSuccess && <form className="sightingForm" onSubmit={submitSighting}>
          <div className="formGrid">
            <label>Where did you see it?<input value={locationArea} onChange={(event) => setLocationArea(event.target.value)} placeholder="Town, area, shop or website" maxLength={160} required /></label>
            <label>Listing URL (optional)<input type="text" inputMode="url" value={listingUrl} onChange={(event) => setListingUrl(event.target.value)} onBlur={tidyListingUrl} placeholder="avispl.com/listing" maxLength={500} autoCapitalize="none" autoCorrect="off" /></label>
          </div>
          <label>Your email (optional)<input type="email" value={reporterEmail} onChange={(event) => setReporterEmail(event.target.value)} placeholder="Only used if more information is needed" maxLength={254} /></label>
          <label>What did you see?<textarea value={details} onChange={(event) => setDetails(event.target.value)} rows={4} placeholder="Describe the advert, seller, vehicle, location or anything that may help." maxLength={1500} required /></label>
          <label className="honeypot" aria-hidden="true">Website<input value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" /></label>
          <p className="privacyHint">Your report is private. It is shared only with the asset owner and authorised ToolTrack staff.</p>
          {sightingError && <div className="notice danger">{sightingError}</div>}
          <div className="inlineActions"><button className="button secondary" type="button" onClick={() => setShowSightingForm(false)} disabled={sending}>Cancel</button><button className="button primary" disabled={sending}>{sending ? "Sending…" : "Send sighting"}</button></div>
        </form>}
        {sightingSuccess && <div className="notice success">{sightingSuccess}</div>}
      </div>}

      {!result.found && <div className="resultActions registerPrompt">
        <div><h3>Is this your asset?</h3><p>Register it now with the serial number already filled in.</p></div>
        <Link className="button primary" href={`/register?serial=${encodeURIComponent(displaySerial(serial))}`}>Register this asset</Link>
      </div>}
    </article>
  );
}
