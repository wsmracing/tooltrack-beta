"use client";

import { FormEvent, useEffect, useState } from "react";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase-browser";
import type { ShopProduct } from "@/lib/types";

function euro(cents: number) { return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100); }

type AdminOrder = { id: string; order_number: string; status: string; payment_status: string; total_cents: number; contact_name: string; contact_email: string; created_at: string };

export default function ShopAdminPage() {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sku, setSku] = useState(""); const [slug, setSlug] = useState(""); const [name, setName] = useState(""); const [description, setDescription] = useState(""); const [category, setCategory] = useState("Locks"); const [price, setPrice] = useState(""); const [stock, setStock] = useState("0");

  async function load(currentToken: string) {
    const headers = { Authorization: `Bearer ${currentToken}` };
    const [productResponse, orderResponse] = await Promise.all([fetch("/api/shop/admin/products", { headers }), fetch("/api/shop/admin/orders", { headers })]);
    const productBody = await productResponse.json(); const orderBody = await orderResponse.json();
    if (!productResponse.ok) throw new Error(productBody.error || "Could not load products.");
    if (!orderResponse.ok) throw new Error(orderBody.error || "Could not load orders.");
    setProducts(productBody.products ?? []); setOrders(orderBody.orders ?? []);
  }

  useEffect(() => { void (async () => { if (!isSupabaseConfigured()) { setError("Supabase is not configured."); setLoading(false); return; } const { data } = await getSupabaseBrowser().auth.getSession(); const access = data.session?.access_token ?? ""; setToken(access); if (!access) { setError("Sign in with a shop administrator account."); setLoading(false); return; } try { await load(access); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load shop admin."); } finally { setLoading(false); } })(); }, []);

  async function createProduct(event: FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    const response = await fetch("/api/shop/admin/products", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ sku, slug, name, description, category, price: Number(price), stockQuantity: Number(stock), active: true }) });
    const body = await response.json(); if (!response.ok) { setError(body.error || "Could not create product."); return; }
    setMessage("Product created."); setSku(""); setSlug(""); setName(""); setDescription(""); setPrice(""); setStock("0"); await load(token);
  }

  async function updateProduct(product: ShopProduct, updates: Record<string, unknown>) {
    const response = await fetch("/api/shop/admin/products", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: product.id, ...updates }) });
    const body = await response.json(); if (!response.ok) setError(body.error || "Could not update product."); else { setMessage("Product updated."); await load(token); }
  }

  async function updateOrder(id: string, status: string) {
    const response = await fetch("/api/shop/admin/orders", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ id, status }) });
    const body = await response.json(); if (!response.ok) setError(body.error || "Could not update order."); else { setMessage("Order updated."); await load(token); }
  }

  if (loading) return <div className="pageWidth pagePad"><div className="skeletonCard" /></div>;
  return <div className="pageWidth pagePad shopAdminPage"><p className="eyebrow red">Restricted</p><h1>Shop administration</h1><p className="muted">Manage products, stock and beta order status.</p>{error && <div className="notice danger">{error}</div>}{message && <div className="notice success">{message}</div>}
    {!error || products.length > 0 ? <><div className="splitLayout"><form className="settingsCard formStack stickyPanel" onSubmit={createProduct}><h2>Add product</h2><label>SKU<input value={sku} onChange={(e) => setSku(e.target.value)} required /></label><label>URL slug<input value={slug} onChange={(e) => setSlug(e.target.value)} required /></label><label>Name<input value={name} onChange={(e) => setName(e.target.value)} required /></label><label>Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></label><label>Category<input value={category} onChange={(e) => setCategory(e.target.value)} required /></label><div className="formGrid two"><label>Price €<input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required /></label><label>Stock<input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} required /></label></div><button className="button primary">Create product</button></form><section><h2>Products</h2><div className="adminProductList">{products.map((product) => <article className="adminProductCard" key={product.id}><div><strong>{product.name}</strong><span>{product.sku} · {product.category}</span></div><div><strong>{euro(product.price_cents)}</strong><span>{product.stock_quantity} in stock</span></div><button className="button secondary" onClick={() => void updateProduct(product, { active: !product.active })}>{product.active ? "Disable" : "Enable"}</button></article>)}</div></section></div><section className="dashboardSection"><div className="dashboardSectionHeading"><div><p className="eyebrow red">Orders</p><h2>Beta orders</h2></div></div><div className="tableScroll"><table><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><strong>{order.order_number}</strong><br /><small>{new Date(order.created_at).toLocaleString("en-IE")}</small></td><td>{order.contact_name}<br /><small>{order.contact_email}</small></td><td>{euro(order.total_cents)}</td><td>{order.payment_status}</td><td><select value={order.status} onChange={(event) => void updateOrder(order.id, event.target.value)}><option value="beta_pending">Beta pending</option><option value="pending_payment">Pending payment</option><option value="paid">Paid</option><option value="processing">Processing</option><option value="shipped">Shipped</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></td></tr>)}</tbody></table></div></section></> : null}
  </div>;
}
