import { createFileRoute } from "@tanstack/react-router";
import { PromoPage } from "@/components/promo/PromoPage";

export const Route = createFileRoute("/promo/$slug")({
  component: () => {
    const { slug } = Route.useParams();
    return <PromoPage slug={slug} />;
  },
});
