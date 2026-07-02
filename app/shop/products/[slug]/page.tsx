"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ShieldIcon, ShopIcon } from "@/components/icons";
import { addShopCartItem } from "@/lib/shop-cart";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import type { ShopProduct, ShopProductImage } from "@/lib/types";

function sortedImages(images?: ShopProductImage[]) {
  return [...(images ?? [])].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return a.sort_order - b.sort_order;
  });
}

function productPrice(product: ShopProduct) {
  return product.sale_price_cents !== null && product.sale_price_cents < product.price_cents
    ? product.sale_price_cents
    : product.price_cents;
}

function imageUrl(image: ShopProductImage) {
  return getSupabaseBrowser().storage.from("shop-product-images").getPublicUrl(image.storage_path).data.publicUrl;
}

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<ShopProduct | null>(null);
  const [related, setRelated] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const supabase = getSupabaseBrowser();
      const { data, error: loadError } = await supabase
        .from("shop_products")
        .select("*, shop_product_images(*)")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (loadError) {
        setError("This product could not be loaded.");
        setLoading(false);
        return;
      }

      const loadedProduct = data as ShopProduct | null;
      setProduct(loadedProduct);
      if (loadedProduct) {
        const { data: relatedData } = await supabase
          .from("shop_products")
          .select("*, shop_product_images(*)")
          .eq("is_active", true)
          .eq("category", loadedProduct.category)
          .neq("id", loadedProduct.id)
          .limit(3);
        setRelated((relatedData ?? []) as ShopProduct[]);
      }
      setLoading(false);
    })();
  }, [slug]);

  const images = useMemo(() => sortedImages(product?.shop_product_images), [product]);
  const imageUrls = images.map((image) => ({ ...image, url: imageUrl(image) }));
  const currentImage = selectedImage ?? imageUrls[0]?.url ?? null;

  if (loading) return <div className="pageWidth pagePad"><div className="skeletonCard" /></div>;
  if (!product) return <div className="pageWidth pagePad narrowPage"><div className="emptyPanel"><ShieldIcon /><h1>Product not found</h1><p>{error || "This product is no longer available."}</p><Link className="button primary" href="/shop">Return to shop</Link></div></div>;

  const currentProduct = product;
  const activePrice = productPrice(currentProduct);

  function addToBasket() {
    addShopCartItem(currentProduct.id, quantity);
    setMessage(`${quantity} × ${currentProduct.name} added to your basket.`);
  }

  return <div className="pageWidth pagePad productDetailPage">
    <Link className="backLink" href="/shop">← Shop</Link>
    {message && <div className="notice success">{message} <Link href="/shop#basket">View basket</Link></div>}
    <div className="productDetailGrid">
      <section className="productGallery">
        <div className="productMainImage">
          {currentImage ? <img src={currentImage} alt={currentProduct.name} /> : <ShieldIcon />}
        </div>
        {imageUrls.length > 1 && <div className="productThumbnails">
          {imageUrls.map((image) => <button type="button" key={image.id} className={currentImage === image.url ? "active" : ""} onClick={() => setSelectedImage(image.url)}>
            <img src={image.url} alt={image.alt_text || currentProduct.name} />
          </button>)}
        </div>}
      </section>
      <section className="productPurchasePanel">
        <span className="productCategory">{currentProduct.category}</span>
        <h1>{currentProduct.name}</h1>
        {(currentProduct.manufacturer || currentProduct.model) && <p className="productModel">{[currentProduct.manufacturer, currentProduct.model].filter(Boolean).join(" · ")}</p>}
        <p className="productLead">{currentProduct.description || "Useful equipment and accessories for everyday work."}</p>
        <div className="productDetailPrice">
          <strong>€{(activePrice / 100).toFixed(2)}</strong>
          {activePrice < currentProduct.price_cents && <del>€{(currentProduct.price_cents / 100).toFixed(2)}</del>}
        </div>
        <p className={`stockLine ${currentProduct.stock_quantity > 0 ? "inStock" : "outStock"}`}>{currentProduct.stock_quantity > 0 ? `${currentProduct.stock_quantity} available` : "Currently out of stock"}</p>
        <div className="productBuyRow">
          <label>Quantity<input type="number" min="1" max={Math.max(1, currentProduct.stock_quantity)} value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(currentProduct.stock_quantity || 1, Number(event.target.value) || 1)))} /></label>
          <button className="button primary" disabled={currentProduct.stock_quantity < 1} onClick={addToBasket}><ShopIcon /> Add to basket</button>
        </div>
        <dl className="productMeta">
          {currentProduct.sku && <><dt>SKU</dt><dd>{currentProduct.sku}</dd></>}
          {currentProduct.warranty && <><dt>Warranty</dt><dd>{currentProduct.warranty}</dd></>}
        </dl>
      </section>
    </div>

    <div className="productInfoGrid">
      <section className="cleanSection productInfoCard"><h2>Product details</h2><p>{currentProduct.full_description || currentProduct.description || "More product information will be added soon."}</p></section>
      <section className="cleanSection productInfoCard"><h2>Key features</h2>{currentProduct.features?.length ? <ul>{currentProduct.features.map((feature) => <li key={feature}>{feature}</li>)}</ul> : <p className="muted">No feature list has been added yet.</p>}</section>
      <section className="cleanSection productInfoCard productSpecs"><h2>Specifications</h2>{currentProduct.specifications && Object.keys(currentProduct.specifications).length ? <dl>{Object.entries(currentProduct.specifications).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl> : <p className="muted">No technical specifications have been added yet.</p>}</section>
    </div>

    {related.length > 0 && <section className="cleanSection relatedProducts"><div className="cleanSectionHeader"><div><h2>Related products</h2><p>More from {currentProduct.category}.</p></div></div><div className="relatedProductGrid">{related.map((item) => {
      const image = sortedImages(item.shop_product_images)[0];
      return <Link href={`/shop/products/${item.slug}`} key={item.id}><div className="relatedProductImage">{image ? <img src={imageUrl(image)} alt={image.alt_text || item.name} /> : <ShieldIcon />}</div><div><strong>{item.name}</strong><span>€{(productPrice(item) / 100).toFixed(2)}</span></div></Link>;
    })}</div></section>}
  </div>;
}
