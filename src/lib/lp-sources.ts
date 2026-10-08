import type { Recipe } from './lp-data';
export const SOURCES = [
  { id: 'langchain-ai/cookbooks', name: 'LangChain Cookbooks', url: 'https://github.com/langchain-ai/cookbooks' },
  { id: 'langchain-ai/langsmith-cookbook', name: 'LangSmith Cookbook', url: 'https://github.com/langchain-ai/langsmith-cookbook' },
  { id: 'masoudSarafZadeh/langchain-cookbook', name: 'Community Cookbook', url: 'https://github.com/masoudSarafZadeh/langchain-cookbook' },
];
export type SourceFile = { path: string; url: string; raw: string; repo: string };
async function readJson(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Source replied (${response.status}): ${(await response.text()).slice(0, 200)}`);
  return response.json();
}
export async function listSource(repo: string): Promise<SourceFile[]> {
  if (!SOURCES.some(s => s.id === repo)) throw new Error('Unknown recipe source.');
  const info = await readJson(`https://api.github.com/repos/${repo}`);
  const data = await readJson(`https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(info.default_branch)}?recursive=1`);
  return (data.tree ?? []).filter((entry: { type: string; path: string }) => entry.type === 'blob' && /\.(ipynb|py|md)$/.test(entry.path) && !/LICENSE|README|__init__/.test(entry.path)).map((entry: { path: string }) => ({
    path: entry.path, repo, url: `https://github.com/${repo}/blob/${info.default_branch}/${entry.path}`,
    raw: `https://raw.githubusercontent.com/${repo}/${info.default_branch}/${entry.path}`,
  }));
}
export async function readSource(file: SourceFile): Promise<{ text: string; prompts: string[] }> {
  const response = await fetch(file.raw, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Could not open this example (${response.status}).`);
  let text = await response.text();
  if (file.path.endsWith('.ipynb')) {
    const notebook = JSON.parse(text);
    text = (notebook.cells ?? []).map((c: { source?: string[] | string }) => Array.isArray(c.source) ? c.source.join('') : c.source ?? '').join('\n\n');
  }
  const prompts = [...text.matchAll(/(?:template|system_prompt|prompt)\s*=\s*(?:[fr])?(?:"""([\s\S]*?)"""|'''([\s\S]*?)'''|"([^"\n]{25,})"|'([^'\n]{25,})')/gi)]
    .map(m => m[1] ?? m[2] ?? m[3] ?? m[4] ?? '').filter(Boolean);
  return { text, prompts: [...new Set(prompts)] };
}
function collectTemplates(value: unknown, result: string[]) {
  if (!value || typeof value !== 'object') return;
  if ('template' in value && typeof value.template === 'string') result.push(value.template);
  for (const child of Object.values(value)) if (child && typeof child === 'object') collectTemplates(child, result);
}
export async function pullHub(handle: string): Promise<{ text: string; source: string }> {
  const clean = handle.trim().replace(/^https:\/\/smith.langchain.com\/hub\//, '').replace(/\/$/, '');
  if (!/^[\w-]+\/[\w.-]+$/.test(clean)) throw new Error('Use a public prompt name like rlm/rag-prompt.');
  const data = await readJson(`https://api.hub.langchain.com/commits/${clean}/latest`);
  const templates: string[] = []; collectTemplates(data.manifest, templates);
  if (!templates.length) throw new Error('This prompt has no readable text template.');
  return { text: templates.join('\n\n'), source: `https://smith.langchain.com/hub/${clean}` };
}
export function promptRecipe(title: string, prompt: string, source: string): Recipe {
  return { id: `source-${title}`, title, source, summary: 'Prompt adapted into a text-only recipe; original tools and document connections are not imported.', difficulty: 'Easy', categories: ['Beginner Friendly'], tools: [], cost: 'Cheap', steps: [
    { kind: 'input', instruction: '{question}' },
    { kind: 'agent', instruction: prompt, label: title.split('/').pop()?.replace(/\.(ipynb|py|md)$/, '') ?? title },
  ] };
}