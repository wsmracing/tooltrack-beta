"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { MapPinIcon, PlusIcon } from "@/components/icons";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import type { Asset, AssetLocation, Profile } from "@/lib/types";

const locationTypes = ["Van", "Shed", "Garage", "Workshop", "Site", "Office", "Storage unit", "Tool chest", "Other"];

export default function LocationsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [locations, setLocations] = useState<AssetLocation[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState("Van");
  const [notes, setNotes] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const supabase = getSupabaseBrowser();
    const { data: auth } = await supabase.auth.getUser();
    setUser(auth.user);
    if (!auth.user) { setLoading(false); return; }
    const [profileResponse, locationResponse, assetResponse] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle(),
      supabase.from("asset_locations").select("*").order("is_default", { ascending: false }).order("name"),
      supabase.from("assets").select("*").order("make"),
    ]);
    if (profileResponse.data) setProfile(profileResponse.data as Profile);
    if (locationResponse.error) setError(locationResponse.error.message); else setLocations((locationResponse.data ?? []) as AssetLocation[]);
    if (assetResponse.data) setAssets(assetResponse.data as Asset[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  function reset() { setName(""); setType("Van"); setNotes(""); setIsDefault(false); setEditingId(null); }

  function startEdit(location: AssetLocation) {
    setEditingId(location.id); setName(location.name); setType(location.location_type ?? "Other"); setNotes(location.notes ?? ""); setIsDefault(location.is_default); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!user || !name.trim()) return;
    setSaving(true); setError(""); setMessage("");
    const supabase = getSupabaseBrowser();
    const payload = { owner_id: user.id, organization_id: profile?.active_organization_id ?? null, name: name.trim(), location_type: type, notes: notes.trim() || null, is_default: isDefault };
    if (isDefault) await supabase.from("asset_locations").update({ is_default: false }).neq("id", editingId ?? "00000000-0000-0000-0000-000000000000");
    const response = editingId ? await supabase.from("asset_locations").update(payload).eq("id", editingId) : await supabase.from("asset_locations").insert(payload);
    if (response.error) setError(response.error.message); else { setMessage(editingId ? "Location updated." : "Location added."); reset(); await load(); }
    setSaving(false);
  }

  async function remove(location: AssetLocation) {
    const count = assets.filter((asset) => asset.location_id === location.id || asset.storage_location === location.name).length;
    if (!window.confirm(`Delete ${location.name}? ${count ? `${count} linked assets will keep their text location but lose the saved-location link.` : ""}`)) return;
    const { error: deleteError } = await getSupabaseBrowser().from("asset_locations").delete().eq("id", location.id);
    if (deleteError) setError(deleteError.message); else { setMessage("Location deleted."); await load(); }
  }

  if (loading) return <div className="pageWidth pagePad"><div className="skeletonCard" /></div>;
  if (!user) return <div className="pageWidth pagePad narrowPage"><div className="emptyPanel"><MapPinIcon /><h1>Sign in to manage locations</h1><Link className="button primary" href="/login">Sign in</Link></div></div>;

  return <div className="pageWidth pagePad locationsPage">
    <Link className="backLink" href="/dashboard">← Dashboard</Link>
    <div className="sectionTitleRow"><div><p className="eyebrow red">Asset locations</p><h1>Vans, sheds, workshops and sites</h1><p className="muted">Create reusable locations for registration and bulk updates.</p></div><MapPinIcon /></div>
    {message && <div className="notice success">{message}</div>}{error && <div className="notice danger">{error}</div>}
    <div className="splitLayout">
      <form className="settingsCard formStack stickyPanel" onSubmit={save}><h2>{editingId ? "Edit location" : "Add location"}</h2><label>Location name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Red van, Back shed, Site container 2" required /></label><label>Type<select value={type} onChange={(event) => setType(event.target.value)}>{locationTypes.map((value) => <option key={value}>{value}</option>)}</select></label><label>Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Optional access or storage notes" /></label><label className="checkRow"><input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} /><span>Use as my default registration location</span></label><div className="formActions"><button className="button secondary" type="button" onClick={reset}>Clear</button><button className="button primary" disabled={saving || !name.trim()}>{saving ? "Saving…" : editingId ? "Save changes" : "Add location"}</button></div></form>
      <section><div className="dashboardSectionHeading"><div><p className="eyebrow red">Saved locations</p><h2>{locations.length} locations</h2></div></div>{locations.length === 0 ? <div className="emptyPanel"><PlusIcon /><h2>No saved locations yet</h2><p>Add the first location using the form.</p></div> : <div className="locationGrid">{locations.map((location) => { const count = assets.filter((asset) => asset.location_id === location.id || asset.storage_location === location.name).length; return <article className="locationCard" key={location.id}><div className="locationCardTop"><MapPinIcon /><div><h3>{location.name}</h3><p>{location.location_type || "Custom"}{location.is_default ? " · Default" : ""}</p></div></div>{location.notes && <p>{location.notes}</p>}<strong>{count} linked asset{count === 1 ? "" : "s"}</strong><div className="miniActions"><button type="button" onClick={() => startEdit(location)}>Edit</button><button type="button" className="dangerText" onClick={() => void remove(location)}>Delete</button></div></article>; })}</div>}</section>
    </div>
  </div>;
}
