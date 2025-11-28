import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bug, GitBranch, ClipboardList } from "lucide-react";

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

export default function DeveloperDashboard() {
  const [bugsFixed, setBugsFixed] = useState(0);
  const [versionsReleased, setVersionsReleased] = useState(0);
  const [pendingIssues, setPendingIssues] = useState(0);
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    // notifications as signals for bugs fixed and versions released
    fetch(`${API_URL}/notifications/`, { headers: { Authorization: `Token ${token}` } })
      .then(r=>r.ok?r.json():null)
      .then(d=>{
        const items = Array.isArray(d?.results) ? d.results : (Array.isArray(d)? d: []);
        const msg = (s:any)=> String(s||'').toLowerCase();
        setBugsFixed(items.filter((n:any)=> /bug|fix|fixed|resolved/.test(msg(n.message))).length);
        setVersionsReleased(items.filter((n:any)=> /version|release|deployed|deployment/.test(msg(n.message))).length);
      }).catch(()=> { setBugsFixed(0); setVersionsReleased(0); });
    // support requests for pending software issues
    fetch(`${API_URL}/support/`, { headers: { Authorization: `Token ${token}` } })
      .then(r=>r.ok?r.json():null)
      .then(d=>{
        const items = Array.isArray(d?.results) ? d.results : (Array.isArray(d)? d: []);
        setPendingIssues(items.filter((s:any)=> s.category === 'software_issue').length);
      }).catch(()=> setPendingIssues(0));
    // recent activity for developer (from admin analytics)
    fetch(`${API_URL}/admin/analytics/`, { headers: { Authorization: `Token ${token}` } })
      .then(r=>r.ok?r.json():null)
      .then(d=> setRecent(Array.isArray(d?.recent_activity) ? d.recent_activity : []))
      .catch(()=> setRecent([]));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Developer Dashboard</h1>
        <p className="text-muted-foreground">Engineering insights</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Stat icon={Bug} label="Bugs Fixed" value={bugsFixed} />
        <Stat icon={GitBranch} label="Versions Released" value={versionsReleased} />
        <Stat icon={ClipboardList} label="Pending Issues" value={pendingIssues} />
      </div>
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
