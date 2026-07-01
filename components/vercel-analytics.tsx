"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

/**
 * Keep Vercel Web Analytics enabled while removing query strings and hashes.
 * Invitation/transfer tokens must never be sent as analytics URLs.
 */
export function ToolTrackAnalytics() {
  return (
    <Analytics
      beforeSend={(event: BeforeSendEvent) => ({
        ...event,
        url: event.url.split(/[?#]/, 1)[0],
      })}
    />
  );
}
