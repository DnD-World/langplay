import { calculate, formatNumber } from "./calc";
import type { Source, ToolFn, ToolId, ToolResult } from "./types";

// Tools that work straight from a browser with no account or key.

export const TOOL_INFO: Record<ToolId, { name: string; hint: string; needsInput: boolean }> = {
  wikipedia: {
    name: "Wikipedia search",
    hint: "Write 2–6 search keywords for an encyclopedia.",
    needsInput: true,
  },
  websearch: {
    name: "Quick web answer (DuckDuckGo)",
    hint: "Write a short search phrase, like you would type into a search engine.",
    needsInput: true,
  },
  calculator: {
    name: "Calculator",
    hint: "Write one maths expression using numbers and + - * / ^ ( ) sqrt(). No words.",
    needsInput: true,
  },
  datetime: { name: "Today's date and time", hint: "", needsInput: false },
  sample: { name: "Practice results (made up)", hint: "", needsInput: false },
};

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const timeout = AbortSignal.timeout(15000);
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    credentials: "omit",
  });
  if (!response.ok) throw new Error(`The service replied ${response.status}.`);
  return response.json();
}

const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, "")}…` : text;

export const wikipedia: ToolFn = async (query, signal) => {
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrlimit=3&prop=extracts|info" +
    "&exintro=1&explaintext=1&exlimit=3&inprop=url&format=json&origin=*&gsrsearch=" +
    encodeURIComponent(query);
  const data = (await getJson(url, signal)) as {
    query?: {
      pages?: Record<
        string,
        { title?: string; extract?: string; fullurl?: string; index?: number }
      >;
    };
  };
  const pages = Object.values(data.query?.pages ?? {}).sort(
    (a, b) => (a.index ?? 0) - (b.index ?? 0),
  );
  const sources: Source[] = pages
    .filter((p) => p.title && p.extract)
    .map((p) => ({
      title: `Wikipedia: ${p.title}`,
      url: p.fullurl,
      snippet: clip((p.extract ?? "").replace(/\s+/g, " "), 600),
    }));
  if (!sources.length) return { text: `Wikipedia found nothing for "${query}".`, sources };
  return {
    text: sources.map((s) => `${s.title}\n${s.snippet}`).join("\n\n"),
    sources,
  };
};

export const websearch: ToolFn = async (query, signal) => {
  const data = (await getJson(
    `https://api.duckduckgo.com/?format=json&no_html=1&skip_disambig=1&q=${encodeURIComponent(query)}`,
    signal,
  )) as {
    Answer?: string;
    AbstractText?: string;
    AbstractURL?: string;
    AbstractSource?: string;
    Definition?: string;
    DefinitionURL?: string;
    RelatedTopics?: { Text?: string; FirstURL?: string }[];
  };
  const sources: Source[] = [];
  if (data.Answer) sources.push({ title: "DuckDuckGo instant answer", snippet: data.Answer });
  if (data.AbstractText)
    sources.push({
      title: data.AbstractSource || "Summary",
      url: data.AbstractURL,
      snippet: clip(data.AbstractText, 600),
    });
  if (data.Definition)
    sources.push({ title: "Definition", url: data.DefinitionURL, snippet: data.Definition });
  for (const topic of data.RelatedTopics ?? []) {
    if (sources.length >= 4) break;
    if (topic.Text) sources.push({ title: "Related", url: topic.FirstURL, snippet: topic.Text });
  }
  // DuckDuckGo only has instant answers for well-known topics; fall back to Wikipedia.
  if (!sources.length) {
    const wiki = await wikipedia(query, signal);
    return {
      ...wiki,
      text: `No quick web answer for "${query}", so Wikipedia was searched instead.\n\n${wiki.text}`,
    };
  }
  return { text: sources.map((s) => `${s.title}: ${s.snippet}`).join("\n\n"), sources };
};

export const calculator: ToolFn = async (input) => {
  const expression = input.replace(/[=?]+\s*$/, "").trim();
  const value = calculate(expression);
  return {
    text: `${expression} = ${formatNumber(value)}`,
    sources: [{ title: "Calculator", snippet: `${expression} = ${formatNumber(value)}` }],
  };
};

export const datetime: ToolFn = async () => {
  const now = new Date();
  const readable = now.toLocaleString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
  return {
    text: `Right now it is ${readable} (${now.toISOString()}).`,
    sources: [{ title: "Device clock", snippet: readable }],
  };
};

export const sample: ToolFn = async (input) => ({
  text: `• Source A says the main idea of "${clip(input, 40)}" is well documented.\n• Source B gives a simple everyday example.`,
  sources: [
    { title: "Practice source A (made up)", snippet: "The main idea is well documented." },
    { title: "Practice source B (made up)", snippet: "A simple everyday example." },
  ],
  practice: true,
});

export const DEFAULT_TOOLS: Record<ToolId, ToolFn> = {
  wikipedia,
  websearch,
  calculator,
  datetime,
  sample,
};

export type { ToolResult };
