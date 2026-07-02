export function friendlyError(error: unknown, fallback: string) {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const message = raw.toLowerCase();

  if (message.includes("contact_name") || message.includes("contact_email")) {
    return "Add your contact details before placing the order.";
  }
  if (message.includes("shop_orders_status_check") || message.includes("check constraint")) {
    return "That order status could not be saved. Refresh the page and try again.";
  }
  if (message.includes("duplicate") || message.includes("unique constraint")) {
    return "A record with those details already exists.";
  }
  if (message.includes("row-level security") || message.includes("permission denied")) {
    return "You do not have permission to complete that action.";
  }
  if (message.includes("jwt") || message.includes("session") || message.includes("not authenticated")) {
    return "Your session has expired. Sign in again and retry.";
  }
  if (message.includes("network") || message.includes("fetch")) {
    return "ToolTrack could not connect. Check your connection and try again.";
  }
  return fallback;
}
