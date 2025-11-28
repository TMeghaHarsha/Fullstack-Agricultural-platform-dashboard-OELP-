import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const API_URL = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.REACT_APP_API_URL || "/api";

interface Plan { id?: number; name?: string; price?: number; type?: string }

export default function BusinessSubscriptions() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [features, setFeatures] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState<Plan & { duration?: number }>({ name: "", price: 0, type: "standard", duration: 30 });
  const [pfRows, setPfRows] = useState<Array<{ feature?: number; max_count?: number; duration_days?: number }>>([]);

  const loadPlans = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const res = await fetch(`${API_URL}/plans/`, { headers: { Authorization: `Token ${token}` } });
    const data = res.ok ? await res.json() : null;
    const items = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []);
    setPlans(items);
  };

  const loadFeatures = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const res = await fetch(`${API_URL}/features/`, { headers: { Authorization: `Token ${token}` } });
    const data = res.ok ? await res.json() : null;
    const items = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []);
    setFeatures(items);
  };

  useEffect(() => { loadPlans(); loadFeatures(); }, []);

  const startAdd = () => { setEditing(null); setForm({ name: "", price: 0, type: "standard", duration: 30 }); setPfRows([]); setOpen(true); };
  const startEdit = async (p: Plan) => { 
    setEditing(p); 
    setForm({ id: p.id, name: p.name, price: Number(p.price)||0, type: p.type||"standard", duration: (p as any)?.duration || 30 }); 
    // load plan-features for this plan
    const token = localStorage.getItem("token");
    if (token && p.id) {
      try {
        const resp = await fetch(`${API_URL}/plan-features/?plan=${p.id}`, { headers: { Authorization: `Token ${token}` } });
        const d = resp.ok ? await resp.json() : null;
        const arr = Array.isArray(d?.results) ? d.results : (Array.isArray(d) ? d : []);
        setPfRows(arr.map((r:any)=> ({ feature: r.feature, max_count: r.max_count, duration_days: r.duration_days })));
      } catch { setPfRows([]); }
    } else { setPfRows([]); }
    setOpen(true); 
  };

  const save = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const body = { name: form.name, price: form.price, type: form.type, duration: form.duration || 30 } as any;
    const headers = { 'Content-Type': 'application/json', Authorization: `Token ${token}` } as any;
    let ok = false;
    let planId = editing?.id;
    if (editing && editing.id) {
      const res = await fetch(`${API_URL}/plans/${editing.id}/`, { method: 'PUT', headers, body: JSON.stringify(body) });
      ok = res.ok;
      planId = editing.id;
    } else {
      const res = await fetch(`${API_URL}/plans/`, { method: 'POST', headers, body: JSON.stringify(body) });
      ok = res.ok;
      if (ok) {
        const j = await res.json().catch(()=>null);
        planId = j?.id || planId;
      }
    }
    if (ok && planId) {
      // replace plan-features
      try {
        const existing = await fetch(`${API_URL}/plan-features/?plan=${planId}`, { headers: { Authorization: `Token ${token}` } }).then(r=>r.ok?r.json():null);
        const items = Array.isArray(existing?.results) ? existing.results : (Array.isArray(existing) ? existing : []);
        await Promise.all(items.map((it:any)=> fetch(`${API_URL}/plan-features/${it.id}/`, { method: 'DELETE', headers: { Authorization: `Token ${token}` } })));
      } catch {}
      for (const row of pfRows) {
        if (!row.feature) continue;
        await fetch(`${API_URL}/plan-features/`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ plan: planId, feature: row.feature, max_count: Number(row.max_count)||0, duration_days: Number(row.duration_days)||0 })
        });
      }
      setOpen(false);
      await loadPlans();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Subscriptions</h1>
          <p className="text-muted-foreground">Manage plans and replicate changes across users</p>
        </div>
        <Button onClick={startAdd}>Add a new subscription</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plans</CardTitle>
          <CardDescription>Create and update subscription plans</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((p) => (
              <Card key={p.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{p.name || '-'}</CardTitle>
                    <Button size="sm" variant="outline" onClick={() => startEdit(p)}>Edit</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Type: {p.type || '-'}</p>
                  <p className="text-sm">Price: ₹{Number(p.price)||0}</p>
                  <p className="text-sm text-muted-foreground">Duration: {(p as any)?.duration || 0} days</p>
                  <div className="mt-2">
                    <p className="text-sm font-medium">Features</p>
                    <ul className="text-sm list-disc ml-5 text-muted-foreground">
                      {(((p as any)?.features)||[]).map((f:string, idx:number)=> (<li key={idx}>{f}</li>))}
                      {(!((p as any)?.features)||((p as any)?.features||[]).length===0) && <li>Basic access</li>}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
            {plans.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-3">No plans configured yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>{editing ? 'Update Subscription' : 'Add Subscription'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name||''} onChange={(e)=> setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Price (₹)</Label>
              <Input type="number" value={Number(form.price)||0} onChange={(e)=> setForm({ ...form, price: Number(e.target.value)||0 })} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Input value={form.type||''} onChange={(e)=> setForm({ ...form, type: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Duration (days)</Label>
              <Input type="number" value={Number((form as any).duration)||0} onChange={(e)=> setForm({ ...form, duration: Number(e.target.value)||0 })} />
            </div>
            <div className="space-y-2">
              <Label>Features</Label>
              <div className="space-y-2">
                {pfRows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <Select value={row.feature ? String(row.feature) : undefined} onValueChange={(v)=> {
                        const next = [...pfRows]; next[idx] = { ...row, feature: Number(v) }; setPfRows(next);
                      }}>
                        <SelectTrigger><SelectValue placeholder="Select feature" /></SelectTrigger>
                        <SelectContent>
                          {features.map((f:any)=> (
                            <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <Input type="number" placeholder="Max count" value={Number(row.max_count)||0} onChange={(e)=> {
                        const next = [...pfRows]; next[idx] = { ...row, max_count: Number(e.target.value)||0 }; setPfRows(next);
                      }} />
                    </div>
                    <div className="col-span-3">
                      <Input type="number" placeholder="Duration days" value={Number(row.duration_days)||0} onChange={(e)=> {
                        const next = [...pfRows]; next[idx] = { ...row, duration_days: Number(e.target.value)||0 }; setPfRows(next);
                      }} />
                    </div>
                    <div className="col-span-1">
                      <Button variant="outline" size="icon" onClick={()=> setPfRows(pfRows.filter((_, i)=> i!==idx))}>×</Button>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="secondary" onClick={()=> setPfRows([...pfRows, {}])}>Add Feature</Button>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={()=> setOpen(false)}>Cancel</Button>
              <Button onClick={save}>{editing ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
