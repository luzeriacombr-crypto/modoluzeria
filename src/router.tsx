import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { LuzeriaLoader } from "./components/luzeria/LuzeriaLoader";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 2 * 60 * 1000, // 2 min: don't refetch on every navigation
        gcTime: 10 * 60 * 1000,   // keep unused data 10 min
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: () => <LuzeriaLoader fullScreen={false} />,
    defaultPendingMs: 300,
  });

  return router;
};
