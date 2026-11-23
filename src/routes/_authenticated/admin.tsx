import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { ClipboardList, FileCheck2, FolderTree, History, LayoutGrid, Users } from "lucide-react";
import { SideNav } from "@/components/dashboard/side-nav";
import { checkIsAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  // UX gate only: every admin server function re-checks the role on the server.
  beforeLoad: async () => {
    const { isAdmin } = await checkIsAdmin();
    if (!isAdmin) throw redirect({ to: "/dashboard" });
  },
  head: () => ({ meta: [{ title: "Admin — SolveBridge" }, { name: "robots", content: "noindex" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[210px_1fr]">
      <SideNav
        title="Admin"
        items={[
          { to: "/admin", label: "Overview & reports", icon: LayoutGrid, exact: true },
          { to: "/admin/problems", label: "Problems", icon: ClipboardList },
          { to: "/admin/solutions", label: "Solutions", icon: FileCheck2 },
          { to: "/admin/users", label: "Users", icon: Users },
          { to: "/admin/categories", label: "Categories", icon: FolderTree },
          { to: "/admin/audit", label: "Audit log", icon: History },
        ]}
      />
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
