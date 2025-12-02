import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, GitBranch, Upload, Calendar } from "lucide-react";
import { toast } from "sonner";

const API_URL = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.REACT_APP_API_URL || "/api";

export default function DeveloperUpdates() {
  const [updates, setUpdates] = useState<any[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    version: "",
    description: "",
    update_type: "feature",
    git_commit: "",
    vercel_deploy: "",
  });

  const loadUpdates = () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    // Use notifications as release/update feed, filter relevant
    fetch(`${API_URL}/notifications/`, { headers: { Authorization: `Token ${token}` } })
      .then(r=>r.ok?r.json():null)
      .then(d=>{
        const arr = Array.isArray(d?.results) ? d.results : (Array.isArray(d)? d : []);
        const rel = arr.filter((n:any)=> 
          /update|version|release|deploy|feature|bugfix|patch/.test(String(n.message||'').toLowerCase()) ||
          n.notification_type === "update"
        );
        setUpdates(rel);
      }).catch(()=> setUpdates([]));
  };

  useEffect(() => {
    loadUpdates();
  }, []);

  const handleCreateUpdate = async () => {
    if (!formData.title || !formData.description) {
      toast.error("Title and description are required");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) return;

    setLoading(true);
    try {
      // Create notification for all users (End-App-User, Admin, SuperAdmin)
      const message = `🚀 ${formData.title}${formData.version ? ` v${formData.version}` : ''}\n\n${formData.description}${formData.git_commit ? `\n\nGit Commit: ${formData.git_commit}` : ''}${formData.vercel_deploy ? `\n\nVercel Deploy: ${formData.vercel_deploy}` : ''}`;
      
      const response = await fetch(`${API_URL}/notification-center/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify({
          receiver_roles: ["End-App-User", "Admin", "SuperAdmin"],
          message: message,
          notification_type: "update",
        }),
      });

      if (response.ok) {
        toast.success("Update created and notifications sent to all users!");
        setFormData({
          title: "",
          version: "",
          description: "",
          update_type: "feature",
          git_commit: "",
          vercel_deploy: "",
        });
        setCreateOpen(false);
        loadUpdates();
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.detail || "Failed to create update");
      }
    } catch (error) {
      toast.error("Failed to create update");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Updates</h1>
          <p className="text-muted-foreground">Manage system updates, releases, and deployments</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Update
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Updates</CardTitle>
          <CardDescription>System changes, versions, deployments, and feature releases</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {updates.map((u:any)=> (
              <div key={u.id} className="p-4 border rounded-lg hover:bg-accent transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="capitalize">
                        {u.notification_type || "update"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString()} at {new Date(u.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="font-medium whitespace-pre-wrap">{u.message}</p>
                    {u.sender_name && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Created by: {u.sender_name}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {updates.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No updates yet. Create your first update to notify all users about new features or changes.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Update</DialogTitle>
            <DialogDescription>
              Create an update that will be sent as a notification to all end users, admins, and super admins.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Update Title *</Label>
                <Input
                  placeholder="e.g., New Dashboard Features"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Version (Optional)</Label>
                <Input
                  placeholder="e.g., 2.1.0"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Update Type</Label>
              <Select value={formData.update_type} onValueChange={(value) => setFormData({ ...formData, update_type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="feature">New Feature</SelectItem>
                  <SelectItem value="bugfix">Bug Fix</SelectItem>
                  <SelectItem value="improvement">Improvement</SelectItem>
                  <SelectItem value="security">Security Update</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                placeholder="Describe the update, new features, bug fixes, or changes..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={5}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  <GitBranch className="inline mr-2 h-4 w-4" />
                  Git Commit (Optional)
                </Label>
                <Input
                  placeholder="e.g., abc1234 or main branch"
                  value={formData.git_commit}
                  onChange={(e) => setFormData({ ...formData, git_commit: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  <Upload className="inline mr-2 h-4 w-4" />
                  Vercel Deploy (Optional)
                </Label>
                <Input
                  placeholder="e.g., Deploy #123 or production"
                  value={formData.vercel_deploy}
                  onChange={(e) => setFormData({ ...formData, vercel_deploy: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateUpdate} disabled={loading || !formData.title || !formData.description}>
                {loading ? "Creating..." : "Create & Notify All Users"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
