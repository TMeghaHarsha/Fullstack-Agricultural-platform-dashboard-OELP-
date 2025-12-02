import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const Crops = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [allCrops, setAllCrops] = useState<{ id: number; name: string; icon_url?: string | null }[]>([]);
  const [varieties, setVarieties] = useState<{ id: number; crop: number; name: string; is_primary: boolean }[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [openCropDialog, setOpenCropDialog] = useState(false);
  const [editingField, setEditingField] = useState<any | null>(null);
  const [form, setForm] = useState({ field: "", crop: "", crop_variety: "", sowing_date: "", harvesting_date: "" });
  const [openDetails, setOpenDetails] = useState(false);
  const [detailsField, setDetailsField] = useState<any | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState({ crop_id: "" });

  const API_URL = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.REACT_APP_API_URL || "/api";

  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Token ${token}` } : {};
  };

  const loadData = async () => {
    try {
      const [cropsRes, varietiesRes, fieldsRes] = await Promise.all([
        fetch(`${API_URL}/crops/`, { headers: { "Content-Type": "application/json", ...authHeaders() } }),
        fetch(`${API_URL}/crop-varieties/`, { headers: { "Content-Type": "application/json", ...authHeaders() } }),
        fetch(`${API_URL}/fields/`, { headers: { "Content-Type": "application/json", ...authHeaders() } }),
      ]);
      if (!cropsRes.ok) throw new Error("Failed to load crops");
      if (!varietiesRes.ok) throw new Error("Failed to load varieties");
      if (!fieldsRes.ok) throw new Error("Failed to load fields");
      const cropsData = await cropsRes.json();
      const varietiesData = await varietiesRes.json();
      const fieldsData = await fieldsRes.json();
      const cropsItems = Array.isArray(cropsData.results) ? cropsData.results : cropsData;
      const varietyItems = Array.isArray(varietiesData.results) ? varietiesData.results : varietiesData;
      const fieldsItems = Array.isArray(fieldsData.results) ? fieldsData.results : fieldsData;
      setAllCrops(cropsItems);
      setVarieties(varietyItems);
      setFields(fieldsItems);
    } catch (e: any) {
      toast.error(e.message || "Failed to load data");
    }
  };

  useEffect(() => {
    loadData();
    const params = new URLSearchParams(window.location.search);
    if (params.get('dialog') === 'add') setOpenCropDialog(true);
  }, []);

  const lifecycleStages = useMemo(() => {
    const now = new Date();
    const assigned = fields.filter((f) => !!f.crop);
    const planting = assigned.filter((f) => {
      const sd = f.current_sowing_date ? new Date(f.current_sowing_date) : null;
      if (!sd) return false;
      const days = Math.floor((now.getTime() - sd.getTime()) / (1000 * 60 * 60 * 24));
      return days <= 30;
    }).length;
    const growing = assigned.filter((f) => {
      const sd = f.current_sowing_date ? new Date(f.current_sowing_date) : null;
      const hd = f.current_harvesting_date ? new Date(f.current_harvesting_date) : null;
      if (!sd) return false;
      const days = Math.floor((now.getTime() - sd.getTime()) / (1000 * 60 * 60 * 24));
      return days > 30 && (!hd || now < hd);
    }).length;
    const ready = assigned.filter((f) => {
      const hd = f.current_harvesting_date ? new Date(f.current_harvesting_date) : null;
      if (!hd) return false;
      const daysTo = Math.floor((hd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysTo <= 7 && daysTo >= 0;
    }).length;
    const total = assigned.length;
    return [
      { stage: "Planting", count: planting, completion: total ? `${Math.round((planting / total) * 100)}%` : "0%" },
      { stage: "Growing", count: growing, completion: total ? `${Math.round((growing / total) * 100)}%` : "0%" },
      { stage: "Ready to Harvest", count: ready, completion: total ? `${Math.round((ready / total) * 100)}%` : "0%" },
    ];
  }, [fields]);

  const computeStatus = (f: any) => {
    const now = new Date();
    const sd = f.current_sowing_date ? new Date(f.current_sowing_date) : null;
    const fd = f.current_flowering_date ? new Date(f.current_flowering_date) : null;
    const hd = f.current_harvesting_date ? new Date(f.current_harvesting_date) : null;
    if (hd && now >= hd) return "Harvested";
    if (fd && now >= fd) return "Flowering";
    if (sd) {
      const days = Math.floor((now.getTime() - sd.getTime()) / (1000 * 60 * 60 * 24));
      return days <= 30 ? "Planting" : "Growing";
    }
    return "—";
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Growing": return "default";
      case "Harvested": return "secondary";
      case "Flowering": return "outline";
      case "Planting": return "default";
      default: return "default";
    }
  };

  const assignedFields = useMemo(() => {
    let list = fields.filter((f) => !!f.crop);
    if (filter.crop_id) list = list.filter((f) => String(f.crop) === String(filter.crop_id));
    if (searchQuery) list = list.filter((f) => (f.crop_name || "").toLowerCase().includes(searchQuery.toLowerCase()));
    return list;
  }, [fields, filter, searchQuery]);

  const handleOpenNewCrop = () => {
    setEditingField(null);
    setForm({ field: "", crop: "", crop_variety: "", sowing_date: "", harvesting_date: "" });
    setOpenCropDialog(true);
  };

  const handleOpenEditCrop = (f: any) => {
    setEditingField(f);
    setForm({ field: String(f.id), crop: String(f.crop || ""), crop_variety: String(f.crop_variety || ""), sowing_date: f.current_sowing_date || "", harvesting_date: f.current_harvesting_date || "" });
    setOpenCropDialog(true);
  };

  const handleDeleteCrop = async (fieldId: number) => {
    if (!confirm("Remove crop from this field?")) return;
    // Clear crop assignment and mark harvested now
    const res1 = await fetch(`${API_URL}/fields/${fieldId}/`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ crop: null, crop_variety: null }) });
    const today = new Date().toISOString().slice(0,10);
    await fetch(`${API_URL}/fields/${fieldId}/update_lifecycle/`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ harvesting_date: today }) });
    if (res1.ok) { toast.success("Crop removed"); loadData(); } else { toast.error("Failed to remove crop"); }
  };

  const submitCrop = async () => {
    if (!form.field || !form.crop) { toast.error('Please select field and crop'); return; }
    // Assign crop and variety to field
    const resField = await fetch(`${API_URL}/fields/${form.field}/`, {
      method: editingField ? "PATCH" : "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ crop: Number(form.crop), crop_variety: form.crop_variety ? Number(form.crop_variety) : null }),
    });
    if (!resField.ok) { toast.error('Failed to assign crop to field'); return; }
    // Update lifecycle dates
    if (form.sowing_date || form.harvesting_date) {
      await fetch(`${API_URL}/fields/${form.field}/update_lifecycle/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ sowing_date: form.sowing_date || null, harvesting_date: form.harvesting_date || null }),
      });
    }
    toast.success(editingField ? 'Crop updated' : 'Crop assigned');
    setOpenCropDialog(false);
    loadData();
  };

  const cropVarietyOptions = varieties.filter((v) => String(v.crop) === String(form.crop));



  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Crops Management</h1>
          <p className="text-muted-foreground">Manage your crops, varieties, and lifecycles</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleOpenNewCrop}>
            <Plus className="mr-2 h-4 w-4" />
            Add Crop
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search crops or varieties..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2 mt-3">
            <Button variant="outline" onClick={() => setFilterOpen((v) => !v)}>Filter</Button>
            {filterOpen && (
              <div className="flex gap-2 items-center text-sm">
                <label>Crop</label>
                <select className="border rounded h-9 px-2" value={filter.crop_id} onChange={(e) => setFilter({ ...filter, crop_id: e.target.value })}>
                  <option value="">All</option>
                  {allCrops.map((c) => (<option key={c.id} value={String(c.id)}>{c.name}</option>))}
                </select>
                <Button variant="outline" size="sm" onClick={() => setFilter({ crop_id: "" })}>Reset</Button>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Crops</CardTitle>
          <CardDescription>Overview of all your crops and their current status</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field</TableHead>
                <TableHead>Crop Name</TableHead>
                <TableHead>Variety</TableHead>
                <TableHead>Season</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Planted Date</TableHead>
                <TableHead>Sowing Date</TableHead>
                <TableHead>Harvesting Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignedFields.map((f) => {
                const status = computeStatus(f);
                const season = f.current_sowing_date ? new Date(f.current_sowing_date).toLocaleString(undefined, { month: 'long' }) : "—";
                return (
                  <TableRow key={f.id} className="cursor-pointer" onClick={() => { setDetailsField(f); setOpenDetails(true); }}>
                    <TableCell className="font-medium">{f.name}</TableCell>
                    <TableCell className="font-medium">{f.crop_name || "-"}</TableCell>
                    <TableCell>{f.crop_variety_name || varieties.find((v) => String(v.id) === String(f.crop_variety))?.name || "-"}</TableCell>
                    <TableCell>{season}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(status)}>{status}</Badge>
                    </TableCell>
                    <TableCell>{f.current_sowing_date || "—"}</TableCell>
                    <TableCell>{f.current_sowing_date || "—"}</TableCell>
                    <TableCell>{f.current_harvesting_date || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEditCrop(f)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteCrop(f.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lifecycle Management</CardTitle>
          <CardDescription>Track and update crop lifecycle stages</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {lifecycleStages.map((stage) => (
              <Card key={stage.stage}>
                <CardHeader>
                  <CardTitle className="text-lg">{stage.stage}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-primary">{stage.count} crops</p>
                  <p className="text-sm text-muted-foreground">{stage.completion} complete</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={openCropDialog} onOpenChange={setOpenCropDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingField ? "Update Crop" : "Assign Crop to Field"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Field *</Label>
                <select className="border rounded-md h-10 px-3 w-full" value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })}>
                  <option value="" disabled>Select field</option>
                  {fields.map((f) => (<option key={f.id} value={String(f.id)}>{f.name}</option>))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Crop *</Label>
                <select className="border rounded-md h-10 px-3 w-full" value={form.crop} onChange={(e) => setForm({ ...form, crop: e.target.value, crop_variety: "" })}>
                  <option value="" disabled>Select crop</option>
                  {allCrops.map((c) => (<option key={c.id} value={String(c.id)}>{c.name}</option>))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Variety</Label>
                <select className="border rounded-md h-10 px-3 w-full" value={form.crop_variety} onChange={(e) => setForm({ ...form, crop_variety: e.target.value })}>
                  <option value="">None</option>
                  {cropVarietyOptions.map((v) => (<option key={v.id} value={String(v.id)}>{v.name}</option>))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Sowing Date</Label>
                <Input type="date" value={form.sowing_date} onChange={(e) => setForm({ ...form, sowing_date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Harvesting Date</Label>
                <Input type="date" value={form.harvesting_date} onChange={(e) => setForm({ ...form, harvesting_date: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpenCropDialog(false)}>Cancel</Button>
              <Button onClick={submitCrop}>{editingField ? "Update" : "Assign"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Crop/Field Assignment Details */}
      <Dialog open={openDetails} onOpenChange={setOpenDetails}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Crop Details</DialogTitle>
          </DialogHeader>
          {detailsField && (
            <div className="space-y-2 text-sm">
              <div><strong>Field:</strong> {detailsField.name}</div>
              <div><strong>Crop:</strong> {detailsField.crop_name || "-"}</div>
              <div><strong>Variety:</strong> {detailsField.crop_variety_name || "-"}</div>
              <div><strong>Season:</strong> {detailsField.current_sowing_date ? new Date(detailsField.current_sowing_date).toLocaleString(undefined, { month: 'long' }) : "-"}</div>
              <div><strong>Status:</strong> {computeStatus(detailsField)}</div>
              <div><strong>Sowing Date:</strong> {detailsField.current_sowing_date || "-"}</div>
              <div><strong>Harvesting Date:</strong> {detailsField.current_harvesting_date || "-"}</div>
              <div><strong>Irrigation:</strong> {detailsField.irrigation_method_name || "-"}</div>
              <div><strong>Created:</strong> {detailsField.created_at ? new Date(detailsField.created_at).toLocaleString() : "-"}</div>
              <div><strong>Updated:</strong> {detailsField.updated_at ? new Date(detailsField.updated_at).toLocaleString() : "-"}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>


    </div>
  );
};

export default Crops;
