import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/**
 * Send a chat completion request with optional function calling.
 * Uses GPT-5.4 for best accuracy and tool-use support.
 *
 * Returns: { text, tool_calls, raw_message }
 *   raw_message: the full OpenAI message object (needed for multi-turn tool loops)
 */
export async function chat({ messages, systemPrompt, tools = [] }) {
  if (!openai) {
    return {
      text: 'No OPENAI_API_KEY configured in root .env — chat is disabled.',
      tool_calls: [],
      raw_message: null,
    };
  }

  const res = await openai.chat.completions.create({
    model: 'gpt-5.4',
    temperature: 0.3,
    max_completion_tokens: 2048,
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    ...(tools.length > 0
      ? { tools: tools.map((t) => ({ type: 'function', function: t })), tool_choice: 'auto' }
      : {}),
  });

  const msg = res.choices[0].message;
  return { text: msg.content || '', tool_calls: msg.tool_calls || [], raw_message: msg };
}

