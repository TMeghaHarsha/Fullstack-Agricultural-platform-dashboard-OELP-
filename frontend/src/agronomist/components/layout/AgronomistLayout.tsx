import { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AgronomistSidebar } from "./AgronomistSidebar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AgronomistTopbar } from "./AgronomistTopbar";

export function AgronomistLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/30">
        <AgronomistSidebar />
        <div className="flex flex-1 flex-col">
          <AgronomistTopbar />
          <ErrorBoundary>
            <main className="flex-1 p-6">{children}</main>
          </ErrorBoundary>
        </div>
      </div>
    </SidebarProvider>
  );
}
