import { ReactNode } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SupportSidebar } from "./SupportSidebar";
import { SupportTopbar } from "./SupportTopbar";

export function SupportLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/30">
        <SupportSidebar />
        <div className="flex flex-1 flex-col">
          <SupportTopbar />
          <ErrorBoundary>
            <main className="flex-1 p-6">{children}</main>
          </ErrorBoundary>
        </div>
      </div>
    </SidebarProvider>
  );
}
