import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalyticsChart } from "@/admin/components/dashboard/AnalyticsChart";
import { CreditCard, IndianRupee, RotateCcw } from "lucide-react";
import usePlatformData from "@/lib/usePlatformData";

const API_URL = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.REACT_APP_API_URL || "/api";

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number | string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-primary">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function BusinessDashboard() {
  const [activePlans, setActivePlans] = useState(0);
  const [refunds, setRefunds] = useState(0);
  const { adminAnalytics, transactions, recentSubscriptions, plans, loading } = usePlatformData();

  useEffect(() => {
    setActivePlans(plans.length || 0);
    const refundCnt = transactions.filter((t:any)=> ["refund","refunded","chargeback"].includes(String(t.status||'').toLowerCase())).length;
    setRefunds(refundCnt);
  }, [plans, transactions]);

  const totalRevenue = Number(adminAnalytics?.stats?.total_revenue) || 0;
  const analytics = adminAnalytics;
  const recent = Array.isArray(adminAnalytics?.recent_activity) ? adminAnalytics.recent_activity : recentSubscriptions || [];

  const revenueByDay = useMemo(() => {
    if (Array.isArray(analytics?.revenue_by_day) && analytics.revenue_by_day.length > 0) {
      return analytics.revenue_by_day.map((x:any,i:number)=> ({ 
        name: x?.name || x?.day || `Day ${i+1}`, 
        value: Number(x?.value)||0 
      }));
    }
    return [];
  }, [analytics]);
  const txnByStatus = useMemo(() => Array.isArray(analytics?.transactions_by_status) ? analytics!.transactions_by_status.map((x:any,i:number)=> ({ name: x?.name || `Status ${i+1}`, value: Number(x?.value)||0 })) : [], [analytics]);
  const planDist = useMemo(() => Array.isArray(analytics?.plan_distribution) ? analytics!.plan_distribution.map((x:any,i:number)=> ({ name: x?.name || `Plan ${i+1}`, value: Number(x?.value)||0 })) : [], [analytics]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Business Dashboard</h1>
        <p className="text-muted-foreground">Plans and revenue overview</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Stat icon={CreditCard} label="Active Plans" value={activePlans} />
        <Stat icon={IndianRupee} label="Total Revenue" value={totalRevenue} />
        <Stat icon={RotateCcw} label="Refunds Processed" value={refunds} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <AnalyticsChart title="Revenue (Last 7 Days)" data={revenueByDay} dataKey="value" />
        <AnalyticsChart title="Transactions by Status" data={txnByStatus} dataKey="value" />
      </div>
      <AnalyticsChart title="Active Plan Distribution" data={planDist} dataKey="value" />

      <div>
        <h2 className="text-xl font-semibold">Recent Activity</h2>
        <div className="mt-2 space-y-2">
          {recent.map((a:any)=> (
            <div key={a.id} className="p-3 border rounded-md text-sm flex justify-between">
              <div>
                <div className="font-medium capitalize">{a.action}</div>
                <div className="text-muted-foreground">{a.description}</div>
              </div>
              <div className="text-xs text-muted-foreground">{a.created_at ? new Date(a.created_at).toLocaleString() : ''}</div>
            </div>
          ))}
          {recent.length === 0 && (
            <div className="text-sm text-muted-foreground">No activity yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
