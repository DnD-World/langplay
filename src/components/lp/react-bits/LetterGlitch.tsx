"use client";

import { useRef, useEffect } from "react";

interface Rgb {
  r: number;
  g: number;
  b: number;
}

const FALLBACK_RGB: Rgb = { r: 255, g: 255, b: 255 };

const LetterGlitch = ({
  glitchColors = ["var(--primary)"],
  glitchSpeed = 50,
  centerVignette = false,
  outerVignette = true,
  smooth = true,
  lightMode = false,
  backgroundColor,
  className = "",
  characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$&*()-_+=/[]{};:<>.,0123456789",
}: {
  glitchColors: string[];
  glitchSpeed: number;
  centerVignette: boolean;
  outerVignette: boolean;
  smooth: boolean;
  lightMode?: boolean;
  backgroundColor?: string;
  className?: string;
  characters: string;
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const letters = useRef<
    {
      char: string;
      rgb: Rgb;
      fromRgb: Rgb;
      targetRgb: Rgb;
      colorProgress: number;
    }[]
  >([]);
  const grid = useRef({ columns: 0, rows: 0 });
  const context = useRef<CanvasRenderingContext2D | null>(null);
  const lastGlitchTime = useRef(Date.now());

  const lettersAndSymbols = Array.from(characters);

  const fontSize = 16;
  const charWidth = 10;
  const charHeight = 20;

  const getRandomChar = () => {
    return lettersAndSymbols[Math.floor(Math.random() * lettersAndSymbols.length)] ?? "L";
  };

  const getRandomColor = () => {
    return glitchColors[Math.floor(Math.random() * glitchColors.length)] ?? "var(--primary)";
  };

  const hexToRgb = (color: string): Rgb | null => {
    const swatch = document.createElement("canvas");
    swatch.width = swatch.height = 1;
    const ctx = swatch.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    return { r: data[0] ?? 0, g: data[1] ?? 0, b: data[2] ?? 0 };
  };

  // Interpolation happens in numbers, and the CSS string is only built at
  // paint time. Previously the formatted `rgb(...)` string was stored back
  // on the letter and fed to hexToRgb on the next frame, which returned null
  // and froze the transition after a single step.
  const mixRgb = (start: Rgb, end: Rgb, factor: number): Rgb => ({
    r: Math.round(start.r + (end.r - start.r) * factor),
    g: Math.round(start.g + (end.g - start.g) * factor),
    b: Math.round(start.b + (end.b - start.b) * factor),
  });

  const rgbToCss = ({ r, g, b }: Rgb) => `rgb(${r}, ${g}, ${b})`;

  // Parse each colour once (parsing draws on a scratch canvas, far too costly per letter).
  // An unparseable entry in glitchColors must not stall the animation.
  const palette = useRef<{ key: string; rgb: Rgb[] }>({ key: "", rgb: [] });
  const getRandomRgb = (): Rgb => {
    const key = glitchColors.join("|");
    if (palette.current.key !== key)
      palette.current = { key, rgb: glitchColors.map((c) => hexToRgb(c) || FALLBACK_RGB) };
    const list = palette.current.rgb;
    return (
      list[Math.floor(Math.random() * list.length)] ?? hexToRgb(getRandomColor()) ?? FALLBACK_RGB
    );
  };
  // Letters still fading, and cells to repaint on the next frame.
  const fading = useRef(new Set<number>());
  const dirty = useRef(new Set<number>());
  const size = useRef({ width: 0, height: 0 });

  const calculateGrid = (width: number, height: number) => {
    const columns = Math.ceil(width / charWidth);
    const rows = Math.ceil(height / charHeight);
    return { columns, rows };
  };

  const initializeLetters = (columns: number, rows: number) => {
    grid.current = { columns, rows };
    const totalLetters = columns * rows;
    letters.current = Array.from({ length: totalLetters }, () => {
      const rgb = getRandomRgb();
      return {
        char: getRandomChar(),
        rgb,
        fromRgb: rgb,
        targetRgb: getRandomRgb(),
        colorProgress: 1,
      };
    });
  };

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = parent.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    size.current = { width: rect.width, height: rect.height };
    fading.current.clear();
    dirty.current.clear();

    if (context.current) {
      context.current.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const { columns, rows } = calculateGrid(rect.width, rect.height);
    initializeLetters(columns, rows);
    drawLetters();
  };

  const drawLetters = () => {
    if (!context.current || letters.current.length === 0) return;
    const ctx = context.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height } = size.current;
    ctx.clearRect(0, 0, width, height);
    ctx.font = `${fontSize}px monospace`;
    ctx.textBaseline = "top";

    letters.current.forEach((letter, index) => {
      const x = (index % grid.current.columns) * charWidth;
      const y = Math.floor(index / grid.current.columns) * charHeight;
      ctx.fillStyle = rgbToCss(letter.rgb);
      ctx.fillText(letter.char, x, y);
    });
  };

  /** Repaints only the cells that changed since the last frame. */
  const drawDirty = () => {
    const ctx = context.current;
    if (!ctx || dirty.current.size === 0) return;
    ctx.font = `${fontSize}px monospace`;
    ctx.textBaseline = "top";
    for (const index of dirty.current) {
      const letter = letters.current[index];
      if (!letter) continue;
      const x = (index % grid.current.columns) * charWidth;
      const y = Math.floor(index / grid.current.columns) * charHeight;
      ctx.clearRect(x, y, charWidth, charHeight);
      ctx.fillStyle = rgbToCss(letter.rgb);
      ctx.fillText(letter.char, x, y);
    }
    dirty.current.clear();
  };

  const updateLetters = () => {
    if (!letters.current || letters.current.length === 0) return;

    const updateCount = Math.max(1, Math.floor(letters.current.length * 0.05));

    for (let i = 0; i < updateCount; i++) {
      const index = Math.floor(Math.random() * letters.current.length);
      const letter = letters.current[index];
      if (!letter) continue;

      letter.char = getRandomChar();
      // A new transition starts from the colour currently on screen, so a
      // letter picked again mid-fade continues instead of jumping.
      letter.fromRgb = letter.rgb;
      letter.targetRgb = getRandomRgb();

      if (!smooth) {
        letter.rgb = letter.targetRgb;
        letter.colorProgress = 1;
      } else {
        letter.colorProgress = 0;
        fading.current.add(index);
      }
      dirty.current.add(index);
    }
  };

  const handleSmoothTransitions = () => {
    for (const index of fading.current) {
      const letter = letters.current[index];
      if (!letter) {
        fading.current.delete(index);
        continue;
      }
      letter.colorProgress = Math.min(1, letter.colorProgress + 0.05);
      letter.rgb = mixRgb(letter.fromRgb, letter.targetRgb, letter.colorProgress);
      dirty.current.add(index);
      if (letter.colorProgress >= 1) fading.current.delete(index);
    }
  };

  const animate = () => {
    if (document.hidden) {
      animationRef.current = null;
      return;
    }
    const now = Date.now();
    if (now - lastGlitchTime.current >= glitchSpeed) {
      updateLetters();
      lastGlitchTime.current = now;
    }

    if (smooth) {
      handleSmoothTransitions();
    }
    drawDirty();

    animationRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    context.current = canvas.getContext("2d");
    resizeCanvas();
    animate();

    let resizeTimeout: ReturnType<typeof setTimeout>;

    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        cancelAnimationFrame(animationRef.current as number);
        resizeCanvas();
        animate();
      }, 100);
    };

    window.addEventListener("resize", handleResize);
    const onVisibility = () => {
      if (document.hidden) {
        if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      } else if (animationRef.current === null) animate();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
      clearTimeout(resizeTimeout);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glitchSpeed, smooth]);

  return (
    <div className={`letter-glitch ${className}`}>
      <canvas ref={canvasRef} />
    </div>
  );
};
export default LetterGlitch;
