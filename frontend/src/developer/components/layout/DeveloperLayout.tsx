import { ReactNode } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DeveloperSidebar } from "./DeveloperSidebar";
import { DeveloperTopbar } from "./DeveloperTopbar";

export function DeveloperLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/30">
        <DeveloperSidebar />
        <div className="flex flex-1 flex-col">
          <DeveloperTopbar />
          <ErrorBoundary>
            <main className="flex-1 p-6">{children}</main>
          </ErrorBoundary>
        </div>
      </div>
    </SidebarProvider>
  );
}
