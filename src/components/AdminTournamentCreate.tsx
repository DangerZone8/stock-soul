import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Swords } from "lucide-react";

export function AdminTournamentCreate() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Special Tournament");
  const [market, setMarket] = useState<"stock" | "forex" | "both">("both");
  const [entry, setEntry] = useState(100);
  const [pool, setPool] = useState(1000);
  const [starts, setStarts] = useState(() => new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16));
  const [ends, setEnds] = useState(() => new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString().slice(0, 16));

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    (supabase.rpc as any)("is_admin").then(({ data }: any) => setIsAdmin(!!data));
  }, [user]);

  if (!isAdmin) return null;

  const create = async () => {
    const { data, error } = await supabase.rpc("create_tournament", {
      p_name: name,
      p_market: market,
      p_entry_fee: entry,
      p_prize_pool: pool,
      p_starts_at: new Date(starts).toISOString(),
      p_ends_at: new Date(ends).toISOString(),
      p_kind: "custom",
    });
    if (error || !data?.[0]?.success) {
      toast({ title: "Failed", description: error?.message || data?.[0]?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Tournament created" });
    setOpen(false);
  };

  return (
    <section className="container mx-auto px-4 max-w-6xl">
      <button onClick={() => setOpen(o => !o)} className="text-xs px-3 py-1.5 rounded-lg bg-secondary/50 border border-border/30 flex items-center gap-1.5">
        <Swords className="w-3 h-3" />{open ? "Close" : "Admin: Create Tournament"}
      </button>
      {open && (
        <div className="glass-card p-4 mt-2 grid grid-cols-2 gap-3 text-sm">
          <label className="col-span-2">Name<input value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 bg-secondary/50 rounded px-2 py-1.5" /></label>
          <label>Market
            <select value={market} onChange={e => setMarket(e.target.value as any)} className="w-full mt-1 bg-secondary/50 rounded px-2 py-1.5">
              <option value="both">Both</option><option value="stock">Stock</option><option value="forex">Forex</option>
            </select>
          </label>
          <label>Entry Fee<input type="number" value={entry} onChange={e => setEntry(+e.target.value)} className="w-full mt-1 bg-secondary/50 rounded px-2 py-1.5" /></label>
          <label>Prize Pool<input type="number" value={pool} onChange={e => setPool(+e.target.value)} className="w-full mt-1 bg-secondary/50 rounded px-2 py-1.5" /></label>
          <label>Starts<input type="datetime-local" value={starts} onChange={e => setStarts(e.target.value)} className="w-full mt-1 bg-secondary/50 rounded px-2 py-1.5" /></label>
          <label>Ends<input type="datetime-local" value={ends} onChange={e => setEnds(e.target.value)} className="w-full mt-1 bg-secondary/50 rounded px-2 py-1.5" /></label>
          <button onClick={create} className="btn-terminal col-span-2 py-2">Create</button>
        </div>
      )}
    </section>
  );
}
