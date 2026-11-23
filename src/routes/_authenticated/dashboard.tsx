import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileCheck2, KeyRound, LayoutGrid, ListChecks, MessageSquareWarning, Settings } from "lucide-react";
import { SideNav } from "@/components/dashboard/side-nav";
import { dashboardQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const { data } = useQuery(dashboardQuery);
  const revisions = data?.solutions.filter((s) => s["status"] === "CHANGES_REQUESTED").length ?? 0;
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[220px_1fr]">
      <SideNav
        title="My dashboard"
        items={[
          { to: "/dashboard", label: "Overview", icon: LayoutGrid, exact: true },
          { to: "/dashboard/problems", label: "Selected problems", icon: ListChecks },
          { to: "/dashboard/solutions", label: "My solutions", icon: FileCheck2 },
          { to: "/dashboard/revisions", label: "Revision requests", icon: MessageSquareWarning, badge: revisions },
          { to: "/dashboard/claim", label: "Claim a problem", icon: KeyRound },
          { to: "/dashboard/settings", label: "Account settings", icon: Settings },
        ]}
      />
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
