import { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SuperAdminSidebar } from "./SuperAdminSidebar";
import { SuperAdminTopbar } from "./SuperAdminTopbar";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export function SuperAdminLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/30">
        <SuperAdminSidebar />
        <div className="flex flex-1 flex-col">
          <SuperAdminTopbar />
          <ErrorBoundary>
            <main className="flex-1 p-6">{children}</main>
          </ErrorBoundary>
        </div>
      </div>
    </SidebarProvider>
  );
}
