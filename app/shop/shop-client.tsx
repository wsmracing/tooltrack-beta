"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ShieldIcon, ShopIcon } from "@/components/icons";
import {
  clearShopCart,
  readShopCart,
  setShopCartItem,
  SHOP_CART_EVENT,
  type ShopCart,
} from "@/lib/shop-cart";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import type { ShopProduct, ShopProductImage } from "@/lib/types";

function primaryImage(images?: ShopProductImage[]) {
  return [...(images ?? [])].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return a.sort_order - b.sort_order;
  })[0];
}

function productPrice(product: ShopProduct) {
  if (product.sale_price_cents !== null && product.sale_price_cents < product.price_cents) {
    return product.sale_price_cents;
  }
  return product.price_cents;
}

export default function ShopClient() {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [cart, setCart] = useState<ShopCart>({});
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
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
      const { data, error: productError } = await getSupabaseBrowser()
        .from("shop_products")
        .select("*, shop_product_images(*)")
        .eq("is_active", true)
        .order("is_featured", { ascending: false })
        .order("name");
      if (productError) setError(productError.message);
      else setProducts((data ?? []) as ShopProduct[]);
      setLoading(false);
    })();
  }, []);

  const items = useMemo(
    () => products.filter((product) => cart[product.id]).map((product) => ({ ...product, quantity: cart[product.id] })),
    [cart, products],
  );
  const total = items.reduce((sum, product) => sum + productPrice(product) * product.quantity, 0);

  function add(product: ShopProduct) {
    const next = Math.min(product.stock_quantity, (cart[product.id] ?? 0) + 1);
    setShopCartItem(product.id, next);
    setMessage(`${product.name} added to your basket.`);
    setError("");
  }

  async function order() {
    setPlacing(true);
    setError("");
    setMessage("");
    const supabase = getSupabaseBrowser();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setError("Sign in before placing a beta order.");
      setPlacing(false);
      return;
    }
    const { data: orderData, error: orderError } = await supabase
      .from("shop_orders")
      .insert({ user_id: auth.user.id, status: "pending", total_cents: total })
      .select("id")
      .single();
    if (orderError) {
      setError(orderError.message);
      setPlacing(false);
      return;
    }
    const { error: itemError } = await supabase.from("shop_order_items").insert(
      items.map((product) => ({
        order_id: orderData.id,
        product_id: product.id,
        product_name: product.name,
        quantity: product.quantity,
        unit_price_cents: productPrice(product),
      })),
    );
    if (itemError) setError(itemError.message);
    else {
      clearShopCart();
      setMessage("Beta order created. No payment was taken.");
    }
    setPlacing(false);
  }

  if (loading) return <div className="skeletonCard" />;

  return <>
    {message && <div className="notice success">{message}</div>}
    {error && <div className="notice danger">{error}</div>}
    <div className="shopLayout">
      <div className="productGrid">
        {products.map((product) => {
          const image = primaryImage(product.shop_product_images);
          const imageUrl = image
            ? getSupabaseBrowser().storage.from("shop-product-images").getPublicUrl(image.storage_path).data.publicUrl
            : null;
          const activePrice = productPrice(product);
          const onSale = activePrice < product.price_cents;
          return <article className="productCard" key={product.id}>
            <Link className="productImageLink" href={`/shop/products/${product.slug}`}>
              <div className="productVisual">
                {imageUrl ? <img src={imageUrl} alt={image?.alt_text || product.name} /> : <ShieldIcon />}
                {product.is_featured && <span className="productBadge">Featured</span>}
              </div>
            </Link>
            <div className="productCardBody">
              <span className="productCategory">{product.category}</span>
              <h2><Link href={`/shop/products/${product.slug}`}>{product.name}</Link></h2>
              <p>{product.description || "Security and asset protection product."}</p>
              <div className="productPriceRow">
                <strong>€{(activePrice / 100).toFixed(2)}</strong>
                {onSale && <del>€{(product.price_cents / 100).toFixed(2)}</del>}
              </div>
              <small>{product.stock_quantity > 0 ? `${product.stock_quantity} in stock` : "Out of stock"}</small>
              <div className="productCardActions">
                <Link className="button secondary" href={`/shop/products/${product.slug}`}>View details</Link>
                <button className="button primary" disabled={product.stock_quantity < 1} onClick={() => add(product)}>Add</button>
              </div>
            </div>
          </article>;
        })}
      </div>
      <aside className="cartCard" id="basket">
        <ShopIcon />
        <h2>Basket</h2>
        {items.length ? items.map((item) => <div className="cartItem" key={item.id}>
          <div><strong>{item.name}</strong><span>€{(productPrice(item) / 100).toFixed(2)} each</span></div>
          <div className="cartQuantity">
            <button aria-label={`Remove one ${item.name}`} onClick={() => setShopCartItem(item.id, item.quantity - 1)}>−</button>
            <span>{item.quantity}</span>
            <button aria-label={`Add one ${item.name}`} disabled={item.quantity >= item.stock_quantity} onClick={() => setShopCartItem(item.id, item.quantity + 1)}>+</button>
          </div>
          <strong>€{(productPrice(item) * item.quantity / 100).toFixed(2)}</strong>
        </div>) : <p className="muted">Your basket is empty.</p>}
        <div className="cartTotal"><span>Total</span><strong>€{(total / 100).toFixed(2)}</strong></div>
        <button className="button primary" disabled={!items.length || placing} onClick={() => void order()}>{placing ? "Creating order…" : "Place beta order"}</button>
        <Link className="textLink" href="/account/orders">View my orders</Link>
        <small>No payment is taken during prototype testing.</small>
      </aside>
    </div>
  </>;
}
