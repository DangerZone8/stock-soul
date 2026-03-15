import { motion } from "framer-motion";
import { Heart, Sparkles, Bell } from "lucide-react";
import { Link } from "react-router-dom";

export function AICompanionSection() {
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
          <button className="btn-ghost-terminal neon-glow">
            <Bell className="w-4 h-4" strokeWidth={1.5} />
            🔔 Sign Up for Premium Alerts
          </button>
        </div>
      </motion.div>
    </section>
  );
}
