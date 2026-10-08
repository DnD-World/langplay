import { describe, expect, it } from 'vitest';
import { classifyModel } from '../lib/lp-models';

describe('free model safety', () => {
  it('recognizes the OpenRouter suffix and zero prices', () => {
    expect(classifyModel('openrouter', 'example:free', false).free).toBe(true);
    expect(classifyModel('openrouter', 'example', false, { prompt: '0', completion: '0' }).free).toBe(true);
    expect(classifyModel('openrouter', 'example', false, { prompt: '0', completion: '.01' }).free).toBe(false);
    expect(classifyModel('openrouter', 'example', false, { prompt: '0' }).free).toBe(false);
  });
  it('never treats unknown or paid services as free', () => {
    expect(classifyModel('custom', 'free-model', true).free).toBe(false);
    expect(classifyModel('openai', 'gpt-4o-mini', true).free).toBe(false);
    expect(classifyModel('puter', 'gpt-4o', false).free).toBe(false);
  });
  it('requires confirmed account allowance for trials', () => {
    expect(classifyModel('cohere', 'command-r7b-12-2024', false).free).toBe(false);
    expect(classifyModel('cohere', 'command-r7b-12-2024', true).free).toBe(true);
  });
  it('uses Meganova allowlist AND account eligibility', () => {
    expect(classifyModel('meganova', 'meganova-ai/manta-mini-1.0', false).free).toBe(false);
    expect(classifyModel('meganova', 'meganova-ai/manta-mini-1.0', true).free).toBe(true);
    expect(classifyModel('meganova', 'unknown', true).free).toBe(false);
  });
});