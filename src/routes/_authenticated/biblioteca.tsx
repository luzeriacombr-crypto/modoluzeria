import { createFileRoute } from "@tanstack/react-router";
import { ReferenceLibraryPage } from "@/components/luzeria/ReferenceLibraryPage";

export const Route = createFileRoute("/_authenticated/biblioteca")({
  component: ReferenceLibraryPage,
  ssr: false,
});
