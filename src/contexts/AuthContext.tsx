import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import type { Session, User, RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  username: string | null;
  referral_code: string | null;
  referred_by: string | null;
  net_profit: number;
  coins: number;
  last_reward_date: string | null;
  username_changes?: number;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signUp: (email: string, password: string, username?: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const realtimeSetupDoneRef = useRef(false);

  const fetchProfile = useCallback(async (uid: string) => {
    try {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
      if (error) {
        console.error("Error fetching profile:", error);
        return;
      }
      if (data) setProfile(data as Profile);
    } catch (err) {
      console.error("Exception fetching profile:", err);
    }
  }, []);

  const claimDaily = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("claim_daily_reward");
      if (error) {
        console.error("Error claiming daily reward:", error);
        return;
      }
      if (data && data[0]) {
        const result = data[0];
        if (result.claimed) {
          toast({ title: "Daily reward!", description: result.message });
          // Update profile coins immediately from the response
          setProfile(prev => prev ? { ...prev, coins: result.coins } : null);
        } else {
          // Already claimed today - silently skip or show message
          console.log("Daily reward already claimed:", result.message);
        }
      }
    } catch (err) {
      console.error("Exception claiming daily reward:", err);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  // Setup realtime profile updates ONCE per user
  useEffect(() => {
    if (!user) {
      // Clean up existing channel when user logs out
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      realtimeSetupDoneRef.current = false;
      return;
    }

    // Only setup realtime once per user session
    if (realtimeSetupDoneRef.current) {
      return;
    }
    realtimeSetupDoneRef.current = true;

    // CRITICAL: Remove any existing channels with this name
    // Supabase caches channels by name and reuses them
    const channelName = `profile-${user.id}`;
    const existingChannels = supabase.getChannels();
    const existingChannel = existingChannels.find(ch => ch.topic === channelName || ch.topic === `realtime:${channelName}`);
    if (existingChannel) {
      supabase.removeChannel(existingChannel);
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Create channel with postgres_changes listener BEFORE subscribe
    const ch = supabase.channel(channelName);

    ch.on("postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "profiles",
        filter: `id=eq.${user.id}`
      },
      (payload) => {
        setProfile(payload.new as Profile);
      }
    );

    // Now subscribe after listeners are attached
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channelRef.current = ch;
      }
    });

    return () => {
      if (channelRef.current === ch) {
        supabase.removeChannel(ch);
        channelRef.current = null;
      }
    };
  }, [user]);

  // Handle auth state changes and claim daily reward
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // Claim daily reward first, then fetch profile
        (async () => {
          try {
            await claimDaily();
            await fetchProfile(s.user.id);
          } catch (err) {
            console.error("Error during login:", err);
          }
        })();
      } else {
        setProfile(null);
      }
    });

    // Also check existing session on mount
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        (async () => {
          try {
            await claimDaily();
            await fetchProfile(s.user.id);
          } catch (err) {
            console.error("Error during session init:", err);
          }
        })();
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile, claimDaily]);

  const signUp = async (email: string, password: string, username?: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email, 
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: username ? { username, full_name: username } : undefined,
        },
      });
      return { error: error?.message ?? null };
    } catch (err) {
      console.error("Sign up error:", err);
      return { error: err instanceof Error ? err.message : "Sign up failed" };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    } catch (err) {
      console.error("Sign in error:", err);
      return { error: err instanceof Error ? err.message : "Sign in failed" };
    }
  };

  const signOut = async () => {
    try {
      realtimeSetupDoneRef.current = false;
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, refreshProfile, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
