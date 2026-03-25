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
- 【重要】日付の解釈：「26/3/31」や「26年3月31日」のような2桁年は西暦20XX年として解釈する（例: 26/3/31 → 2026-03-31）。現在は令和時代であり平成（1989-2019）ではない`,
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
