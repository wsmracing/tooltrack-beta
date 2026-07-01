export const SHOP_CART_KEY = "tooltrack-shop-cart-v1";
export const SHOP_CART_EVENT = "tooltrack-cart-change";

export type ShopCart = Record<string, number>;

export function readShopCart(): ShopCart {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SHOP_CART_KEY) ?? "{}") as ShopCart;
    return Object.fromEntries(
      Object.entries(parsed).filter(([, quantity]) => Number.isFinite(quantity) && quantity > 0),
    );
  } catch {
    return {};
  }
}

export function writeShopCart(cart: ShopCart) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SHOP_CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new CustomEvent(SHOP_CART_EVENT));
}

export function addShopCartItem(productId: string, quantity = 1) {
  const cart = readShopCart();
  cart[productId] = Math.max(1, (cart[productId] ?? 0) + quantity);
  writeShopCart(cart);
}

export function setShopCartItem(productId: string, quantity: number) {
  const cart = readShopCart();
  if (quantity <= 0) delete cart[productId];
  else cart[productId] = quantity;
  writeShopCart(cart);
}

export function clearShopCart() {
  writeShopCart({});
}
