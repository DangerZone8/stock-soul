import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Sparkles, Bell, Send, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function AICompanionSection() {
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { toast } = useToast();

  const handleNotifyClick = () => {
    if (isSubscribed) return;
    setShowEmailInput(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast({ title: "Please enter a valid email", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("waitlist_emails" as any)
        .insert({ email: trimmed } as any);

      if (error) {
        if (error.code === "23505") {
          setIsSubscribed(true);
          toast({ title: "You're already subscribed! 💚" });
        } else {
          throw error;
        }
      } else {
        setIsSubscribed(true);
        toast({ title: "You're subscribed! You'll get notified on every change 💚" });
      }
    } catch (err: any) {
      toast({ title: "Something went wrong", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="container mx-auto px-4 pb-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="glass-card p-8 sm:p-10 max-w-2xl mx-auto text-center"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono mb-6">
          <Heart className="w-3 h-3" strokeWidth={1.5} />
          <span>AI COMPANION • LIVE</span>
        </div>

        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tighter mb-4">
          AI Trading <span className="neon-text">Companion</span>
        </h2>

        <p className="text-muted-foreground max-w-md mx-auto leading-relaxed mb-4">
          Your AI trading partner and companion. She knows the markets,
          celebrates your wins, and keeps you grounded during the dips.
        </p>

        <p className="text-xs text-primary font-mono flex items-center justify-center gap-1 mb-8">
          <Sparkles className="w-3 h-3" />
          Online • Watching markets
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/dream-girl" className="btn-terminal">
            <Heart className="w-4 h-4" strokeWidth={1.5} />
            Talk to Kaia
          </Link>

          {!isSubscribed ? (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleNotifyClick}
                className="btn-ghost-terminal neon-glow"
              >
                <Bell className="w-4 h-4" strokeWidth={1.5} />
                🔔 Notify Me of Updates
              </button>

              <AnimatePresence>
                {showEmailInput && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleSubmit}
                    className="flex gap-2 mt-2 w-full max-w-sm"
                  >
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="flex-1 bg-muted/50 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                      disabled={isSubmitting}
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="btn-terminal px-4 disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" strokeWidth={1.5} />
                      Sign Up
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-primary text-sm font-mono">
              <Check className="w-4 h-4" />
              You're subscribed! You'll get notified on every change 💚
            </div>
          )}
        </div>
      </motion.div>
    </section>
  );
}
