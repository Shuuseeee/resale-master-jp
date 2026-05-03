# 手势支持 Hook

`hooks/useGesture.ts` 提供轻量级触摸手势识别，不依赖第三方库。它返回一个 `ref`，绑定到目标 DOM 元素后即可监听滑动、长按和双击。

## 导入

```tsx
import {
  useGesture,
  useSwipeToDelete,
  useLongPressMenu,
  useDoubleTapZoom,
} from '@/hooks/useGesture';
```

## 基础用法

```tsx
function GesturePanel() {
  const gestureRef = useGesture<HTMLDivElement>({
    onSwipeLeft: () => console.log('向左滑动'),
    onSwipeRight: () => console.log('向右滑动'),
    onSwipeUp: () => console.log('向上滑动'),
    onSwipeDown: () => console.log('向下滑动'),
    onLongPress: () => console.log('长按'),
    onDoubleTap: () => console.log('双击'),
    threshold: 50,
    longPressDelay: 500,
    doubleTapDelay: 300,
  });

  return (
    <div
      ref={gestureRef}
      className="rounded-[var(--radius-md)] bg-[var(--color-bg-elevated)] p-4 text-[var(--color-text)]"
    >
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
  const swipeRef = useSwipeToDelete(() => onDelete(item.id), 80);

  return (
    <div ref={swipeRef} className="rounded-[var(--radius-md)] bg-[var(--color-bg-elevated)] p-4">
      {item.name}
    </div>
  );
}
```

### 长按菜单

```tsx
import { useLongPressMenu } from '@/hooks/useGesture';

function Card({ item }) {
  const [showMenu, setShowMenu] = useState(false);
  const longPressRef = useLongPressMenu(() => setShowMenu(true), 500);

  return (
    <>
      <div ref={longPressRef} className="rounded-[var(--radius-lg)] bg-[var(--color-bg-elevated)] p-4">
        {item.name}
      </div>
      {showMenu && <Menu onClose={() => setShowMenu(false)} />}
    </>
  );
}
```

### 双击缩放

```tsx
import { useDoubleTapZoom } from '@/hooks/useGesture';

function ImageViewer({ src }) {
  const [isZoomed, setIsZoomed] = useState(false);
  const doubleTapRef = useDoubleTapZoom(() => setIsZoomed(prev => !prev));

  return (
    <div ref={doubleTapRef} className="overflow-hidden">
      <img
        src={src}
        alt=""
        className={isZoomed ? 'scale-150 transition-transform' : 'scale-100 transition-transform'}
      />
    </div>
  );
}
```

## 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `onSwipeLeft` | `() => void` | - | 向左滑动回调 |
| `onSwipeRight` | `() => void` | - | 向右滑动回调 |
| `onSwipeUp` | `() => void` | - | 向上滑动回调 |
| `onSwipeDown` | `() => void` | - | 向下滑动回调 |
| `onLongPress` | `() => void` | - | 长按回调 |
| `onDoubleTap` | `() => void` | - | 双击回调 |
| `threshold` | `number` | `50` | 滑动阈值，单位 px |
| `longPressDelay` | `number` | `500` | 长按延迟，单位 ms |
| `doubleTapDelay` | `number` | `300` | 双击判定窗口，单位 ms |

## 当前实现行为

- 使用 `touchstart`、`touchmove`、`touchend`、`touchcancel` 事件。
- 监听器使用 `{ passive: true }`，不会主动阻止页面滚动。
- 手指移动会取消长按计时。
- 触发长按后会清空本次 touch start，避免同一次触摸继续触发滑动。
- 滑动方向根据横向/纵向位移的绝对值大小判断。
- 当前只支持触摸事件，不处理鼠标拖拽或 Pointer Events。

## 注意事项

- 垂直滑动可能和页面滚动同时发生；列表场景优先只配置水平滑动。
- 如果需要阻止默认滚动行为，应该在具体组件中另行设计，不要改这个 Hook 的 passive 默认行为。
- 使用泛型指定元素类型可获得更准确的 ref 类型：

```tsx
const divRef = useGesture<HTMLDivElement>({ onSwipeLeft: handleSwipe });
const buttonRef = useGesture<HTMLButtonElement>({ onLongPress: handleLongPress });
```

## 适用范围

这个 Hook 覆盖项目内常见移动端交互，如长按进入多选、滑动触发轻量操作、双击切换状态。复杂手势如缩放、旋转、惯性拖拽不在当前实现范围内。
