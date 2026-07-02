"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShopIcon } from "@/components/icons";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import type { ShopOrder } from "@/lib/types";
import { friendlyError } from "@/lib/user-errors";

const statusLabels: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  dispatched: "Dispatched",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const supabase = getSupabaseBrowser();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setLoading(false);
        return;
      }
      const { data, error: loadError } = await supabase.from("shop_orders").select("*, shop_order_items(*)").order("created_at", { ascending: false });
      if (loadError) setError(friendlyError(loadError, "Your orders could not be loaded."));
      else setOrders((data ?? []) as ShopOrder[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="pageWidth pagePad"><div className="skeletonCard" /></div>;

  return <div className="pageWidth pagePad narrowContent">
    <Link className="backLink" href="/account#orders">← Account</Link>
    <div className="sectionTitleRow"><div><p className="eyebrow red">Account</p><h1>My orders</h1><p className="muted">Shop order requests linked to your account.</p></div><ShopIcon /></div>
    {error && <div className="notice danger">{error}</div>}
    {orders.length ? <div className="orderList">{orders.map((order) => <article className="orderCard" key={order.id}>
      <div className="orderTop"><div><strong>Order {order.order_number || order.id.slice(0, 8).toUpperCase()}</strong><span>{new Date(order.created_at).toLocaleString("en-IE")}</span></div><span className={`status ${order.status === "cancelled" ? "stolen" : "safe"}`}>{statusLabels[order.status] || order.status}</span></div>
      <ul>{order.shop_order_items?.map((item) => <li key={item.id}><span>{item.product_name} × {item.quantity}</span><strong>€{((item.line_total_cents ?? item.unit_price_cents * item.quantity) / 100).toFixed(2)}</strong></li>)}</ul>
      <div className="orderTotal"><span>Total</span><strong>€{(order.total_cents / 100).toFixed(2)}</strong></div>
      {order.contact_name && <div className="orderDelivery"><strong>Delivery details</strong><span>{order.contact_name}</span><span>{order.contact_email}</span></div>}
    </article>)}</div> : <div className="emptyPanel"><ShopIcon /><h2>No orders yet</h2><p>Your submitted shop orders will appear here.</p><Link className="button primary" href="/shop">Open shop</Link></div>}
  </div>;
}
