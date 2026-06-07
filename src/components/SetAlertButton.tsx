import { useState } from "react";
import { Bell } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface Props {
  symbol: string;
  currentPrice?: number;
  market?: "stock" | "forex" | "crypto";
  size?: "sm" | "md";
}

export function SetAlertButton({ symbol, currentPrice, market = "stock", size = "md" }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [target, setTarget] = useState<string>(currentPrice ? currentPrice.toFixed(2) : "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!user) {
      toast({ title: "Sign in required", description: "Sign in to set price alerts." });
      return;
    }
    const t = parseFloat(target);
    if (!Number.isFinite(t) || t <= 0) {
      toast({ title: "Invalid price", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.rpc("create_price_alert", {
      p_symbol: symbol,
      p_market: market,
      p_direction: direction,
      p_target: t,
      p_reference: currentPrice ?? null,
      p_notify_email: false,
    });
    setSaving(false);
    if (error || !data?.[0]?.success) {
      toast({ title: "Failed", description: (data?.[0]?.message ?? error?.message) || "Try again", variant: "destructive" });
      return;
    }
    toast({ title: "Alert set", description: `${symbol} ${direction} ${t}` });
    setOpen(false);
  };

  const cls = size === "sm"
    ? "h-9 px-3 text-xs"
    : "h-10 px-4 text-sm";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className={`${cls} inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-secondary/50 text-foreground font-medium hover:bg-secondary transition`}
          aria-label={`Set price alert for ${symbol}`}
        >
          <Bell className="w-4 h-4" strokeWidth={1.5} /> Set Alert
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Price alert · {symbol}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {currentPrice != null && (
            <div className="text-xs text-muted-foreground">Current: <span className="font-mono text-foreground">{currentPrice.toFixed(2)}</span></div>
          )}
          <div className="space-y-2">
            <Label>Notify me when price is</Label>
            <RadioGroup value={direction} onValueChange={(v) => setDirection(v as any)} className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="above" /> Above
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="below" /> Below
              </label>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label>Target price</Label>
            <Input
              type="number"
              step="0.01"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="w-full h-10 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Create alert"}
          </button>
          <p className="text-[11px] text-muted-foreground text-center">
            You'll get an in-app notification (bell icon) when the target is hit. Checks run every minute.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
