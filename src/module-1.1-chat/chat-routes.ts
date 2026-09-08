import type { Env } from '../env';
import { errorJson, json } from '../lib/http';
import { runGeminiConversation } from './providers/gemini';
import { runOpenAiCompatConversation } from './providers/openai-compat';
import type { ChatMessage, ChatProvider, ChatTurnResult, McpTool } from './types';

export function resolveProvider(value: unknown, env: Env): ChatProvider {
  const provider = value || env.DEFAULT_CHAT_PROVIDER || 'gemini';
  return provider === 'openai' || provider === 'openai-compat' ? provider : 'gemini';
}
export function defaultModelFor(provider: ChatProvider, env: Env): string {
  return provider === 'gemini' ? env.GEMINI_MODEL || 'gemini-flash-latest' : provider === 'openai' ? env.OPENAI_MODEL || 'gpt-4o-mini' : env.OPENAI_COMPAT_MODEL || 'gpt-4o-mini';
}
export function buildSystemPrompt(): string { return 'คุณคือผู้ช่วย AI ที่สุภาพ ตอบภาษาไทยเป็นหลัก และตอบให้กระชับชัดเจน'; }
function resolveApiKey(provider: ChatProvider, env: Env): string { return provider === 'gemini' ? env.GEMINI_API_KEY || '' : provider === 'openai' ? env.OPENAI_API_KEY || '' : env.OPENAI_COMPAT_API_KEY || ''; }
function resolveBaseUrl(provider: ChatProvider, env: Env): string { return provider === 'openai' ? 'https://api.openai.com/v1' : provider === 'openai-compat' ? env.OPENAI_COMPAT_BASE_URL || '' : ''; }
function resolveTools(): McpTool[] { return []; }

export async function runChatTurn(message: string, history: ChatMessage[], provider: ChatProvider, model: string, env: Env): Promise<ChatTurnResult> {
  const messages = [...history, { role: 'user' as const, content: message }];
  const tools = resolveTools();
  const result = provider === 'gemini'
    ? await runGeminiConversation(resolveApiKey(provider, env), model, messages, buildSystemPrompt(), tools)
    : await runOpenAiCompatConversation(resolveBaseUrl(provider, env), resolveApiKey(provider, env), model, messages, buildSystemPrompt(), tools);
  return { reply: result.reply, provider, model, toolTrace: result.toolTrace };
}

export async function handleChatRoute(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return errorJson('ต้องใช้ POST กับ /api/chat', 405);
  let body: any;
  try { body = await request.json(); } catch { return errorJson('รูปแบบ JSON ไม่ถูกต้อง'); }
  if (typeof body?.message !== 'string' || !body.message.trim()) return errorJson('กรุณาระบุ message');
  const history: ChatMessage[] = Array.isArray(body.history) ? body.history.filter((item: any) => (item?.role === 'user' || item?.role === 'assistant') && typeof item.content === 'string') : [];
  const provider = resolveProvider(body.provider, env);
  const model = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : defaultModelFor(provider, env);
  return json(await runChatTurn(body.message.trim(), history, provider, model, env));
}