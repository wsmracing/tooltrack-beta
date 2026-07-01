"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ShieldIcon, ShopIcon } from "@/components/icons";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase-browser";
import type { ShopProduct } from "@/lib/types";

type CartLine = { product: ShopProduct; quantity: number };

function euro(cents: number) { return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100); }

export function ShopClient() {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("All");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [postcode, setPostcode] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("tooltrack-shop-cart-v1");
    if (saved) { try { setCart(JSON.parse(saved)); } catch { /* ignore */ } }
    void fetch("/api/shop/products").then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load shop products.");
      setProducts(body.products ?? []);
    }).catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load shop products.")).finally(() => setLoading(false));
    if (isSupabaseConfigured()) void getSupabaseBrowser().auth.getUser().then(({ data }) => { if (data.user?.email) setContactEmail(data.user.email); const name = data.user?.user_metadata?.full_name; if (typeof name === "string") setContactName(name); });
  }, []);

  useEffect(() => { localStorage.setItem("tooltrack-shop-cart-v1", JSON.stringify(cart)); }, [cart]);

  const categories = useMemo(() => ["All", ...Array.from(new Set(products.map((product) => product.category))).sort()], [products]);
  const visibleProducts = category === "All" ? products : products.filter((product) => product.category === category);
  const lines: CartLine[] = products.filter((product) => cart[product.id]).map((product) => ({ product, quantity: cart[product.id] }));
  const subtotal = lines.reduce((sum, line) => sum + line.product.price_cents * line.quantity, 0);
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);

  function add(product: ShopProduct) { setCart((current) => ({ ...current, [product.id]: Math.min(product.stock_quantity, (current[product.id] ?? 0) + 1) })); setMessage(`${product.name} added to cart.`); }
  function changeQuantity(productId: string, quantity: number) { setCart((current) => { const next = { ...current }; if (quantity <= 0) delete next[productId]; else next[productId] = quantity; return next; }); }

  async function placeOrder(event: FormEvent) {
    event.preventDefault(); setSubmitting(true); setError(""); setMessage("");
    try {
      if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
      const { data } = await getSupabaseBrowser().auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sign in before placing a beta order.");
      const response = await fetch("/api/shop/orders", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ items: lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })), contactName, contactEmail, contactPhone, address1, address2, city, county, postcode }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not create order.");
      setCart({}); setCheckoutOpen(false); setMessage(`${body.message} Reference: ${body.order.order_number}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not create order."); }
    finally { setSubmitting(false); }
  }

  return <div className="pageWidth pagePad shopPage">
    <div className="sectionTitleRow"><div><p className="eyebrow red">ToolTrack security shop</p><h1>Protect your tools and assets</h1><p className="muted">Products, stock and beta orders now use the ToolTrack shop backend.</p></div><div className="shopCartSummary"><ShopIcon /><span><strong>{count}</strong> items</span><strong>{euro(subtotal)}</strong></div></div>
    <div className="notice warning"><strong>Beta checkout:</strong> orders are saved for testing, but no card payment is taken.</div>
    {message && <div className="notice success">{message}</div>}{error && <div className="notice danger">{error}</div>}
    <div className="shopCategoryBar">{categories.map((value) => <button type="button" key={value} className={category === value ? "active" : ""} onClick={() => setCategory(value)}>{value}</button>)}</div>
    {loading ? <div className="skeletonCard" /> : <div className="shopLayout"><section><div className="productGrid">{visibleProducts.map((product) => <article className="productCard shopProductCard" key={product.id}><div className="productVisual">{product.image_url ? <img src={product.image_url} alt="" /> : <ShieldIcon />}</div><span className="productCategory">{product.category}</span><h2>{product.name}</h2><p>{product.description}</p><div className="productPriceRow"><strong>{euro(product.price_cents)}</strong>{product.compare_at_price_cents && <del>{euro(product.compare_at_price_cents)}</del>}</div><small>{product.stock_quantity > 0 ? `${product.stock_quantity} available` : "Out of stock"}</small><button className="button primary" disabled={product.stock_quantity < 1} onClick={() => add(product)}>Add to cart</button></article>)}</div></section>
      <aside className="shopCartPanel"><div className="dashboardSectionHeading"><div><p className="eyebrow red">Your cart</p><h2>{count ? `${count} item${count === 1 ? "" : "s"}` : "Cart is empty"}</h2></div><Link className="textLink" href="/shop/orders">My orders</Link></div>{lines.length ? <><div className="cartLines">{lines.map((line) => <div className="cartLine" key={line.product.id}><div><strong>{line.product.name}</strong><span>{euro(line.product.price_cents)} each</span></div><label>Qty<input type="number" min="0" max={line.product.stock_quantity} value={line.quantity} onChange={(event) => changeQuantity(line.product.id, Number(event.target.value))} /></label><strong>{euro(line.product.price_cents * line.quantity)}</strong></div>)}</div><div className="cartTotal"><span>Subtotal</span><strong>{euro(subtotal)}</strong></div><button className="button primary large" type="button" onClick={() => setCheckoutOpen(true)}>Continue to beta checkout</button></> : <p className="muted">Add products to create a test order.</p>}</aside></div>}
    {checkoutOpen && <div className="modalBackdrop" role="presentation"><div className="modalCard" role="dialog" aria-modal="true" aria-label="Beta checkout"><div className="dashboardSectionHeading"><div><p className="eyebrow red">Beta checkout</p><h2>Delivery details</h2></div><button className="button textButton" type="button" onClick={() => setCheckoutOpen(false)}>Close</button></div><form className="formStack" onSubmit={placeOrder}><div className="formGrid two"><label>Name<input value={contactName} onChange={(e) => setContactName(e.target.value)} required /></label><label>Email<input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required /></label></div><label>Phone<input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} inputMode="tel" /></label><label>Address line 1<input value={address1} onChange={(e) => setAddress1(e.target.value)} required /></label><label>Address line 2<input value={address2} onChange={(e) => setAddress2(e.target.value)} /></label><div className="formGrid two"><label>Town / city<input value={city} onChange={(e) => setCity(e.target.value)} required /></label><label>County<input value={county} onChange={(e) => setCounty(e.target.value)} required /></label></div><label>Eircode / postcode<input value={postcode} onChange={(e) => setPostcode(e.target.value)} /></label><div className="cartTotal"><span>Total</span><strong>{euro(subtotal)}</strong></div><p className="privacyHint">No payment is taken during beta. This order will be stored in your ToolTrack account for testing.</p><button className="button primary large" disabled={submitting}>{submitting ? "Creating order…" : "Place beta order"}</button></form></div></div>}
  </div>;
}
