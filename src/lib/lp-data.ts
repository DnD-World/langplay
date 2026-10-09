export type StepKind = "input" | "agent" | "tool" | "retriever" | "router" | "critic" | "final";

export interface Step {
  id: string;
  kind: StepKind;
  label: string;
  instruction: string;
}

export const KINDS: Record<
  StepKind,
  { emoji: string; title: string; plain: string; techName: string; analogy: string; code: string }
> = {
  input: {
    emoji: "📝",
    title: "Input Prompt",
    plain: "A mad-libs style form for the AI: your question gets dropped into a ready-made sentence.",
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
    plain: "The brain of the recipe: it reads everything so far and decides what to say or do next.",
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
    plain: "A gadget the AI can use, like looking something up on the web.",
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
    plain: "A traffic cop that sends the question down the right path.",
    techName: "add_conditional_edges",
    analogy: "Like a receptionist pointing you to the right desk.",
    code: `def route(state):
    text = state["messages"][-1].content.lower()
    return "billing" if "refund" in text else "tech"

graph.add_conditional_edges("router", route,
    {"billing": "billing_agent", "tech": "tech_agent"})`,
  },
  critic: {
    emoji: "🧐",
    title: "Critic / Checker",
    plain: "A second AI that reviews the first one's work and suggests fixes.",
    techName: "Reflection Node (multi-agent)",
    analogy: "Like an editor marking up a draft with a red pen.",
    code: `def critic(state):
    review = llm.invoke([
        ("system", "Critique this answer and improve it."),
        *state["messages"],
    ])
    return {"messages": [review]}

graph.add_node("critic", critic)
graph.add_edge("writer", "critic")`,
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

let n = 0;
export const uid = () => `s${Date.now().toString(36)}${(n++).toString(36)}`;
export const mk = (kind: StepKind, instruction = "", label?: string): Step => ({
  id: uid(),
  kind,
  label: label ?? KINDS[kind].title,
  instruction,
});

export const defaultSteps = (): Step[] => [
  mk("input", "Answer like I'm 10 years old: {question}"),
  mk("agent", "Think step by step and draft a friendly answer."),
  mk("tool", "Search the web for supporting facts."),
  mk("final", "Give a short, clear final answer."),
];

export type Category = "Beginner Friendly" | "Multi-Agent" | "Document Q&A" | "Tool User";

export interface Recipe {
  id: string;
  title: string;
  summary: string;
  difficulty: "Easy" | "Medium" | "Hard";
  categories: Category[];
  tools: string[];
  cost: "Cheap" | "Medium";
  source?: string;
  steps: { kind: StepKind; instruction: string; label?: string }[];
}

export const RECIPES: Recipe[] = [
  {
    id: "fact",
    title: "Web Fact Checker",
    summary: "Checks if a claim is true by searching the web and explaining the verdict.",
    difficulty: "Easy",
    categories: ["Beginner Friendly", "Tool User"],
    tools: ["Web Search"],
    cost: "Cheap",
    steps: [
      { kind: "input", instruction: "Is this claim true? {question}" },
      { kind: "agent", instruction: "Decide what to search to verify the claim." },
      { kind: "tool", instruction: "Search the web for evidence." },
      { kind: "final", instruction: "Say TRUE, FALSE or UNSURE and explain why simply." },
    ],
  },
  {
    id: "pdf",
    title: "PDF ELI5 Explainer",
    summary: "Finds the right pages in a document and explains them like you're five.",
    difficulty: "Medium",
    categories: ["Document Q&A", "Beginner Friendly"],
    tools: ["Document Lookup"],
    cost: "Cheap",
    steps: [
      { kind: "input", instruction: "Explain from my document: {question}" },
      { kind: "retriever", instruction: "Fetch the 3 most relevant pages." },
      { kind: "agent", instruction: "Explain the pages like I'm five." },
      { kind: "final", instruction: "Summarize in 3 bullet points." },
    ],
  },
  {
    id: "duo",
    title: "Writer & Critic Duo",
    summary: "One AI writes, another critiques, and together they polish the result.",
    difficulty: "Medium",
    categories: ["Multi-Agent"],
    tools: ["None"],
    cost: "Medium",
    steps: [
      { kind: "input", instruction: "Write about: {question}" },
      { kind: "agent", instruction: "Write a short first draft.", label: "Writer" },
      { kind: "critic", instruction: "Point out weaknesses and rewrite it better." },
      { kind: "final", instruction: "Return the polished version." },
    ],
  },
  {
    id: "router",
    title: "Smart Support Router",
    summary: "Sorts customer questions into billing or tech help and answers accordingly.",
    difficulty: "Medium",
    categories: ["Multi-Agent", "Tool User"],
    tools: ["Router"],
    cost: "Cheap",
    steps: [
      { kind: "input", instruction: "Customer says: {question}" },
      { kind: "router", instruction: "Is this about billing or tech?" },
      { kind: "agent", instruction: "Answer as the matching support specialist.", label: "Specialist" },
      { kind: "final", instruction: "Reply politely in under 80 words." },
    ],
  },
  {
    id: "code",
    title: "Code Fixer & Explainer",
    summary: "Fixes a broken bit of code, tests it, and explains the fix in plain words.",
    difficulty: "Hard",
    categories: ["Tool User"],
    tools: ["Code Runner"],
    cost: "Medium",
    steps: [
      { kind: "input", instruction: "Fix this code: {question}" },
      { kind: "agent", instruction: "Find the bug and propose a fix.", label: "Fixer" },
      { kind: "tool", instruction: "Run a quick test on the fixed code.", label: "Test Runner" },
      { kind: "critic", instruction: "Double-check the test result." },
      { kind: "final", instruction: "Show the fix and explain it for a beginner." },
    ],
  },
  {
    id: "brief",
    title: "Daily Briefing Bot",
    summary: "Gathers today's news on a topic and turns it into a 1-minute briefing.",
    difficulty: "Easy",
    categories: ["Beginner Friendly", "Tool User"],
    tools: ["Web Search"],
    cost: "Cheap",
    steps: [
      { kind: "input", instruction: "Topic for today's briefing: {question}" },
      { kind: "tool", instruction: "Search for today's headlines." },
      { kind: "agent", instruction: "Summarize each headline in one line.", label: "Summarizer" },
      { kind: "agent", instruction: "Merge into a friendly morning briefing.", label: "Editor" },
      { kind: "final", instruction: "Deliver the briefing in 5 bullets." },
    ],
  },
];

export const CATEGORIES: Category[] = ["Beginner Friendly", "Multi-Agent", "Document Q&A", "Tool User"];

export type ProviderId =
  | "simulator" | "pollinations" | "puter" | "horde" | "ovh" | "ollama" | "lmstudio"
  | "openai" | "openrouter" | "groq" | "kilo" | "custom"
  | "cerebras" | "nvidia" | "mistral" | "cohere" | "ollama-cloud" | "sealion" | "meganova";

export const PROVIDERS: { id: ProviderId; name: string; group: string; baseUrl: string; model: string; models: string[]; needsKey: boolean; tip: string }[] = [
  { id: "simulator", name: "Offline Simulator", group: "Instant & offline", baseUrl: "", model: "sim-1", models: ["sim-1"], needsKey: false, tip: "Pretend AI that answers instantly without the internet — perfect for practice." },
  { id: "pollinations", name: "Pollinations AI", group: "Free · no key", baseUrl: "https://text.pollinations.ai/openai", model: "openai", models: ["openai"], needsKey: false, tip: "A free AI service you can use without signing up. Your questions are sent to pollinations.ai." },
  { id: "puter", name: "Puter AI", group: "No API key", baseUrl: "puter.js", model: "gpt-4o-mini", models: ["gpt-4o-mini", "gpt-4o", "claude-3-5-sonnet"], needsKey: false, tip: "Puter handles payment and sign-in for you; usage is not automatically free." },
  { id: "horde", name: "AI Horde", group: "Free · no key", baseUrl: "https://oai.aihorde.net/v1", model: "auto", models: ["auto"], needsKey: false, tip: "Volunteers share their computers to run AI for free — can be slow. \"auto\" picks whichever model volunteers are running now. Its service returned errors when tested on 9 Oct 2026; Langplay falls back to the Simulator if it fails." },
  { id: "ovh", name: "OVHcloud AI Endpoints", group: "Free · no key", baseUrl: "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1", model: "Mistral-7B-Instruct-v0.3", models: ["Mistral-7B-Instruct-v0.3", "Meta-Llama-3_1-70B-Instruct"], needsKey: false, tip: "A European cloud that offers a free, limited AI tier." },
  { id: "ollama", name: "Ollama (local)", group: "On your computer", baseUrl: "http://localhost:11434/v1", model: "llama3", models: ["llama3", "mistral", "phi3"], needsKey: false, tip: "Runs AI on your own computer — private and free once installed." },
  { id: "lmstudio", name: "LM Studio (local)", group: "On your computer", baseUrl: "http://localhost:1234/v1", model: "local-model", models: ["local-model"], needsKey: false, tip: "A desktop app that runs AI on your own computer." },
  { id: "openai", name: "OpenAI", group: "Bring your own key", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini", models: ["gpt-4o-mini", "gpt-4o"], needsKey: true, tip: "The makers of ChatGPT — needs your own paid key." },
  { id: "openrouter", name: "OpenRouter", group: "Bring your own key", baseUrl: "https://openrouter.ai/api/v1", model: "openrouter/free", models: ["openrouter/free", "openai/gpt-4o-mini"], needsKey: true, tip: "One key that unlocks many different AI models; the free router picks a free model." },
  { id: "groq", name: "Groq", group: "Bring your own key", baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.1-8b-instant", models: ["llama-3.1-8b-instant", "mixtral-8x7b-32768"], needsKey: true, tip: "Super-fast AI answers — needs a free account key." },
  { id: "kilo", name: "Kilo Gateway", group: "Bring your own key", baseUrl: "https://api.kilocode.ai/v1", model: "gpt-4o-mini", models: ["gpt-4o-mini"], needsKey: true, tip: "A gateway that passes your requests to many AI models." },
  { id: "cerebras", name: "Cerebras", group: "Bring your own key", baseUrl: "https://api.cerebras.ai/v1", model: "gpt-oss-120b", models: ["gpt-oss-120b"], needsKey: true, tip: "Fast AI with a limited free account tier and paid plans." },
  { id: "nvidia", name: "NVIDIA NIM", group: "Bring your own key", baseUrl: "https://integrate.api.nvidia.com/v1", model: "meta/llama-3.1-8b-instruct", models: ["meta/llama-3.1-8b-instruct"], needsKey: true, tip: "Try NVIDIA-hosted models with limited developer trial credits." },
  { id: "mistral", name: "Mistral", group: "Bring your own key", baseUrl: "https://api.mistral.ai/v1", model: "mistral-small-latest", models: ["mistral-small-latest", "mistral-large-latest"], needsKey: true, tip: "European AI with a limited experiment plan and paid production plans." },
  { id: "cohere", name: "Cohere", group: "Bring your own key", baseUrl: "https://api.cohere.ai/compatibility/v1", model: "command-r7b-12-2024", models: ["command-r7b-12-2024", "command-a-03-2025"], needsKey: true, tip: "Writing and document AI; trial keys have limited evaluation usage." },
  { id: "ollama-cloud", name: "Ollama Cloud", group: "Bring your own key", baseUrl: "https://ollama.com/v1", model: "gpt-oss:120b", models: ["gpt-oss:120b", "deepseek-v3.1"], needsKey: true, tip: "Run large Ollama models online using your account's cloud allowance." },
  { id: "sealion", name: "SEA-LION", group: "Bring your own key", baseUrl: "https://api.sea-lion.ai/v1", model: "aisingapore/Qwen-SEA-LION-v4.5-27B-IT", models: ["aisingapore/Qwen-SEA-LION-v4.5-27B-IT", "aisingapore/Llama-SEA-LION-v3.5-70B-R"], needsKey: true, tip: "Southeast Asian language models with a limited proof-of-concept API." },
  { id: "meganova", name: "Meganova", group: "Bring your own key", baseUrl: "https://api.meganova.ai/v1", model: "meganova-ai/manta-mini-1.0", models: ["meganova-ai/manta-mini-1.0", "meganova-ai/manta-flash-1.0", "meganova-ai/manta-pro-1.0", "zai-org/GLM-4.7-Flash"], needsKey: true, tip: "Selected models have daily free quotas that depend on your account tier." },
  { id: "custom", name: "Custom (OpenAI-compatible)", group: "Bring your own key", baseUrl: "", model: "", models: [], needsKey: false, tip: "Any other AI service that speaks the same language as OpenAI." },
];

export const RANKS = [
  { name: "Novice Apprentice", min: 0, icon: "🌱" },
  { name: "Chain Weaver", min: 100, icon: "🧵" },
  { name: "Tool Tamer", min: 250, icon: "🛠️" },
  { name: "Graph Overlord", min: 500, icon: "👑" },
];

export const QUESTS = [
  { id: "first_run", title: "Run your first prompt", pts: 50, coins: 5 },
  { id: "connect2", title: "Connect 2+ nodes", pts: 25, coins: 3 },
  { id: "python", title: "Peek at Python code", pts: 25, coins: 3 },
  { id: "tool", title: "Trigger a tool", pts: 40, coins: 4 },
  { id: "install", title: "Install a community recipe", pts: 40, coins: 4 },
  { id: "connect", title: "Test an AI connection", pts: 30, coins: 3 },
  { id: "konami", title: "??? Secret ???", pts: 100, coins: 20 },
];
