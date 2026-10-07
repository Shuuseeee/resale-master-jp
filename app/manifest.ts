import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '账务管理',
    short_name: '账务管理',
    description: '日本業務账务管理システム',
    start_url: '/',
    display: 'standalone',
    // manifest 是静态安装产物，无法逐用户跟随主题；取默认主题 header 色
    background_color: '#1b1b26',
    theme_color: '#1b1b26',
    orientation: 'portrait',
    // any：保留透明圆角；maskable：满铺 + 内容缩进，安卓自适应图标裁成圆形 / 圆角方形也不会切到文字
    icons: [
      { src: '/icons/app-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/app-icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/app-icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
