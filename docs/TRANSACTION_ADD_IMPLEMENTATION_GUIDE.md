# 交易添加页面 - 完整实现指南

## 概述
根据用户需求，实现支持叠加积分的交易记录功能。用户可以记录：
- 平台积分（如Amazon积分）
- 额外平台积分（如d point）
- 信用卡积分

## 用户需求回答
1. 默认购物平台：Amazon
2. 信用卡积分平台：自动填充但允许手动修改
3. 积分平台必填：如果有积分数量，必须选择平台
4. 积分为0时：隐藏或禁用平台选择器
5. 布局：组合式布局（积分数量和平台在同一行）

## 实现步骤

### 步骤1：添加导入和状态

在文件顶部添加：
```typescript
import type { PaymentMethod, TransactionFormData, PointsPlatform } from '@/types/database.types';
```

在状态声明部分添加：
```typescript
const [pointsPlatforms, setPointsPlatforms] = useState<PointsPlatform[]>([]);
```

### 步骤2：添加加载积分平台函数

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

### 步骤3：在useEffect中调用

```typescript
useEffect(() => {
  fetchPaymentMethods();
  fetchPointsPlatforms();
}, []);
```

### 步骤4：修改handleInputChange函数

当选择支付方式时，自动设置信用卡积分平台：

```typescript
// 当选择信用卡时，自动计算预期卡积分并设置积分平台
if (name === 'card_id' && value) {
  const selectedCard = paymentMethods.find((pm) => pm.id === value);
  if (selectedCard && formData.card_paid > 0) {
    const calculatedPoints = Math.floor(formData.card_paid * selectedCard.point_rate);
    setFormData((prev) => ({
      ...prev,
      card_id: value,
      expected_card_points: calculatedPoints,
      card_points_platform_id: selectedCard.card_points_platform_id || '', // 自动设置积分平台
    }));
  } else if (selectedCard) {
    setFormData((prev) => ({
      ...prev,
      card_id: value,
      card_points_platform_id: selectedCard.card_points_platform_id || '',
    }));
  }
}
```

### 步骤5：添加表单验证

在validateForm函数中添加：

```typescript
// 验证积分平台
if (formData.expected_platform_points > 0 && !formData.platform_points_platform_id) {
  newErrors.platform_points_platform_id = '请选择平台积分平台';
}

if (formData.extra_platform_points && formData.extra_platform_points > 0 && !formData.extra_platform_points_platform_id) {
  newErrors.extra_platform_points_platform_id = '请选择额外积分平台';
}

if (formData.expected_card_points > 0 && !formData.card_points_platform_id) {
  newErrors.card_points_platform_id = '请选择信用卡积分平台';
}
```

### 步骤6：修改提交函数

在handleSubmit中，确保提交包含所有积分平台字段：

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
      extra_platform_points: formData.extra_platform_points || 0,
      extra_platform_points_platform_id: formData.extra_platform_points_platform_id || null,
    },
  ])
  .select()
  .single();
```

### 步骤7：添加表单字段（组合式布局）

在"积分信息"部分，替换现有的积分输入字段为以下组合式布局：

```tsx
{/* 积分信息 */}
<div>
  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
    积分信息
  </h3>

  {/* 平台积分 - 组合式布局 */}
  <div className="grid grid-cols-2 gap-4 mb-4">
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        平台积分数量
      </label>
      <input
        type="number"
        name="expected_platform_points"
        value={formData.expected_platform_points}
        onChange={handleNumberChange}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        placeholder="0"
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        积分平台
      </label>
      <select
        name="platform_points_platform_id"
        value={formData.platform_points_platform_id || ''}
        onChange={handleInputChange}
        disabled={formData.expected_platform_points === 0}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">选择平台</option>
        {pointsPlatforms.map((platform) => (
          <option key={platform.id} value={platform.id}>
            {platform.display_name} (¥{platform.yen_conversion_rate})
          </option>
        ))}
      </select>
      {errors.platform_points_platform_id && (
        <p className="mt-1 text-sm text-red-500">{errors.platform_points_platform_id}</p>
      )}
    </div>
  </div>

  {/* 额外平台积分 - 组合式布局 */}
  <div className="grid grid-cols-2 gap-4 mb-4">
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        额外积分数量
        <span className="text-xs text-gray-500 ml-2">(如d point)</span>
      </label>
      <input
        type="number"
        name="extra_platform_points"
        value={formData.extra_platform_points || 0}
        onChange={handleNumberChange}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        placeholder="0"
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        额外积分平台
      </label>
      <select
        name="extra_platform_points_platform_id"
        value={formData.extra_platform_points_platform_id || ''}
        onChange={handleInputChange}
        disabled={!formData.extra_platform_points || formData.extra_platform_points === 0}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">选择平台</option>
        {pointsPlatforms.map((platform) => (
          <option key={platform.id} value={platform.id}>
            {platform.display_name} (¥{platform.yen_conversion_rate})
          </option>
        ))}
      </select>
      {errors.extra_platform_points_platform_id && (
        <p className="mt-1 text-sm text-red-500">{errors.extra_platform_points_platform_id}</p>
      )}
    </div>
  </div>

  {/* 信用卡积分 - 组合式布局 */}
  <div className="grid grid-cols-2 gap-4">
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        信用卡积分数量
      </label>
      <input
        type="number"
        name="expected_card_points"
        value={formData.expected_card_points}
        onChange={handleNumberChange}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        placeholder="0"
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        信用卡积分平台
      </label>
      <select
        name="card_points_platform_id"
        value={formData.card_points_platform_id || ''}
        onChange={handleInputChange}
        disabled={formData.expected_card_points === 0 || !formData.card_id}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">选择平台</option>
        {pointsPlatforms.map((platform) => (
          <option key={platform.id} value={platform.id}>
            {platform.display_name} (¥{platform.yen_conversion_rate})
          </option>
        ))}
      </select>
      {errors.card_points_platform_id && (
        <p className="mt-1 text-sm text-red-500">{errors.card_points_platform_id}</p>
      )}
      {formData.card_id && formData.card_points_platform_id && (
        <p className="mt-1 text-xs text-gray-500">
          已从支付方式自动设置
        </p>
      )}
    </div>
  </div>
</div>
```

## 使用场景示例

### 场景1：Amazon购物 + d point
```
平台积分：10 P → Amazon ポイント
额外积分：10 P → d ポイント
信用卡积分：5 P → V ポイント
总价值：¥25
```

### 场景2：楽天购物
```
平台积分：100 P → 楽天ポイント
额外积分：0 P → (不显示)
信用卡积分：50 P → V ポイント
总价值：¥150
```

## 注意事项

1. **自动填充**：选择支付方式时自动设置信用卡积分平台
2. **禁用状态**：积分为0时禁用对应的平台选择器
3. **必填验证**：有积分数量时必须选择平台
4. **默认平台**：可以为Amazon设置为默认平台（可选）
5. **用户体验**：显示兑换率帮助用户理解

## 完成后测试

1. 记录一笔Amazon交易，测试叠加积分
2. 验证自动填充功能
3. 测试必填验证
4. 检查积分价值计算是否正确
