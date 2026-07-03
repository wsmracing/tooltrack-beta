import type { AccountType, PlanTier } from "@/lib/plans";

export type AssetStatus = "safe" | "stolen" | "recovered" | "transfer";
export type MarketStatus = "not_for_sale" | "for_sale" | "disputed";
export type VerificationLevel = "registered" | "evidence_supplied" | "retailer_verified" | "transfer_history" | "disputed";

export interface Asset {
  id: string;
  owner_id: string;
  organization_id: string | null;
  make: string;
  model: string;
  category: string;
  serial_original: string;
  serial_normalized: string;
  secondary_identifier: string | null;
  colour: string | null;
  storage_location: string | null;
  location_id: string | null;
  estimated_value: number | null;
  supplier: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  invoice_number: string | null;
  security_id: string | null;
  notes: string | null;
  catalogue_item_id: string | null;
  product_barcode: string | null;
  status: AssetStatus;
  market_status?: MarketStatus | null;
  sale_expires_at?: string | null;
  verification_level?: VerificationLevel | null;
  registered_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  display_name: string | null;
  business_name: string | null;
  phone: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  county?: string | null;
  eircode?: string | null;
  country?: string | null;
  account_type: AccountType;
  plan_tier: PlanTier;
  active_organization_id: string | null;
  email_sighting_notifications: boolean;
  email_team_notifications: boolean;
  created_at: string;
}

export interface Organization {
  id: string;
  owner_id: string;
  name: string;
  account_type: AccountType;
  plan_tier: PlanTier;
  created_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: "owner" | "admin" | "editor" | "viewer";
  status: "active" | "disabled";
  created_at: string;
  profiles?: { display_name: string | null } | null;
}

export interface TeamInvitation {
  id: string;
  organization_id: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  token: string;
  status: "pending" | "accepted" | "expired" | "cancelled";
  expires_at: string;
  created_at: string;
}

export interface AssetLocation {
  id: string;
  owner_id: string;
  organization_id: string | null;
  name: string;
  location_type: string | null;
  notes: string | null;
  is_default: boolean;
  created_at: string;
}

export interface AssetAuditEntry {
  id: string;
  asset_id: string;
  actor_id: string | null;
  action: string;
  changes: Record<string, unknown> | null;
  created_at: string;
}

export interface OwnershipTransfer {
  id: string;
  asset_id: string;
  from_owner_id: string;
  recipient_email: string | null;
  transfer_code: string;
  status: "pending" | "accepted" | "cancelled" | "expired";
  expires_at: string;
  created_at: string;
}

export interface Sighting {
  id: string;
  asset_id: string;
  theft_report_id: string;
  reporter_email: string | null;
  location_area: string;
  listing_url: string | null;
  source_platform?: string | null;
  seller_username?: string | null;
  listing_title?: string | null;
  asking_price_cents?: number | null;
  details: string;
  status: "new" | "reviewed" | "dismissed";
  notification_status: "pending" | "sent" | "skipped" | "failed";
  notification_sent_at: string | null;
  notification_provider_id?: string | null;
  created_at: string;
  assets?: {
    make: string;
    model: string;
    serial_original: string;
  } | null;
}

export type PublicLookupState = "none" | "registered" | "for_sale" | "transfer_pending" | "stolen" | "recovered" | "disputed";

export interface PublicLookupResult {
  found: boolean;
  status: AssetStatus | "none";
  lookupState: PublicLookupState;
  make?: string;
  model?: string;
  category?: string;
  serialMasked?: string;
  registeredAt?: string;
  marketStatus?: MarketStatus;
  saleExpiresAt?: string;
  verificationLevel?: VerificationLevel;
  reportedAt?: string;
  locationArea?: string;
  publicReference?: string;
  message: string;
  ownedByCurrentUser?: boolean;
  assetId?: string;
}

export interface CatalogueItem {
  id: string;
  catalogue_key: string;
  make: string;
  model: string;
  category: string;
  manufacturer_part_number: string | null;
  gtin: string | null;
  power_type: string | null;
  voltage: string | null;
  source: string;
}


export interface ShopProductImage {
  id: string;
  product_id: string;
  storage_path: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
}

export interface ShopProduct {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  description: string | null;
  full_description: string | null;
  category: string;
  manufacturer: string | null;
  model: string | null;
  warranty: string | null;
  features: string[] | null;
  specifications: Record<string, string> | null;
  price_cents: number;
  sale_price_cents: number | null;
  stock_quantity: number;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  shop_product_images?: ShopProductImage[];
}

export interface ShopOrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents?: number;
}

export type ShopOrderStatus =
  | "pending"
  | "processing"
  | "dispatched"
  | "delivered"
  | "completed"
  | "cancelled";

export interface ShopOrder {
  id: string;
  order_number?: string | null;
  user_id: string;
  status: ShopOrderStatus;
  payment_status?: string | null;
  subtotal_cents?: number;
  delivery_cents?: number;
  total_cents: number;
  currency?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  delivery_address?: Record<string, string | null> | null;
  notes?: string | null;
  status_updated_at: string | null;
  status_updated_by: string | null;
  created_at: string;
  updated_at: string;
  shop_order_items?: ShopOrderItem[];
}

export interface PlatformAdmin {
  user_id: string;
  role: "admin" | "super_admin";
  created_at: string;
}

export interface SellerConfirmationChallenge {
  id: string;
  public_token: string;
  asset_id: string;
  status: "pending" | "confirmed" | "expired";
  expires_at: string;
  confirmed_at: string | null;
  created_at: string;
}
