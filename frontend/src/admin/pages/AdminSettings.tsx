import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const API_URL = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.REACT_APP_API_URL || "/api";

export default function AdminSettings() {
  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
    phone_number: "",
    avatar: "",
  });
  const [editMode, setEditMode] = useState(false);
  const [deleteAccountDialog, setDeleteAccountDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  
  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Token ${token}` } : {};
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/auth/me/`, { headers: authHeaders() });
        if (res.ok) {
          const data = await res.json();
          setProfile({ 
            full_name: data.full_name || "", 
            email: data.email || "", 
            phone_number: data.phone_number || "", 
            avatar: data.avatar || "" 
          });
        }
      } catch {}
    };
    load();
  }, []);

  const [password, setPassword] = useState({
    new: "",
    confirm: "",
  });

  const [regional, setRegional] = useState({
    language: "english",
    timezone: "pst",
    currency: "inr",
  });

  const [notifications, setNotifications] = useState({
    email: true,
    sms: false,
    push: true,
    weather: true,
  });

  const handleUpdateProfile = () => {
    fetch(`${API_URL}/auth/me/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(profile),
    }).then(async (r) => {
      if (r.ok) {
        toast.success("Profile updated successfully!");
        setEditMode(false);
      } else {
        const err = await r.json().catch(() => ({}));
        toast.error(err.detail || "Failed to update profile");
      }
    });
  };

  const handleChangePassword = () => {
    if (!password.new || !password.confirm) {
      toast.error("Please fill in all password fields");
      return;
    }
    if (password.new !== password.confirm) {
      toast.error("New passwords do not match");
      return;
    }
    if (password.new.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    fetch(`${API_URL}/auth/password/reset/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ new_password: password.new, confirm_password: password.confirm }),
    }).then(async (r) => {
      if (r.ok) {
        toast.success("Password updated");
        setPassword({ new: "", confirm: "" });
      } else {
        const err = await r.json().catch(() => ({}));
        toast.error(err.detail || "Failed to update password");
      }
    });
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") {
      toast.error("Please type 'DELETE' to confirm account deletion");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/auth/me/`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...authHeaders() },
      });

      if (res.ok) {
        toast.success("Account deleted successfully");
        localStorage.removeItem("token");
        window.location.href = "/login";
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Failed to delete account");
      }
    } catch (error) {
      toast.error("Failed to delete account");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your personal account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} disabled={!editMode} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" value={profile.phone_number} onChange={(e) => setProfile({ ...profile, phone_number: e.target.value })} disabled={!editMode} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Avatar URL</Label>
              <Input id="location" value={profile.avatar} onChange={(e) => setProfile({ ...profile, avatar: e.target.value })} disabled={!editMode} />
            </div>
          </div>
          <div className="flex gap-2">
            {!editMode ? (
              <Button onClick={() => setEditMode(true)}>Update Profile</Button>
            ) : (
              <>
                <Button onClick={handleUpdateProfile}>Save Profile</Button>
                <Button variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update your account password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="newPassword">New Password</Label>
              <span className="text-xs text-muted-foreground">Forgot Password? Use this reset.</span>
            </div>
            <Input
              id="newPassword"
              type="password"
              value={password.new}
              onChange={(e) => setPassword({ ...password, new: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={password.confirm}
              onChange={(e) => setPassword({ ...password, confirm: e.target.value })}
            />
          </div>
          <Button onClick={handleChangePassword}>Reset Password</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Language & Regional Settings</CardTitle>
          <CardDescription>Customize your language and regional preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Language</Label>
              <Select value={regional.language} onValueChange={(value) => setRegional({ ...regional, language: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="english">English</SelectItem>
                  <SelectItem value="hindi">Hindi</SelectItem>
                  <SelectItem value="spanish">Spanish</SelectItem>
                  <SelectItem value="french">French</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={regional.timezone} onValueChange={(value) => setRegional({ ...regional, timezone: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ist">Indian Standard Time</SelectItem>
                  <SelectItem value="pst">Pacific Standard Time</SelectItem>
                  <SelectItem value="est">Eastern Standard Time</SelectItem>
                  <SelectItem value="cst">Central Standard Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={regional.currency} onValueChange={(value) => setRegional({ ...regional, currency: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inr">Indian Rupee</SelectItem>
                  <SelectItem value="usd">US Dollar</SelectItem>
                  <SelectItem value="eur">Euro</SelectItem>
                  <SelectItem value="gbp">British Pound</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>Choose how you want to receive notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Notifications</Label>
              <p className="text-sm text-muted-foreground">Receive notifications via email</p>
            </div>
            <Switch
              checked={notifications.email}
              onCheckedChange={(checked) => setNotifications({ ...notifications, email: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>SMS Notifications</Label>
              <p className="text-sm text-muted-foreground">Receive notifications via SMS</p>
            </div>
            <Switch
              checked={notifications.sms}
              onCheckedChange={(checked) => setNotifications({ ...notifications, sms: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Push Notifications</Label>
              <p className="text-sm text-muted-foreground">Receive push notifications on your device</p>
            </div>
            <Switch
              checked={notifications.push}
              onCheckedChange={(checked) => setNotifications({ ...notifications, push: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Weather Alerts</Label>
              <p className="text-sm text-muted-foreground">Get notified about weather conditions</p>
            </div>
            <Switch
              checked={notifications.weather}
              onCheckedChange={(checked) => setNotifications({ ...notifications, weather: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>Irreversible and destructive actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-red-600">Delete Account</h4>
              <p className="text-sm text-muted-foreground">
                Once you delete your account, there is no going back. Please be certain.
              </p>
            </div>
            <Dialog open={deleteAccountDialog} onOpenChange={setDeleteAccountDialog}>
              <DialogTrigger asChild>
                <Button variant="destructive">Delete Account</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Are you absolutely sure?</DialogTitle>
                  <DialogDescription>
                    This action cannot be undone. This will permanently delete your account
                    and remove all your data from our servers.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="delete-confirmation">
                      Type <span className="font-mono bg-gray-100 px-1 rounded">DELETE</span> to confirm
                    </Label>
                    <Input
                      id="delete-confirmation"
                      value={deleteConfirmation}
                      onChange={(e) => setDeleteConfirmation(e.target.value)}
                      placeholder="DELETE"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDeleteAccountDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmation !== "DELETE"}
                  >
                    Delete Account
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
