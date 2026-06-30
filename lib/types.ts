export type AssetStatus = "safe" | "stolen" | "recovered" | "transfer";

export interface Asset {
  id: string;
  owner_id: string;
  make: string;
  model: string;
  category: string;
  serial_original: string;
  serial_normalized: string;
  secondary_identifier: string | null;
  colour: string | null;
  storage_location: string | null;
  estimated_value: number | null;
  supplier: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  invoice_number: string | null;
  security_id: string | null;
  status: AssetStatus;
  registered_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  display_name: string | null;
  business_name: string | null;
  account_type: "individual" | "tradesperson" | "business";
  email_sighting_notifications: boolean;
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
