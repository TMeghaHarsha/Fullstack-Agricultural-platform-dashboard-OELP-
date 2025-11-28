import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Leaf, Mail, Lock, User, Phone } from "lucide-react";
import { toast } from "sonner";

const Login = () => {
  const navigate = useNavigate();
  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [resetOpen, setResetOpen] = useState(false);
  const [reset, setReset] = useState({ username: "", new_password: "", confirm_password: "" });
  const [signupData, setSignupData] = useState({
    username: "",
    full_name: "",
    phone_number: "",
    password: "",
    confirmPassword: "",
    google_id: "",
    avatar: "",
  });

  // Fixed: Use VITE_API_BASE_URL and add deployed backend as fallback
  const API_URL = (import.meta as any).env.VITE_API_URL ||  
                  'https://oelp-backend-t8w3.onrender.com/api';
  
  console.log('🔧 Using API URL:', API_URL); // Debug log

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginData.username || !loginData.password) {
      toast.error("Please fill in all fields");
      return;
    }
    
    try {
      console.log('📡 Login request to:', `${API_URL}/auth/login/`);
      const res = await fetch(`${API_URL}/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginData),
      });
      
      console.log('📨 Login response status:', res.status);
      
      if (res.ok) {
        const data = await res.json();
        console.log('✅ Login response data:', data);
        
        if (data.token) {
          localStorage.setItem("token", data.token);
          
          // Store user data with roles
          if (data.user) {
            localStorage.setItem("user", JSON.stringify(data.user));
            // Also store roles separately for easy access
            if (data.user.roles) {
              localStorage.setItem("user_roles", JSON.stringify(data.user.roles));
            }
          }
          
          toast.success("Welcome back!");
          
          // Small delay to ensure localStorage is updated
          setTimeout(() => {
            navigate("/");
            // Force a reload to ensure App.tsx picks up the new token and roles
            window.location.href = "/";
          }, 100);
        } else {
          toast.error("Login succeeded but no token received");
        }
      } else {
        const error = await res.json().catch(() => ({}));
        console.error('❌ Login error:', error);
        toast.error(error.detail || "Invalid credentials");
      }
    } catch (error: any) {
      console.error('❌ Login network error:', error);
      toast.error(error?.message || "Network error during login");
    }
  };

  const [submitting, setSubmitting] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupData.username || !signupData.full_name || !signupData.phone_number || !signupData.password) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (signupData.password.length < 8) {
      toast.error("Password should be at least 8 characters long");
      return;
    }
    if (signupData.password !== signupData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    try {
      setSubmitting(true);
      console.log('📡 Signup request to:', `${API_URL}/auth/signup/`); // Debug log
      const res = await fetch(`${API_URL}/auth/signup/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: signupData.username,
          full_name: signupData.full_name,
          phone_number: signupData.phone_number,
          password: signupData.password,
          google_id: signupData.google_id || undefined,
          avatar: signupData.avatar || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) localStorage.setItem("token", data.token);
        toast.success("Account created! Redirecting...");
        setTimeout(() => navigate("/"), 800);
      } else {
        const err = await res.json().catch(() => ({}));
        const firstFieldError = err?.username?.[0] || err?.full_name?.[0] || err?.password?.[0] || err?.phone_number?.[0];
        toast.error(err.detail || firstFieldError || `Signup failed (${res.status})`);
      }
    } catch (error: any) {
      toast.error(error?.message || "Network error during signup");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md shadow-2xl border-primary/20">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
              <Leaf className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-primary">FarmPlatform</CardTitle>
          <CardDescription>Sign in to your agricultural dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="username"
                      type="text"
                      placeholder="yourusername"
                      className="pl-10"
                      value={loginData.username}
                      onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      className="pl-10"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end">
                    <button type="button" className="text-xs underline" onClick={() => setResetOpen(true)}>Forgot Password?</button>
                  </div>
                </div>
                <Button type="submit" className="w-full">
                  Sign In
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="username"
                      type="text"
                      placeholder="yourusername"
                      className="pl-10"
                      value={signupData.username}
                      onChange={(e) => setSignupData({ ...signupData, username: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="full_name"
                      type="text"
                      placeholder="John Farmer"
                      className="pl-10"
                      value={signupData.full_name}
                      onChange={(e) => setSignupData({ ...signupData, full_name: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone_number">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone_number"
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      className="pl-10"
                      value={signupData.phone_number}
                      onChange={(e) => setSignupData({ ...signupData, phone_number: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="google_id">Google ID (optional)</Label>
                    <Input id="google_id" value={signupData.google_id} onChange={(e) => setSignupData({ ...signupData, google_id: (e.target as HTMLInputElement).value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="avatar">Avatar URL (optional)</Label>
                    <Input id="avatar" value={signupData.avatar} onChange={(e) => setSignupData({ ...signupData, avatar: (e.target as HTMLInputElement).value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type="password"
                      className="pl-10"
                      value={signupData.password}
                      onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirm-password"
                      type="password"
                      className="pl-10"
                      value={signupData.confirmPassword}
                      onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  Create Account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      {resetOpen && (
        <div className="fixed inset-0">
          <div className="absolute inset-0 bg-black/30" onClick={() => setResetOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-background p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Reset Password</h3>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input value={reset.username} onChange={(e) => setReset({ ...reset, username: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input type="password" value={reset.new_password} onChange={(e) => setReset({ ...reset, new_password: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Confirm New Password</Label>
                <Input type="password" value={reset.confirm_password} onChange={(e) => setReset({ ...reset, confirm_password: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
                <Button onClick={async () => {
                  if (!reset.username || !reset.new_password || !reset.confirm_password) { toast.error("Fill all fields"); return; }
                  if (reset.new_password !== reset.confirm_password) { toast.error("Passwords do not match"); return; }
                  console.log('📡 Password reset request to:', `${API_URL}/auth/password/reset/`); // Debug log
                  const res = await fetch(`${API_URL}/auth/password/reset/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reset) });
                  if (res.ok) { toast.success("Password reset. Please sign in."); setResetOpen(false); } else { const err = await res.json().catch(() => ({})); toast.error(err.detail || 'Failed to reset'); }
                }}>Reset</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
