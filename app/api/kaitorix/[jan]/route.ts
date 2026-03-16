import { NextResponse } from 'next/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jan: string }> }
) {
  const { jan } = await params;

  if (!jan || !/^\d+$/.test(jan)) {
    return NextResponse.json(
      { error: 'Invalid JAN code' },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `https://kaitorix.app/api/product/${jan}?token=maysedorisedori1`,
      {
        headers: {
          'X-API-Token': 'maysedorisedori1',
          'Referer': 'https://kaitorix.app/',
          'Origin': 'https://kaitorix.app',
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch from KaitoriX' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('KaitoriX API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
