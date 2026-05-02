// app/transactions/[id]/edit/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase, uploadImage } from '@/lib/supabase/client';
import { processImageForUpload } from '@/lib/image-utils';
import type { PaymentMethod, TransactionFormData, Transaction, PointsPlatform } from '@/types/database.types';
import Image from 'next/image';
import { layout, heading, card, button, input } from '@/lib/theme';
import DatePicker from '@/components/DatePicker';
import BarcodeScanner from '@/components/BarcodeScanner';
import { createPurchasePlatform } from '@/lib/api/platforms';
import { usePlatforms } from '@/contexts/PlatformsContext';
import { parseNumberInput } from '@/lib/number-utils';
import { getTodayString, formatDateToLocal, parseDateFromLocal } from '@/lib/utils/dateUtils';
import { useJanProductAutoFill } from '@/hooks/useJanProductAutoFill';

export default function EditTransactionPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  // 表单状态
  const [formData, setFormData] = useState<TransactionFormData>({
    date: getTodayString(),
    product_name: '',
    purchase_price_total: 0,
    card_paid: 0,
    point_paid: 0,
    balance_paid: 0,
    card_id: '',
    expected_platform_points: 0,
    expected_card_points: 0,
    extra_platform_points: 0,
    platform_points_platform_id: '',
    card_points_platform_id: '',
    extra_platform_points_platform_id: '',
    jan_code: '',
    unit_price: 0,
    purchase_platform_id: '',
    order_number: '',
    image_url: '',
    notes: '',
  });

  // UI 状态
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [pointsPlatforms, setPointsPlatforms] = useState<PointsPlatform[]>([]);
  const { purchasePlatforms, refreshPlatforms } = usePlatforms();
  const [newPurchasePlatformName, setNewPurchasePlatformName] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [isPending, setIsPending] = useState(false); // 未着品トグル
  const [showScanner, setShowScanner] = useState(false);

  // 加载交易数据和支付方式列表
  useEffect(() => {
    loadTransaction();
    fetchPaymentMethods();
    fetchPointsPlatforms();
  }, [id]);

  const loadTransaction = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        setTransaction(data); // 保存完整的交易数据
        setIsPending(data.status === 'pending'); // 设置未着品状态
        setFormData({
          date: data.date,
          product_name: data.product_name,
          quantity: data.quantity,
          purchase_price_total: data.purchase_price_total,
          card_paid: data.card_paid,
          point_paid: data.point_paid,
          balance_paid: data.balance_paid,
          card_id: data.card_id || '',
          expected_platform_points: data.expected_platform_points,
          expected_card_points: data.expected_card_points,
          extra_platform_points: data.extra_platform_points || 0,
          platform_points_platform_id: data.platform_points_platform_id || '',
          card_points_platform_id: data.card_points_platform_id || '',
          extra_platform_points_platform_id: data.extra_platform_points_platform_id || '',
          jan_code: data.jan_code || '',
          unit_price: data.unit_price || 0,
          purchase_platform_id: data.purchase_platform_id || '',
          order_number: data.order_number || '',
          image_url: data.image_url || '',
          notes: data.notes || '',
        });

        // 设置现有图片预览
        if (data.image_url) {
          setImagePreview(data.image_url);
        }
      }
    } catch (error) {
      console.error('加载交易失败:', error);
      alert('加载失败，请重试');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentMethods = async () => {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('获取支付方式失败:', error);
      return;
    }

    setPaymentMethods(data || []);
  };

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

  const handleAddPurchasePlatform = async () => {
    const name = newPurchasePlatformName.trim();
    if (!name) return;
    const created = await createPurchasePlatform(name);
    if (created) {
      await refreshPlatforms();
      setFormData(prev => ({ ...prev, purchase_platform_id: created.id }));
      setNewPurchasePlatformName('');
    }
  };

  const { isLooking: janLooking } = useJanProductAutoFill({
    janCode: formData.jan_code || '',
    productName: formData.product_name,
    onProductNameChange: (productName) => {
      setFormData(prev => ({
        ...prev,
        product_name: prev.product_name ? prev.product_name : productName,
      }));
    },
  });

  // 处理输入变化
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // 当选择信用卡时，自动计算预期卡积分并设置积分平台
    if (name === 'card_id' && value) {
      const selectedCard = paymentMethods.find((pm) => pm.id === value);
      if (selectedCard && formData.card_paid > 0) {
        const calculatedPoints = Math.floor(formData.card_paid * selectedCard.point_rate);
        setFormData((prev) => ({
          ...prev,
          card_id: value,
          expected_card_points: calculatedPoints,
          card_points_platform_id: selectedCard.card_points_platform_id || '',
        }));
      } else if (selectedCard) {
        setFormData((prev) => ({
          ...prev,
          card_id: value,
          card_points_platform_id: selectedCard.card_points_platform_id || '',
        }));
      }
    }

    // 清除该字段的错误
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // 处理数字输入
  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = parseFloat(value) || 0;
    setFormData((prev) => ({
      ...prev,
      [name]: numValue,
    }));
  };

  // 自动计算余额支付
  const calculateBalancePaid = (
    total: number,
    cardPaid: number,
    pointPaid: number
  ): number => {
    const balance = total - cardPaid - pointPaid;
    return Math.max(0, balance);
  };

  // 处理支付金额变化
  const handlePaymentChange = (field: 'card_paid' | 'point_paid', value: number) => {
    const newFormData = { ...formData, [field]: value };

    // 自动计算余额支付
    const balancePaid = calculateBalancePaid(
      newFormData.purchase_price_total,
      newFormData.card_paid,
      newFormData.point_paid
    );

    // 如果是信用卡支付金额变化，且已选择卡片，自动计算预期卡积分
    let cardPoints = newFormData.expected_card_points;
    if (field === 'card_paid' && newFormData.card_id) {
      const selectedCard = paymentMethods.find((pm) => pm.id === newFormData.card_id);
      if (selectedCard) {
        cardPoints = Math.floor(value * selectedCard.point_rate);
      }
    }

    setFormData({
      ...newFormData,
      balance_paid: balancePaid,
      expected_card_points: cardPoints,
    });
  };

  // 处理图片选择
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 支持常见图片格式 + HEIC/HEIF (iOS默认格式)
    const isValidImage = file.type.startsWith('image/') ||
                        file.name.toLowerCase().endsWith('.heic') ||
                        file.name.toLowerCase().endsWith('.heif');

    if (!isValidImage) {
      setErrors((prev) => ({ ...prev, image: '请选择图片文件（支持JPG、PNG、HEIC等格式）' }));
      return;
    }

    setSelectedImage(file);

    // 生成预览
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // 表单验证
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.product_name.trim()) {
      newErrors.product_name = '请输入商品名称';
    }

    if (!formData.quantity || formData.quantity < 1) {
      newErrors.quantity = '数量必须大于0';
    }

    if (formData.purchase_price_total <= 0) {
      newErrors.purchase_price_total = '采购总价必须大于0';
    }

    const totalPaid = formData.card_paid + formData.point_paid + formData.balance_paid;
    if (Math.abs(totalPaid - formData.purchase_price_total) > 0.01) {
      newErrors.payment = '支付总额必须等于采购总价';
    }

    if (formData.card_paid > 0 && !formData.card_id) {
      newErrors.card_id = '请选择支付方式';
    }

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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      let imageUrl = formData.image_url;

      // 如果选择了新图片，则上传
      if (selectedImage) {
        const compressed = await processImageForUpload(selectedImage);
        imageUrl = await uploadImage(compressed);
      }

      // 更新交易记录
      const updateData: Record<string, any> = {
          date: formData.date,
          product_name: formData.product_name,
          quantity: formData.quantity,
          purchase_price_total: formData.purchase_price_total,
          card_paid: formData.card_paid,
          point_paid: formData.point_paid,
          balance_paid: formData.balance_paid,
          card_id: formData.card_id || null,
          expected_platform_points: formData.expected_platform_points,
          expected_card_points: formData.expected_card_points,
          extra_platform_points: formData.extra_platform_points || 0,
          platform_points_platform_id: formData.platform_points_platform_id || null,
          card_points_platform_id: formData.card_points_platform_id || null,
          extra_platform_points_platform_id: formData.extra_platform_points_platform_id || null,
          jan_code: formData.jan_code || null,
          unit_price: formData.unit_price || null,
          purchase_platform_id: formData.purchase_platform_id || null,
          order_number: formData.order_number || null,
          image_url: imageUrl,
          notes: formData.notes,
      };

      // 只有当前状态是 pending 或 in_stock 时才允许切换
      if (transaction && (transaction.status === 'pending' || transaction.status === 'in_stock') && transaction.quantity_sold === 0) {
        updateData.status = isPending ? 'pending' : 'in_stock';
      }

      const { error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      // 成功后跳转到详情页
      router.push(`/transactions/${id}`);
    } catch (error: any) {
      console.error('保存失败:', error);
      setErrors({ submit: error.message || '保存失败,请重试' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--color-text)]">
          <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-xl">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="relative max-w-2xl lg:max-w-5xl mx-auto px-4 py-8">
        {/* 标题区域 */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">返回</span>
          </button>

          <h1 className="text-4xl font-bold text-[var(--color-text)] mb-2">
            编辑交易
          </h1>
          <p className="text-[var(--color-text-muted)]">修改交易记录信息</p>
        </div>

        {/* 表单卡片 */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start lg:space-y-0">
          <div className="space-y-6">
          <div className="sn-form-card">
            {/* 基本信息 */}
            <div className="space-y-5">
              <h2 className="sn-form-title">
                <div className="sn-form-title-bar"></div>
                基本信息
              </h2>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="sn-form-label">
                    日期 <span className="text-[var(--color-danger)]">*</span>
                  </label>
                  <DatePicker
                    selected={formData.date ? parseDateFromLocal(formData.date) : null}
                    onChange={(date) => {
                      setFormData((prev) => ({
                        ...prev,
                        date: formatDateToLocal(date)
                      }));
                    }}
                    className="w-full sn-form-input"
                  />
                </div>

                <div>
                  <label className="sn-form-label">
                    商品名称 <span className="text-[var(--color-danger)]">*</span>
                  </label>
                  <input
                    type="text"
                    name="product_name"
                    value={formData.product_name}
                    onChange={handleInputChange}
                    placeholder="例: Nintendo Switch OLED"
                    className="w-full sn-form-input"
                    required
                  />
                  {errors.product_name && (
                    <p className="sn-form-error">{errors.product_name}</p>
                  )}
                </div>

                <div>
                  <label className="sn-form-label">
                    数量 <span className="text-[var(--color-danger)]">*</span>
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    value={formData.quantity ?? ''}
                    onChange={(e) => setFormData({...formData, quantity: e.target.value === '' ? '' as any : parseInt(e.target.value)})}
                    min="1"
                    disabled={!!(transaction && transaction.quantity_sold > 0)}
                    className="w-full sn-form-input disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {errors.quantity && (
                    <p className="sn-form-error">{errors.quantity}</p>
                  )}
                  {transaction && transaction.quantity_sold > 0 && (
                    <p className="text-[var(--color-warning)] text-sm mt-1">
                      该商品已售出 {transaction.quantity_sold} 件，无法修改总数量
                    </p>
                  )}
                </div>

                {/* 未到货切换 - 只有 pending/in_stock 且未售出时可切换 */}
                {transaction && (transaction.status === 'pending' || transaction.status === 'in_stock') && transaction.quantity_sold === 0 && (
                  <div className="sn-form-subtle-panel flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-[var(--color-text)]">
                        未到货
                      </label>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        商品未到货
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isPending}
                      onClick={() => setIsPending(!isPending)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        isPending ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-border)]'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          isPending ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 购买信息 */}
          <div className="sn-form-card">
            <div className="space-y-5">
              <h2 className="sn-form-title">
                <div className="sn-form-title-bar"></div>
                购买信息
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="sn-form-label">
                    JAN
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      name="jan_code"
                      value={formData.jan_code || ''}
                      onChange={handleInputChange}
                      placeholder="4901234567890"
                      className="flex-1 sn-form-input"
                    />
                    {janLooking ? (
                      <svg className="animate-spin h-5 w-5 text-[var(--color-primary)] flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowScanner(true)}
                        className="flex-shrink-0 p-2 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] rounded-lg transition-colors"
                        title="扫描条形码"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="sn-form-label">
                    订单号
                  </label>
                  <input
                    type="text"
                    name="order_number"
                    value={formData.order_number || ''}
                    onChange={handleInputChange}
                    placeholder="订单号"
                    className="w-full sn-form-input"
                  />
                </div>
              </div>

              <div>
                <label className="sn-form-label">
                  单价 (¥)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    name="unit_price"
                    value={formData.unit_price || ''}
                    onChange={(e) => {
                      const val = parseNumberInput(e.target.value, 0);
                      const qty = formData.quantity || 1;
                      setFormData(prev => ({
                        ...prev,
                        unit_price: val,
                        purchase_price_total: Math.round(val * qty * 100) / 100,
                        balance_paid: calculateBalancePaid(Math.round(val * qty * 100) / 100, prev.card_paid, prev.point_paid),
                      }));
                    }}
                    placeholder="0.00"
                    className="w-full sn-form-input pr-12"
                  />
                  <span className="sn-form-addon">¥</span>
                </div>
                <p className="sn-form-muted">
                  输入单价后会自动计算总价和余额支付金额
                </p>
              </div>

              <div>
                <label className="sn-form-label">
                  购买平台
                </label>
                <div className="flex gap-2">
                  <select
                    name="purchase_platform_id"
                    value={formData.purchase_platform_id || ''}
                    onChange={handleInputChange}
                    className="flex-1 sn-form-input"
                  >
                    <option value="">请选择</option>
                    {purchasePlatforms.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}{p.is_builtin ? '' : ' （自定义）'}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={newPurchasePlatformName}
                    onChange={(e) => setNewPurchasePlatformName(e.target.value)}
                    placeholder="请输入新的购买平台..."
                    className="flex-1 sn-form-input py-2"
                  />
                  <button
                    type="button"
                    onClick={handleAddPurchasePlatform}
                    disabled={!newPurchasePlatformName.trim()}
                    className="px-3 py-2 bg-[var(--color-primary)] active:opacity-80 disabled:opacity-50 text-white text-sm rounded-lg transition-all disabled:cursor-not-allowed"
                  >添加</button>
                </div>
              </div>
            </div>
          </div>
          </div>{/* end left column */}

          <div className="space-y-6">
          {/* 采购成本 */}
          <div className="sn-form-card">
            <div className="space-y-5">
              <h2 className="sn-form-title">
                <div className="sn-form-title-bar"></div>
                采购成本
              </h2>

              <div>
                <label className="sn-form-label">
                  采购总价 <span className="text-[var(--color-danger)]">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    name="purchase_price_total"
                    value={formData.purchase_price_total || ''}
                    onChange={(e) => {
                      handleNumberChange(e);
                      const total = parseFloat(e.target.value) || 0;
                      const balancePaid = calculateBalancePaid(
                        total,
                        formData.card_paid,
                        formData.point_paid
                      );
                      setFormData((prev) => ({ ...prev, balance_paid: balancePaid }));
                    }}
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="w-full sn-form-input pr-12"
                    required
                  />
                  <span className="sn-form-addon">¥</span>
                </div>
                {errors.purchase_price_total && (
                  <p className="sn-form-error">{errors.purchase_price_total}</p>
                )}
              </div>

              {/* 混合支付 */}
              <div className="grid grid-cols-1 gap-4 pt-4 border-t border-[var(--color-border)]">
                <div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="min-w-0">
                      <label className="sn-form-label">
                        信用卡支付
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={formData.card_paid || ''}
                          onChange={(e) => handlePaymentChange('card_paid', parseFloat(e.target.value) || 0)}
                          step="0.01"
                          min="0"
                          max={formData.purchase_price_total}
                          placeholder="0.00"
                          className="w-full sn-form-input pr-12"
                        />
                        <span className="sn-form-addon">¥</span>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <label className="sn-form-label">
                        支付卡片
                      </label>
                      <select
                        name="card_id"
                        value={formData.card_id}
                        onChange={handleInputChange}
                        className="w-full sn-form-input"
                        disabled={formData.card_paid === 0}
                      >
                        <option value="">选择卡片</option>
                        {paymentMethods
                          .filter((pm) => pm.type === 'card')
                          .map((pm) => (
                            <option key={pm.id} value={pm.id}>
                              {pm.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                  {errors.card_id && (
                    <p className="sn-form-error">{errors.card_id}</p>
                  )}
                </div>

                <div>
                  <label className="sn-form-label">
                    积分抵扣
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.point_paid || ''}
                      onChange={(e) => handlePaymentChange('point_paid', parseFloat(e.target.value) || 0)}
                      step="0.01"
                      min="0"
                      max={formData.purchase_price_total}
                      placeholder="0.00"
                      className="w-full sn-form-input pr-12"
                    />
                    <span className="sn-form-addon">¥</span>
                  </div>
                </div>

                <div>
                  <label className="sn-form-label">
                    余额支付
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.balance_paid || ''}
                      readOnly
                      className="w-full px-4 py-3 pr-12 bg-[var(--color-bg-subtle)] border border-[var(--color-border)] rounded-xl text-[var(--color-text-muted)] cursor-not-allowed"
                    />
                    <span className="sn-form-addon">¥</span>
                  </div>
                  <p className="sn-form-muted">自动计算</p>
                </div>

                {errors.payment && (
                  <div className="sn-form-alert-error">
                    <p className="text-sm text-[var(--color-danger)]">{errors.payment}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 预期积分 */}
          <div className="sn-form-card">
            <div className="space-y-5">
              <h2 className="sn-form-title">
                <div className="sn-form-title-bar"></div>
                预期积分
              </h2>

              {/* 平台积分 - 组合式布局 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="sn-form-label">
                    平台积分数量
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      name="expected_platform_points"
                      value={formData.expected_platform_points || ''}
                      onChange={handleNumberChange}
                      step="1"
                      min="0"
                      placeholder="0"
                      className="w-full sn-form-input pr-12"
                    />
                    <span className="sn-form-addon">P</span>
                  </div>
                </div>
                <div>
                  <label className="sn-form-label">
                    积分平台
                  </label>
                  <select
                    name="platform_points_platform_id"
                    value={formData.platform_points_platform_id || ''}
                    onChange={handleInputChange}
                    disabled={formData.expected_platform_points === 0}
                    className="w-full sn-form-input disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">选择平台</option>
                    {pointsPlatforms.map((platform) => (
                      <option key={platform.id} value={platform.id}>
                        {platform.display_name}
                      </option>
                    ))}
                  </select>
                  {errors.platform_points_platform_id && (
                    <p className="sn-form-error">{errors.platform_points_platform_id}</p>
                  )}
                </div>
              </div>

              {/* 额外平台积分 - 组合式布局 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="sn-form-label">
                    额外积分数量
                    <span className="text-xs text-[var(--color-text-muted)] ml-2">(如d point)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      name="extra_platform_points"
                      value={formData.extra_platform_points || ''}
                      onChange={handleNumberChange}
                      step="1"
                      min="0"
                      placeholder="0"
                      className="w-full sn-form-input pr-12"
                    />
                    <span className="sn-form-addon">P</span>
                  </div>
                </div>
                <div>
                  <label className="sn-form-label">
                    额外积分平台
                  </label>
                  <select
                    name="extra_platform_points_platform_id"
                    value={formData.extra_platform_points_platform_id || ''}
                    onChange={handleInputChange}
                    disabled={!formData.extra_platform_points || formData.extra_platform_points === 0}
                    className="w-full sn-form-input disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">选择平台</option>
                    {pointsPlatforms.map((platform) => (
                      <option key={platform.id} value={platform.id}>
                        {platform.display_name}
                      </option>
                    ))}
                  </select>
                  {errors.extra_platform_points_platform_id && (
                    <p className="sn-form-error">{errors.extra_platform_points_platform_id}</p>
                  )}
                </div>
              </div>

              {/* 信用卡积分 - 组合式布局 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="sn-form-label">
                    信用卡积分数量
                    {formData.card_id && paymentMethods.find(pm => pm.id === formData.card_id) && (
                      <span className="ml-2 text-xs text-[var(--color-primary)]">
                        (返点率: {(paymentMethods.find(pm => pm.id === formData.card_id)?.point_rate || 0) * 100}%)
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      name="expected_card_points"
                      value={formData.expected_card_points || ''}
                      onChange={handleNumberChange}
                      step="1"
                      min="0"
                      placeholder="0"
                      className="w-full sn-form-input pr-12"
                    />
                    <span className="sn-form-addon">P</span>
                  </div>
                  <p className="sn-form-muted">根据卡片返点率自动计算，可手动调整</p>
                </div>
                <div>
                  <label className="sn-form-label">
                    信用卡积分平台
                  </label>
                  <select
                    name="card_points_platform_id"
                    value={formData.card_points_platform_id || ''}
                    onChange={handleInputChange}
                    disabled={formData.expected_card_points === 0 || !formData.card_id}
                    className="w-full sn-form-input disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">选择平台</option>
                    {pointsPlatforms.map((platform) => (
                      <option key={platform.id} value={platform.id}>
                        {platform.display_name}
                      </option>
                    ))}
                  </select>
                  {errors.card_points_platform_id && (
                    <p className="sn-form-error">{errors.card_points_platform_id}</p>
                  )}
                  {formData.card_id && formData.card_points_platform_id && (
                    <p className="sn-form-muted">
                      已从支付方式自动设置
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 凭证上传 */}
          <div className="sn-form-card">
            <div className="space-y-5">
              <h2 className="sn-form-title">
                <div className="sn-form-title-bar"></div>
                凭证上传
              </h2>

              <div>
                <label className="sn-form-label">
                  采购截图
                </label>

                {imagePreview ? (
                  <div className="relative group">
                    <div className="relative h-48 w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                      <Image
                        src={imagePreview}
                        alt="预览"
                        fill
                        className="object-contain"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedImage(null);
                        setImagePreview('');
                      }}
                      className="absolute top-2 right-2 p-2 bg-[var(--color-danger)] active:opacity-80 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-[var(--color-border)] rounded-xl cursor-pointer bg-[var(--color-bg-subtle)] hover:bg-[var(--color-bg-elevated)] transition-all">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <svg className="w-12 h-12 mb-3 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <p className="mb-2 text-sm text-[var(--color-text-muted)]">
                        <span className="font-semibold">点击上传</span>
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">PNG, JPG 或 WEBP (最大 5MB)</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </label>
                )}
                {errors.image && (
                  <p className="sn-form-error">{errors.image}</p>
                )}
              </div>
            </div>
          </div>

          {/* 备注 */}
          <div className="sn-form-card">
            <div className="space-y-5">
              <h2 className="sn-form-title">
                <div className="sn-form-title-bar"></div>
                备注
              </h2>

              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
                placeholder="添加备注信息..."
                className="w-full sn-form-input resize-none"
              />
            </div>
          </div>
          </div>{/* end right column */}
          </div>{/* end grid wrapper */}

          {/* 提交按钮 */}
          {errors.submit && (
            <div className="p-4 rounded-[var(--radius-lg)] border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)]">
              <p className="text-sm text-[var(--color-danger)]">{errors.submit}</p>
            </div>
          )}

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className={button.primary + ' flex-1 py-3'}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  保存中...
                </span>
              ) : (
                '保存更改'
              )}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className={button.secondary + ' py-3'}
            >
              取消
            </button>
          </div>
        </form>
      </div>
      {showScanner && (
          <BarcodeScanner
          onDetected={(code) => {
            setFormData(prev => ({ ...prev, jan_code: code }));
            setShowScanner(false);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
