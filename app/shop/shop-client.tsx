"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ShieldIcon, ShopIcon } from "@/components/icons";
import {
  clearShopCart,
  readShopCart,
  setShopCartItem,
  SHOP_CART_EVENT,
  type ShopCart,
} from "@/lib/shop-cart";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import type { Profile, ShopProduct, ShopProductImage } from "@/lib/types";
import { friendlyError } from "@/lib/user-errors";

type CheckoutForm = {
  name: string;
  email: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  county: string;
  eircode: string;
  country: string;
};

const emptyCheckout: CheckoutForm = {
  name: "",
  email: "",
  phone: "",
  address1: "",
  address2: "",
  city: "",
  county: "",
  eircode: "",
  country: "Ireland",
};

function primaryImage(images?: ShopProductImage[]) {
  return [...(images ?? [])].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return a.sort_order - b.sort_order;
  })[0];
}

function productPrice(product: ShopProduct) {
  if (product.sale_price_cents !== null && product.sale_price_cents < product.price_cents) return product.sale_price_cents;
  return product.price_cents;
}

export default function ShopClient() {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [cart, setCart] = useState<ShopCart>({});
  const [checkout, setCheckout] = useState<CheckoutForm>(emptyCheckout);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [saveDelivery, setSaveDelivery] = useState(true);
  const [emailVerified, setEmailVerified] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const refreshCart = () => setCart(readShopCart());
    refreshCart();
    window.addEventListener(SHOP_CART_EVENT, refreshCart);
    window.addEventListener("storage", refreshCart);
    return () => {
      window.removeEventListener(SHOP_CART_EVENT, refreshCart);
      window.removeEventListener("storage", refreshCart);
    };
  }, []);

  useEffect(() => {
    void (async () => {
      const supabase = getSupabaseBrowser();
      const [{ data, error: productError }, { data: auth }] = await Promise.all([
        supabase.from("shop_products").select("*, shop_product_images(*)").eq("is_active", true).order("is_featured", { ascending: false }).order("name"),
        supabase.auth.getUser(),
      ]);
      if (productError) setError("The shop products could not be loaded.");
      else setProducts((data ?? []) as ShopProduct[]);

      if (auth.user) {
        const { data: profileData } = await supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
        const profile = profileData as Profile | null;
        setCheckout((current) => ({
          ...current,
          name: profile?.display_name?.trim() || profile?.business_name?.trim() || String(auth.user?.user_metadata?.full_name || "").trim(),
          email: auth.user?.email || "",
          phone: profile?.phone || "",
          address1: profile?.address_line1 || "",
          address2: profile?.address_line2 || "",
          city: profile?.city || "",
          county: profile?.county || "",
          eircode: profile?.eircode || "",
          country: profile?.country || "Ireland",
        }));
        setEmailVerified(Boolean(auth.user.email_confirmed_at));
      }
      setLoading(false);
    })();
  }, []);

  const items = useMemo(
    () => products.filter((product) => cart[product.id]).map((product) => ({ ...product, quantity: cart[product.id] })),
    [cart, products],
  );
  const itemCount = items.reduce((sum, product) => sum + product.quantity, 0);
  const total = items.reduce((sum, product) => sum + productPrice(product) * product.quantity, 0);

  function add(product: ShopProduct) {
    const next = Math.min(product.stock_quantity, (cart[product.id] ?? 0) + 1);
    setShopCartItem(product.id, next);
    setMessage(`${product.name} added to your basket.`);
    setError("");
  }

  function validateCheckout() {
    if (!checkout.name.trim()) return "Enter your name before placing the order.";
    if (!/^\S+@\S+\.\S+$/.test(checkout.email.trim())) return "Enter a valid email address.";
    if (!checkout.phone.trim()) return "Enter a contact phone number.";
    const phoneDigits = checkout.phone.replace(/\D/g, "");
    if (phoneDigits.length < 9 || phoneDigits.length > 15) return "Enter a valid contact phone number.";
    if (!checkout.address1.trim() || !checkout.city.trim() || !checkout.county.trim()) return "Complete the delivery address.";
    return "";
  }

  async function order(event: FormEvent) {
    event.preventDefault();
    const validation = validateCheckout();
    if (validation) {
      setError(validation);
      return;
    }
    setPlacing(true);
    setError("");
    setMessage("");

    try {
      const supabase = getSupabaseBrowser();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("SESSION_REQUIRED");

      if (!emailVerified) throw new Error("EMAIL_NOT_VERIFIED");

      const normalizedPhone = checkout.phone.trim().replace(/^0/, "+353").replace(/[\s()-]/g, "");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("SESSION_REQUIRED");

      const response = await fetch("/api/shop/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: items.map((product) => ({ productId: product.id, quantity: product.quantity })),
          contactName: checkout.name.trim(),
          contactEmail: checkout.email.trim().toLowerCase(),
          contactPhone: normalizedPhone,
          address1: checkout.address1.trim(),
          address2: checkout.address2.trim(),
          city: checkout.city.trim(),
          county: checkout.county.trim(),
          postcode: checkout.eircode.trim().toUpperCase(),
          country: checkout.country.trim() || "Ireland",
        }),
      });
      const orderData = await response.json().catch(() => null) as { order?: { order_number?: string }; error?: string; debug?: string } | null;
      if (!response.ok) throw new Error(orderData?.debug || orderData?.error || `Order API failed with HTTP ${response.status}.`);

      if (saveDelivery) {
        const { error: profileError } = await supabase.from("profiles").update({
          phone: normalizedPhone,
          address_line1: checkout.address1.trim(),
          address_line2: checkout.address2.trim() || null,
          city: checkout.city.trim(),
          county: checkout.county.trim(),
          eircode: checkout.eircode.trim().toUpperCase() || null,
          country: checkout.country.trim() || "Ireland",
        }).eq("id", auth.user.id);
        if (profileError) console.warn("Order created, but delivery details were not saved.", profileError);
      }

      clearShopCart();
      setCheckoutOpen(false);
      setMessage(`Order ${orderData?.order?.order_number || "created"} saved. We will contact you to confirm payment and delivery.`);
    } catch (caught) {
      const raw = caught instanceof Error ? caught.message : "";
      setError(
        raw === "SESSION_REQUIRED"
          ? "Sign in before placing an order."
          : raw === "EMAIL_NOT_VERIFIED"
            ? "Verify your email address before placing an order. Open Account to resend the verification email."
            : `Order failed: ${caught instanceof Error && caught.message ? caught.message : friendlyError(caught, "The order could not be created. Your basket has been kept; please try again.")}`
      );
    } finally {
      setPlacing(false);
    }
  }

  if (loading) return <div className="skeletonCard" />;

  return <>
    {message && <div className="notice success">{message}</div>}
    {error && <div className="notice danger">{error}</div>}
    {itemCount > 0 && <a className="mobileBasketButton" href="#basket"><ShopIcon /> Basket <span>{itemCount}</span></a>}
    <div className="shopLayout">
      <div className="productGrid">
        {products.map((product) => {
          const image = primaryImage(product.shop_product_images);
          const imageUrl = image ? getSupabaseBrowser().storage.from("shop-product-images").getPublicUrl(image.storage_path).data.publicUrl : null;
          const activePrice = productPrice(product);
          const onSale = activePrice < product.price_cents;
          return <article className="productCard" key={product.id}>
            <Link className="productImageLink" href={`/shop/products/${product.slug}`}>
              <div className="productVisual">
                {imageUrl ? <img src={imageUrl} alt={image?.alt_text || product.name} /> : <ShieldIcon />}
                {product.is_featured && <span className="productBadge">Featured</span>}
              </div>
            </Link>
            <div className="productCardBody simplifiedProductCardBody">
              <h2><Link href={`/shop/products/${product.slug}`}>{product.name}</Link></h2>
              <div className="productPriceRow"><strong>€{(activePrice / 100).toFixed(2)}</strong>{onSale && <del>€{(product.price_cents / 100).toFixed(2)}</del>}</div>
              {product.stock_quantity < 1 ? <small className="stockWarning">Out of stock</small> : product.stock_quantity <= 4 ? <small className="stockWarning">Only {product.stock_quantity} left</small> : null}
              <button className="button primary productAddButton" disabled={product.stock_quantity < 1} onClick={() => add(product)}>Add to basket</button>
            </div>
          </article>;
        })}
      </div>

      <aside className="cartCard" id="basket">
        <ShopIcon />
        <h2>Basket</h2>
        {items.length ? items.map((item) => <div className="cartItem" key={item.id}>
          <div><strong>{item.name}</strong><span>€{(productPrice(item) / 100).toFixed(2)} each</span></div>
          <div className="cartQuantity"><button aria-label={`Remove one ${item.name}`} onClick={() => setShopCartItem(item.id, item.quantity - 1)}>−</button><span>{item.quantity}</span><button aria-label={`Add one ${item.name}`} disabled={item.quantity >= item.stock_quantity} onClick={() => setShopCartItem(item.id, item.quantity + 1)}>+</button></div>
          <strong>€{(productPrice(item) * item.quantity / 100).toFixed(2)}</strong>
        </div>) : <p className="muted">Your basket is empty.</p>}
        <div className="cartTotal"><span>Total</span><strong>€{(total / 100).toFixed(2)}</strong></div>
        {!checkoutOpen ? <button className="button primary" disabled={!items.length} onClick={() => setCheckoutOpen(true)}>Continue to details</button> : <form className="checkoutForm formStack" onSubmit={order}>
          <h3>Contact & delivery</h3>
          <label>Name<input value={checkout.name} onChange={(event) => setCheckout({ ...checkout, name: event.target.value })} autoComplete="name" required /></label>
          <label>Email<input type="email" value={checkout.email} onChange={(event) => setCheckout({ ...checkout, email: event.target.value })} autoComplete="email" required /></label>
          <label>Phone<input value={checkout.phone} onChange={(event) => setCheckout({ ...checkout, phone: event.target.value })} inputMode="tel" autoComplete="tel" required /></label>
          <label>Address<input value={checkout.address1} onChange={(event) => setCheckout({ ...checkout, address1: event.target.value })} autoComplete="address-line1" required /></label>
          <label>Address line 2<input value={checkout.address2} onChange={(event) => setCheckout({ ...checkout, address2: event.target.value })} autoComplete="address-line2" /></label>
          <div className="formGrid two"><label>Town / city<input value={checkout.city} onChange={(event) => setCheckout({ ...checkout, city: event.target.value })} autoComplete="address-level2" required /></label><label>County<input value={checkout.county} onChange={(event) => setCheckout({ ...checkout, county: event.target.value })} autoComplete="address-level1" required /></label></div>
          <div className="formGrid two"><label>Eircode<input value={checkout.eircode} onChange={(event) => setCheckout({ ...checkout, eircode: event.target.value.toUpperCase() })} autoComplete="postal-code" /></label><label>Country<input value={checkout.country} onChange={(event) => setCheckout({ ...checkout, country: event.target.value })} autoComplete="country-name" /></label></div>
          <label className="checkoutSaveDetails"><input type="checkbox" checked={saveDelivery} onChange={(event) => setSaveDelivery(event.target.checked)} /> <span>Save these delivery details to my account</span></label>
          {!emailVerified && <div className="notice danger">Your email address must be verified before an order can be placed.</div>}
          <div className="checkoutActions"><button type="button" className="button secondary" onClick={() => setCheckoutOpen(false)}>Back</button><button className="button primary" disabled={placing || !emailVerified}>{placing ? "Creating order…" : "Send order request"}</button></div>
        </form>}
        <Link className="textLink" href="/account/orders">View my orders</Link>
        <small>Order request only — payment and delivery will be confirmed separately.</small>
      </aside>
    </div>
  </>;
}
