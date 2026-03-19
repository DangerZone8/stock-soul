import { motion } from "framer-motion";

const STATS = [
  { label: "Leadership", value: 6, icon: "🏆", description: "MUN, Chess Club, Yuvana, Events" },
  { label: "Technical", value: 5, icon: "⚡", description: "Internships, Hacking, Drones, Graphics" },
  { label: "Community", value: 6, icon: "💚", description: "Volunteering, Hosting, Assemblies" },
];

export function AchievementStats() {
  return (
    <section className="container mx-auto px-4 pb-20">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {STATS.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.12 }}
            className="glass-card border-primary/30 p-5 text-center"
            style={{
              boxShadow: "0 0 20px hsl(var(--primary) / 0.1), inset 0 0 15px hsl(var(--primary) / 0.03)",
            }}
          >
            <span className="text-2xl">{stat.icon}</span>
            <div className="font-mono text-3xl font-bold text-primary mt-2">{stat.value}</div>
            <div className="text-sm font-semibold text-foreground mt-1">{stat.label}</div>
            <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
