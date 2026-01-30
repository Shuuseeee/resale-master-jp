// lib/pdf-font-loader.ts
// PDF日本語フォントローダー

import type { jsPDF } from 'jspdf';

let fontLoaded = false;
let fontBase64Cache: string | null = null;
let fontLoadError = false;

/**
 * PDFに日本語フォントを追加
 * jsPDF 2.x で正しく動作
 *
 * Noto Sans JPフォントを使用して日本語テキストを表示
 * フォント読み込みに失敗した場合は、標準フォントにフォールバック
 */
export async function loadJapaneseFont(doc: jsPDF): Promise<void> {
  // 以前のロードが失敗している場合は、標準フォントを使用
  if (fontLoadError) {
    console.warn('日本語フォントは利用できません。標準フォントを使用します。');
    doc.setFont('helvetica');
    return;
  }

  // キャッシュされたフォントがある場合は再利用
  if (fontLoaded && fontBase64Cache) {
    try {
      doc.addFileToVFS('NotoSansJP-Regular.ttf', fontBase64Cache);
      doc.addFont('NotoSansJP-Regular.ttf', 'NotoSansJP', 'normal');
      doc.setFont('NotoSansJP');
      return;
    } catch (error) {
      console.error('キャッシュされたフォントの使用に失敗:', error);
      // キャッシュをクリアして再読み込みを試みる
      fontLoaded = false;
      fontBase64Cache = null;
    }
  }

  try {
    // フォントファイルを取得
    const response = await fetch('/fonts/NotoSansJP-Regular.ttf');
    if (!response.ok) {
      throw new Error(`フォント取得失敗: ${response.status}`);
    }

    // ArrayBufferとして取得し、Base64に変換
    const fontBuffer = await response.arrayBuffer();
    const fontBase64 = arrayBufferToBase64(fontBuffer);

    // Base64文字列をキャッシュ
    fontBase64Cache = fontBase64;

    // jsPDFにフォントを追加（エラーを抑制）
    try {
      doc.addFileToVFS('NotoSansJP-Regular.ttf', fontBase64);
      doc.addFont('NotoSansJP-Regular.ttf', 'NotoSansJP', 'normal');
      doc.setFont('NotoSansJP');

      fontLoaded = true;
      console.log('日本語フォント読み込み成功');
    } catch (fontError) {
      // フォントの解析エラーを捕捉
      console.warn('フォントの解析に失敗しました。標準フォントを使用します:', fontError);
      fontLoadError = true;
      doc.setFont('helvetica');
      // エラーを再スローしない - フォールバック動作を許可
    }
  } catch (error) {
    console.error('日本語フォントの読み込みに失敗:', error);
    fontLoadError = true;
    // フォールバックとして標準フォントを使用
    doc.setFont('helvetica');
    // エラーを再スローしない - PDFエクスポート自体は続行
  }
}

/**
 * ArrayBufferをBase64に変換（大きなファイルに対応）
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000; // 32KB chunks
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }

  return btoa(binary);
}
