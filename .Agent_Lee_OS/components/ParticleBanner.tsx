/* ============================================================================
LEEWAY HEADER — DO NOT REMOVE
PROFILE: LEEWAY-RUNTIME
TAG: UI.ENGINE._AGENT_LEE_OS_COMPONENTS_PARTICLEBANNER_TSX.MAIN_UI.BANNER
REGION: 🔵 UI
============================================================================ */

import React, { useEffect, useRef } from "react";

interface ParticleBannerProps {
  messages?: string[];
  height?: number;
}

const COLORS = ["#22d3ee", "#ffffff", "#10b981", "#a855f7", "#00ffff"];

interface MessageGroup {
  particles: Particle[];
  width: number;
  x: number;
  spawnedNext: boolean;
  text: string;
}

class Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  alpha: number;

  constructor(x: number, y: number, color: string) {
    this.x = x;
    this.y = y;
    this.size = Math.random() * 1.5 + 1.2;
    this.color = color;
    this.alpha = 0.6 + Math.random() * 0.4;
  }

  draw(ctx: CanvasRenderingContext2D, offsetX: number) {
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x + offsetX, this.y, this.size, this.size);
  }
}

export const ParticleBanner: React.FC<ParticleBannerProps> = ({
  messages = [],
  height = 40,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const stateRef = useRef<{
    activeGroups: MessageGroup[];
    nextIndex: number;
  }>({ activeGroups: [], nextIndex: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || messages.length === 0) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const resize = () => {
      if (canvas && container) {
        canvas.width = container.clientWidth;
        canvas.height = height;
      }
    };
    window.addEventListener("resize", resize);
    resize();

    const scrollSpeed = 1.0;
    const spawnPadding = 150;

    const createGroup = (index: number): MessageGroup => {
      const text = messages[index];
      const color = COLORS[index % COLORS.length];

      const tempCanvas = document.createElement("canvas");
      const tempCtx = tempCanvas.getContext("2d")!;
      const fontSize = height * 0.55;
      tempCtx.font = `900 ${fontSize}px monospace`;

      const metrics = tempCtx.measureText(text);
      const msgWidth = Math.ceil(metrics.width);

      tempCanvas.width = msgWidth;
      tempCanvas.height = height;
      tempCtx.font = `900 ${fontSize}px monospace`;
      tempCtx.fillStyle = "white";
      tempCtx.textBaseline = "middle";
      tempCtx.textAlign = "left";
      tempCtx.fillText(text, 0, height / 2);

      const imgData = tempCtx.getImageData(0, 0, msgWidth, height);
      const particles: Particle[] = [];
      const step = 2;

      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < msgWidth; x += step) {
          const alpha = imgData.data[(y * msgWidth + x) * 4 + 3];
          if (alpha > 120) particles.push(new Particle(x, y, color));
        }
      }

      return {
        particles,
        width: msgWidth,
        x: canvas.width + 50,
        spawnedNext: false,
        text,
      };
    };

    stateRef.current = {
      activeGroups: [createGroup(0)],
      nextIndex: 1 % messages.length,
    };

    const animate = () => {
      const { activeGroups } = stateRef.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = activeGroups.length - 1; i >= 0; i--) {
        const group = activeGroups[i];
        group.x -= scrollSpeed;
        group.particles.forEach((p) => p.draw(ctx, group.x));

        if (
          !group.spawnedNext &&
          group.x + group.width < canvas.width - spawnPadding
        ) {
          const ni = stateRef.current.nextIndex;
          activeGroups.push(createGroup(ni));
          stateRef.current.nextIndex = (ni + 1) % messages.length;
          group.spawnedNext = true;
        }

        if (group.x + group.width < -100) activeGroups.splice(i, 1);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [messages, height]);

  return (
    <div
      className="particle-banner-row w-full relative overflow-hidden bg-black/80 border-y border-white/5"
      ref={containerRef}
      style={{ height: `${height}px` }}
    >
      <canvas ref={canvasRef} className="block w-full h-full opacity-90" />
      <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-black to-transparent pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-black to-transparent pointer-events-none" />
    </div>
  );
};
