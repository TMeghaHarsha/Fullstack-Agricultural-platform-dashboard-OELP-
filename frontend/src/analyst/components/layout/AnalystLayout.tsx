import { ReactNode } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AnalystSidebar } from "./AnalystSidebar";
import { AnalystTopbar } from "./AnalystTopbar";

export function AnalystLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/30">
        <AnalystSidebar />
        <div className="flex flex-1 flex-col">
          <AnalystTopbar />
          <ErrorBoundary>
            <main className="flex-1 p-6">{children}</main>
          </ErrorBoundary>
        </div>
      </div>
    </SidebarProvider>
  );
}
