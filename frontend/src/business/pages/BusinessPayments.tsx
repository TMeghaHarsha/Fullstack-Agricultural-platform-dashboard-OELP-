import { useMemo, useState } from "react";
import usePlatformData from "@/lib/usePlatformData";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const API_URL = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.REACT_APP_API_URL || "/api";

export default function BusinessPayments() {
  const { transactions: txns = [], loading } = usePlatformData();
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
  let arr = txns || [];
    if (query.trim()) {
      const q = query.toLowerCase();
      arr = arr.filter((t:any)=>
        String(t.id).includes(q) ||
        (t.plan?.name || '').toLowerCase().includes(q) ||
        (t.status || '').toLowerCase().includes(q)
      );
    }
    return arr;
  }, [txns, query]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Payments</h1>
        <p className="text-muted-foreground">View transactions data</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>Initially empty until payments are integrated</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-3">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search transactions..." className="pl-9" value={query} onChange={(e)=> setQuery(e.target.value)} />
            </div>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((t:any)=> (
                  <TableRow key={t.id}>
                    <TableCell>{t.id}</TableCell>
                    <TableCell>{t.plan?.name || '-'}</TableCell>
                    <TableCell>{t.amount ? `₹${t.amount}` : '-'}</TableCell>
                    <TableCell className="capitalize">{(t.status || '-')}</TableCell>
                    <TableCell>{t.created_at ? new Date(t.created_at).toLocaleString() : '-'}</TableCell>
                  </TableRow>
                ))}
                {visible.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-sm text-muted-foreground">No transactions yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
