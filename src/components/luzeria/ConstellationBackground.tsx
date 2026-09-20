import { useEffect, useRef } from "react";

// Fundo animado do hero — pontos derivando devagar, conectados por linhas
// quando próximos (lembra rede neural). Aprovado pelo Junior via mockup
// (duas opções testadas: essa "constelação" e uma "varredura HUD").
// Desenhado num <canvas> em vez de SVG/DOM por performance (dezenas de
// elementos animados por frame). Não anima se o usuário pediu menos
// movimento (prefers-reduced-motion) — desenha só 1 frame parado.
export function ConstellationBackground({ count = 40, alpha = 1 }: { count?: number; alpha?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const PARTICLE_COUNT = count;
    const LINK_DIST = 130;
    let width = 0;
    let height = 0;
    let particles: { x: number; y: number; vx: number; vy: number; r: number }[] = [];
    let raf = 0;

    function seed() {
      particles = Array.from({ length: PARTICLE_COUNT }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: 1 + Math.random() * 1.6,
      }));
    }

    function resize() {
      const parent = canvas!.parentElement;
      width = parent?.clientWidth ?? window.innerWidth;
      height = parent?.clientHeight ?? 480;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }
    resize();
    window.addEventListener("resize", resize);

    function drawFrame() {
      ctx!.clearRect(0, 0, width, height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;
      }
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i], b = particles[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK_DIST) {
            const op = (1 - dist / LINK_DIST) * 0.22;
            ctx!.strokeStyle = `rgba(215,255,63,${(op * alpha).toFixed(3)})`;
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.stroke();
          }
        }
      }
      for (const p of particles) {
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(215,255,63,${(0.55 * alpha).toFixed(3)})`;
        ctx!.fill();
      }
    }

    function loop() {
      drawFrame();
      raf = requestAnimationFrame(loop);
    }
    if (reduced) drawFrame();
    else raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("resize", resize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 w-full h-full" aria-hidden="true" />;
}

