import { useEffect, useState } from "react";
import { Bell, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface Alert {
  id: string;
  symbol: string;
  market: string;
  direction: string;
  target_price: number;
  reference_price: number | null;
  triggered: boolean;
  triggered_at: string | null;
  triggered_price: number | null;
  created_at: string;
}

export function AlertsManager() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("price_alerts")
      .select("*")
      .order("triggered", { ascending: true })
      .order("created_at", { ascending: false });
    setAlerts((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const remove = async (id: string) => {
    await supabase.rpc("delete_price_alert", { p_id: id });
    toast({ title: "Alert deleted" });
    setAlerts(alerts.filter(a => a.id !== id));
  };

  if (!user) return null;

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Price Alerts</h3>
        </div>
        <span className="text-xs text-muted-foreground">{alerts.filter(a => !a.triggered).length} active</span>
      </div>
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : alerts.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6">
          No alerts yet. Tap "Set Alert" on any stock or forex pair.
        </div>
      ) : (
        <ul className="space-y-2">
          {alerts.map(a => (
            <li key={a.id} className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${a.triggered ? "border-border/30 bg-secondary/30 opacity-70" : "border-border/50 bg-secondary/40"}`}>
              <div className="min-w-0">
                <div className="font-mono text-sm font-semibold">{a.symbol}</div>
                <div className="text-xs text-muted-foreground">
                  {a.direction === "above" ? "≥" : "≤"} {Number(a.target_price).toFixed(2)}
                  {a.triggered && a.triggered_price != null && (
                    <span className="ml-2 text-primary">· hit @ {Number(a.triggered_price).toFixed(2)}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => remove(a.id)}
                aria-label="Delete alert"
                className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-secondary"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
