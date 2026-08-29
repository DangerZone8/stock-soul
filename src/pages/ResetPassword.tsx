import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { TrendingUp, Lock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [valid, setValid] = useState<boolean | null>(null);

  // Recovery links arrive with a token hash that the supabase client exchanges
  // automatically (detectSessionInUrl). We confirm we have a recovery session.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setValid(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      // If there's already a session (from the recovery link exchange), allow reset
      if (session) setValid(true);
      else if (valid === null) setValid((v) => (v === null ? false : v));
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Too short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Mismatch", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password updated!", description: "You're signed in with your new password." });
      navigate("/", { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md glass-card p-8">
        <Link to="/" className="flex items-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <span className="font-semibold text-lg">Stock<span className="text-primary">Soul</span></span>
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight mb-1">Set a new password</h1>
        <p className="text-sm text-muted-foreground mb-6">Choose a new password for your account.</p>

        {valid === false ? (
          <div className="space-y-4">
            <p className="text-sm text-destructive">This reset link is invalid or has expired.</p>
            <Link to="/auth" className="block text-sm text-primary hover:underline font-medium">
              Go back to sign in and request a new link
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="New password"
                className="w-full h-11 pl-10 pr-3 rounded-lg bg-secondary/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="password" required minLength={6} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirm new password"
                className="w-full h-11 pl-10 pr-3 rounded-lg bg-secondary/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <button type="submit" disabled={busy}
              className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition flex items-center justify-center gap-2 disabled:opacity-60">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              Update password
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default ResetPassword;
