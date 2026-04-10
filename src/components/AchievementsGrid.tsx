import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Award, GraduationCap, Briefcase, Trophy, Users, Cpu, FlaskConical, Pen, Plane, Shield, Heart, Mic } from "lucide-react";

const ACHIEVEMENTS = [
  {
    id: "1",
    title: "Phoenix MUN",
    anchor: "phoenix-mun",
    icon: Users,
    description: "Founded and led my own Model United Nations conference with support from family and friends. Built a strong team, hosted a successful event, and sharpened my communication, leadership, critical thinking, and quick decision-making skills while connecting with a wide range of people.",
  },
  {
    id: "2",
    title: "Chess Club",
    anchor: "chess-club",
    icon: Trophy,
    description: "Launched and led my school's Chess Club with help from family and friends. Assembled a dedicated team and organized a successful chess competition, boosting my communication, leadership, strategic thinking, and social skills.",
  },
  {
    id: "3",
    title: "Best Delegate (Model United Nations)",
    icon: Award,
    description: "Earned this national-level honor through intense preparation and flawless delegation. Perfected speeches, dominated rebuttals, and received strong support from family and friends.",
  },
  {
    id: "3b",
    title: "Honorable Mention (Model United Nations)",
    icon: Award,
    description: "Earned this honor through rigorous efforts and training.",
  },
  {
    id: "4",
    title: "Hosted Yuvana 2025",
    anchor: "yuvana-2025",
    icon: Mic,
    description: "Selected as CEO of hosting and scripting for Yuvana 2025 after auditions and polling. Mastered voice modulation and scripting from teachers, guided other hosts through challenges, and delivered a cohesive, successful event. Teamwork truly makes the dream work.",
  },
  {
    id: "5",
    title: "Alyssum Global Services (Internship)",
    icon: Briefcase,
    description: "Improved the organization's website using Python (frontend) and Java (backend) for better user experience. Also contributed to building a brand-new, modern website (still in progress).",
  },
  {
    id: "6",
    title: "Nexergy (Volunteer/Internship)",
    icon: Cpu,
    description: "Assisted in semiconductor division for solar panel procurement and installation. Visited plants, learned integration processes, and explored solar deployment challenges in various climates with guidance from my uncle.",
  },
  {
    id: "7",
    title: "First Place in Forensic Files (Chemistry Event)",
    icon: FlaskConical,
    description: "Won school-level first place in a forensic chemistry competition. Solved cases involving adulterated juice (lead poisoning) and contaminated cottage cheese (starch detection) through brainstorming and lab tests.",
  },
  {
    id: "8",
    title: "Third Place in Engineering Graphics Event",
    icon: Pen,
    description: "Secured third place in a school-level engineering graphics contest. Analyzed local building blueprints, guessed structures, and constructed models from top/side/front views in timed rounds.",
  },
  {
    id: "9",
    title: "Certificate of Participation – Physics Drone Event",
    icon: Plane,
    description: "Built and competed with a drone in a school physics event. Excelled in speed and precision rounds but lost in demonstration after a wing-damaging crash.",
  },
  {
    id: "10",
    title: "Organising Committee – Tech Team (Flagship Event)",
    icon: Cpu,
    description: "Served on the organising committee for a major school tech event. Led a group that brainstormed and executed winning ideas, including Code Crusaders and Code Disco.",
  },
  {
    id: "11",
    title: "Certificate of Participation – Hack Hunt",
    icon: Shield,
    description: "Competed in a school-level ethical hacking challenge. Solved timed code-based puzzles to track a \"hacker\" through multiple rounds, reaching the semi-finals.",
  },
  {
    id: "12",
    title: "Hosted Republic Day 2023",
    icon: Mic,
    description: "Organized and hosted the school's Republic Day celebration. Handled theme selection, script writing, and sweets distribution logistics — delivered a successful event with teacher support.",
  },
  {
    id: "13",
    title: "Hosted Millets Assembly",
    icon: Mic,
    description: "Researched and presented on millets — types, sources, uses, benefits, and drawbacks — for a school assembly.",
  },
  {
    id: "14",
    title: "Seva Foundation (Volunteer)",
    icon: Heart,
    description: "Collaborated with locals and Seva Foundation to repair monsoon puddles. Taught math to underprivileged lower-grade students and led book/clothes collection drives for juniors.",
  },
  {
    id: "15",
    title: "Sadak Suraksha (Road Safety Volunteer)",
    icon: Shield,
    description: "Participated in school-led road safety program in underprivileged areas. Educated young bikers on rules and road signs to promote safer roads.",
  },
  {
    id: "16",
    title: "Certificate of Participation for Alchemist Quest (Chemistry Event)",
    icon: FlaskConical,
    description: "Competed in a school-level chemistry challenge with a team. Solved multiple rounds involving metal properties, indicators, and timed tests.",
  },
  {
    id: "17",
    title: "Certificate of Achievement in Homi Bhabha",
    icon: GraduationCap,
    description: "Qualified for national-level round in Homi Bhabha science exam after strong performance in school round.",
  },
];

export function AchievementsGrid() {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedAch = ACHIEVEMENTS.find((a) => a.id === selected);

  return (
    <section className="container mx-auto px-4 py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-12"
      >
        <div className="flex items-center gap-2 mb-3">
          <Award className="w-4 h-4 text-primary" strokeWidth={1.5} />
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            Milestones
          </span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tighter">
          Career <span className="text-primary">Achievements</span>
        </h2>
        <p className="text-muted-foreground mt-2 max-w-lg">
          Every experience is a lesson. Here are the milestones that shaped my journey.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ACHIEVEMENTS.map((ach, i) => (
          <motion.div
            key={ach.id}
            id={(ach as any).anchor || undefined}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            onClick={() => setSelected(ach.id)}
            className="glass-card-hover p-6 cursor-pointer group scroll-mt-24"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <ach.icon className="w-4 h-4 text-primary" strokeWidth={1.5} />
              </div>
              <h3 className="text-sm font-semibold tracking-tight group-hover:text-primary transition-colors leading-tight">
                {ach.title}
              </h3>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {ach.description}
            </p>

            <div className="mt-3 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
              Read more →
            </div>
          </motion.div>
        ))}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedAch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card p-8 max-w-lg w-full relative"
            >
              <button
                onClick={() => setSelected(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <selectedAch.icon className="w-5 h-5 text-primary" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-semibold tracking-tight">{selectedAch.title}</h3>
              </div>

              <p className="text-muted-foreground leading-relaxed">{selectedAch.description}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
