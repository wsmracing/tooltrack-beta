"use client";

import { useEffect, useState } from "react";

export function PwaRegister() {
  const [updateReady, setUpdateReady] = useState(false);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let registration: ServiceWorkerRegistration | undefined;
    void navigator.serviceWorker.register("/sw.js").then((value) => {
      registration = value;
      void registration.update();
      if (registration.waiting) setUpdateReady(true);
      registration.addEventListener("updatefound", () => {
        const worker = registration?.installing;
        worker?.addEventListener("statechange", () => { if (worker.state === "installed" && navigator.serviceWorker.controller) setUpdateReady(true); });
      });
    }).catch(() => undefined);
    const interval = window.setInterval(() => { void registration?.update(); }, 60_000);
    return () => window.clearInterval(interval);
  }, []);
  if (!updateReady) return null;
  return <button className="updateBanner" type="button" onClick={() => window.location.reload()}>A new ToolTrack version is ready — refresh</button>;
}
