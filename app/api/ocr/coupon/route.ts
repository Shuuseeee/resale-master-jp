import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { image, mediaType } = await request.json();
    if (!image) {
      return NextResponse.json({ error: 'image is required' }, { status: 400 });
    }

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL: 'https://api.anthropic.com',
    });

    const today = new Date();
    const currentYear = today.getFullYear();
    const reiwaYear = currentYear - 2018; // 令和元年 = 2019年

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType || 'image/jpeg',
                data: image,
              },
            },
            {
              type: 'text',
              text: `この画像はクーポン・優待券です。画像から以下の情報を読み取り、JSON形式で返してください。

【現在の日付情報】
- 今日: ${currentYear}年${today.getMonth() + 1}月${today.getDate()}日
- 現在の元号: 令和${reiwaYear}年（${currentYear}年）
- 日本は現在「令和」時代です（令和1年 = 2019年）

返すJSONのフォーマット：
{
  "name": "クーポン名または商品名（文字列、必須）",
  "discount_type": "割引の種類（以下から1つ選択: percentage / fixed_amount / point_multiply / free_item）",
  "discount_value": "割引値（数値。percentageなら割合、fixed_amountなら円額、point_multiplyなら倍率。free_itemなら0）",
  "expiry_date": "有効期限（YYYY-MM-DD形式。不明な場合はnull）",
  "start_date": "利用開始日（YYYY-MM-DD形式。不明な場合はnull）",
  "platform": "利用可能なプラットフォームや店舗名（文字列またはnull）",
  "coupon_code": "クーポンコードや番号（文字列またはnull）",
  "min_purchase_amount": "最低購入金額（数値。不明な場合は0）",
  "max_discount_amount": "最大割引額（数値。不明な場合は0）",
  "notes": "その他の条件や備考（文字列またはnull）"
}

注意事項：
- JSONのみ返してください。説明文は不要です
- 読み取れない項目はnullまたは0にしてください
- 日付は必ずYYYY-MM-DD形式に変換してください
- discount_typeの判断基準：%OFFや割引率→percentage、○円引き→fixed_amount、ポイント倍率→point_multiply、無料引換や商品プレゼント→free_item
- 【最重要・日付ルール】元号の明示がない2桁年は「西暦20XX年」として解釈すること：
  - 「26/3/31」→ 2026-03-31（西暦2026年）
  - 「26年3月31日」→ 2026-03-31（西暦2026年）
  - 「27.12.31」→ 2027-12-31（西暦2027年）
  - 絶対に平成として解釈しないこと（平成は2019年に終了）
  - 「令和〇年」と明記されている場合のみ令和換算（令和7年=2025年）
  - 「平成〇年」と明記されている場合のみ平成換算（平成26年=2014年）
  - 元号なしの2桁数字は必ず西暦20XX年`,
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    // Extract JSON from response (strip markdown code blocks if present)
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
    const jsonStr = (jsonMatch[1] || text).trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response', raw: text }, { status: 422 });
    }

    // 平成誤読補正: 元号なし2桁年を平成として解釈した場合（2010-2019）、12年加算して西暦20XX年に修正
    // 例: 平成26年誤読 → 2014 → +12 → 2026
    for (const field of ['expiry_date', 'start_date']) {
      const val = parsed[field];
      if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
        const year = parseInt(val.slice(0, 4), 10);
        if (year >= 2010 && year <= 2019) {
          parsed[field] = `${year + 12}${val.slice(4)}`;
        }
      }
    }

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error('OCR API error:', error);
    return NextResponse.json({
      error: error.message || 'OCR failed',
      type: error.constructor?.name,
      status_code: error.status,
    }, { status: 500 });
  }
}
