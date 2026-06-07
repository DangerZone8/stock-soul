import { useEffect, useState } from "react";
import { Bell, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Notif {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    if (data) setItems(data as any);
  };

  useEffect(() => {
    if (!user) { setItems([]); return; }
    load();
    const ch = supabase
      .channel(`notif-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (p) => setItems((prev) => [p.new as any, ...prev].slice(0, 30)))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const unread = items.filter(i => !i.read).length;

  const markAll = async () => {
    await supabase.rpc("mark_notifications_read", { p_ids: null });
    setItems(items.map(i => ({ ...i, read: true })));
  };

  const remove = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    setItems(items.filter(i => i.id !== id));
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v && unread > 0) markAll(); }}>
      <PopoverTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50"
        >
          <Bell className="w-5 h-5" strokeWidth={1.5} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 max-h-[70vh] overflow-y-auto">
        <div className="flex items-center justify-between p-3 border-b border-border/40">
          <div className="font-semibold text-sm">Notifications</div>
          {items.some(i => !i.read) && (
            <button onClick={markAll} className="text-xs text-primary flex items-center gap-1 hover:underline">
              <Check className="w-3 h-3" /> Mark all read
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No notifications yet</div>
        ) : (
          <ul className="divide-y divide-border/40">
            {items.map(n => (
              <li key={n.id} className={`p-3 text-sm ${!n.read ? "bg-primary/5" : ""}`}>
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{n.title}</div>
                    {n.body && <div className="text-xs text-muted-foreground mt-0.5">{n.body}</div>}
                    {n.link && (
                      <a href={n.link} className="text-xs text-primary hover:underline mt-1 inline-block">
                        View →
                      </a>
                    )}
                    <div className="text-[10px] text-muted-foreground/70 mt-1">
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                  </div>
                  <button onClick={() => remove(n.id)} aria-label="Delete" className="text-muted-foreground hover:text-destructive shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
