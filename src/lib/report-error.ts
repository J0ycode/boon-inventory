/**
 * The one place errors are reported. Always logs; when ERROR_WEBHOOK_URL is set (server only) it also POSTs a small
 * JSON payload there — point it at Sentry (via a relay), Slack, Better Stack, a Google Chat webhook, etc.
 * Never include passwords, API keys or customer data in `context`.
 */
export async function reportError(error: unknown, context: Record<string, unknown> = {}): Promise<void> {
  const err = error instanceof Error ? error : new Error(String(error));
  const payload = {
    app: "boonbaby-store-manager",
    environment: process.env.NODE_ENV,
    message: err.message,
    name: err.name,
    digest: (err as Error & { digest?: string }).digest,
    stack: err.stack?.split("\n").slice(0, 12).join("\n"),
    time: new Date().toISOString(),
    ...context,
  };
  console.error("[reportError]", payload);

  const url = typeof window === "undefined" ? process.env.ERROR_WEBHOOK_URL : undefined;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: `BoonBaby error: ${payload.message}`, ...payload }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Reporting must never break the request that failed.
  }
}
