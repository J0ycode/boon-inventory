import type { Metadata } from "next";
import { ReportPage } from "@/features/reports/report-page";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Reports" };

export default async function Page({ searchParams }: PageProps<"/owner/reports">) {
  const session = await requireRole(["OWNER"]);
  return <ReportPage session={session} searchParams={await searchParams} />;
}