import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
const LetterGlitch = lazy(() => import("./react-bits/LetterGlitch"));
const ClickSpark = lazy(() => import("./react-bits/ClickSpark.jsx"));
import BorderGlow from "./react-bits/BorderGlow";

export function Motion({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const [ready, setReady] = useState(false);
  const [color, setColor] = useState("");
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReady(!media.matches);
    update();
    media.addEventListener("change", update);
    setColor(getComputedStyle(document.documentElement).getPropertyValue("--primary").trim());
    return () => media.removeEventListener("change", update);
  }, []);
  return (
    <>
      {enabled && ready && color && (
        <Suspense fallback={null}>
          <div className="motion-background" aria-hidden="true">
            <LetterGlitch
              glitchColors={[color]}
              glitchSpeed={180}
              centerVignette={false}
              outerVignette={false}
              smooth
              characters="LANGPLAY 01 + →"
            />
          </div>
          <ClickSpark sparkColor={color} />
        </Suspense>
      )}
      {children}
    </>
  );
}

// Adapted from React Bits BorderGlow by David Haz; license in react-bits/LICENSE.md.
export function StarFrame({ children, active }: { children: ReactNode; active: boolean }) {
  return (
    <BorderGlow className={`star-frame ${active ? "star-frame-active" : ""}`} animated={active}>
      {children}
    </BorderGlow>
  );
}
