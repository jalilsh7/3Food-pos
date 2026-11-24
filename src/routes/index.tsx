import { createFileRoute } from "@tanstack/react-router";
import { GrillApp } from "@/features/pos/app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <GrillApp />;
}
