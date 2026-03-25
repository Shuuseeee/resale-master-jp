import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

    const client = new Anthropic({ apiKey, baseURL: 'https://api.anthropic.com' });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Reply "ok"' }],
    });

    return NextResponse.json({ ok: true, reply: response.content[0] });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      type: error.constructor?.name,
      status: error.status,
    }, { status: 500 });
  }
}
