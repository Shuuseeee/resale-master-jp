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
  // 必须挂到 body 且元素可渲染（不能 display:none），否则 iOS 不触发震动
  try {
    const fire = () => {
      const label = document.createElement('label');
      label.setAttribute('aria-hidden', 'true');
      label.style.cssText = 'position:fixed;pointer-events:none;opacity:0;left:-200px;top:-200px;';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      label.appendChild(input);
      document.body.appendChild(label);
      label.click();
      document.body.removeChild(label);
    };
    fire();
    if (type === 'medium') setTimeout(fire, 80);
  } catch (_) {}
}
