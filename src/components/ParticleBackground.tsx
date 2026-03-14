"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number; // 2 or 3
  colorIndex: number;
  opacity: number;
}

// 4 colours at very low opacity on the light canvas
const PARTICLE_COLORS = [
  "108, 99, 255",  // #6C63FF — indigo
  "0, 212, 255",   // #00D4FF — cyan
  "200, 200, 232", // #C8C8E8 — lavender
  "5, 5, 8",       // #050508 — near-black
];

const BG_COLOR = "#F8F8FC";
const PARTICLE_COUNT = 120;

interface BokehBlob {
  color: string;
  size: number;
  top: string;
  left: string;
  duration: number;
  delay: number;
  animation: string;
}

const BOKEH_BLOBS: BokehBlob[] = [
  {
    color: "rgba(108, 99, 255, 0.06)",
    size: 380,
    top: "5%",
    left: "10%",
    duration: 28,
    delay: 0,
    animation: "bokeh-drift-1",
  },
  {
    color: "rgba(0, 212, 255, 0.05)",
    size: 320,
    top: "60%",
    left: "75%",
    duration: 34,
    delay: -8,
    animation: "bokeh-drift-2",
  },
  {
    color: "rgba(200, 200, 232, 0.07)",
    size: 420,
    top: "30%",
    left: "55%",
    duration: 40,
    delay: -14,
    animation: "bokeh-drift-3",
  },
  {
    color: "rgba(108, 99, 255, 0.04)",
    size: 280,
    top: "75%",
    left: "20%",
    duration: 24,
    delay: -5,
    animation: "bokeh-drift-4",
  },
  {
    color: "rgba(0, 212, 255, 0.04)",
    size: 350,
    top: "15%",
    left: "80%",
    duration: 38,
    delay: -20,
    animation: "bokeh-drift-5",
  },
  {
    color: "rgba(200, 200, 232, 0.06)",
    size: 300,
    top: "50%",
    left: "5%",
    duration: 30,
    delay: -10,
    animation: "bokeh-drift-6",
  },
];

export default function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);

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

    // Initialise particles
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      size: Math.random() < 0.5 ? 2 : 3,
      colorIndex: Math.floor(Math.random() * PARTICLE_COLORS.length),
      opacity: Math.random() * 0.10 + 0.08, // 0.08 – 0.18
    }));

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("resize", resize);

    let lastMouse = { x: 0, y: 0 };

    const draw = () => {
      if (!canvas || !ctx) return;

      // Fill light background each frame
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (!prefersReduced) {
        const mx = mouseRef.current.x;
        const my = mouseRef.current.y;
        const dx = mx - lastMouse.x;
        const dy = my - lastMouse.y;
        lastMouse = { x: mx, y: my };

        for (const p of particlesRef.current) {
          // Slow drift + 3% mouse parallax
          p.x += p.vx + dx * 0.03;
          p.y += p.vy + dy * 0.03;

          // Wrap edges
          if (p.x < 0) p.x += canvas.width;
          if (p.x > canvas.width) p.x -= canvas.width;
          if (p.y < 0) p.y += canvas.height;
          if (p.y > canvas.height) p.y -= canvas.height;

          const color = PARTICLE_COLORS[p.colorIndex];
          ctx.fillStyle = `rgba(${color}, ${p.opacity})`;
          ctx.fillRect(
            Math.round(p.x - p.size / 2),
            Math.round(p.y - p.size / 2),
            p.size,
            p.size
          );
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div
      className="particle-bg"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
      aria-hidden="true"
    >
      {/* Canvas — fills #F8F8FC and draws particles */}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      />

      {/* Bokeh blobs */}
      {BOKEH_BLOBS.map((blob, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: blob.top,
            left: blob.left,
            width: blob.size,
            height: blob.size,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${blob.color} 0%, transparent 70%)`,
            animation: `${blob.animation} ${blob.duration}s ${blob.delay}s ease-in-out infinite`,
            transform: "translate(-50%, -50%)",
            willChange: "transform",
          }}
        />
      ))}

      {/* SVG grain overlay */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.03,
          mixBlendMode: "multiply",
        }}
      >
        <filter id="grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </div>
  );
}
