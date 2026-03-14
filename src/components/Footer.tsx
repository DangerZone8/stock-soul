import { TrendingUp, Heart, Github } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/30 bg-card/20 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" strokeWidth={1.5} />
            <span className="font-semibold text-sm">
              Stock<span className="text-primary">Soul</span>
            </span>
          </div>

          <p className="text-xs text-muted-foreground font-mono flex items-center gap-1">
            Built with <Heart className="w-3 h-3 text-destructive" strokeWidth={1.5} /> & Lovable
          </p>

          <div className="flex items-center gap-4">
            <a
              href="#"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              <Github className="w-4 h-4" strokeWidth={1.5} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
