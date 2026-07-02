"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertIcon, ToolboxIcon } from "@/components/icons";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import type { Sighting } from "@/lib/types";
import { friendlyError } from "@/lib/user-errors";

export default function SightingsPage() {
  const [rows, setRows] = useState<Sighting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    const supabase = getSupabaseBrowser();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setLoading(false);
      return;
    }

    const { data, error: loadError } = await supabase
      .from("sightings")
      .select("id, asset_id, theft_report_id, reporter_email, location_area, listing_url, source_platform, seller_username, listing_title, asking_price_cents, details, status, notification_status, notification_sent_at, created_at, assets(make, model, serial_original)")
      .order("created_at", { ascending: false });

    if (loadError) setError(friendlyError(loadError, "Sightings could not be loaded."));
    else setRows((data ?? []) as unknown as Sighting[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function markReviewed(id: string) {
    setError("");
    const { error: updateError } = await getSupabaseBrowser()
      .from("sightings")
      .update({ status: "reviewed" })
      .eq("id", id);

    if (updateError) setError(friendlyError(updateError, "The sighting could not be updated."));
    else setRows((current) => current.map((item) => item.id === id ? { ...item, status: "reviewed" } : item));
  }

  if (loading) return <div className="pageWidth pagePad"><div className="skeletonCard" /></div>;

  return <div className="pageWidth pagePad narrowContent">
    <Link className="backLink" href="/dashboard">← Dashboard</Link>
    <div className="sectionTitleRow">
      <div><p className="eyebrow red">Sighting inbox</p><h1>Reported sightings</h1><p className="muted">Review information connected to assets you have reported stolen.</p></div>
      <AlertIcon />
    </div>

    {error && <div className="notice danger">{error}</div>}

    {rows.length ? <div className="sightingList">{rows.map((sighting) => <article className={`sightingCard ${sighting.status === "new" ? "new" : ""}`} key={sighting.id}>
      <div className="sightingTop">
        <div><strong>{sighting.assets?.make} {sighting.assets?.model}</strong><span>{sighting.assets?.serial_original}</span></div>
        <span className={`status ${sighting.status === "new" ? "stolen" : "reviewed"}`}>{sighting.status === "new" ? "New" : "Reviewed"}</span>
      </div>
      <p className="sightingLocation"><AlertIcon /> {[sighting.source_platform, sighting.location_area].filter(Boolean).join(" · ")}</p>
      {(sighting.listing_title || sighting.seller_username || sighting.asking_price_cents != null) && <dl className="sightingListingDetails">
        {sighting.listing_title && <div><dt>Advert</dt><dd>{sighting.listing_title}</dd></div>}
        {sighting.seller_username && <div><dt>Seller</dt><dd>{sighting.seller_username}</dd></div>}
        {sighting.asking_price_cents != null && <div><dt>Asking price</dt><dd>€{(sighting.asking_price_cents / 100).toFixed(2)}</dd></div>}
      </dl>}
      <p>{sighting.details}</p>
      {sighting.listing_url && <a className="textLink" href={sighting.listing_url} target="_blank" rel="noreferrer">Open reported listing</a>}
      {sighting.reporter_email && <p className="smallText">Reporter contact: {sighting.reporter_email}</p>}
      <div className="sightingMeta"><span>{new Date(sighting.created_at).toLocaleString("en-IE")}</span>{sighting.status === "new" && <button onClick={() => void markReviewed(sighting.id)}>Mark reviewed</button>}</div>
    </article>)}</div> : <div className="emptyPanel"><ToolboxIcon /><h2>No sightings reported</h2><p>New reports connected to your stolen assets will appear here.</p></div>}
  </div>;
}
