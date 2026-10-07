// lib/utils/clipboard.ts
// 复制「需要先异步准备」的文本。
//
// 为什么不是 `await 取数 → navigator.clipboard.writeText`：Safari / iOS PWA 要求剪贴板写入发生在
// 用户手势的同一调用栈里，await 网络请求之后手势已失效，会抛 NotAllowedError。
// ClipboardItem 允许把「Promise<Blob>」交给浏览器，由浏览器在手势内占位、数据稍后到位。
// 不支持 ClipboardItem 的环境退回「先取数再 writeText」（多数桌面浏览器仍可成功）。
//
// 调用方必须在点击事件的同步部分调用本函数（不要先 await 别的东西）。

export async function copyTextAsync(getText: () => Promise<string>): Promise<void> {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    const item = new ClipboardItem({
      'text/plain': getText().then(text => new Blob([text], { type: 'text/plain' })),
    });
    await navigator.clipboard.write([item]);
    return;
  }
  const text = await getText();
  await navigator.clipboard.writeText(text);
}
