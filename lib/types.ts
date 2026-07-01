import type { AccountType, PlanTier } from "@/lib/plans";

export type AssetStatus = "safe" | "stolen" | "recovered" | "transfer";

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
  registered_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  display_name: string | null;
  business_name: string | null;
  phone: string | null;
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

export interface PublicLookupResult {
  found: boolean;
  status: AssetStatus | "none";
  make?: string;
  model?: string;
  category?: string;
  serialMasked?: string;
  registeredAt?: string;
  reportedAt?: string;
  locationArea?: string;
  publicReference?: string;
  message: string;
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
  community_count?: number;
  verification_status?: "verified" | "community" | "review";
}

export interface ShopProduct {
  id: string;
  sku: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  price_cents: number;
  compare_at_price_cents: number | null;
  currency: string;
  stock_quantity: number;
  image_url: string | null;
  active: boolean;
  featured: boolean;
}

export interface ShopOrder {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  currency: string;
  created_at: string;
}

