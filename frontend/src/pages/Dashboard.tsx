import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";
import { Sprout, CreditCard, Map, Plus, FileText, Upload, BarChart } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const navigate = useNavigate();

  const [stats, setStats] = useState([
    { title: "Active Crops", value: "0", icon: Sprout, description: "Currently growing", onClick: () => navigate("/crops") },
    { title: "Current Subscription", value: "Free", icon: CreditCard, description: "—", onClick: () => navigate("/subscriptions") },
    { title: "Total Fields", value: "0", icon: Map, description: "0 fields", onClick: () => navigate("/fields") },
  ]);
  const [practices, setPractices] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const API_URL = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.REACT_APP_API_URL || "/api";
    const token = localStorage.getItem("token");
    
    const loadComprehensiveActivity = async () => {
      try {
        // Fetch all recent data in parallel
        const [dashboardRes, cropsRes, fieldsRes, practicesRes] = await Promise.all([
          fetch(`${API_URL}/dashboard/`, { headers: { ...(token ? { Authorization: `Token ${token}` } : {}) } }),
          fetch(`${API_URL}/crops/`, { headers: { ...(token ? { Authorization: `Token ${token}` } : {}) } }),
          fetch(`${API_URL}/fields/`, { headers: { ...(token ? { Authorization: `Token ${token}` } : {}) } }),
          fetch(`${API_URL}/irrigation-practices/`, { headers: { ...(token ? { Authorization: `Token ${token}` } : {}) } })
        ]);

        const dashboardData = dashboardRes.ok ? await dashboardRes.json() : null;
        const cropsData = cropsRes.ok ? await cropsRes.json() : { results: [] };
        const fieldsData = fieldsRes.ok ? await fieldsRes.json() : { results: [] };
        const practicesData = practicesRes.ok ? await practicesRes.json() : { results: [] };

        if (dashboardData) {
          const activeCrops = Number(dashboardData.active_crops || 0);
          const fieldsCount = Number(dashboardData.active_fields || 0);
          const planLabel = dashboardData.current_plan?.plan_name || "Free";
          
          setStats([
            { title: "Active Crops", value: String(activeCrops), icon: Sprout, description: "Currently growing", onClick: () => navigate("/crops") },
            { title: "Current Subscription", value: planLabel, icon: CreditCard, description: "—", onClick: () => navigate("/subscriptions") },
            { title: "Total Fields", value: String(fieldsCount), icon: Map, description: "", onClick: () => navigate("/fields") },
          ]);
          setPractices(Array.isArray(dashboardData.current_practices) ? dashboardData.current_practices : []);
        }

        // Build recent activity from system activity (CRUD) and limit to latest 6
        const recentActivityData: any[] = [];
        if (dashboardData?.recent_activity) {
          dashboardData.recent_activity.forEach((a: any) => {
            recentActivityData.push({
              action: a.description || a.action,
              timestamp: a.created_at,
              time: new Date(a.created_at).toLocaleString(),
              type: 'system'
            });
          });
        }
        recentActivityData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setRecentActivity(recentActivityData.slice(0, 6));
      } catch (error) {
        console.error('Error loading activity:', error);
      }
    };

    loadComprehensiveActivity();
    
    // Load role for display
    fetch(`${API_URL}/auth/me/`, { headers: { ...(token ? { Authorization: `Token ${token}` } : {}) } })
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => {
        const roles = Array.isArray(me?.roles) ? me.roles : [];
        setUserRole(roles[0] || null);
      })
      .catch(() => {});
  }, []);

  const practiceRow = (p: any) => ({ name: p.method_name || "Irrigation", status: new Date(p.performed_at).toLocaleString(), field: p.field_name, time: "" });


  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-foreground mb-2">Welcome back!</h1>
          {userRole && userRole !== "End-App-User" && (
            <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] uppercase tracking-wide">
              <Shield className="h-3.5 w-3.5" />
              {userRole}
            </span>
          )}
        </div>
        <p className="text-muted-foreground">Here's your farm overview.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card 
            key={stat.title} 
            className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/50"
            onClick={stat.onClick}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Current Practices</CardTitle>
            <CardDescription>Active farming activities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {practices.map((practice: any, index) => (
                <div key={index} className="flex items-start justify-between border-b pb-3 last:border-0">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{practice.method_name || "Irrigation"}</p>
                    <p className="text-sm text-muted-foreground">{practice.field_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-primary">{practice.performed_at ? new Date(practice.performed_at).toLocaleString() : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest updates</CardDescription>
              </div>
              <Button variant="ghost" size="sm">View All</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex justify-between items-center">
                  <p className="text-sm">{activity.action}</p>
                  <p className="text-xs text-muted-foreground">{activity.time}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Button variant="outline" className="h-24 flex-col gap-2" onClick={() => navigate('/crops?dialog=add')}>
              <Plus className="h-5 w-5" />
              <span>Add New Crop</span>
            </Button>
            <Button variant="outline" className="h-24 flex-col gap-2" onClick={() => navigate('/fields?dialog=soil')}>
              <Upload className="h-5 w-5" />
              <span>Generate Soil Report</span>
            </Button>
            <Button variant="outline" className="h-24 flex-col gap-2" onClick={() => navigate('/reports')}>
              <BarChart className="h-5 w-5" />
              <span>View Analytics</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
