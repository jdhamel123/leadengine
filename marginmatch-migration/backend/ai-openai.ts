/**
 * Provider-neutral AI adapter backed by the OpenAI Responses API.
 * Keeps AI access out of business logic so providers can be swapped later.
 */
type AnyRecord = Record<string, unknown>;

function apiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is required');
  return key;
}

async function callOpenAI(input: AnyRecord) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error('AI request failed: ' + response.status + ' ' + body);
  }
  return response.json() as Promise<AnyRecord>;
}

function extractText(result: AnyRecord): string {
  if (typeof result.output_text === 'string') return result.output_text;
  const output = Array.isArray(result.output) ? result.output : [];
  const texts: string[] = [];
  for (const item of output as AnyRecord[]) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content as AnyRecord[]) {
      if (typeof part.text === 'string') texts.push(part.text);
    }
  }
  return texts.join('\n').trim();
}

export const openAiAdapter = {
  async generate(options: AnyRecord): Promise<{ text: string }> {
    const system = String(options.system || '');
    const prompt = String(options.prompt || '');
    const result = await callOpenAI({
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
      input: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: prompt },
      ],
      max_output_tokens: Number(options.maxTokens || 500),
    });
    return { text: extractText(result) };
  },

  async run(options: AnyRecord): Promise<{ data?: unknown }> {
    // Compatibility path for structured agent calls. We deliberately return
    // parsed JSON only when the model emits valid JSON; otherwise callers can
    // escalate rather than silently taking an unsafe action.
    const system = String(options.system || '');
    const prompt = String(options.prompt || '');
    const result = await callOpenAI({
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
      input: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: prompt + '\nReturn JSON only.' },
      ],
      max_output_tokens: Number(options.maxTokens || 500),
    });
    const text = extractText(result);
    try {
      return { data: JSON.parse(text) };
    } catch {
      return { data: undefined };
    }
  },
};
