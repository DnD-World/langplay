import { afterEach, describe, expect, it, vi } from 'vitest';
import { readSource, pullHub } from '@/lib/lp-sources';
import { fetchModels } from '@/lib/lp-models';
const file = {path:'example.ipynb', raw:'https://raw.githubusercontent.com/langchain-ai/cookbooks/main/example.ipynb',url:'https://github.com/langchain-ai/cookbooks', repo:'langchain-ai/cookbooks'};
afterEach(() => vi.unstubAllGlobals());
describe('source data safety', () => {
  it('extracts author context, prompt text and account hints without executing code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({cells:[{cell_type:'markdown',source:['# Example\n\nThis workflow asks an assistant to answer using the evidence you provide.']},{cell_type:'code',source:['system_prompt = "Answer the question with the evidence supplied here."\nkey = os.environ["OPENAI_API_KEY"]']}]}))));
    const result = await readSource(file);
    expect(result.overview).toContain('evidence you provide'); expect(result.prompts).toHaveLength(1); expect(result.requirements).toContain('OPENAI_API_KEY');
  });
  it('rejects malformed notebook data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"cells":{}}')));
    await expect(readSource(file)).rejects.toThrow('no readable cells');
  });
  it('rejects incompatible model lists, skips null rows', async () => {
    const fetchMock=vi.fn().mockResolvedValueOnce(new Response('null')).mockResolvedValueOnce(new Response('{"data":[null,{"id":"test:free"}]}')); vi.stubGlobal('fetch',fetchMock);
    const settings={provider:'openrouter',baseUrl:'https://openrouter.ai/api/v1',apiKey:'',model:'test:free'};
    await expect(fetchModels(settings)).rejects.toThrow('compatible model list');
    expect(await fetchModels(settings)).toEqual([{id:'test:free',free:true,evidence:'Zero-price model · limited usage'}]);
  });
  it('validates public Hub handles before requesting data', async () => {
    const fetchMock=vi.fn();vi.stubGlobal('fetch',fetchMock);
    await expect(pullHub('https://unknown.example/private')).rejects.toThrow('public prompt');expect(fetchMock).not.toHaveBeenCalled();
  });
});