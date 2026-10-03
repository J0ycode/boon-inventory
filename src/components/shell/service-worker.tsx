"use client";

import { useEffect } from "react";

/** Registers /sw.js in production builds only (a service worker in dev caches stale bundles). */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Not fatal: the app works the same without it, just without the offline page.
    });
  }, []);
  return null;
}
