import type { NodeKind } from "@/engine";

export type StepKind = NodeKind;

export const KINDS: Record<
  StepKind,
  { emoji: string; title: string; plain: string; techName: string; analogy: string; code: string }
> = {
  input: {
    emoji: "📝",
    title: "Input Prompt",
    plain:
      "A mad-libs style form for the AI: your question gets dropped into a ready-made sentence.",
    techName: "ChatPromptTemplate",
    analogy: "Like filling in the blanks on a postcard before mailing it.",
    code: `from langchain_core.prompts import ChatPromptTemplate

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a friendly helper."),
    ("human", "{question}"),
])`,
  },
  agent: {
    emoji: "🧠",
    title: "AI Thinking (Agent)",
    plain:
      "The brain of the recipe: it reads everything so far and decides what to say or do next.",
    techName: "StateGraph Node + ChatOpenAI",
    analogy: "Like a chef reading the order and deciding how to cook it.",
    code: `from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, MessagesState

llm = ChatOpenAI(model="gpt-4o-mini")

def agent(state: MessagesState):
    return {"messages": [llm.invoke(state["messages"])]}

graph = StateGraph(MessagesState)
graph.add_node("agent", agent)`,
  },
  tool: {
    emoji: "🔎",
    title: "Tool / Search",
    plain:
      "A real gadget the AI can use: Wikipedia, a quick web answer, a calculator or a clock. The AI writes what to look up.",
    techName: "@tool + ToolNode",
    analogy: "Like letting the chef phone a friend for a missing ingredient.",
    code: `from langchain_core.tools import tool
from langgraph.prebuilt import ToolNode

@tool
def web_search(query: str) -> str:
    """Look something up on the web."""
    return search_engine(query)

tools = ToolNode([web_search])`,
  },
  retriever: {
    emoji: "📚",
    title: "Document Lookup",
    plain: "Finds the most relevant pages in your documents so the AI can quote them.",
    techName: "VectorStoreRetriever (RAG)",
    analogy: "Like a librarian who fetches the exact pages you need.",
    code: `from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings

store = FAISS.from_documents(docs, OpenAIEmbeddings())
retriever = store.as_retriever(search_kwargs={"k": 3})`,
  },
  router: {
    emoji: "🔀",
    title: "Smart Router",
    plain: "A traffic cop: the AI reads the question and picks which path the recipe follows next.",
    techName: "add_conditional_edges",
    analogy: "Like a receptionist pointing you to the right desk.",
    code: `def route(state):
    choice = llm.invoke([
        ("system", "Choose exactly one option: billing, tech."),
        ("human", state["question"]),
    ]).content.strip().lower()
    return "billing" if "billing" in choice else "tech"

graph.add_conditional_edges("router", route,
    {"billing": "billing_agent", "tech": "tech_agent"})`,
  },
  critic: {
    emoji: "🧐",
    title: "Critic / Checker",
    plain:
      "A second AI that reviews the draft. It can rewrite it, or send it back to the writer until it's good — a loop.",
    techName: "Reflection loop (conditional edge back to the writer)",
    analogy: "Like an editor handing a draft back with red-pen notes until it's ready.",
    code: `def critic(state):
    review = llm.invoke([
        ("system", "Reply PASS if the draft is good, else REVISE: what to fix."),
        ("human", state["draft"]),
    ]).content
    return {"feedback": review, "loops": state["loops"] + 1}

def check(state):
    if review_passed(state) or state["loops"] >= 2:
        return "good"
    return "needs_work"

graph.add_conditional_edges("critic", check,
    {"good": "final", "needs_work": "writer"})  # a cycle!`,
  },
  final: {
    emoji: "🏁",
    title: "Final Answer",
    plain: "Wraps everything up into one clean answer for you.",
    techName: "END + StrOutputParser",
    analogy: "Like plating the dish and serving it.",
    code: `from langgraph.graph import END
from langchain_core.output_parsers import StrOutputParser

graph.add_edge("agent", END)
app = graph.compile()
print(app.invoke({"messages": [("human", "Hi!")]}))`,
  },
};

export type Category = "Beginner Friendly" | "Multi-Agent" | "Document Q&A" | "Tool User";

export const CATEGORIES: Category[] = [
  "Beginner Friendly",
  "Multi-Agent",
  "Document Q&A",
  "Tool User",
];

export type ProviderId =
  | "simulator"
  | "pollinations"
  | "puter"
  | "horde"
  | "ovh"
  | "ollama"
  | "lmstudio"
  | "openai"
  | "openrouter"
  | "groq"
  | "kilo"
  | "custom"
  | "gemini"
  | "offline"
  | "cerebras"
  | "nvidia"
  | "mistral"
  | "cohere"
  | "ollama-cloud"
  | "sealion"
  | "meganova";

export const PROVIDERS: {
  id: ProviderId;
  name: string;
  group: string;
  baseUrl: string;
  model: string;
  models: string[];
  needsKey: boolean;
  tip: string;
}[] = [
  {
    id: "simulator",
    name: "Offline Simulator",
    group: "Instant & offline",
    baseUrl: "",
    model: "sim-1",
    models: ["sim-1"],
    needsKey: false,
    tip: "Pretend AI that answers instantly without the internet — perfect for practice.",
  },
  {
    id: "pollinations",
    name: "Pollinations AI",
    group: "Free · no key (a few requests)",
    baseUrl: "https://text.pollinations.ai/openai",
    model: "openai",
    models: ["openai"],
    needsKey: false,
    tip: "A free AI service you can use without signing up. Your questions are sent to pollinations.ai.",
  },
  {
    id: "puter",
    name: "Puter AI",
    group: "No API key",
    baseUrl: "puter.js",
    model: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o", "claude-3-5-sonnet"],
    needsKey: false,
    tip: "Puter handles payment and sign-in for you; usage is not automatically free.",
  },
  {
    id: "horde",
    name: "AI Horde",
    group: "Free · no key (a few requests)",
    baseUrl: "https://oai.aihorde.net/v1",
    model: "auto",
    models: ["auto"],
    needsKey: false,
    tip: 'Volunteers share their computers to run AI for free — can be slow. "auto" picks whichever model volunteers are running now. Its service returned errors when tested on 9 Oct 2026; Langplay falls back to the Simulator if it fails.',
  },
  {
    id: "ovh",
    name: "OVHcloud AI Endpoints",
    group: "Free · no key (a few requests)",
    baseUrl: "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1",
    model: "Mistral-Small-3.2-24B-Instruct-2506",
    models: [
      "Mistral-Small-3.2-24B-Instruct-2506",
      "Meta-Llama-3_3-70B-Instruct",
      "gpt-oss-120b",
      "Qwen3.5-9B",
      "Mistral-7B-Instruct-v0.3",
    ],
    needsKey: false,
    tip: "A European cloud with a free, rate-limited AI tier. Your questions are sent to OVHcloud.",
  },
  {
    id: "offline",
    name: "Offline AI (built in)",
    group: "On your computer",
    baseUrl: "http://127.0.0.1:12081/v1",
    model: "local",
    models: ["local"],
    needsKey: false,
    tip: "Windows app only: a model you downloaded under Settings → Offline AI. No key, no internet.",
  },
  {
    id: "ollama",
    name: "Ollama (local)",
    group: "On your computer",
    baseUrl: "http://localhost:11434/v1",
    model: "llama3",
    models: ["llama3", "mistral", "phi3"],
    needsKey: false,
    tip: "Runs AI on your own computer — private and free once installed.",
  },
  {
    id: "lmstudio",
    name: "LM Studio (local)",
    group: "On your computer",
    baseUrl: "http://localhost:1234/v1",
    model: "local-model",
    models: ["local-model"],
    needsKey: false,
    tip: "A desktop app that runs AI on your own computer.",
  },
  {
    id: "openai",
    name: "OpenAI",
    group: "Bring your own key",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o"],
    needsKey: true,
    tip: "The makers of ChatGPT — needs your own paid key.",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    group: "Free with a key",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openrouter/free",
    models: ["openrouter/free", "openai/gpt-4o-mini"],
    needsKey: true,
    tip: "One key that unlocks many different AI models; the free router picks a free model.",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    group: "Free with a key",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-3.8-flash",
    models: ["gemini-3.8-flash"],
    needsKey: true,
    tip: "Google's AI. A free key from Google AI Studio has a daily free allowance — the easiest way to get lots of free runs.",
  },
  {
    id: "groq",
    name: "Groq",
    group: "Free with a key",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.1-8b-instant",
    models: ["llama-3.1-8b-instant", "mixtral-8x7b-32768"],
    needsKey: true,
    tip: "Super-fast AI answers — needs a free account key.",
  },
  {
    id: "kilo",
    name: "Kilo Gateway",
    group: "Bring your own key",
    baseUrl: "https://api.kilocode.ai/v1",
    model: "gpt-4o-mini",
    models: ["gpt-4o-mini"],
    needsKey: true,
    tip: "A gateway that passes your requests to many AI models.",
  },
  {
    id: "cerebras",
    name: "Cerebras",
    group: "Bring your own key",
    baseUrl: "https://api.cerebras.ai/v1",
    model: "gpt-oss-120b",
    models: ["gpt-oss-120b"],
    needsKey: true,
    tip: "Fast AI with a limited free account tier and paid plans.",
  },
  {
    id: "nvidia",
    name: "NVIDIA NIM",
    group: "Bring your own key",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    model: "meta/llama-3.1-8b-instruct",
    models: ["meta/llama-3.1-8b-instruct"],
    needsKey: true,
    tip: "Try NVIDIA-hosted models with limited developer trial credits.",
  },
  {
    id: "mistral",
    name: "Mistral",
    group: "Bring your own key",
    baseUrl: "https://api.mistral.ai/v1",
    model: "mistral-small-latest",
    models: ["mistral-small-latest", "mistral-large-latest"],
    needsKey: true,
    tip: "European AI with a limited experiment plan and paid production plans.",
  },
  {
    id: "cohere",
    name: "Cohere",
    group: "Bring your own key",
    baseUrl: "https://api.cohere.ai/compatibility/v1",
    model: "command-r7b-12-2024",
    models: ["command-r7b-12-2024", "command-a-03-2025"],
    needsKey: true,
    tip: "Writing and document AI; trial keys have limited evaluation usage.",
  },
  {
    id: "ollama-cloud",
    name: "Ollama Cloud",
    group: "Bring your own key",
    baseUrl: "https://ollama.com/v1",
    model: "gpt-oss:120b",
    models: ["gpt-oss:120b", "deepseek-v3.1"],
    needsKey: true,
    tip: "Run large Ollama models online using your account's cloud allowance.",
  },
  {
    id: "sealion",
    name: "SEA-LION",
    group: "Bring your own key",
    baseUrl: "https://api.sea-lion.ai/v1",
    model: "aisingapore/Qwen-SEA-LION-v4.5-27B-IT",
    models: ["aisingapore/Qwen-SEA-LION-v4.5-27B-IT", "aisingapore/Llama-SEA-LION-v3.5-70B-R"],
    needsKey: true,
    tip: "Southeast Asian language models with a limited proof-of-concept API.",
  },
  {
    id: "meganova",
    name: "Meganova",
    group: "Bring your own key",
    baseUrl: "https://api.meganova.ai/v1",
    model: "meganova-ai/manta-mini-1.0",
    models: [
      "meganova-ai/manta-mini-1.0",
      "meganova-ai/manta-flash-1.0",
      "meganova-ai/manta-pro-1.0",
      "zai-org/GLM-4.7-Flash",
    ],
    needsKey: true,
    tip: "Selected models have daily free quotas that depend on your account tier.",
  },
  {
    id: "custom",
    name: "Custom (OpenAI-compatible)",
    group: "Bring your own key",
    baseUrl: "",
    model: "",
    models: [],
    needsKey: false,
    tip: "Any other AI service that speaks the same language as OpenAI.",
  },
];

export const RANKS = [
  { name: "Novice Apprentice", min: 0, icon: "🌱" },
  { name: "Chain Weaver", min: 100, icon: "🧵" },
  { name: "Tool Tamer", min: 250, icon: "🛠️" },
  { name: "Graph Overlord", min: 500, icon: "👑" },
  { name: "Agent Architect", min: 900, icon: "🏗️" },
  { name: "LangGraph Legend", min: 1500, icon: "🌌" },
];

export const QUESTS = [
  { id: "first_run", title: "Run your first prompt", pts: 50, coins: 5 },
  { id: "trace", title: "Open a step in the Inspect Box", pts: 25, coins: 3 },
  { id: "connect2", title: "Change the order of your steps", pts: 25, coins: 3 },
  { id: "python", title: "Peek at Python code", pts: 25, coins: 3 },
  { id: "tool", title: "Use a real tool", pts: 40, coins: 4 },
  { id: "router", title: "Let a router choose a path", pts: 40, coins: 4 },
  { id: "loop", title: "Watch a critic send a draft back", pts: 50, coins: 5 },
  { id: "docs", title: "Search your own document", pts: 50, coins: 5 },
  { id: "install", title: "Install a library recipe", pts: 40, coins: 4 },
  { id: "share", title: "Share a recipe link", pts: 30, coins: 3 },
  { id: "compare", title: "Compare two runs side by side", pts: 40, coins: 4 },
  { id: "connect", title: "Test an AI connection", pts: 30, coins: 3 },
  { id: "konami", title: "??? Secret ???", pts: 100, coins: 20 },
];

export const MILESTONE_COUNT = QUESTS.filter((q) => q.id !== "konami").length;
