# Modal 组件使用文档

## 基础用法

### 1. 导入组件

```tsx
import Modal, { ModalWithFooter, ConfirmModal } from '@/components/Modal';
```

### 2. 基础 Modal

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

### 3. 带页脚的 Modal

```tsx
<ModalWithFooter
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="编辑信息"
  footer={
    <div className="flex gap-3 justify-end">
      <button onClick={() => setIsOpen(false)}>取消</button>
      <button onClick={handleSave}>保存</button>
    </div>
  }
>
  <form>
    {/* 表单内容 */}
  </form>
</ModalWithFooter>
```

### 4. 确认对话框

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

## Props 说明

### Modal Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| isOpen | boolean | - | 是否显示模态框 |
| onClose | () => void | - | 关闭回调函数 |
| title | string | - | 标题（可选） |
| children | ReactNode | - | 内容 |
| size | 'sm' \| 'md' \| 'lg' \| 'xl' \| 'full' | 'md' | 尺寸 |
| showCloseButton | boolean | true | 是否显示关闭按钮 |
| closeOnOverlayClick | boolean | true | 点击遮罩层关闭 |
| closeOnEsc | boolean | true | ESC 键关闭 |

### ConfirmModal Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| isOpen | boolean | - | 是否显示 |
| onClose | () => void | - | 关闭回调 |
| onConfirm | () => void | - | 确认回调 |
| title | string | - | 标题 |
| message | string | - | 提示信息 |
| confirmText | string | '确认' | 确认按钮文字 |
| cancelText | string | '取消' | 取消按钮文字 |
| confirmVariant | 'primary' \| 'danger' | 'primary' | 确认按钮样式 |
| isLoading | boolean | false | 加载状态 |

## 特性

### 移动端优化
- ✅ 移动端底部弹出，桌面端居中显示
- ✅ 移动端顶部拖动指示器
- ✅ 触摸友好的关闭按钮（44x44px）
- ✅ 防止滚动穿透
- ✅ 平滑动画过渡

### 无障碍性
- ✅ 正确的 ARIA 属性
- ✅ ESC 键关闭支持
- ✅ 焦点管理
- ✅ 键盘导航

### 响应式设计
- ✅ 不同尺寸适配
- ✅ 自适应高度
- ✅ 滚动内容支持

## 实际应用示例

### 删除确认

```tsx
function TransactionList() {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteTransaction(deleteId!);
      setDeleteId(null);
    } catch (error) {
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      {/* 列表内容 */}
      <button onClick={() => setDeleteId(transaction.id)}>
        删除
      </button>

      {/* 确认对话框 */}
      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="确认删除"
        message="确定要删除这条交易记录吗？此操作无法撤销。"
        confirmVariant="danger"
        isLoading={isDeleting}
      />
    </>
  );
}
```

### 表单编辑

```tsx
function EditForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({});

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveData(formData);
      setIsOpen(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)}>编辑</button>

      <ModalWithFooter
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="编辑交易"
        size="lg"
        footer={
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setIsOpen(false)}
              disabled={isSaving}
              className="px-4 py-2 bg-gray-100 rounded-lg"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg"
            >
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        }
      >
        <form>
          {/* 表单字段 */}
        </form>
      </ModalWithFooter>
    </>
  );
}
```
