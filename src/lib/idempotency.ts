"use client";

import { useCallback, useState } from "react";

/**
 * One idempotency key per attempt at a stock action. The key is created when the form mounts and sent with every
 * retry of the same submission, so a double tap or a retry after a dropped connection never applies twice.
 * Call `renew()` after a successful submit to start a fresh document.
 */
export function useIdempotencyKey() {
  const [key, setKey] = useState(() => crypto.randomUUID());
  const renew = useCallback(() => setKey(crypto.randomUUID()), []);
  return [key, renew] as const;
}
