// 跨平台触感反馈
// Android: navigator.vibrate
// iOS Safari 17.4+: label + switch checkbox trick 触发 Taptic Engine

export function triggerHaptic(type: 'light' | 'medium' = 'light') {
  if (typeof window === 'undefined') return;

  // Android
  if (window.navigator?.vibrate) {
    window.navigator.vibrate(type === 'light' ? 25 : [30, 50, 30]);
    return;
  }

  // iOS Safari 17.4+: input[type=checkbox][switch] 切换触发 Taptic Engine
  // 元素必须在 viewport 内渲染（display:none / opacity:0 / 屏外都不触发）
  try {
    const fire = () => {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      // 1×1px，视口内，极低不透明度（0 不行，需要可见）
      input.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0.01;border:none;padding:0;margin:0;';
      document.body.appendChild(input);
      input.click();
      // 延迟移除，确保 iOS 有时间触发震动再销毁元素
      setTimeout(() => { if (input.parentNode) input.parentNode.removeChild(input); }, 150);
    };
    fire();
    if (type === 'medium') setTimeout(fire, 100);
  } catch (_) {}
}
