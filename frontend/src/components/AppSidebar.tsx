import { Home, Sprout, Map, CreditCard, BarChart3, Settings as SettingsIcon, ChevronRight } from "lucide-react";
import { NavLink } from "react-router-dom";
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

const defaultItems = [
  { key: "dashboard", title: "Dashboard", url: "/dashboard", icon: Home },
  { key: "crops", title: "Crops", url: "/crops", icon: Sprout },
  { key: "fields", title: "Fields", url: "/fields", icon: Map },
  { key: "subscriptions", title: "Subscriptions", url: "/subscriptions", icon: CreditCard },
  { key: "reports", title: "Reports", url: "/reports", icon: BarChart3 },
  { key: "settings", title: "Settings", url: "/settings", icon: SettingsIcon },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [menuItems, setMenuItems] = useState(defaultItems);
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    const API_URL = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.REACT_APP_API_URL || "/api";
    const token = localStorage.getItem("token");
    fetch(`${API_URL}/menu/`, { headers: { ...(token ? { Authorization: `Token ${token}` } : {}) } })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length) {
          setMenuItems(
            data
              .map((i: any) => ({
                key: i.key,
                title: i.label,
                url: `/${i.key}`,
                icon: (defaultItems.find((d) => d.key === i.key)?.icon as any) || Home,
              }))
              .filter(Boolean),
          );
        }
      })
      .catch(() => {});
    fetch(`${API_URL}/auth/me/`, { headers: { ...(token ? { Authorization: `Token ${token}` } : {}) } })
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => setRole((me?.roles || [])[0] || null))
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
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url}
                      className={({ isActive }) => 
                        `group flex items-center gap-3 ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "hover:bg-sidebar-accent/50"}`
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
