import { useEffect, useRef } from "react";

export function CandlestickBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const candles: { x: number; open: number; close: number; high: number; low: number; width: number }[] = [];
    const count = 60;

    for (let i = 0; i < count; i++) {
      const open = Math.random() * canvas.height * 0.6 + canvas.height * 0.2;
      const close = open + (Math.random() - 0.5) * 80;
      const high = Math.min(open, close) - Math.random() * 30;
      const low = Math.max(open, close) + Math.random() * 30;
      candles.push({
        x: (canvas.width / count) * i + 10,
        open, close, high, low,
        width: canvas.width / count * 0.5,
      });
    }

    let offset = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      offset += 0.15;

      candles.forEach((c, i) => {
        const shift = Math.sin((i + offset) * 0.05) * 8;
        const bullish = c.close < c.open;
        const color = bullish ? "rgba(0, 255, 159, 0.04)" : "rgba(255, 59, 92, 0.03)";
        const wickColor = bullish ? "rgba(0, 255, 159, 0.06)" : "rgba(255, 59, 92, 0.04)";

        // Wick
        ctx.strokeStyle = wickColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(c.x + c.width / 2, c.high + shift);
        ctx.lineTo(c.x + c.width / 2, c.low + shift);
        ctx.stroke();

        // Body
        ctx.fillStyle = color;
        const top = Math.min(c.open, c.close) + shift;
        const height = Math.abs(c.close - c.open);
        ctx.fillRect(c.x, top, c.width, height);
      });

      requestAnimationFrame(draw);
    };

    const animId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.6 }}
    />
  );
}
