"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase-browser";
import type { Asset } from "@/lib/types";
import { AlertIcon, PlusIcon, SearchIcon, ToolboxIcon } from "@/components/icons";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "safe" | "stolen">("all");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured()) { setError("Supabase is not configured."); setLoading(false); return; }
    const supabase = getSupabaseBrowser();
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      setUser(auth.user);
      if (!auth.user) { setLoading(false); return; }
      const { data, error: fetchError } = await supabase.from("assets").select("*").order("registered_at", { ascending: false });
      if (fetchError) setError(fetchError.message); else setAssets((data ?? []) as Asset[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => assets.filter((asset) => {
    const matchesStatus = filter === "all" || asset.status === filter;
    const text = `${asset.make} ${asset.model} ${asset.serial_original} ${asset.category}`.toLowerCase();
    return matchesStatus && text.includes(query.toLowerCase());
  }), [assets, filter, query]);

  if (loading) return <div className="pageWidth pagePad"><div className="skeletonCard" /></div>;
  if (!user) return <div className="pageWidth pagePad narrowPage"><div className="emptyPanel"><ToolboxIcon /><h1>Sign in to view your tools</h1><p>Your registered assets and private documents are linked to your account.</p><Link className="button primary" href="/login">Sign in or register</Link></div></div>;

  return (
    <div className="pageWidth pagePad">
      <div className="sectionTitleRow"><div><p className="eyebrow red">Your account</p><h1>My tools</h1><p className="muted">Signed in as {user.email}</p></div><Link className="button primary" href="/register"><PlusIcon /> Add asset</Link></div>
      {error && <div className="notice danger">{error}. Have you run the Supabase schema?</div>}
      <div className="statsGrid"><article><span>Registered</span><strong>{assets.length}</strong></article><article><span>Safe</span><strong>{assets.filter((a) => a.status === "safe").length}</strong></article><article className="dangerStat"><span>Stolen</span><strong>{assets.filter((a) => a.status === "stolen").length}</strong></article></div>
      <div className="toolbar"><div className="inputWithIcon"><SearchIcon /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search my tools" /></div><div className="pills"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button><button className={filter === "safe" ? "active" : ""} onClick={() => setFilter("safe")}>Safe</button><button className={filter === "stolen" ? "active" : ""} onClick={() => setFilter("stolen")}>Stolen</button></div></div>
      {filtered.length === 0 ? <div className="emptyPanel"><ToolboxIcon /><h2>{assets.length ? "No matching tools" : "No tools registered yet"}</h2><p>{assets.length ? "Try changing the search or filter." : "Register the first asset from your phone."}</p><Link className="button primary" href="/register">Register a tool</Link></div> : <div className="assetGrid">{filtered.map((asset) => <Link href={`/asset/${asset.id}`} className="assetCard" key={asset.id}><div className="assetIcon"><ToolboxIcon /></div><div className="assetMain"><div className="assetTop"><h2>{asset.make} {asset.model}</h2><span className={`status ${asset.status}`}>{asset.status}</span></div><p>{asset.category}</p><dl><div><dt>Serial</dt><dd>{asset.serial_original}</dd></div><div><dt>Registered</dt><dd>{new Date(asset.registered_at).toLocaleDateString("en-IE")}</dd></div></dl></div>{asset.status === "stolen" && <AlertIcon className="assetAlert" />}</Link>)}</div>}
    </div>
  );
}
