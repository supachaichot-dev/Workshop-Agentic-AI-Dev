import type { ChatMessage, McpTool, ToolTraceEntry } from '../types';
import { toGeminiSchema } from '../tool-schema';

type GeminiResult = { reply: string; toolTrace: ToolTraceEntry[] };
export async function runGeminiConversation(apiKey: string, model: string, messages: ChatMessage[], systemPrompt: string, tools: McpTool[] = []): Promise<GeminiResult> {
  if (!apiKey) return { reply: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY กรุณาตั้งค่า key ก่อนใช้งาน Gemini', toolTrace: [] };
  const contents = [{ role: 'user', parts: [{ text: systemPrompt }] }, ...messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))];
  const body: Record<string, unknown> = { contents };
  if (tools.length) body.tools = [{ functionDeclarations: tools.map((tool) => ({ name: `${tool.serverId}__${tool.name}`, description: tool.description, parameters: toGeminiSchema(tool.inputSchema) })) }];
  for (let round = 0; round < 4; round += 1) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) return { reply: `Gemini ตอบกลับผิดพลาด (${response.status}) กรุณาลองใหม่อีกครั้ง`, toolTrace: [] };
    const data = await response.json() as any;
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const text = parts.find((part: any) => typeof part.text === 'string')?.text;
    if (text) return { reply: text, toolTrace: [] };
    return { reply: 'Gemini ไม่ได้ส่งข้อความตอบกลับ', toolTrace: [] };
  }
  return { reply: 'การเรียกใช้เครื่องมือเกินจำนวนรอบที่กำหนด', toolTrace: [] };
}