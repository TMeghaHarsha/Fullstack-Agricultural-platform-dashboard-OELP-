import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const API_URL = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.REACT_APP_API_URL || "/api";

export default function DeveloperUpdates() {
  const [updates, setUpdates] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    // Use notifications as release/update feed for now, filter relevant
    fetch(`${API_URL}/notifications/`, { headers: { Authorization: `Token ${token}` } })
      .then(r=>r.ok?r.json():null)
      .then(d=>{
        const arr = Array.isArray(d?.results) ? d.results : (Array.isArray(d)? d : []);
        const rel = arr.filter((n:any)=> /update|version|release|deploy/.test(String(n.message||'').toLowerCase()));
        setUpdates(rel);
      }).catch(()=> setUpdates([]));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Updates</h1>
        <p className="text-muted-foreground">Latest releases and changes. Initially empty if none.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent Updates</CardTitle>
          <CardDescription>System changes, versions, deployments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {updates.map((u:any)=> (
              <div key={u.id} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{u.message}</p>
                  <Badge variant="secondary">{new Date(u.created_at).toLocaleDateString()}</Badge>
                </div>
              </div>
            ))}
            {updates.length === 0 && (
              <div className="text-sm text-muted-foreground">No updates yet.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
