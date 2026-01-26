# 交易添加页面 - 积分平台选择器补丁

## 需要修改的文件
`/app/transactions/add/page.tsx`

## 修改步骤

### 1. 导入PointsPlatform类型
```typescript
import type { PaymentMethod, TransactionFormData, PointsPlatform } from '@/types/database.types';
```

### 2. 添加积分平台状态
```typescript
const [pointsPlatforms, setPointsPlatforms] = useState<PointsPlatform[]>([]);
```

### 3. 添加加载积分平台函数
```typescript
const fetchPointsPlatforms = async () => {
  const { data, error } = await supabase
    .from('points_platforms')
    .select('*')
    .eq('is_active', true)
    .order('display_name');

  if (error) {
    console.error('获取积分平台失败:', error);
    return;
  }

  setPointsPlatforms(data || []);
};
```

### 4. 在useEffect中调用
```typescript
useEffect(() => {
  fetchPaymentMethods();
  fetchPointsPlatforms(); // 添加这行
}, []);
```

### 5. 当选择支付方式时，自动设置信用卡积分平台
在`handleInputChange`函数中，当`name === 'card_id'`时：
```typescript
if (name === 'card_id' && value) {
  const selectedCard = paymentMethods.find((pm) => pm.id === value);
  if (selectedCard) {
    // 自动设置信用卡积分平台
    setFormData((prev) => ({
      ...prev,
      card_id: value,
      card_points_platform_id: selectedCard.card_points_platform_id || '',
      expected_card_points: formData.card_paid > 0
        ? Math.floor(formData.card_paid * selectedCard.point_rate)
        : 0
    }));
  }
}
```

### 6. 在表单中添加积分平台选择器

在"积分信息"部分添加以下字段：

```tsx
{/* 购物平台积分平台 */}
<div>
  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
    购物平台积分平台
  </label>
  <select
    name="platform_points_platform_id"
    value={formData.platform_points_platform_id || ''}
    onChange={handleInputChange}
    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
  >
    <option value="">选择积分平台</option>
    {pointsPlatforms.map((platform) => (
      <option key={platform.id} value={platform.id}>
        {platform.display_name} (1积分=¥{platform.yen_conversion_rate})
      </option>
    ))}
  </select>
  <p className="mt-1 text-xs text-gray-500">
    选择购物平台的积分类型（如楽天、PayPay等）
  </p>
</div>

{/* 信用卡积分平台（自动从支付方式获取，可手动修改） */}
<div>
  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
    信用卡积分平台
  </label>
  <select
    name="card_points_platform_id"
    value={formData.card_points_platform_id || ''}
    onChange={handleInputChange}
    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
    disabled={!formData.card_id}
  >
    <option value="">选择积分平台</option>
    {pointsPlatforms.map((platform) => (
      <option key={platform.id} value={platform.id}>
        {platform.display_name} (1积分=¥{platform.yen_conversion_rate})
      </option>
    ))}
  </select>
  <p className="mt-1 text-xs text-gray-500">
    {formData.card_id
      ? '已从支付方式自动设置，可手动修改'
      : '请先选择支付方式'}
  </p>
</div>
```

### 7. 在提交时包含积分平台ID
在`handleSubmit`函数中，确保提交数据包含积分平台ID：
```typescript
const { error } = await supabase
  .from('transactions')
  .insert([
    {
      ...formData,
      image_url: imageUrl,
      card_id: formData.card_id || null,
      platform_points_platform_id: formData.platform_points_platform_id || null,
      card_points_platform_id: formData.card_points_platform_id || null,
    },
  ])
  .select()
  .single();
```

## 建议的表单布局位置

将积分平台选择器放在"积分信息"部分，在"预期平台积分"和"预期信用卡积分"输入框之后：

```
[预期平台积分] (数字输入)
[购物平台积分平台] (下拉选择) ← 新增
[预期信用卡积分] (数字输入)
[信用卡积分平台] (下拉选择) ← 新增
```

## 用户体验优化

1. **自动设置**：当用户选择支付方式时，自动设置信用卡积分平台
2. **禁用状态**：如果没有选择支付方式，信用卡积分平台选择器应该禁用
3. **提示信息**：显示每个积分平台的兑换率，帮助用户理解
4. **默认值**：可以为常用平台设置默认值（如楽天）

## 完成后的效果

用户在记录交易时：
1. 输入平台积分数量 → 选择积分平台（如楽天 1:1）
2. 选择支付方式 → 自动设置信用卡积分平台（如V Point 1:1）
3. 系统根据积分平台的兑换率计算准确的积分价值
