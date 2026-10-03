"use client";

/** Last-resort error screen when the root layout itself fails. Plain HTML: the app's styles may not have loaded. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 24, textAlign: "center", color: "#1f2929" }}>
        <h1 style={{ fontSize: 24, marginTop: 64 }}>Something went wrong</h1>
        <p style={{ color: "#5b6666" }}>
          The app couldn&apos;t load. Nothing was changed{error.digest ? ` (reference ${error.digest})` : ""}.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{ marginTop: 16, minHeight: 44, padding: "0 20px", borderRadius: 10, border: 0, background: "#2a8c86", color: "#fff", fontWeight: 700 }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
