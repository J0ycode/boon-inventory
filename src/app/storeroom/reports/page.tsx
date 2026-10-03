import type { Metadata } from "next";
import { ReportPage } from "@/features/reports/report-page";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Reports" };

export default async function Page({ searchParams }: PageProps<"/storeroom/reports">) {
  const session = await requireRole(["OWNER", "STOREROOM_MANAGER"]);
  return <ReportPage session={session} searchParams={await searchParams} />;
}