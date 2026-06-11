import { useEffect, useState, useCallback, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Search, UserPlus, Check, MessageCircle, Heart, Send, X, Loader as Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface UserRow { id: string; username: string; coins: number; net_profit: number; }
interface FriendRow { other_id: string; username: string; coins: number; net_profit: number; status: string; is_incoming: boolean; }
interface TradeRow { symbol: string; type: string; quantity: number; price: number; created_at: string; }
interface DM { id: string; sender_id: string; recipient_id: string; body: string; created_at: string; }

export function FriendsTab({ onOpenUser }: { onOpenUser: (id: string, username: string) => void }) {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<UserRow[]>([]);
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [leaderKind, setLeaderKind] = useState<"coins" | "profit">("coins");
  const [friendBoard, setFriendBoard] = useState<{ rank: number; user_id: string; username: string; coins: number; net_profit: number }[]>([]);
  const friendChannelRef = useRef<RealtimeChannel | null>(null);
  const friendshipSetupDoneRef = useRef(false);

  const loadFriends = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("get_friendships");
      if (error) {
        console.error("Error loading friends:", error);
        return;
      }
      if (data) setFriends(data as FriendRow[]);
    } catch (err) {
      console.error("Exception loading friends:", err);
    }
  }, []);

  const loadFriendBoard = useCallback(async (kind: "coins" | "profit") => {
    try {
      const { data, error } = await supabase.rpc("get_friends_leaderboard", { p_kind: kind });
      if (error) {
        console.error("Error loading friend board:", error);
        return;
      }
      if (data) setFriendBoard(data as never);
    } catch (err) {
      console.error("Exception loading friend board:", err);
    }
  }, []);

  useEffect(() => { loadFriends(); }, [loadFriends]);
  useEffect(() => { loadFriendBoard(leaderKind); }, [leaderKind, loadFriendBoard]);

  // Setup realtime for friendships ONCE
  useEffect(() => {
    if (!user) {
      if (friendChannelRef.current) {
        supabase.removeChannel(friendChannelRef.current);
        friendChannelRef.current = null;
      }
      friendshipSetupDoneRef.current = false;
      return;
    }

    // Only setup once per user
    if (friendshipSetupDoneRef.current) {
      return;
    }
    friendshipSetupDoneRef.current = true;

    if (friendChannelRef.current) {
      supabase.removeChannel(friendChannelRef.current);
    }

    // Create channel with postgres_changes listeners BEFORE subscribe
    const ch = supabase.channel(`friendships-${user.id}`);
    
    ch.on("postgres_changes", 
      { event: "*", schema: "public", table: "friendships" }, 
      () => {
        loadFriends();
        loadFriendBoard(leaderKind);
      }
    );

    // Subscribe after listeners are attached
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        friendChannelRef.current = ch;
        console.log("Friendships channel subscribed");
      } else if (status === "CHANNEL_ERROR") {
        console.error("Friendships channel error");
      }
    });

    // Safety poll every 8s in case realtime drops
    const poll = setInterval(() => {
      loadFriends();
      loadFriendBoard(leaderKind);
    }, 8000);

    return () => {
      if (friendChannelRef.current === ch) {
        supabase.removeChannel(ch);
        friendChannelRef.current = null;
      }
      clearInterval(poll);
    };
  }, [user, leaderKind, loadFriends, loadFriendBoard]);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const { data, error } = await supabase.rpc("search_users", { p_q: q.trim(), p_limit: 10 });
        if (error) {
          console.error("Error searching users:", error);
        }
        setResults((data as UserRow[]) || []);
      } catch (err) {
        console.error("Exception searching users:", err);
        setResults([]);
      }
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const sendRequest = async (id: string) => {
    try {
      const { data, error } = await supabase.rpc("send_friend_request", { p_addressee: id });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      const row = data?.[0];
      toast({ title: row?.success ? "Sent!" : "Hmm", description: row?.message || "" });
      await loadFriends();
    } catch (err) {
      console.error("Exception sending friend request:", err);
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to send request", variant: "destructive" });
    }
  };

  const accept = async (id: string) => {
    try {
      const { data, error } = await supabase.rpc("accept_friend_request", { p_requester: id });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      const row = data?.[0];
      toast({ title: row?.success ? "Friend added" : "Error", description: row?.message || "" });
      await loadFriends();
    } catch (err) {
      console.error("Exception accepting friend request:", err);
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to accept request", variant: "destructive" });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2"><Search className="w-4 h-4 text-primary" /><h3 className="font-semibold">Find traders</h3></div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by username..."
            className="w-full h-11 pl-10 pr-3 rounded-lg bg-secondary/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/40" />
          {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {results.length === 0 && q && !searching && <p className="text-sm text-muted-foreground text-center py-4">No users found</p>}
          {results.map(u => (
            <div key={u.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 border border-border/30">
              <button onClick={() => onOpenUser(u.id, u.username)} className="text-left flex-1">
                <div className="font-semibold text-sm">{u.username}</div>
                <div className="text-xs text-muted-foreground font-mono">{Number(u.coins).toFixed(2)} coins · P/L {Number(u.net_profit) >= 0 ? "+" : ""}{Number(u.net_profit).toFixed(2)}</div>
              </button>
              <button onClick={() => sendRequest(u.id)} className="h-8 px-3 rounded-md bg-primary/15 text-primary text-xs font-medium hover:bg-primary/25 flex items-center gap-1">
                <UserPlus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-border/30 pt-4">
          <h4 className="font-semibold text-sm mb-2">Your friends ({friends.filter(f => f.status === "accepted").length})</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {friends.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No friends yet — search above to start.</p>}
            {friends.map(f => (
              <div key={f.other_id} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30">
                <button onClick={() => onOpenUser(f.other_id, f.username)} className="text-left flex-1">
                  <div className="text-sm font-medium">{f.username}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {f.status === "pending" ? (f.is_incoming ? "Wants to be friends" : "Request sent") : `${Number(f.coins).toFixed(2)} coins`}
                  </div>
                </button>
                {f.status === "pending" && f.is_incoming ? (
                  <button onClick={() => accept(f.other_id)} className="h-8 px-3 rounded-md bg-green-500/15 text-green-500 text-xs font-medium hover:bg-green-500/25 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Accept
                  </button>
                ) : f.status === "accepted" ? (
                  <button onClick={() => onOpenUser(f.other_id, f.username)} className="h-8 px-3 rounded-md bg-secondary border border-border/50 text-xs font-medium hover:bg-secondary/80 flex items-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5" /> Chat
                  </button>
                ) : <span className="text-xs text-muted-foreground">Pending</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Friends Leaderboard</h3>
          <div className="flex gap-1.5">
            <button onClick={() => setLeaderKind("coins")} className={`px-2.5 h-8 rounded-md text-xs font-medium ${leaderKind === "coins" ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-muted-foreground hover:bg-secondary"}`}>Coins</button>
            <button onClick={() => setLeaderKind("profit")} className={`px-2.5 h-8 rounded-md text-xs font-medium ${leaderKind === "profit" ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-muted-foreground hover:bg-secondary"}`}>Profit</button>
          </div>
        </div>
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {friendBoard.length <= 1 && <p className="text-sm text-muted-foreground text-center py-6">Add friends to see them here.</p>}
          {friendBoard.map(r => (
            <button key={r.user_id} onClick={() => onOpenUser(r.user_id, r.username)} className="w-full flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors text-left">
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-sm w-6">#{r.rank}</span>
                <div>
                  <div className="text-sm font-medium">{r.username}</div>
                  <div className="text-xs text-muted-foreground font-mono">{Number(r.coins).toFixed(2)} coins</div>
                </div>
              </div>
              <span className={`font-mono text-sm ${Number(r.net_profit) >= 0 ? "text-green-500" : "text-red-500"}`}>
                {Number(r.net_profit) >= 0 ? "+" : ""}{Number(r.net_profit).toFixed(2)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProfileTab() {
  const { profile, refreshProfile } = useAuth();
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const remaining = 5 - (profile?.username_changes ?? 0);

  const change = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("change_username", { p_new: newName.trim() });
      if (error) {
        toast({ title: "Couldn't change", description: error.message, variant: "destructive" });
        return;
      }
      const row = data?.[0];
      if (!row?.success) {
        toast({ title: "Couldn't change", description: row?.message || "Unknown error", variant: "destructive" });
      } else {
        toast({ title: "Username updated", description: `You have ${row.remaining} change(s) left.` });
        setNewName("");
        await refreshProfile();
      }
    } catch (err) {
      console.error("Exception changing username:", err);
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to change username", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="glass-card p-6">
        <h3 className="font-semibold mb-2">Your Profile</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Username</span><span className="font-mono font-semibold">{profile?.username || "—"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Coins</span><span className="font-mono text-amber-500 font-semibold">{Number(profile?.coins ?? 0).toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Net Profit</span><span className={`font-mono ${(profile?.net_profit ?? 0) >= 0 ? "text-green-500" : "text-red-500"} font-semibold`}>{Number(profile?.net_profit ?? 0).toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Username changes left</span><span className="font-mono">{remaining}/5</span></div>
        </div>
      </div>
      <div className="glass-card p-6">
        <h3 className="font-semibold mb-2">Change Username</h3>
        <p className="text-xs text-muted-foreground mb-3">3-24 chars · letters, numbers, underscore. Max 5 changes total.</p>
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="new_username"
          disabled={remaining <= 0}
          className="w-full h-11 px-3 rounded-lg bg-secondary/50 border border-border/50 font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 mb-3 disabled:opacity-50" />
        <button onClick={change} disabled={busy || remaining <= 0 || !newName.trim()}
          className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-60">
          {remaining <= 0 ? "No changes left" : "Update username"}
        </button>
      </div>
    </div>
  );
}

export function UserDialog({ userId, username, open, onClose }: { userId: string | null; username: string; open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserRow | null>(null);
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [following, setFollowing] = useState(false);
  const [tab, setTab] = useState<"info" | "chat">("info");
  const [messages, setMessages] = useState<DM[]>([]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const dmChannelRef = useRef<RealtimeChannel | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [p, t, f] = await Promise.all([
        supabase.rpc("get_user_public", { p_user: userId }),
        supabase.rpc("get_user_recent_trades", { p_user: userId, p_limit: 10 }),
        supabase.from("follows").select("*").eq("follower_id", user?.id || "").eq("following_id", userId).maybeSingle(),
      ]);
      if (p.data?.[0]) setProfile(p.data[0] as UserRow);
      if (t.data) setTrades(t.data as TradeRow[]);
      setFollowing(!!f.data);
    } catch (err) {
      console.error("Exception loading user profile:", err);
    }
  }, [userId, user]);

  const loadMessages = useCallback(async () => {
    if (!userId || !user) return;
    try {
      const { data, error } = await supabase.from("direct_messages").select("*")
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${user.id})`)
        .order("created_at", { ascending: true }).limit(100);
      if (error) {
        console.error("Error loading messages:", error);
        return;
      }
      if (data) setMessages(data as DM[]);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
    } catch (err) {
      console.error("Exception loading messages:", err);
    }
  }, [userId, user]);

  useEffect(() => { if (open) load(); }, [open, load]);
  useEffect(() => { if (open && tab === "chat") loadMessages(); }, [open, tab, loadMessages]);

  useEffect(() => {
    if (!open || !user || !userId) {
      if (dmChannelRef.current) {
        supabase.removeChannel(dmChannelRef.current);
        dmChannelRef.current = null;
      }
      return;
    }
    if (dmChannelRef.current) {
      supabase.removeChannel(dmChannelRef.current);
    }

    const ch = supabase.channel(`dm-${user.id}-${userId}`);
    
    ch.on("postgres_changes", 
      { event: "INSERT", schema: "public", table: "direct_messages" }, 
      (payload) => {
        const m = payload.new as DM;
        if ((m.sender_id === user.id && m.recipient_id === userId) || (m.sender_id === userId && m.recipient_id === user.id)) {
          setMessages(prev => [...prev, m]);
          setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
        }
      }
    );

    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        dmChannelRef.current = ch;
      }
    });

    return () => {
      if (dmChannelRef.current === ch) {
        supabase.removeChannel(ch);
        dmChannelRef.current = null;
      }
    };
  }, [open, user, userId]);

  const toggleFollow = async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase.rpc("toggle_follow", { p_target: userId });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      const row = data?.[0];
      if (row?.success) { setFollowing(row.following); toast({ title: row.message }); }
    } catch (err) {
      console.error("Exception toggling follow:", err);
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to toggle follow", variant: "destructive" });
    }
  };

  const sendFriend = async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase.rpc("send_friend_request", { p_addressee: userId });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      const row = data?.[0];
      toast({ title: row?.success ? "Sent!" : "Hmm", description: row?.message || "" });
    } catch (err) {
      console.error("Exception sending friend request:", err);
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to send request", variant: "destructive" });
    }
  };

  const sendMsg = async () => {
    if (!draft.trim() || !userId || !user) return;
    const body = draft.trim();
    setDraft("");
    try {
      const { error } = await supabase.from("direct_messages").insert({ sender_id: user.id, recipient_id: userId, body });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setDraft(body); // Restore on error
      }
    } catch (err) {
      console.error("Exception sending message:", err);
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to send message", variant: "destructive" });
      setDraft(body);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b border-border/30">
          <DialogTitle className="flex items-center justify-between">
            <span>{username}</span>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </DialogTitle>
        </DialogHeader>

        <div className="flex border-b border-border/30">
          <button onClick={() => setTab("info")} className={`flex-1 py-2.5 text-sm font-medium ${tab === "info" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>Profile</button>
          <button onClick={() => setTab("chat")} className={`flex-1 py-2.5 text-sm font-medium ${tab === "chat" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>Chat</button>
        </div>

        {tab === "info" && (
          <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
            {profile && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-3 rounded-lg bg-secondary/40"><div className="text-xs text-muted-foreground">Coins</div><div className="font-mono font-bold text-amber-500">{Number(profile.coins).toFixed(2)}</div></div>
                <div className="p-3 rounded-lg bg-secondary/40"><div className="text-xs text-muted-foreground">Net Profit</div><div className={`font-mono font-bold ${profile.net_profit >= 0 ? "text-green-500" : "text-red-500"}`}>{Number(profile.net_profit).toFixed(2)}</div></div>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={sendFriend} className="flex-1 h-10 rounded-lg bg-primary/15 text-primary font-medium hover:bg-primary/25 text-sm flex items-center justify-center gap-1.5"><UserPlus className="w-4 h-4" /> Add Friend</button>
              <button onClick={toggleFollow} className={`flex-1 h-10 rounded-lg font-medium text-sm flex items-center justify-center gap-1.5 ${following ? "bg-pink-500/20 text-pink-500" : "bg-secondary"}`}>
                <Heart className={`w-4 h-4 ${following ? "fill-current" : ""}`} /> {following ? "Following" : "Follow"}
              </button>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recent Trades</h4>
              {trades.length === 0 ? <p className="text-sm text-muted-foreground">No trades yet.</p> : (
                <div className="space-y-1.5">
                  {trades.map((t, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-md bg-secondary/30 text-sm">
                      <div className="flex items-center gap-2">
                        {t.type === "buy" ? <TrendingUp className="w-3.5 h-3.5 text-green-500" /> : <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
                        <span className="font-mono font-semibold">{t.symbol}</span>
                        <span className="text-xs text-muted-foreground uppercase">{t.type}</span>
                      </div>
                      <div className="font-mono text-xs">{Number(t.quantity).toFixed(4)} @ {Number(t.price).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "chat" && (
          <div className="flex flex-col h-[60vh]">
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.length === 0 && <p className="text-sm text-muted-foreground text-center mt-10">Start the conversation 👋</p>}
              <AnimatePresence initial={false}>
                {messages.map(m => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <motion.div key={m.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`px-3 py-2 rounded-2xl text-sm max-w-[75%] ${mine ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                        {m.body}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
            <div className="p-3 border-t border-border/30 flex gap-2">
              <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMsg()}
                placeholder="Type a message..." className="flex-1 h-10 px-3 rounded-lg bg-secondary/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm" />
              <button onClick={sendMsg} disabled={!draft.trim()} className="h-10 px-4 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50"><Send className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
