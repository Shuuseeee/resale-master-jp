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

  // iOS Safari 17.4+: label 包裹 input[type=checkbox][switch]，label.click() 触发 Taptic Engine
  // 必须用 label.click()，直接 input.click() 无效；display:none 也无效，用屏外定位
  try {
    const fire = () => {
      const label = document.createElement('label');
      label.setAttribute('aria-hidden', 'true');
      label.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;overflow:hidden;opacity:0.01;';
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
