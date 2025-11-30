import { useEffect, useMemo, useState } from "react";
import usePlatformData from "@/lib/usePlatformData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, CreditCard, Download, Plus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const Subscriptions = () => {
  const API_URL = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.REACT_APP_API_URL || "/api";
  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Token ${token}` } : {};
  };
  const [plans, setPlans] = useState<any[]>([]);
  const [userPlan, setUserPlan] = useState<any | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const { adminAnalytics, transactions: hookTx = [], plans: hookPlans = [], recentSubscriptions, loading } = usePlatformData();
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showPlanDialog, setShowPlanDialog] = useState<{ open: boolean; plan: any | null }>({ open: false, plan: null });
  const [card, setCard] = useState({ brand: "Visa", last4: "", exp_month: "", exp_year: "" });
  const [loadingPlan, setLoadingPlan] = useState<number | null>(null);
  const [showPmDetails, setShowPmDetails] = useState<{ open: boolean; pm: any | null }>({ open: false, pm: null });
  const [showPmPicker, setShowPmPicker] = useState(false);
  const [showDowngradeDialog, setShowDowngradeDialog] = useState(false);
  const [refundInfo, setRefundInfo] = useState<any>(null);
  const [selectedWhy, setSelectedWhy] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [loadingRefund, setLoadingRefund] = useState(false);

  const load = async () => {
    try {
      const [plansRes, upRes, pmRes, txRes] = await Promise.all([
        fetch(`${API_URL}/plans/`, { headers: authHeaders() }),
        fetch(`${API_URL}/subscriptions/user/`, { headers: authHeaders() }),
        fetch(`${API_URL}/payment-methods/`, { headers: authHeaders() }),
        fetch(`${API_URL}/transactions/`, { headers: authHeaders() }),
      ]);
      const j = async (r: Response) => {
        try {
          const parsed = await r.clone().json();
          return Array.isArray(parsed) ? parsed : parsed.results || [];
        } catch {
          return [];
        }
      };
  const parsedPlans = await j(plansRes);
  setPlans((Array.isArray(hookPlans) && hookPlans.length > 0) ? hookPlans : parsedPlans);
      const ups = await j(upRes);
      setUserPlan(Array.isArray(ups) ? ups[0] || null : ups || null);
  setPaymentMethods(await j(pmRes));
  const parsedTx = await j(txRes);
  setTransactions((Array.isArray(hookTx) && hookTx.length > 0) ? hookTx : parsedTx);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load subscriptions data");
    }
  };

  useEffect(() => { load(); }, []);

  // If hook provides an explicit current user subscription, prefer it for UI
  useEffect(() => {
    if (Array.isArray(recentSubscriptions) && recentSubscriptions.length > 0 && !userPlan) {
      setUserPlan(recentSubscriptions[0]);
    }
  }, [recentSubscriptions]);

  const selectPlan = async (planId: number) => {
    try {
      setLoadingPlan(planId);
      const today = new Date();
      const end = new Date();
      end.setDate(today.getDate() + 30);
      const res = await fetch(`${API_URL}/subscriptions/user/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ plan: planId, start_date: today.toISOString().slice(0,10), end_date: end.toISOString().slice(0,10), expire_at: end.toISOString() }),
      });
      if (res.ok) { toast.success("Plan selected"); setShowPlanDialog({ open: false, plan: null }); load(); } else { 
        const e = await res.json().catch(()=>({})); 
        toast.error(e.detail || e.message || "Failed to select plan");
        if (e.detail && e.detail.includes("active subscription")) {
          load(); // Reload to refresh UI
        }
      }
    } catch { toast.error("Failed to select plan"); } finally { setLoadingPlan(null); }
  };

  const canDowngrade = userPlan && (userPlan.plan_name || "").toLowerCase() !== "free";
  const isEnterprise = (userPlan?.plan_name || "").toLowerCase() === "enterprise";
  const isFreePlan = (planName: string) => planName.toLowerCase() === "free";
  const hasActivePaidPlan = userPlan && !isFreePlan(userPlan.plan_name) && userPlan.is_active;
  
  const loadRefundInfo = async () => {
    if (!userPlan || !canDowngrade) return;
    try {
      const res = await fetch(`${API_URL}/subscriptions/user/${userPlan.id}/refund-info/`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setRefundInfo(data);
      }
    } catch {}
  };

  const handleDowngradeClick = async () => {
    if (!userPlan) return;
    await loadRefundInfo();
    setShowDowngradeDialog(true);
  };

  const handleDowngrade = async (requestRefund: boolean) => {
    if (!userPlan) return;
    try {
      setLoadingRefund(true);
      const reason = selectedWhy === "other" ? customReason : selectedWhy;
      const res = await fetch(`${API_URL}/subscriptions/user/${userPlan.id}/downgrade/`, {
        method: 'POST',
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ request_refund: requestRefund, refund_reason: reason })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.refund_processed && data.refund_amount) {
          toast.success(`Downgraded to Free. Refund of ₹${data.refund_amount} processed.`);
          // Notify other pages to refresh platform data (analytics, transactions)
          try { window.dispatchEvent(new Event('platform-data-refresh')); } catch (e) {}
        } else {
          toast.success('Downgraded to Free');
        }
        setShowDowngradeDialog(false);
        load();
      } else {
        toast.error(data.detail || 'Failed to downgrade');
      }
    } catch (e: any) {
      toast.error('Failed to downgrade: ' + (e.message || 'Unknown error'));
    } finally {
      setLoadingRefund(false);
    }
  };

  const addPaymentMethod = async () => {
    if (!card.last4 || !card.exp_month || !card.exp_year) { toast.error("Fill card details"); return; }
    const res = await fetch(`${API_URL}/payment-methods/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ brand: card.brand, last4: card.last4.slice(-4), exp_month: Number(card.exp_month), exp_year: Number(card.exp_year), is_primary: !paymentMethods.length }),
    });
    if (res.ok) { toast.success("Payment method added"); setShowPaymentDialog(false); load(); } else { toast.error("Failed to add payment method"); }
  };

  const currentPlanName = userPlan?.plan_name || "Free";
  const billingHistory = useMemo(() => (transactions || []).map((t: any) => ({ id: t.id, date: new Date(t.created_at).toISOString().slice(0,10), plan: t.plan_name || "-", amount: `${t.amount || 0}`, status: t.status || "paid" })), [transactions]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Subscriptions</h1>
        <p className="text-muted-foreground">Manage your subscription plans and billing</p>
      </div>

      <Card className="border-primary/50">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Current Subscription: {currentPlanName}</CardTitle>
              <CardDescription>{currentPlanName === "Free" ? "No renewal required" : (userPlan?.is_active ? "Active" : "Inactive")}</CardDescription>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-primary">{(userPlan?.plan_details?.price || userPlan?.plan?.price) ? `₹${Number(userPlan.plan_details?.price || userPlan.plan?.price).toLocaleString()}` : "₹0.00"}<span className="text-sm text-muted-foreground">/period</span></p>
              {/* Show end date only for paid plans */}
              <p className="text-sm text-muted-foreground">{(currentPlanName && currentPlanName.toLowerCase() !== 'free' && userPlan?.end_date) ? `Ends ${userPlan.end_date}` : "—"}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button onClick={() => setShowPlanDialog({ open: true, plan: null })} disabled={isEnterprise || hasActivePaidPlan}>
              {hasActivePaidPlan ? "Cancel Current Plan First" : "Upgrade Plan"}
            </Button>
            <Button variant="outline" onClick={handleDowngradeClick} disabled={!canDowngrade}>Downgrade Plan</Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-2xl font-bold mb-4">Available Plans</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle>{plan.name}</CardTitle>
                  {plan.type === "main" && <Badge>Popular</Badge>}
                </div>
                <p className="text-3xl font-bold text-primary">₹{Number(plan.price).toLocaleString()}<span className="text-sm text-muted-foreground">/{plan.duration}d</span></p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-1">Features</p>
                  <ul className="text-sm list-disc ml-5 text-muted-foreground">
                    {(plan.features || []).map((f: string, idx: number) => (<li key={idx}>{f}</li>))}
                    {(!plan.features || plan.features.length === 0) && <li>Basic access</li>}
                  </ul>
                </div>
                {userPlan?.plan === plan.id ? (
                  <Button className="w-full" disabled>Current Plan</Button>
                ) : isFreePlan(plan.name) ? (
                  <Button className="w-full" disabled>Free Plan</Button>
                ) : hasActivePaidPlan ? (
                  <Button className="w-full" disabled title="Cancel current subscription first">Not Available</Button>
                ) : plan.type === "topup" ? (
                  (() => {
                    // Check if user has active main plan
                    const hasMainPlan = userPlan && userPlan.plan_details && 
                      (userPlan.plan_details.type === "main" || 
                       (userPlan.plan_name && userPlan.plan_name.toLowerCase().includes("main")));
                    return (
                      <Button 
                        className="w-full" 
                        onClick={() => setShowPlanDialog({ open: true, plan })}
                        disabled={!hasMainPlan}
                        title={!hasMainPlan ? "Top-up plan requires an active Main plan" : ""}
                      >
                        {!hasMainPlan ? "Requires Main Plan" : "View Details"}
                      </Button>
                    );
                  })()
                ) : (
                  <Button className="w-full" onClick={() => setShowPlanDialog({ open: true, plan })}>
                    View Details
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Methods</CardTitle>
          <CardDescription>Manage your payment options</CardDescription>
        </CardHeader>
        <CardContent>
          {paymentMethods.length === 0 && <p className="text-sm text-muted-foreground">No payment methods added.</p>}
          {paymentMethods.map((pm) => (
            <div key={pm.id} className="flex items-center justify-between p-4 border rounded-lg mb-2">
              <div className="flex items-center gap-3">
                <CreditCard className="h-6 w-6" />
                <div>
                  <p className="font-medium">{pm.brand} •••• {pm.last4}</p>
                  <p className="text-sm text-muted-foreground">Expires {pm.exp_month}/{pm.exp_year}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowPmDetails({ open: true, pm })}>View</Button>
                {pm.is_primary && <Badge variant="secondary">Primary</Badge>}
                <Button variant="outline" size="sm" onClick={async () => {
                  const res = await fetch(`${API_URL}/payment-methods/${pm.id}/`, { method: 'DELETE', headers: { ...authHeaders() } });
                  if (res.ok) { toast.success('Removed'); load(); } else { toast.error('Failed to remove'); }
                }}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
          <CardDescription>Your past invoices and payments</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {billingHistory.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.id}</TableCell>
                  <TableCell>{invoice.date}</TableCell>
                  <TableCell>{invoice.plan}</TableCell>
                  <TableCell>{invoice.amount}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{invoice.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => { const token = localStorage.getItem('token'); const url = `${API_URL}/transactions/${invoice.id}/invoice/${token ? `?token=${token}` : ''}`; window.open(url, "_blank"); }}>
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* dialogs below unchanged (payment, plan, pm picker, details, downgrade) */}

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Payment Method</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Brand</Label>
              <Input value={card.brand} onChange={(e) => setCard({ ...card, brand: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <Label>Last 4</Label>
                <Input maxLength={4} value={card.last4} onChange={(e) => setCard({ ...card, last4: e.target.value.replace(/[^0-9]/g, "") })} />
              </div>
              <div className="space-y-2">
                <Label>Exp Month</Label>
                <Input maxLength={2} value={card.exp_month} onChange={(e) => setCard({ ...card, exp_month: e.target.value.replace(/[^0-9]/g, "") })} />
              </div>
              <div className="space-y-2">
                <Label>Exp Year</Label>
                <Input maxLength={4} value={card.exp_year} onChange={(e) => setCard({ ...card, exp_year: e.target.value.replace(/[^0-9]/g, "") })} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>Cancel</Button>
              <Button onClick={addPaymentMethod}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPlanDialog.open} onOpenChange={(open) => setShowPlanDialog({ open, plan: open ? showPlanDialog.plan : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{showPlanDialog.plan?.name || 'Choose a Plan'}</DialogTitle>
          </DialogHeader>
          {!showPlanDialog.plan && (
            <div className="space-y-3">
              {plans.filter((p) => !isFreePlan(p.name)).map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">₹{Number(p.price).toLocaleString()} / {p.duration}d</p>
                  </div>
                  <Button size="sm" onClick={() => setShowPlanDialog({ open: true, plan: p })}>View</Button>
                </div>
              ))}
            </div>
          )}
          {showPlanDialog.plan && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">Details</p>
                <p className="text-sm text-muted-foreground">Duration: {showPlanDialog.plan.duration} days</p>
                <p className="text-sm text-muted-foreground">Cost: ₹{Number(showPlanDialog.plan.price).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Features</p>
                <ul className="text-sm list-disc ml-5 text-muted-foreground">
                  {(showPlanDialog.plan.features || []).map((f: string, idx: number) => (<li key={idx}>{f}</li>))}
                  {(!showPlanDialog.plan.features || showPlanDialog.plan.features.length === 0) && <li>Basic access</li>}
                </ul>
              </div>
              <div className="flex justify-end">
                {isFreePlan(showPlanDialog.plan.name) ? (
                  <Button disabled>Free Plan - No Payment Required</Button>
                ) : (
                  <Button onClick={async () => {
                    try {
                      setLoadingPlan(showPlanDialog.plan.id);
                      if (paymentMethods.length > 0) {
                        setShowPmPicker(true);
                      } else {
                        const orderRes = await fetch(`${API_URL}/subscriptions/razorpay/order/`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', ...authHeaders() },
                          body: JSON.stringify({ plan_id: showPlanDialog.plan.id, currency: 'INR' })
                        });
                        const order = await orderRes.json();
                        if (!orderRes.ok) throw new Error(order.detail || 'Failed to create order');
                        if (!(window as any).Razorpay) {
                          await new Promise((resolve, reject) => {
                            const s = document.createElement('script');
                            s.src = 'https://checkout.razorpay.com/v1/checkout.js';
                            s.onload = resolve;
                            s.onerror = () => reject(new Error('Failed to load Razorpay'));
                            document.body.appendChild(s);
                          });
                        }
                        const key = (import.meta as any).env.VITE_RAZORPAY_KEY_ID || (import.meta as any).env.REACT_APP_RAZORPAY_KEY_ID;
                        const options: any = {
                          key,
                          amount: order.amount,
                          currency: order.currency,
                          name: 'AgriSpark',
                          description: showPlanDialog.plan.name,
                          order_id: order.id,
                          prefill: {},
                          theme: { color: '#0ea5e9' },
                          handler: async function (response: any) {
                            try {
                              const successRes = await fetch(`${API_URL}/subscriptions/razorpay/success/`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                                body: JSON.stringify({
                                  razorpay_payment_id: response.razorpay_payment_id,
                                  razorpay_order_id: response.razorpay_order_id,
                                  razorpay_signature: response.razorpay_signature,
                                  plan_id: showPlanDialog.plan.id
                                })
                              });
                              const successData = await successRes.json();
                              if (successRes.ok) {
                                toast.success('Payment successful! Plan activated.');
                                setShowPlanDialog({ open: false, plan: null });
                                load();
                              } else {
                                toast.error(successData.detail || 'Payment verification failed');
                              }
                            } catch (error: any) {
                              toast.error('Failed to verify payment: ' + (error.message || 'Unknown error'));
                            }
                          },
                          modal: {
                            ondismiss: function() {
                              setLoadingPlan(null);
                            }
                          }
                        };
                        const rzp = new (window as any).Razorpay(options);
                        rzp.on('payment.failed', function (response: any) {
                          toast.error('Payment failed: ' + (response.error?.description || 'Unknown error'));
                          setLoadingPlan(null);
                        });
                        rzp.open();
                      }
                  } catch (e: any) {
                    toast.error(e.message || 'Payment failed to initialize');
                    setLoadingPlan(null);
                  }
                  }} disabled={loadingPlan === showPlanDialog.plan.id || hasActivePaidPlan}>
                    {hasActivePaidPlan ? "Cancel Current Plan First" : loadingPlan === showPlanDialog.plan.id ? 'Processing...' : 'Make Payment'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showPmPicker} onOpenChange={(open) => { setShowPmPicker(open); if (!open) setLoadingPlan(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select a saved card</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {paymentMethods.map((pm) => (
              <div key={pm.id} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <p className="font-medium">{pm.brand} •••• {pm.last4}</p>
                  <p className="text-xs text-muted-foreground">Exp {pm.exp_month}/{pm.exp_year} {pm.is_primary ? '(Primary)' : ''}</p>
                </div>
                <Button size="sm" onClick={async () => {
                  try {
                    const orderRes = await fetch(`${API_URL}/subscriptions/razorpay/order/`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', ...authHeaders() },
                      body: JSON.stringify({ plan_id: showPlanDialog.plan.id, currency: 'INR' })
                    });
                    const order = await orderRes.json();
                    if (!orderRes.ok) throw new Error(order.detail || 'Failed to create order');

                    if (!(window as any).Razorpay) {
                      await new Promise((resolve, reject) => {
                        const s = document.createElement('script');
                        s.src = 'https://checkout.razorpay.com/v1/checkout.js';
                        s.onload = resolve;
                        s.onerror = () => reject(new Error('Failed to load Razorpay'));
                        document.body.appendChild(s);
                      });
                    }

                    const key = (import.meta as any).env.VITE_RAZORPAY_KEY_ID || (import.meta as any).env.REACT_APP_RAZORPAY_KEY_ID;
                    const rzp = new (window as any).Razorpay({
                      key,
                      amount: order.amount,
                      currency: order.currency,
                      name: 'AgriSpark',
                      description: `${showPlanDialog.plan.name} - Paying with ${pm.brand} •••• ${pm.last4}`,
                      order_id: order.id,
                      prefill: {},
                      notes: { payment_method_id: String(pm.id) },
                      theme: { color: '#0ea5e9' },
                      handler: async function (response: any) {
                        try {
                          const successRes = await fetch(`${API_URL}/subscriptions/razorpay/success/`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', ...authHeaders() },
                            body: JSON.stringify({
                              razorpay_payment_id: response.razorpay_payment_id,
                              razorpay_order_id: response.razorpay_order_id,
                              razorpay_signature: response.razorpay_signature,
                              plan_id: showPlanDialog.plan.id
                            })
                          });
                          const successData = await successRes.json();
                          if (successRes.ok) {
                            toast.success('Payment successful! Plan activated.');
                            setShowPmPicker(false);
                            setShowPlanDialog({ open: false, plan: null });
                            setLoadingPlan(null);
                            load();
                          } else {
                            toast.error(successData.detail || 'Payment verification failed');
                            setLoadingPlan(null);
                          }
                        } catch (error: any) {
                          toast.error('Failed to verify payment: ' + (error.message || 'Unknown error'));
                          setLoadingPlan(null);
                        }
                      },
                      modal: {
                        ondismiss: function() {
                          setLoadingPlan(null);
                        }
                      }
                    });
                    rzp.on('payment.failed', function (response: any) {
                      toast.error('Payment failed: ' + (response.error?.description || 'Unknown error'));
                      setLoadingPlan(null);
                    });
                    rzp.open();
                  } catch (err: any) {
                    toast.error(err.message || 'Failed to start payment');
                    setLoadingPlan(null);
                  }
                }}>Pay</Button>
              </div>
            ))}
            {paymentMethods.length === 0 && (
              <p className="text-sm text-muted-foreground">No saved cards. Please add a payment method first.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPmDetails.open} onOpenChange={(open) => setShowPmDetails({ open, pm: open ? showPmDetails.pm : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Card details</DialogTitle>
          </DialogHeader>
          {showPmDetails.pm && (
            <div className="space-y-2">
              <p className="text-sm">Brand: {showPmDetails.pm.brand}</p>
              <p className="text-sm">Last 4: {showPmDetails.pm.last4}</p>
              <p className="text-sm">Expires: {showPmDetails.pm.exp_month}/{showPmDetails.pm.exp_year}</p>
              <p className="text-sm">Primary: {showPmDetails.pm.is_primary ? 'Yes' : 'No'}</p>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setShowPmDetails({ open: false, pm: null })}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDowngradeDialog} onOpenChange={(open) => { setShowDowngradeDialog(open); if (!open) { setSelectedWhy(""); setCustomReason(""); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Why are you downgrading?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select a reason</Label>
              <div className="space-y-2">
                {[
                  "Too expensive",
                  "Features not needed",
                  "Switching to another service",
                  "Temporary pause",
                  "Other"
                ].map((reason) => (
                  <div key={reason} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={`reason-${reason}`}
                      name="downgrade-reason"
                      value={reason === "Other" ? "other" : reason.toLowerCase()}
                      checked={selectedWhy === (reason === "Other" ? "other" : reason.toLowerCase())}
                      onChange={(e) => setSelectedWhy(e.target.value)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor={`reason-${reason}`} className="cursor-pointer font-normal">{reason}</Label>
                  </div>
                ))}
              </div>
              {selectedWhy === "other" && (
                <Input
                  placeholder="Please specify..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="mt-2"
                />
              )}
            </div>

            {refundInfo && (
              <div className="p-4 border rounded-lg bg-muted/50">
                <h4 className="font-semibold mb-2">Refund Information</h4>
                <div className="space-y-1 text-sm">
                  <p>Original Payment: ₹{Number(refundInfo.payment_info?.amount || 0).toLocaleString()}</p>
                  <p>Days Since Purchase: {refundInfo.payment_info?.days_since || 0}</p>
                  <p>Refund Policy: {refundInfo.refund_policy ? `${refundInfo.refund_policy.percentage}% within ${refundInfo.refund_policy.days_after_purchase} days` : 'No policy configured (full refund possible)'} </p>
                  {refundInfo.refund_available ? (
                    <p className="text-green-600 font-semibold">Refund Amount: ₹{Number(refundInfo.refund_amount || 0).toLocaleString()}</p>
                  ) : (
                    <p className="text-muted-foreground">{refundInfo.reason}</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowDowngradeDialog(false)} disabled={loadingRefund}>
                Cancel
              </Button>
              {refundInfo?.refund_available && (
                <Button
                  onClick={() => handleDowngrade(true)}
                  disabled={!selectedWhy || loadingRefund}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {loadingRefund ? "Processing..." : `Downgrade & Get ₹${refundInfo.refund_amount} Refund`}
                </Button>
              )}
              <Button
                onClick={() => handleDowngrade(false)}
                disabled={!selectedWhy || loadingRefund}
                variant="destructive"
              >
                {loadingRefund ? "Processing..." : "Downgrade Without Refund"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Subscriptions;

