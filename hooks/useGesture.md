# 手势支持 (useGesture Hook)

轻量级的手势识别 Hook，无需外部依赖，支持滑动、长按、双击等常见手势。

## 功能特性

- ✅ 滑动检测（上下左右）
- ✅ 长按检测
- ✅ 双击检测
- ✅ 零依赖，轻量级
- ✅ TypeScript 支持
- ✅ 被动事件监听，性能优化
- ✅ 自动清理

## 基础用法

### 1. 导入 Hook

```tsx
import { useGesture } from '@/hooks/useGesture';
```

### 2. 完整手势支持

```tsx
function Component() {
  const gestureRef = useGesture<HTMLDivElement>({
    onSwipeLeft: () => console.log('向左滑动'),
    onSwipeRight: () => console.log('向右滑动'),
    onSwipeUp: () => console.log('向上滑动'),
    onSwipeDown: () => console.log('向下滑动'),
    onLongPress: () => console.log('长按'),
    onDoubleTap: () => console.log('双击'),
    threshold: 50,        // 滑动阈值（默认 50px）
    longPressDelay: 500,  // 长按延迟（默认 500ms）
    doubleTapDelay: 300,  // 双击延迟（默认 300ms）
  });

  return (
    <div ref={gestureRef} className="p-4 bg-gray-100">
      在这里尝试手势
    </div>
  );
}
```

## 专用 Hooks

### 滑动删除

```tsx
import { useSwipeToDelete } from '@/hooks/useGesture';

function ListItem({ item, onDelete }) {
  const swipeRef = useSwipeToDelete(
    () => {
      if (confirm('确定删除吗？')) {
        onDelete(item.id);
      }
    },
    80 // 滑动阈值
  );

  return (
    <div ref={swipeRef} className="p-4 bg-white">
      {item.name}
      <span className="text-gray-400">← 向左滑动删除</span>
    </div>
  );
}
```

### 长按菜单

```tsx
import { useLongPressMenu } from '@/hooks/useGesture';

function Card({ item }) {
  const [showMenu, setShowMenu] = useState(false);

  const longPressRef = useLongPressMenu(
    () => setShowMenu(true),
    500 // 长按延迟
  );

  return (
    <>
      <div ref={longPressRef} className="p-4">
        {item.name}
      </div>

      {showMenu && (
        <Menu onClose={() => setShowMenu(false)}>
          <MenuItem>编辑</MenuItem>
          <MenuItem>删除</MenuItem>
        </Menu>
      )}
    </>
  );
}
```

### 双击缩放

```tsx
import { useDoubleTapZoom } from '@/hooks/useGesture';

function ImageViewer({ src }) {
  const [isZoomed, setIsZoomed] = useState(false);

  const doubleTapRef = useDoubleTapZoom(
    () => setIsZoomed(!isZoomed)
  );

  return (
    <div ref={doubleTapRef}>
      <img
        src={src}
        className={isZoomed ? 'scale-150' : 'scale-100'}
      />
    </div>
  );
}
```

## 实际应用示例

### 1. 交易卡片滑动删除

```tsx
// components/TransactionCard.tsx
import { useSwipeToDelete } from '@/hooks/useGesture';
import { ConfirmModal } from '@/components/Modal';

function TransactionCard({ transaction, onDelete }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const swipeRef = useSwipeToDelete(() => {
    setShowDeleteConfirm(true);
  });

  return (
    <>
      <div ref={swipeRef} className="...">
        {/* 卡片内容 */}
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => onDelete(transaction.id)}
        title="确认删除"
        message="确定要删除这条记录吗？"
        confirmVariant="danger"
      />
    </>
  );
}
```

### 2. 图片长按预览

```tsx
function ProductImage({ src, alt }) {
  const [showPreview, setShowPreview] = useState(false);

  const longPressRef = useLongPressMenu(
    () => setShowPreview(true)
  );

  return (
    <>
      <img
        ref={longPressRef}
        src={src}
        alt={alt}
        className="cursor-pointer"
      />

      {showPreview && (
        <Modal
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          size="lg"
        >
          <img src={src} alt={alt} className="w-full" />
        </Modal>
      )}
    </>
  );
}
```

### 3. 轮播图滑动

```tsx
function Carousel({ images }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const carouselRef = useGesture({
    onSwipeLeft: () => {
      setCurrentIndex((prev) =>
        prev < images.length - 1 ? prev + 1 : prev
      );
    },
    onSwipeRight: () => {
      setCurrentIndex((prev) =>
        prev > 0 ? prev - 1 : prev
      );
    },
    threshold: 30,
  });

  return (
    <div ref={carouselRef} className="overflow-hidden">
      <div
        className="flex transition-transform duration-300"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {images.map((img, i) => (
          <img key={i} src={img} className="w-full flex-shrink-0" />
        ))}
      </div>
    </div>
  );
}
```

## 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| onSwipeLeft | () => void | - | 向左滑动回调 |
| onSwipeRight | () => void | - | 向右滑动回调 |
| onSwipeUp | () => void | - | 向上滑动回调 |
| onSwipeDown | () => void | - | 向下滑动回调 |
| onLongPress | () => void | - | 长按回调 |
| onDoubleTap | () => void | - | 双击回调 |
| threshold | number | 50 | 滑动阈值（像素） |
| longPressDelay | number | 500 | 长按延迟（毫秒） |
| doubleTapDelay | number | 300 | 双击延迟（毫秒） |

## 注意事项

### 1. 与滚动冲突

垂直滑动手势可能与页面滚动冲突。如果需要同时支持滚动和上下滑动，考虑：

```tsx
// 只监听水平滑动
const gestureRef = useGesture({
  onSwipeLeft: handleSwipeLeft,
  onSwipeRight: handleSwipeRight,
  // 不设置 onSwipeUp 和 onSwipeDown
});
```

### 2. 与点击事件冲突

如果元素同时需要点击和手势，确保在滑动时阻止点击：

```tsx
const gestureRef = useGesture({
  onSwipeLeft: handleSwipe,
});

// 点击处理
const handleClick = (e: React.MouseEvent) => {
  // 手势会自动处理，无需额外逻辑
};
```

### 3. 性能优化

Hook 已经使用了被动事件监听器（`{ passive: true }`），这对滚动性能很重要。

### 4. 类型安全

使用泛型指定元素类型：

```tsx
const divRef = useGesture<HTMLDivElement>({ ... });
const buttonRef = useGesture<HTMLButtonElement>({ ... });
```

## 浏览器兼容性

- ✅ iOS Safari 10+
- ✅ Android Chrome 60+
- ✅ 所有现代浏览器

## 对比其他方案

| 方案 | 包大小 | 手势类型 | 优势 |
|------|--------|----------|------|
| **useGesture (本项目)** | 0 KB | 基础手势 | 零依赖、轻量、足够用 |
| react-use-gesture | ~15 KB | 丰富 | 功能强大、动画集成 |
| hammer.js | ~25 KB | 完整 | 老牌方案、稳定 |
| framer-motion | ~60 KB | 动画为主 | 动画强大，手势为辅 |

## 总结

这个 Hook 提供了：
- ✅ 足够的手势支持（日常 90% 场景）
- ✅ 零依赖（不增加包体积）
- ✅ 简单易用（5 分钟上手）
- ✅ 性能优化（被动监听）

如果需要更复杂的手势（如旋转、缩放手势），考虑使用 `react-use-gesture` 或 `framer-motion`。
