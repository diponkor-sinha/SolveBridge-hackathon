import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { getRouter } from "@/router";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("reuses a loader's fresh query when another page subscribes", async () => {
    const client = getRouter().options.context.queryClient;
    let requests = 0;
    const query = {
      queryKey: ["performance", "shared-data"],
      queryFn: async () => ++requests,
    };
    await client.ensureQueryData(query);
    await client.fetchQuery(query);
    expect(requests).toBe(1);
    await client.invalidateQueries({ queryKey: query.queryKey });
    await client.fetchQuery(query);
    expect(requests).toBe(2);
    client.clear();
  });

  it("preloads on intent while keeping Query freshness and scroll restoration", () => {
    const router = getRouter();
    expect(router.options.defaultPreload).toBe("intent");
    expect(router.options.defaultPreloadDelay).toBe(100);
    expect(router.options.defaultPreloadStaleTime).toBe(0);
    expect(router.options.scrollRestoration).toBe(true);
    expect(router.options.context.queryClient.getDefaultOptions().queries?.staleTime).toBe(15_000);
  });
});
