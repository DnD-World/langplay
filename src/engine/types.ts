// Shared types for the Langplay engine. No React and no browser-only APIs here:
// the same engine runs in the app, in exported HTML files, in Node (MCP) and in Workers.

export type NodeKind = "input" | "agent" | "tool" | "retriever" | "router" | "critic" | "final";
export type ToolId = "wikipedia" | "websearch" | "calculator" | "datetime" | "sample";

export interface Route {
  label: string;
  /** Node to jump to when this route is chosen; undefined = the following node in the list. */
  to?: string;
}

export interface RecipeNode {
  id: string;
  kind: NodeKind;
  label: string;
  instruction: string;
  /** undefined = the following node in the list, "end" = stop, otherwise a node id. */
  next?: string;
  tool?: ToolId;
  routes?: Route[];
  /** Critic only: node to loop back to when the draft needs work. */
  retryTo?: string;
  maxLoops?: number;
  x?: number;
  y?: number;
}

export type SpinoutProvider = "pollinations" | "ovh" | "simulator" | "visitor";

export interface Recipe {
  version: 2;
  id?: string;
  title: string;
  summary: string;
  source?: string;
  difficulty?: "Easy" | "Medium" | "Hard";
  categories?: string[];
  tools?: string[];
  cost?: "Cheap" | "Medium";
  nodes: RecipeNode[];
  spinout?: { provider: SpinoutProvider; model?: string };
}

/** A partial node update; `undefined` removes the property. */
export type NodePatch = { [K in keyof RecipeNode]?: RecipeNode[K] | undefined };

export interface LlmSettings {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  freeOnly?: boolean;
  freeAllowance?: boolean;
  modelFreeVerified?: boolean;
  /** USD per token, when the provider published it (OpenRouter model list). */
  pricing?: { prompt: number; completion: number };
}

export type Msg = { role: "system" | "user" | "assistant"; content: string };
export type Usage = { prompt: number; completion: number; estimated: boolean };
export type ChatResult = { text: string; usage: Usage; provider: string; model: string };
export type ChatFn = (messages: Msg[], signal?: AbortSignal) => Promise<ChatResult>;

export type Source = { title: string; url?: string | undefined; snippet: string };
export type ToolResult = { text: string; sources: Source[]; practice?: boolean | undefined };
export type ToolFn = (input: string, signal?: AbortSignal) => Promise<ToolResult>;
export type DocSearch = (query: string, k: number) => Source[];

export interface StepTrace {
  index: number;
  nodeId: string;
  kind: NodeKind;
  label: string;
  ms: number;
  /** Exact messages sent to the AI, when this step called one. */
  messages?: Msg[];
  /** Tool/search input, or the filled-in prompt for input steps. */
  input?: string;
  output: string;
  /** Router choice or critic verdict, in plain words. */
  decision?: string;
  sources?: Source[];
  usage?: Usage;
  provider?: string;
  model?: string;
  /** Anything the learner should know: fallbacks, practice data, loop limits. */
  note?: string;
  practice?: boolean | undefined;
}

export interface RunResult {
  answer: string;
  steps: StepTrace[];
  ms: number;
  usage: Usage;
  fallbacks: number;
  stoppedByGuard: boolean;
}

export type RunEvent =
  | { type: "step-start"; nodeId: string; index: number }
  | { type: "step"; trace: StepTrace }
  | { type: "done"; result: RunResult };

export interface RunDeps {
  chat: ChatFn;
  /** Used when `chat` fails (busy service, blocked browser request); usually the Simulator. */
  fallbackChat?: ChatFn;
  tools?: Partial<Record<ToolId, ToolFn>>;
  searchDocs?: DocSearch | undefined;
  /** True when `chat` is the Simulator; tools then derive their input without an extra AI call. */
  simulated?: boolean;
  signal?: AbortSignal;
  now?: () => number;
}
