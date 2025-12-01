import { NavLink } from "react-router-dom";
import { LayoutDashboard, Sprout, Bell, Users, Settings, AlertCircle, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/agronomist/dashboard", icon: LayoutDashboard },
  { title: "Crops", url: "/agronomist/crops", icon: Sprout },
  { title: "Notifications", url: "/agronomist/notifications", icon: Bell },
  { title: "Users", url: "/agronomist/users", icon: Users },
  { title: "Issues", url: "/agronomist/issues", icon: AlertCircle },
  { title: "Settings", url: "/agronomist/settings", icon: Settings },
];

export function AgronomistSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [roleTitle, setRoleTitle] = useState<string>("");

  useEffect(() => {
    const API_URL = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.REACT_APP_API_URL || "/api";
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API_URL}/auth/me/`, { headers: { Authorization: `Token ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => {
        const first = Array.isArray(me?.roles) ? me.roles[0] : "";
        setRoleTitle(first || "");
      })
      .catch(() => {});
  }, []);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Sprout className="h-5 w-5 text-primary-foreground" />
          </div>
          {!isCollapsed && (
            <div>
              <h2 className="text-sm font-semibold text-sidebar-foreground">Agricultural Management</h2>
              {roleTitle && (
                <p className="text-xs text-muted-foreground">{roleTitle}</p>
              )}
            </div>
          )}
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url}
                      className={({ isActive }) =>
                        isActive 
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                      {!isCollapsed && (
                        <ChevronRight className="ml-auto h-4 w-4" />
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
