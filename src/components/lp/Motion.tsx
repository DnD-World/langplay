import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
const Waves = lazy(() => import('./react-bits/Waves.jsx'));
const TargetCursor = lazy(() => import('./react-bits/TargetCursor.jsx'));
const ClickSpark = lazy(() => import('./react-bits/ClickSpark.jsx'));

export function Motion({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const [ready, setReady] = useState(false);
  const [color, setColor] = useState('');
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReady(!media.matches);
    update(); media.addEventListener('change', update);
    setColor(getComputedStyle(document.documentElement).getPropertyValue('--primary').trim());
    return () => media.removeEventListener('change', update);
  }, []);
  if (!enabled || !ready || !color) return <>{children}</>;
  return <Suspense fallback={children}>
    <div className="motion-background" aria-hidden="true"><Waves lineColor={color} xGap={65} yGap={55} waveAmpX={12} waveAmpY={8} /></div>
    <TargetCursor targetSelector="button, a, [draggable]" hideDefaultCursor={false} cursorColor={color} parallaxOn={false} />
    <ClickSpark sparkColor={color}>{children}</ClickSpark>
  </Suspense>;
}

// Adapted from React Bits StarBorder by David Haz; license in react-bits/LICENSE.md.
export function StarFrame({ children, active }: { children: ReactNode; active: boolean }) {
  return <div className={`star-frame ${active ? 'star-frame-active' : ''}`}>
    {active && <><span className="border-gradient-bottom" /><span className="border-gradient-top" /></>}
    <div className="star-inner">{children}</div>
  </div>;
}