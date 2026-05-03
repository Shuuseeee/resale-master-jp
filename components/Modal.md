# Modal 组件使用文档

`components/Modal.tsx` 提供三个导出：

```tsx
import Modal, { ModalWithFooter, ConfirmModal } from '@/components/Modal';
```

组件是客户端组件，使用 portal 渲染到 `document.body`，打开时会锁定页面滚动位置。

## 基础用法

```tsx
const [isOpen, setIsOpen] = useState(false);

<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="标题"
>
  <p>这是模态框内容</p>
</Modal>
```

## 带页脚的 Modal

```tsx
import { button } from '@/lib/theme';

<ModalWithFooter
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="编辑信息"
  size="lg"
  footer={
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <button type="button" onClick={() => setIsOpen(false)} className={button.secondary}>
        取消
      </button>
      <button type="button" onClick={handleSave} className={button.primary}>
        保存
      </button>
    </div>
  }
>
  <form>{/* 表单内容 */}</form>
</ModalWithFooter>
```

## 确认对话框

```tsx
<ConfirmModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onConfirm={handleDelete}
  title="确认删除"
  message="确定要删除这条记录吗？此操作无法撤销。"
  confirmText="删除"
  cancelText="取消"
  confirmVariant="danger"
  isLoading={isDeleting}
/>
```

## Props

### Modal

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `isOpen` | `boolean` | - | 是否显示 |
| `onClose` | `() => void` | - | 关闭回调 |
| `title` | `string` | - | 标题，可选 |
| `children` | `React.ReactNode` | - | 内容 |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl' \| 'full'` | `'md'` | 桌面端最大宽度 |
| `showCloseButton` | `boolean` | `true` | 是否显示关闭按钮 |
| `closeOnOverlayClick` | `boolean` | `true` | 点击遮罩是否关闭 |
| `closeOnEsc` | `boolean` | `true` | 按 ESC 是否关闭 |

### ConfirmModal

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `isOpen` | `boolean` | - | 是否显示 |
| `onClose` | `() => void` | - | 关闭回调 |
| `onConfirm` | `() => void` | - | 确认回调 |
| `title` | `string` | - | 标题 |
| `message` | `string` | - | 提示信息 |
| `confirmText` | `string` | `'确认'` | 确认按钮文字 |
| `cancelText` | `string` | `'取消'` | 取消按钮文字 |
| `confirmVariant` | `'primary' \| 'danger'` | `'primary'` | 确认按钮样式 |
| `isLoading` | `boolean` | `false` | 加载中禁用关闭和按钮 |

## 行为说明

- 移动端从底部弹出，桌面端居中显示。
- 移动端标题栏显示拖动指示器，但当前没有拖拽关闭逻辑。
- 内容区带 `data-modal-scroll`，允许内部滚动；外层遮罩会阻止滚动穿透。
- `showCloseButton` 为 `true` 时显示 44px 触控尺寸关闭按钮。
- `ConfirmModal` 加载中会禁用遮罩点击关闭和 ESC 关闭。

## 实际示例

```tsx
import { useState } from 'react';
import { button } from '@/lib/theme';
import { ModalWithFooter } from '@/components/Modal';

function EditForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    try {
      await saveData();
      setIsOpen(false);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className={button.primary}>
        编辑
      </button>

      <ModalWithFooter
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="编辑交易"
        size="lg"
        closeOnOverlayClick={!isSaving}
        closeOnEsc={!isSaving}
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setIsOpen(false)} disabled={isSaving} className={button.secondary}>
              取消
            </button>
            <button type="button" onClick={handleSave} disabled={isSaving} className={button.primary}>
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        }
      >
        <form className="space-y-4">{/* 表单字段 */}</form>
      </ModalWithFooter>
    </>
  );
}
```
