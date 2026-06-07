import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Flame, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface StreakInfo {
  current_streak: number;
  longest_streak: number;
  last_claim: string | null;
  can_claim_today: boolean;
}

export function StreakCard() {
  const { user } = useAuth();
  const [info, setInfo] = useState<StreakInfo | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase.rpc as any)("get_streak_info");
    if (data?.[0]) setInfo(data[0]);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const claim = async () => {
    setBusy(true);
    const { data, error } = await (supabase.rpc as any)("claim_daily_reward");
    setBusy(false);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    const row = data?.[0];
    if (row?.claimed) toast({ title: "Reward claimed!", description: row.message });
    else toast({ title: row?.message || "Already claimed today" });
    load();
  };

  if (!user || !info) return null;

  const next = info.current_streak + 1;
  const nextReward = 250 + Math.min(250, (next - 1) * 25);

  return (
    <section className="container mx-auto px-4 max-w-6xl">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-5 flex flex-col sm:flex-row items-center justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/10 border border-orange-500/30 flex items-center justify-center">
              <Flame className={`w-7 h-7 ${info.current_streak > 0 ? "text-orange-400" : "text-muted-foreground"}`} />
            </div>
            {info.current_streak >= 7 && (
              <span className="absolute -top-1 -right-1 text-xs">🔥</span>
            )}
          </div>
          <div>
            <div className="font-bold text-lg">
              {info.current_streak}-day streak
              <span className="text-xs text-muted-foreground ml-2">Best: {info.longest_streak}</span>
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              {info.can_claim_today
                ? `Claim today → +${nextReward} coins (Day ${next})`
                : "Come back tomorrow to keep your streak alive"}
            </div>
          </div>
        </div>
        <button
          onClick={claim}
          disabled={!info.can_claim_today || busy}
          className="btn-terminal flex items-center gap-2 disabled:opacity-40"
        >
          <Gift className="w-4 h-4" />
          {info.can_claim_today ? (busy ? "Claiming..." : "Claim daily reward") : "Claimed ✓"}
        </button>
      </motion.div>
    </section>
  );
}
