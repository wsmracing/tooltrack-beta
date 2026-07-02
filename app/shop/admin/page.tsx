"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { ShieldIcon, ShopIcon, UploadIcon } from "@/components/icons";
import { safeFileName } from "@/lib/normalise";
import { friendlyError } from "@/lib/user-errors";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import type {
  ShopOrder,
  ShopOrderStatus,
  ShopProduct,
  ShopProductImage,
} from "@/lib/types";

type ProductForm = {
  name: string;
  slug: string;
  sku: string;
  category: string;
  manufacturer: string;
  model: string;
  warranty: string;
  description: string;
  fullDescription: string;
  features: string;
  specifications: string;
  price: string;
  salePrice: string;
  stock: string;
  active: boolean;
  featured: boolean;
};

const blank: ProductForm = {
  name: "",
  slug: "",
  sku: "",
  category: "Accessories",
  manufacturer: "",
  model: "",
  warranty: "",
  description: "",
  fullDescription: "",
  features: "",
  specifications: "",
  price: "",
  salePrice: "",
  stock: "0",
  active: true,
  featured: false,
};

const orderStatuses: Array<{ value: ShopOrderStatus; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "dispatched", label: "Dispatched" },
  { value: "delivered", label: "Delivered" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseFeatures(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim().replace(/^[-•]\s*/, ""))
    .filter(Boolean);
}

function parseSpecifications(value: string) {
  return Object.fromEntries(
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf(":");
        if (separator < 1) return [line, ""];
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
      }),
  );
}

function specificationsText(value: Record<string, string> | null) {
  if (!value) return "";
  return Object.entries(value)
    .map(([key, item]) => `${key}: ${item}`)
    .join("\n");
}

function publicImageUrl(path: string) {
  return getSupabaseBrowser().storage.from("shop-product-images").getPublicUrl(path).data.publicUrl;
}

export default function ShopAdminPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [form, setForm] = useState<ProductForm>(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<"products" | "orders">("products");
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);

  const editedProduct = useMemo(
    () => products.find((product) => product.id === editing) ?? null,
    [editing, products],
  );

  async function load() {
    const supabase = getSupabaseBrowser();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setAllowed(false);
      return;
    }

    const { data: admin } = await supabase
      .from("platform_admins")
      .select("role")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (!admin) {
      setAllowed(false);
      return;
    }

    setAllowed(true);
    const [productResponse, orderResponse] = await Promise.all([
      supabase
        .from("shop_products")
        .select("*, shop_product_images(*)")
        .order("is_featured", { ascending: false })
        .order("name"),
      supabase
        .from("shop_orders")
        .select("*, shop_order_items(*)")
        .order("created_at", { ascending: false }),
    ]);

    if (productResponse.error) setError(friendlyError(productResponse.error, "Products could not be loaded."));
    else setProducts((productResponse.data ?? []) as ShopProduct[]);
    if (orderResponse.error) setError(friendlyError(orderResponse.error, "Orders could not be loaded."));
    else setOrders((orderResponse.data ?? []) as ShopOrder[]);
  }

  useEffect(() => {
    void load();
  }, []);

  function resetForm() {
    setEditing(null);
    setForm(blank);
    setPendingImages([]);
  }

  function edit(product: ShopProduct) {
    setEditing(product.id);
    setForm({
      name: product.name,
      slug: product.slug,
      sku: product.sku ?? "",
      category: product.category,
      manufacturer: product.manufacturer ?? "",
      model: product.model ?? "",
      warranty: product.warranty ?? "",
      description: product.description ?? "",
      fullDescription: product.full_description ?? "",
      features: (product.features ?? []).join("\n"),
      specifications: specificationsText(product.specifications),
      price: String(product.price_cents / 100),
      salePrice:
        product.sale_price_cents === null || product.sale_price_cents === undefined
          ? ""
          : String(product.sale_price_cents / 100),
      stock: String(product.stock_quantity),
      active: product.is_active,
      featured: product.is_featured,
    });
    setPendingImages([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const valid = files.filter(
      (file) => file.type.startsWith("image/") && file.size <= 8 * 1024 * 1024,
    );
    if (valid.length !== files.length) {
      setError("Only image files up to 8 MB can be uploaded.");
    } else {
      setError("");
    }
    setPendingImages((current) => [...current, ...valid].slice(0, 12));
    event.target.value = "";
  }

  async function uploadImages(productId: string, existingCount: number) {
    if (!pendingImages.length) return;
    const supabase = getSupabaseBrowser();

    for (let index = 0; index < pendingImages.length; index += 1) {
      const file = pendingImages[index];
      const path = `${productId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from("shop-product-images")
        .upload(path, file, {
          upsert: false,
          cacheControl: "3600",
          contentType: file.type,
        });
      if (uploadError) throw uploadError;

      const { error: rowError } = await supabase.from("shop_product_images").insert({
        product_id: productId,
        storage_path: path,
        alt_text: form.name.trim(),
        sort_order: existingCount + index,
        is_primary: existingCount === 0 && index === 0,
      });
      if (rowError) throw rowError;
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const name = form.name.trim();
      const price = Number(form.price);
      if (!name) throw new Error("Product name is required.");
      if (!Number.isFinite(price) || price < 0) throw new Error("Enter a valid product price.");

      const supabase = getSupabaseBrowser();
      const { data: duplicates, error: duplicateError } = await supabase
        .from("shop_products")
        .select("id")
        .ilike("name", name);
      if (duplicateError) throw duplicateError;
      if ((duplicates ?? []).some((item) => item.id !== editing)) {
        throw new Error("A shop product with this name already exists.");
      }

      const payload: Record<string, unknown> = {
        name,
        slug: slugify(form.slug || name),
        description: form.description.trim() || null,
        full_description: form.fullDescription.trim() || null,
        category: form.category.trim() || "Accessories",
        manufacturer: form.manufacturer.trim() || null,
        model: form.model.trim() || null,
        warranty: form.warranty.trim() || null,
        features: parseFeatures(form.features),
        specifications: parseSpecifications(form.specifications),
        price_cents: Math.round(price * 100),
        sale_price_cents: form.salePrice.trim()
          ? Math.round(Number(form.salePrice) * 100)
          : null,
        stock_quantity: Math.max(0, Number(form.stock) || 0),
        is_active: form.active,
        is_featured: form.featured,
        updated_at: new Date().toISOString(),
      };
      if (form.sku.trim()) payload.sku = form.sku.trim().toUpperCase();

      const response = editing
        ? await supabase
            .from("shop_products")
            .update(payload)
            .eq("id", editing)
            .select("id")
            .single()
        : await supabase.from("shop_products").insert(payload).select("id").single();
      if (response.error) throw response.error;

      const existingCount = editedProduct?.shop_product_images?.length ?? 0;
      await uploadImages(response.data.id as string, existingCount);
      setMessage(editing ? "Product updated." : "Product created.");
      resetForm();
      await load();
    } catch (caught) {
      setError(friendlyError(caught, "The product could not be saved. Check the details and try again."));
    } finally {
      setSaving(false);
    }
  }

  async function deleteImage(image: ShopProductImage) {
    if (!window.confirm("Delete this product image?")) return;
    setError("");
    const supabase = getSupabaseBrowser();
    const storageResult = await supabase.storage
      .from("shop-product-images")
      .remove([image.storage_path]);
    if (storageResult.error) {
      setError(friendlyError(storageResult.error, "The image could not be deleted."));
      return;
    }
    const { error: rowError } = await supabase
      .from("shop_product_images")
      .delete()
      .eq("id", image.id);
    if (rowError) setError(friendlyError(rowError, "The image record could not be updated."));
    else {
      setMessage("Product image deleted.");
      await load();
    }
  }

  async function setPrimary(image: ShopProductImage) {
    const supabase = getSupabaseBrowser();
    setError("");
    const { error: clearError } = await supabase
      .from("shop_product_images")
      .update({ is_primary: false })
      .eq("product_id", image.product_id);
    if (clearError) {
      setError(friendlyError(clearError, "The main image could not be changed."));
      return;
    }
    const { error: updateError } = await supabase
      .from("shop_product_images")
      .update({ is_primary: true })
      .eq("id", image.id);
    if (updateError) setError(friendlyError(updateError, "The main image could not be changed."));
    else {
      setMessage("Main product image updated.");
      await load();
    }
  }

  async function moveImage(image: ShopProductImage, direction: -1 | 1) {
    const images = [...(editedProduct?.shop_product_images ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    const currentIndex = images.findIndex((item) => item.id === image.id);
    const target = images[currentIndex + direction];
    if (!target) return;

    const supabase = getSupabaseBrowser();
    const first = await supabase
      .from("shop_product_images")
      .update({ sort_order: target.sort_order })
      .eq("id", image.id);
    const second = await supabase
      .from("shop_product_images")
      .update({ sort_order: image.sort_order })
      .eq("id", target.id);
    if (first.error || second.error) setError(friendlyError(first.error || second.error, "The product images could not be reordered."));
    else await load();
  }

  async function updateStatus(id: string, value: ShopOrderStatus) {
    const previous = orders.find((order) => order.id === id)?.status;
    setUpdatingOrder(id);
    setError("");
    setMessage("");
    setOrders((current) => current.map((order) => order.id === id ? { ...order, status: value } : order));

    const supabase = getSupabaseBrowser();
    const { data: auth } = await supabase.auth.getUser();
    const { error: updateError } = await supabase
      .from("shop_orders")
      .update({
        status: value,
        status_updated_at: new Date().toISOString(),
        status_updated_by: auth.user?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      if (previous) setOrders((current) => current.map((order) => order.id === id ? { ...order, status: previous } : order));
      setError(friendlyError(updateError, "The order status could not be saved. Refresh and try again."));
    } else {
      setMessage(`Order marked ${orderStatuses.find((item) => item.value === value)?.label ?? value}.`);
      await load();
    }
    setUpdatingOrder(null);
  }

  if (allowed === null) {
    return <div className="pageWidth pagePad"><div className="skeletonCard" /></div>;
  }
  if (!allowed) {
    return <div className="pageWidth pagePad narrowPage"><div className="emptyPanel"><ShieldIcon /><h1>Shop administrator access required</h1><p>This area is restricted to ToolTrack platform administrators.</p><Link className="button primary" href="/shop">Return to shop</Link></div></div>;
  }

  const currentImages = [...(editedProduct?.shop_product_images ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  return <div className="pageWidth pagePad shopAdminPage v44ShopAdmin">
    <div className="sectionTitleRow"><div><p className="eyebrow red">Platform administration</p><h1>Shop administration</h1><p className="muted">Manage products, images and customer orders.</p></div><ShopIcon /></div>
    {message && <div className="notice success">{message}</div>}
    {error && <div className="notice danger">{error}</div>}

    <nav className="adminTabs" aria-label="Shop administration sections">
      <button className={tab === "products" ? "active" : ""} onClick={() => setTab("products")}>Products</button>
      <button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}>Orders <span>{orders.length}</span></button>
    </nav>

    {tab === "products" && <div className="shopAdminLayout">
      <form className="settingsCard formStack shopProductEditor" onSubmit={save}>
        <div className="cleanSectionHeader"><div><h2>{editing ? "Edit product" : "Add product"}</h2><p>Use clear details and real product photos.</p></div>{editing && <button type="button" className="textButton" onClick={resetForm}>New product</button>}</div>
        <div className="formGrid two"><label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label><label>Slug<input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="auto-created-from-name" /></label></div>
        <div className="formGrid two"><label>SKU<input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} placeholder="Auto-generated if blank" /></label><label>Category<input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label></div>
        <div className="formGrid two"><label>Manufacturer<input value={form.manufacturer} onChange={(event) => setForm({ ...form, manufacturer: event.target.value })} /></label><label>Model<input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} /></label></div>
        <label>Short description<textarea rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Shown on the shop card" /></label>
        <label>Full description<textarea rows={5} value={form.fullDescription} onChange={(event) => setForm({ ...form, fullDescription: event.target.value })} placeholder="Detailed product information" /></label>
        <div className="formGrid two"><label>Features — one per line<textarea rows={5} value={form.features} onChange={(event) => setForm({ ...form, features: event.target.value })} placeholder={"Weather resistant\nEasy to fit\nSuitable for daily use"} /></label><label>Specifications — Key: Value<textarea rows={5} value={form.specifications} onChange={(event) => setForm({ ...form, specifications: event.target.value })} placeholder={"Colour: Black\nMaterial: Steel\nWeight: 1.2 kg"} /></label></div>
        <div className="formGrid three"><label>Price (€)<input type="number" step="0.01" min="0" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required /></label><label>Sale price (€)<input type="number" step="0.01" min="0" value={form.salePrice} onChange={(event) => setForm({ ...form, salePrice: event.target.value })} placeholder="Optional" /></label><label>Stock<input type="number" min="0" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} /></label></div>
        <label>Warranty<input value={form.warranty} onChange={(event) => setForm({ ...form, warranty: event.target.value })} placeholder="e.g. 2 years" /></label>

        <section className="adminImageSection"><div><strong>Product images</strong><small>Main image first, followed by gallery images.</small></div><label className="button secondary fileButton"><UploadIcon /> Add images<input type="file" accept="image/*" multiple onChange={selectImages} /></label></section>
        {currentImages.length > 0 && <div className="adminImageGrid">{currentImages.map((image, index) => <article key={image.id}><img src={publicImageUrl(image.storage_path)} alt={image.alt_text || form.name} /><div><span>{image.is_primary ? "Main image" : `Gallery ${index + 1}`}</span><div className="imageAdminActions"><button type="button" disabled={index === 0} onClick={() => void moveImage(image, -1)}>←</button><button type="button" disabled={index === currentImages.length - 1} onClick={() => void moveImage(image, 1)}>→</button>{!image.is_primary && <button type="button" onClick={() => void setPrimary(image)}>Make main</button>}<button type="button" className="dangerText" onClick={() => void deleteImage(image)}>Delete</button></div></div></article>)}</div>}
        {pendingImages.length > 0 && <div className="pendingImageGrid">{pendingImages.map((file, index) => <article key={`${file.name}-${file.lastModified}-${index}`}><img src={URL.createObjectURL(file)} alt="Pending upload preview" /><span>{file.name}</span><button type="button" onClick={() => setPendingImages((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></article>)}</div>}

        <div className="toggleStack"><label className="toggleRow"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /><span><strong>Visible in the shop</strong><small>Hidden products stay in admin but cannot be purchased.</small></span></label><label className="toggleRow"><input type="checkbox" checked={form.featured} onChange={(event) => setForm({ ...form, featured: event.target.checked })} /><span><strong>Featured product</strong><small>Featured items appear first.</small></span></label></div>
        <div className="cleanFormActions"><button type="button" className="button secondary" onClick={resetForm}>Clear</button><button className="button primary" disabled={saving}>{saving ? "Saving…" : "Save product"}</button></div>
      </form>

      <section className="cleanSection adminProductPanel"><div className="cleanSectionHeader"><div><h2>Products</h2><p>{products.length} products</p></div><button className="button secondary" onClick={resetForm}>Add product</button></div><div className="adminProductList detailed">
        {products.map((product) => { const images = [...(product.shop_product_images ?? [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order); const image = images[0]; return <article key={product.id}><div className="adminProductThumb">{image ? <img src={publicImageUrl(image.storage_path)} alt={image.alt_text || product.name} /> : <ShieldIcon />}</div><div><strong>{product.name}</strong><span>{product.category} · €{(product.price_cents / 100).toFixed(2)} · {product.stock_quantity} stock</span><small>{images.length} image{images.length === 1 ? "" : "s"}</small></div><span className={`status ${product.is_active ? "safe" : "transfer"}`}>{product.is_active ? "active" : "hidden"}</span><button onClick={() => edit(product)}>Edit</button></article>; })}
      </div></section>
    </div>}

    {tab === "orders" && <section className="cleanSection adminOrdersPanel"><div className="cleanSectionHeader"><div><h2>Orders</h2><p>Customer details and fulfilment status.</p></div></div><div className="adminOrderList detailedOrders">
      {orders.length ? orders.map((order) => <article key={order.id}>
        <div className="adminOrderSummary"><strong>{order.order_number || order.id.slice(0, 8).toUpperCase()}</strong><span>{order.contact_name || "Customer"} · €{(order.total_cents / 100).toFixed(2)}</span><small>{new Date(order.created_at).toLocaleString("en-IE")}</small></div>
        <div className="adminOrderContact"><span>{order.contact_email || "No email"}</span><span>{order.contact_phone || "No phone"}</span></div>
        <select value={order.status} disabled={updatingOrder === order.id} onChange={(event) => void updateStatus(order.id, event.target.value as ShopOrderStatus)}>{orderStatuses.map((status) => <option value={status.value} key={status.value}>{status.label}</option>)}</select>
      </article>) : <p className="muted">No orders yet.</p>}
    </div></section>}
  </div>;
}