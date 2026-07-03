"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertIcon, CheckIcon, CopyIcon, SearchIcon, ShieldIcon } from "@/components/icons";
import { displaySerial, normaliseOptionalUrl } from "@/lib/normalise";
import { verificationLabel } from "@/lib/asset-status";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase-browser";
import type { PublicLookupResult } from "@/lib/types";

const listingSources = ["Adverts.ie", "DoneDeal", "Facebook Marketplace", "eBay", "Gumtree", "Auction or dealer", "Other"];

type Challenge = { code: string; token: string; expiresAt: string; status: "pending" | "confirmed" | "expired" };

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
      let authorization: string | undefined;
      if (isSupabaseConfigured()) {
        const { data } = await getSupabaseBrowser().auth.getSession();
        if (data.session?.access_token) authorization = `Bearer ${data.session.access_token}`;
      }
      const response = await fetch(`/api/lookup?serial=${encodeURIComponent(clean)}`, {
        cache: "no-store",
        headers: authorization ? { Authorization: authorization } : undefined,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The serial could not be checked.");
      setResult(body as PublicLookupResult);
      window.history.replaceState(null, "", `/lookup?serial=${encodeURIComponent(clean)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The serial could not be checked.");
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

  return <div className="pageWidth pagePad narrowPage">
    <div className="pageIntro">
      <h1>Check before you buy.</h1>
      <p>Search the serial number, then ask the seller to confirm control of any existing ToolTrack registration.</p>
    </div>
    <form className="lookupPanel" onSubmit={submit}>
      <label htmlFor="serial-search">Serial number</label>
      <div className="lookupInputRow">
        <div className="inputWithIcon"><SearchIcon /><input id="serial-search" value={serial} onChange={(event) => setSerial(event.target.value.toUpperCase())} onBlur={() => setSerial(displaySerial(serial))} placeholder="Enter serial number" autoCapitalize="characters" autoComplete="off" /></div>
        <button className="button primary" disabled={loading}>{loading ? "Checking…" : "Check serial"}</button>
      </div>
    </form>

    {error && <div className="notice danger">{error}</div>}
    {loading && <div className="skeletonCard" />}
    {result && <ResultCard result={result} serial={serial} />}

    <div className="lookupDisclaimer"><strong>Important:</strong> ToolTrack records support safer buying and an evidence trail, but they do not by themselves prove legal ownership or seller identity.</div>
  </div>;
}

function ResultCard({ result, serial }: { result: PublicLookupResult; serial: string }) {
  const stolen = result.lookupState === "stolen";
  const disputed = result.lookupState === "disputed";
  const confirmationAvailable = !result.ownedByCurrentUser && ["registered", "for_sale", "recovered"].includes(result.lookupState);
  const [showSightingForm, setShowSightingForm] = useState(false);
  const [sourcePlatform, setSourcePlatform] = useState("");
  const [locationArea, setLocationArea] = useState("");
  const [listingUrl, setListingUrl] = useState("");
  const [sellerUsername, setSellerUsername] = useState("");
  const [listingTitle, setListingTitle] = useState("");
  const [askingPrice, setAskingPrice] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [details, setDetails] = useState("");
  const [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const [sightingError, setSightingError] = useState("");
  const [sightingSuccess, setSightingSuccess] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [challengeBusy, setChallengeBusy] = useState(false);
  const [challengeError, setChallengeError] = useState("");

  useEffect(() => {
    if (!challenge || challenge.status !== "pending") return;
    const poll = window.setInterval(async () => {
      const response = await fetch(`/api/seller-confirmations?token=${encodeURIComponent(challenge.token)}`, { cache: "no-store" });
      if (!response.ok) return;
      const body = await response.json() as { status: Challenge["status"] };
      setChallenge((current) => current ? { ...current, status: body.status } : current);
    }, 3000);
    return () => window.clearInterval(poll);
  }, [challenge]);

  function tidyListingUrl() {
    if (!listingUrl.trim()) return;
    const normalised = normaliseOptionalUrl(listingUrl);
    if (normalised) setListingUrl(normalised);
  }

  async function requestSellerConfirmation() {
    setChallengeBusy(true); setChallengeError("");
    try {
      const response = await fetch("/api/seller-confirmations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serial }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Seller confirmation could not be started.");
      setChallenge({ code: body.code, token: body.token, expiresAt: body.expiresAt, status: "pending" });
    } catch (caught) {
      setChallengeError(caught instanceof Error ? caught.message : "Seller confirmation could not be started.");
    } finally { setChallengeBusy(false); }
  }

  async function copyCode() {
    if (!challenge) return;
    await navigator.clipboard?.writeText(challenge.code);
  }

  async function submitSighting(event: FormEvent) {
    event.preventDefault();
    setSending(true); setSightingError(""); setSightingSuccess("");
    try {
      const normalisedListing = listingUrl.trim() ? normaliseOptionalUrl(listingUrl) : "";
      if (listingUrl.trim() && !normalisedListing) throw new Error("Enter a valid listing address or leave it blank.");
      if (normalisedListing) setListingUrl(normalisedListing);
      let authorization: string | undefined;
      if (isSupabaseConfigured()) {
        const { data } = await getSupabaseBrowser().auth.getSession();
        if (data.session?.access_token) authorization = `Bearer ${data.session.access_token}`;
      }
      const response = await fetch("/api/sightings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authorization ? { Authorization: authorization } : {}) },
        body: JSON.stringify({ serial, sourcePlatform, locationArea, listingUrl: normalisedListing, sellerUsername, listingTitle, askingPrice, reporterEmail, details, website }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The sighting could not be reported.");
      setSightingSuccess(body.message || "Thank you. The sighting has been recorded.");
      setSourcePlatform(""); setLocationArea(""); setListingUrl(""); setSellerUsername(""); setListingTitle(""); setAskingPrice(""); setReporterEmail(""); setDetails(""); setShowSightingForm(false);
    } catch (err) {
      setSightingError(err instanceof Error ? err.message : "The sighting could not be reported.");
    } finally { setSending(false); }
  }

  const title = result.lookupState === "stolen" ? "Reported stolen"
    : result.lookupState === "for_sale" ? "Registered and offered for sale"
      : result.lookupState === "transfer_pending" ? "Transfer pending"
        : result.lookupState === "disputed" ? "Registration disputed"
          : result.lookupState === "recovered" ? "Previously reported stolen"
            : result.found ? "Registered — seller verification required" : "No matching record";

  const className = stolen ? "stolen" : disputed || result.lookupState === "transfer_pending" ? "warning" : result.found ? "registered" : "none";

  return <article className={`resultCard ${className}`}>
    <div className="resultHeader">
      {stolen || disputed ? <AlertIcon /> : <ShieldIcon />}
      <div><p>{title}</p><h2>{result.message}</h2></div>
    </div>

    {result.ownedByCurrentUser && result.assetId && <div className="ownerLookupPanel">
      <div><strong>Your registered asset</strong><span>Manage this record from your ToolTrack account.</span></div>
      <Link className="button primary" href={`/asset/${result.assetId}`}>View asset</Link>
    </div>}

    {result.found && <>
      <dl className="resultDetails">
        <div><dt>Make</dt><dd>{result.make}</dd></div>
        <div><dt>Model</dt><dd>{result.model}</dd></div>
        <div><dt>Category</dt><dd>{result.category}</dd></div>
        <div><dt>Serial</dt><dd>{result.serialMasked}</dd></div>
        {result.registeredAt && <div><dt>Registered since</dt><dd>{new Date(result.registeredAt).toLocaleDateString("en-IE")}</dd></div>}
        <div><dt>Record strength</dt><dd>{verificationLabel(result.verificationLevel)}</dd></div>
        {result.saleExpiresAt && <div><dt>Sale confirmation expires</dt><dd>{new Date(result.saleExpiresAt).toLocaleDateString("en-IE")}</dd></div>}
        {result.locationArea && <div><dt>Reported area</dt><dd>{result.locationArea}</dd></div>}
        {result.publicReference && <div><dt>Reference</dt><dd>{result.publicReference}</dd></div>}
      </dl>
      {confirmationAvailable && <div className="sellerCheckPanel">
        <div><h3>Confirm the seller controls this record</h3><p>Generate a temporary code and ask the seller to enter it from this asset in their ToolTrack account.</p></div>
        {!challenge && <button className="button primary" onClick={() => void requestSellerConfirmation()} disabled={challengeBusy}>{challengeBusy ? "Starting…" : "Request seller confirmation"}</button>}
        {challenge?.status === "pending" && <div className="sellerChallenge"><span>Give this code to the seller</span><strong>{challenge.code.slice(0, 3)} {challenge.code.slice(3)}</strong><button type="button" onClick={() => void copyCode()}><CopyIcon /> Copy</button><small>Waiting for confirmation · expires in 15 minutes</small></div>}
        {challenge?.status === "confirmed" && <div className="sellerConfirmed"><CheckIcon /><div><strong>Seller account confirmed just now</strong><span>The seller demonstrated control of the registered ToolTrack account. Complete the ownership transfer before payment.</span></div></div>}
        {challenge?.status === "expired" && <div className="notice danger">The confirmation code expired. Start a new request.</div>}
        {challengeError && <div className="notice danger">{challengeError}</div>}
      </div>}
    </>}

    {stolen && !result.ownedByCurrentUser && <div className="resultActions">
      {!showSightingForm && !sightingSuccess && <button className="button primary" type="button" onClick={() => setShowSightingForm(true)}>Report a sighting</button>}
      <p>Do not confront a seller. Save the listing details and contact An Garda Síochána where appropriate.</p>
      {showSightingForm && !sightingSuccess && <form className="sightingForm" onSubmit={submitSighting}>
        <div className="formGrid">
          <label>Where did you see the item?<select value={sourcePlatform} onChange={(event) => setSourcePlatform(event.target.value)} required><option value="">Choose source</option>{listingSources.map((source) => <option key={source}>{source}</option>)}</select></label>
          <label>Approximate location<input value={locationArea} onChange={(event) => setLocationArea(event.target.value)} placeholder="Town, area or shop" maxLength={160} required /></label>
          <label>Listing URL (optional)<input type="text" inputMode="url" value={listingUrl} onChange={(event) => setListingUrl(event.target.value)} onBlur={tidyListingUrl} placeholder="Paste the advert link" maxLength={500} autoCapitalize="none" autoCorrect="off" /></label>
          <label>Seller username (optional)<input value={sellerUsername} onChange={(event) => setSellerUsername(event.target.value)} maxLength={160} /></label>
          <label>Advert title (optional)<input value={listingTitle} onChange={(event) => setListingTitle(event.target.value)} maxLength={240} /></label>
          <label>Asking price (optional)<input type="number" min="0" step="0.01" inputMode="decimal" value={askingPrice} onChange={(event) => setAskingPrice(event.target.value)} placeholder="€" /></label>
        </div>
        <label>Your email (optional)<input type="email" value={reporterEmail} onChange={(event) => setReporterEmail(event.target.value)} placeholder="Only used if more information is needed" maxLength={254} /></label>
        <label>What did you see?<textarea value={details} onChange={(event) => setDetails(event.target.value)} rows={4} placeholder="Describe the advert, seller, vehicle or anything else that may help." maxLength={1500} required /></label>
        <label className="honeypot" aria-hidden="true">Website<input value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" /></label>
        <p className="privacyHint">Your report is private and is shared only with the asset owner and authorised ToolTrack staff.</p>
        {sightingError && <div className="notice danger">{sightingError}</div>}
        <div className="inlineActions"><button className="button secondary" type="button" onClick={() => setShowSightingForm(false)} disabled={sending}>Cancel</button><button className="button primary" disabled={sending}>{sending ? "Sending…" : "Send sighting"}</button></div>
      </form>}
      {sightingSuccess && <div className="notice success">{sightingSuccess}</div>}
    </div>}

    {!result.found && <div className="resultActions registerPrompt"><div><h3>Is this your asset?</h3><p>Create a dated record with the serial number already filled in.</p></div><Link className="button primary" href={`/register?serial=${encodeURIComponent(displaySerial(serial))}`}>Register this asset</Link></div>}
  </article>;
}
