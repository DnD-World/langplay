// A short confetti burst for big moments (lesson complete). One canvas, removed when done.
// Skipped when motion is off in Settings or the device asks for reduced motion.

export function confetti(origin?: { x: number; y: number }) {
  if (typeof window === "undefined") return;
  if (document.documentElement.classList.contains("motion-off")) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:90";
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.remove();
  ctx.scale(dpr, dpr);
  const style = getComputedStyle(document.documentElement);
  const colors = ["--primary", "--accent", "--coin", "--success"].map(
    (v) => style.getPropertyValue(v).trim() || "#7fe0c0",
  );
  const x0 = origin?.x ?? innerWidth / 2;
  const y0 = origin?.y ?? innerHeight * 0.75;
  const parts = Array.from({ length: 220 }, () => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.3;
    const speed = 10 + Math.random() * 12;
    return {
      x: x0,
      y: y0,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 4 + Math.random() * 6,
      spin: (Math.random() - 0.5) * 0.4,
      rot: Math.random() * Math.PI,
      color: colors[Math.floor(Math.random() * colors.length)] as string,
      round: Math.random() < 0.3,
    };
  });
  const start = performance.now();
  const frame = (now: number) => {
    const t = now - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.38;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.spin;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t / 1800);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (t < 1800) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
