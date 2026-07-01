"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ShopIcon } from "@/components/icons";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase-browser";
import type { ShopOrder } from "@/lib/types";
function euro(cents: number) { return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100); }
export default function ShopOrdersPage() {
  const [orders, setOrders] = useState<Array<ShopOrder & { shop_order_items?: Array<{ id: string; product_name: string; quantity: number; line_total_cents: number }> }>>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [signedIn, setSignedIn] = useState(false);
  useEffect(() => { void (async () => { if (!isSupabaseConfigured()) { setError("Supabase is not configured."); setLoading(false); return; } const { data } = await getSupabaseBrowser().auth.getSession(); const token = data.session?.access_token; setSignedIn(Boolean(token)); if (!token) { setLoading(false); return; } const response = await fetch("/api/shop/orders", { headers: { Authorization: `Bearer ${token}` } }); const body = await response.json(); if (!response.ok) setError(body.error || "Could not load orders."); else setOrders(body.orders ?? []); setLoading(false); })(); }, []);
  if (loading) return <div className="pageWidth pagePad"><div className="skeletonCard" /></div>;
  if (!signedIn) return <div className="pageWidth pagePad narrowPage"><div className="emptyPanel"><ShopIcon /><h1>Sign in to view orders</h1><Link className="button primary" href="/login?next=/shop/orders">Sign in</Link></div></div>;
  return <div className="pageWidth pagePad"><div className="sectionTitleRow"><div><p className="eyebrow red">Security shop</p><h1>My orders</h1><p className="muted">Beta orders and their current status.</p></div><Link className="button primary" href="/shop">Back to shop</Link></div>{error && <div className="notice danger">{error}</div>}{orders.length ? <div className="orderList">{orders.map((order) => <article className="orderCard" key={order.id}><div className="orderCardTop"><div><strong>{order.order_number}</strong><span>{new Date(order.created_at).toLocaleString("en-IE")}</span></div><span className="status safe">{order.status.replaceAll("_", " ")}</span></div><div className="orderItems">{order.shop_order_items?.map((item) => <div key={item.id}><span>{item.quantity} × {item.product_name}</span><strong>{euro(item.line_total_cents)}</strong></div>)}</div><div className="cartTotal"><span>Total</span><strong>{euro(order.total_cents)}</strong></div><p className="smallText">Payment: {order.payment_status.replaceAll("_", " ")}</p></article>)}</div> : <div className="emptyPanel"><ShopIcon /><h2>No shop orders yet</h2><p>Create a beta order from the security shop.</p><Link className="button primary" href="/shop">Open shop</Link></div>}</div>;
}
