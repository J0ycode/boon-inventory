import { Hourglass } from "lucide-react";
import { EmptyState } from "./empty-state";
import { PageHeader } from "./page-header";

/** Temporary body for screens that are built in a later phase. Delete each usage when its screen lands. */
export function PlannedScreen({ title, description, phase }: { title: string; description: string; phase: number }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <EmptyState icon={Hourglass} title="Not built yet" description={`This screen is delivered in phase ${phase}.`} />
    </>
  );
}
