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

  // iOS Safari 17.4+
  try {
    const fire = () => {
      const label = document.createElement('label');
      label.ariaHidden = 'true';
      label.style.display = 'none';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      label.appendChild(input);
      document.head.appendChild(label);
      label.click();
      document.head.removeChild(label);
    };
    fire();
    if (type === 'medium') setTimeout(fire, 80);
  } catch (_) {}
}
