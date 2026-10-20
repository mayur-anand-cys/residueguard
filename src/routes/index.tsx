import { createFileRoute } from "@tanstack/react-router";
import { ResidueGuard } from "@/components/residue-guard";

export const Route = createFileRoute("/")({ component: ResidueGuard });
