import type { ChatMessage, McpTool, ToolTraceEntry } from '../types';
type OpenAiResult = { reply: string; toolTrace: ToolTraceEntry[] };
export async function runOpenAiCompatConversation(baseUrl: string, apiKey: string, model: string, messages: ChatMessage[], systemPrompt: string, tools: McpTool[] = []): Promise<OpenAiResult> {
  if (!baseUrl) return { reply: 'ยังไม่ได้ตั้งค่า base URL ของ OpenAI-compatible gateway', toolTrace: [] };
  if (!apiKey) return { reply: 'ยังไม่ได้ตั้งค่า API key ของ provider ที่เลือก', toolTrace: [] };
  const messagesBody = [{ role: 'system', content: systemPrompt }, ...messages];
  const body: Record<string, unknown> = { model, messages: messagesBody };
  if (tools.length) { body.tools = tools.map((tool) => ({ type: 'function', function: { name: `${tool.serverId}__${tool.name}`, description: tool.description, parameters: tool.inputSchema } })); body.tool_choice = 'auto'; }
  const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  for (let round = 0; round < 4; round += 1) {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body) });
    if (!response.ok) return { reply: `AI provider ตอบกลับผิดพลาด (${response.status}) กรุณาลองใหม่อีกครั้ง`, toolTrace: [] };
    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content;
    if (typeof content === 'string') return { reply: content, toolTrace: [] };
    return { reply: 'AI provider ไม่ได้ส่งข้อความตอบกลับ', toolTrace: [] };
  }
  return { reply: 'การเรียกใช้เครื่องมือเกินจำนวนรอบที่กำหนด', toolTrace: [] };
}