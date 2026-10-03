import { execSync } from "node:child_process";

/**
 * Starts every E2E run from the seeded demo data so results don't depend on earlier runs.
 * Set E2E_NO_RESET=1 to keep the current local data (e.g. while exploring the app by hand).
 */
export default function globalSetup() {
  if (process.env.E2E_NO_RESET === "1") return;
  execSync("supabase db reset", { stdio: "ignore", timeout: 180_000 });
}
