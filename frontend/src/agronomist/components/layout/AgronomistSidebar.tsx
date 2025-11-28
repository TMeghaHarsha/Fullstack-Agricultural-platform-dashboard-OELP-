import { NavLink } from "react-router-dom";
import { LayoutDashboard, Sprout, Bell, Users, Settings, AlertCircle } from "lucide-react";

export function AgronomistSidebar() {
  const link = (to: string, label: string, Icon: any) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition 
         ${isActive
           ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
           : "hover:bg-sidebar-accent/50 text-sidebar-foreground"
         }`
      }
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </NavLink>
  );

  return (
    <aside className="hidden md:block w-64 border-r bg-sidebar p-4">
      <div className="mb-4 text-xs font-semibold text-sidebar-foreground">
        Agronomist
      </div>

      <nav className="space-y-1">
        {link("/agronomist/dashboard", "Dashboard", LayoutDashboard)}
        {link("/agronomist/crops", "Crops", Sprout)}
        {link("/agronomist/notifications", "Notifications", Bell)}
        {link("/agronomist/users", "Users", Users)}
        {link("/agronomist/issues", "Issues", AlertCircle)}
        {link("/agronomist/settings", "Settings", Settings)}
      </nav>
    </aside>
  );
}
