import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Globe, AlertCircle } from "lucide-react";

// 48-hour countdown anchored to a fixed launch timestamp shared by every visitor.
// Update this value if you want to reset/extend the announcement.
const ANNOUNCEMENT_START_KEY = "stocksoul-domain-popup-start";
const DURATION_MS = 48 * 60 * 60 * 1000;

function getOrInitStart(): number {
  if (typeof window === "undefined") return Date.now();
  const stored = localStorage.getItem(ANNOUNCEMENT_START_KEY);
  if (stored) {
    const n = parseInt(stored, 10);
    if (Number.isFinite(n)) return n;
  }
  const now = Date.now();
  localStorage.setItem(ANNOUNCEMENT_START_KEY, String(now));
  return now;
}

function format(ms: number) {
  if (ms < 0) ms = 0;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

export function DomainChangePopup() {
  const [start] = useState<number>(getOrInitStart);
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = start + DURATION_MS - now;
  if (remaining <= 0) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Domain change announcement"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onKeyDown={(e) => e.preventDefault()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md rounded-2xl border border-primary/40 bg-card shadow-2xl p-6 sm:p-7"
      >
        <div className="flex items-center gap-2 mb-3 text-primary">
          <Sparkles className="w-5 h-5" />
          <span className="text-xs font-mono uppercase tracking-wider">Important Announcement</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3">
          We&apos;ve moved to{" "}
          <span className="text-primary">stock-soul.lovable.app</span>
        </h2>

        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          <span className="text-foreground font-medium">rudra-shailendra.lovable.app</span> is being
          retired. From now on, the official home of Stock Empire is{" "}
          <span className="text-foreground font-medium">stock-soul.lovable.app</span>. Update your
          bookmarks and share the new link with friends.
        </p>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/60 border border-border/40 mb-5">
          <Globe className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-muted-foreground font-mono uppercase">New URL</div>
            <a
              href="https://stock-soul.lovable.app"
              className="text-sm font-mono text-primary hover:underline truncate block"
            >
              stock-soul.lovable.app
            </a>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-amber-500 mb-1">
          <AlertCircle className="w-3.5 h-3.5" />
          <span className="font-mono uppercase tracking-wider">Notice ends in</span>
        </div>
        <div className="font-mono text-2xl font-bold text-foreground tabular-nums">
          {format(remaining)}
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          This message will close automatically after 48 hours.
        </p>
      </motion.div>
    </div>
  );
}
