import { Home, Sprout, Map, CreditCard, BarChart3, Settings as SettingsIcon, Shield } from "lucide-react";
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
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground flex items-center gap-2">
            Agricultural Management
            {role && role !== "End-App-User" && !isCollapsed && (
              <span className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                <Shield className="h-3 w-3" />
                {role}
              </span>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url}
                      className={({ isActive }) => 
                        isActive ? "bg-sidebar-accent" : ""
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
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
