import { useState, useCallback } from "react";
import { motion } from "framer-motion";

function playKnockSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const playBeep = (time: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 220;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.3, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
      osc.start(time);
      osc.stop(time + 0.15);
    };
    playBeep(ctx.currentTime);
    playBeep(ctx.currentTime + 0.2);
  } catch {}
}

export function AchievementDoor({ onOpen }: { onOpen: () => void }) {
  const [opened, setOpened] = useState(false);

  const handleOpen = useCallback(() => {
    if (opened) return;
    playKnockSound();
    setOpened(true);
    setTimeout(onOpen, 1000);
  }, [opened, onOpen]);

  if (opened) {
    return (
      <div className="relative w-full flex justify-center items-center py-16 overflow-hidden">
        {/* Left panel slides out */}
        <motion.div
          initial={{ x: 0 }}
          animate={{ x: "-110%" }}
          transition={{ duration: 1, ease: [0.76, 0, 0.24, 1] }}
          className="absolute left-[calc(50%-120px)] w-[120px] h-[280px] sm:w-[160px] sm:h-[340px] rounded-xl border border-primary/30 bg-card/60 backdrop-blur-xl"
          style={{
            boxShadow: "0 0 30px hsl(var(--primary) / 0.2), inset 0 0 20px hsl(var(--primary) / 0.05)",
          }}
        />
        {/* Right panel slides out */}
        <motion.div
          initial={{ x: 0 }}
          animate={{ x: "110%" }}
          transition={{ duration: 1, ease: [0.76, 0, 0.24, 1] }}
          className="absolute right-[calc(50%-120px)] w-[120px] h-[280px] sm:w-[160px] sm:h-[340px] rounded-xl border border-primary/30 bg-card/60 backdrop-blur-xl"
          style={{
            boxShadow: "0 0 30px hsl(var(--primary) / 0.2), inset 0 0 20px hsl(var(--primary) / 0.05)",
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center py-16">
      <motion.div
        onClick={handleOpen}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className="relative cursor-pointer flex select-none"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && handleOpen()}
      >
        {/* Left door panel */}
        <div
          className="w-[120px] h-[280px] sm:w-[160px] sm:h-[340px] rounded-l-xl border border-r-0 border-primary/30 bg-card/60 backdrop-blur-xl flex items-center justify-end pr-3"
          style={{
            boxShadow: "0 0 30px hsl(var(--primary) / 0.2), inset 0 0 20px hsl(var(--primary) / 0.05)",
          }}
        >
          {/* Candlestick decoration */}
          <div className="flex flex-col items-center gap-1 opacity-60">
            <div className="w-[2px] h-8 bg-primary/50 rounded-full" />
            <div className="w-3 h-12 bg-primary/30 rounded-sm border border-primary/40" />
            <div className="w-[2px] h-6 bg-primary/50 rounded-full" />
          </div>
        </div>

        {/* Right door panel */}
        <div
          className="w-[120px] h-[280px] sm:w-[160px] sm:h-[340px] rounded-r-xl border border-l-0 border-primary/30 bg-card/60 backdrop-blur-xl flex items-center justify-start pl-3"
          style={{
            boxShadow: "0 0 30px hsl(var(--primary) / 0.2), inset 0 0 20px hsl(var(--primary) / 0.05)",
          }}
        >
          <div className="flex flex-col items-center gap-1 opacity-60">
            <div className="w-[2px] h-6 bg-destructive/50 rounded-full" />
            <div className="w-3 h-10 bg-destructive/30 rounded-sm border border-destructive/40" />
            <div className="w-[2px] h-8 bg-destructive/50 rounded-full" />
          </div>
        </div>

        {/* Center seam glow */}
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px]">
          <motion.div
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="w-full h-full bg-primary/60 rounded-full"
            style={{ boxShadow: "0 0 12px hsl(var(--primary) / 0.6)" }}
          />
        </div>

        {/* Knock label */}
        <motion.span
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 2.5 }}
          className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs font-mono text-muted-foreground whitespace-nowrap"
        >
          🚪 Knock to open
        </motion.span>
      </motion.div>
    </div>
  );
}
