import { lazy, Suspense, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AnimatedIcon } from './AnimatedIcon';
const SquishSwitch = lazy(() => import('./react-bits/SquishSwitch'));
const HoldButton = lazy(() => import('./react-bits/HoldButton'));
const ThoughtLine = lazy(() => import('./react-bits/ThoughtLine'));

function useReady() { const [ready, setReady] = useState(false); useEffect(() => setReady(true), []); return ready; }
export function SquishToggle({ checked, onChange, label }: { checked: boolean; onChange: (on: boolean) => void; label: string }) {
  const ready = useReady();
  const fallback = <Button type="button" variant="outline" role="switch" aria-label={label} aria-checked={checked} onClick={() => onChange(!checked)} className="h-7 w-12 p-0">{checked ? 'On' : 'Off'}</Button>;
  return ready ? <Suspense fallback={fallback}><SquishSwitch checked={checked} onChange={onChange} ariaLabel={label} width={44} height={26} radius={13} /></Suspense> : fallback;
}
export function HoldDelete({ onDelete, disabled }: { onDelete: () => void; disabled: boolean }) {
  const ready = useReady();
  const fallback = <Button type="button" variant="outline" size="icon" disabled title="Hold to delete step"><AnimatedIcon name="close" /></Button>;
  return ready ? <Suspense fallback={fallback}><HoldButton disabled={disabled} size="sm" holdTime={1200} onHold={onDelete} className="hold-delete" icon={<AnimatedIcon name="close" />} doneLabel="Deleted">{null}</HoldButton></Suspense> : fallback;
}
export function RunThought({ working, label }: { working: boolean; label: string }) {
  const ready = useReady();
  return ready ? <Suspense fallback={<span role="status">{label}</span>}><ThoughtLine working={working} label={label} doneLabel="Run finished" collapsible={false} fontSize={12} glyph={<AnimatedIcon name="agent" />} shimmer={false} /></Suspense> : <span role="status">{label}</span>;
}