import {
  BrainCircuit,
  Search,
  BookOpen,
  GitBranch,
  ScanEye,
  Flag,
  PencilLine,
  Trophy,
  Coins,
  Sparkles,
  Settings2,
  Blocks,
  MessageCircle,
  Gamepad2,
  Microscope,
  Lightbulb,
  Target,
  CheckCircle2,
  Circle,
  AlertTriangle,
  GripVertical,
  ArrowUp,
  ArrowDown,
  X,
  Play,
  Crown,
  Code2,
} from "lucide-react";

const icons = {
  input: PencilLine,
  agent: BrainCircuit,
  tool: Search,
  retriever: BookOpen,
  router: GitBranch,
  critic: ScanEye,
  final: Flag,
  trophy: Trophy,
  coin: Coins,
  spark: Sparkles,
  settings: Settings2,
  blocks: Blocks,
  chat: MessageCircle,
  game: Gamepad2,
  inspect: Microscope,
  idea: Lightbulb,
  target: Target,
  check: CheckCircle2,
  circle: Circle,
  warning: AlertTriangle,
  grip: GripVertical,
  up: ArrowUp,
  down: ArrowDown,
  close: X,
  play: Play,
  crown: Crown,
  code: Code2,
};
export function AnimatedIcon({
  name,
  className = "",
}: {
  name: keyof typeof icons;
  className?: string;
}) {
  const Icon = icons[name];
  return (
    <span className={`animated-icon icon-${name} ${className}`} aria-hidden="true">
      <Icon strokeWidth={1.7} />
    </span>
  );
}
