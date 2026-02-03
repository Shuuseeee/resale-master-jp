// app/transactions/[id]/edit/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase, uploadImage } from '@/lib/supabase/client';
import { processImageForUpload } from '@/lib/image-utils';
import type { PaymentMethod, TransactionFormData, Transaction, PointsPlatform } from '@/types/database.types';
import Image from 'next/image';
import { layout, heading, card, button, input } from '@/lib/theme';
import DatePicker from '@/components/DatePicker';
import { useCalculator } from '@/hooks/useCalculator';

export default function EditTransactionPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  // 表单状态
  const [formData, setFormData] = useState<TransactionFormData>({
    date: new Date().toISOString().split('T')[0],
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
    image_url: '',
    notes: '',
  });

  // UI 状态
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [pointsPlatforms, setPointsPlatforms] = useState<PointsPlatform[]>([]);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [transaction, setTransaction] = useState<Transaction | null>(null);

  // Calculator refs
  const purchasePriceRef = useRef<HTMLInputElement>(null);
  const cardPaidRef = useRef<HTMLInputElement>(null);
  const pointPaidRef = useRef<HTMLInputElement>(null);
  const platformPointsRef = useRef<HTMLInputElement>(null);
  const extraPointsRef = useRef<HTMLInputElement>(null);
  const cardPointsRef = useRef<HTMLInputElement>(null);

  // Initialize calculator for each numeric input
  useCalculator(purchasePriceRef);
  useCalculator(cardPaidRef);
  useCalculator(pointPaidRef);
  useCalculator(platformPointsRef);
  useCalculator(extraPointsRef);
  useCalculator(cardPointsRef);

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
      router.push('/transactions');
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
      const { error } = await supabase
        .from('transactions')
        .update({
          date: formData.date,
          product_name: formData.product_name,
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
          image_url: imageUrl,
          notes: formData.notes,
        })
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-900 dark:text-white">
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="relative max-w-2xl mx-auto px-4 py-8">
        {/* 标题区域 */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-white transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">返回</span>
          </button>

          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            编辑交易
          </h1>
          <p className="text-gray-600 dark:text-gray-400">修改交易记录信息</p>
        </div>

        {/* 表单卡片 */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-2xl">
            {/* 基本信息 */}
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>
                基本信息
              </h2>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    日期 <span className="text-red-300">*</span>
                  </label>
                  <DatePicker
                    selected={formData.date ? new Date(formData.date) : null}
                    onChange={(date) => {
                      setFormData((prev) => ({
                        ...prev,
                        date: date ? date.toISOString().split('T')[0] : ''
                      }));
                    }}
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    商品名称 <span className="text-red-300">*</span>
                  </label>
                  <input
                    type="text"
                    name="product_name"
                    value={formData.product_name}
                    onChange={handleInputChange}
                    placeholder="例: Nintendo Switch OLED"
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    required
                  />
                  {errors.product_name && (
                    <p className="mt-1 text-sm text-red-300">{errors.product_name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    数量 <span className="text-red-300">*</span>
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    value={formData.quantity || 1}
                    onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 1})}
                    min="1"
                    disabled={!!(transaction && transaction.quantity_sold > 0)}
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    required
                  />
                  {transaction && transaction.quantity_sold > 0 && (
                    <p className="text-amber-500 text-sm mt-1">
                      该商品已售出 {transaction.quantity_sold} 件，无法修改总数量
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 采购成本 */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-2xl">
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <div className="w-1 h-6 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-full"></div>
                采购成本
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  采购总价 <span className="text-red-300">*</span>
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
                    ref={purchasePriceRef}
                    className="w-full px-4 py-3 pr-12 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    required
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400">¥</span>
                </div>
                {errors.purchase_price_total && (
                  <p className="mt-1 text-sm text-red-300">{errors.purchase_price_total}</p>
                )}
              </div>

              {/* 混合支付 */}
              <div className="grid grid-cols-1 gap-4 pt-4 border-t border-gray-300 dark:border-gray-600/50">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    信用卡支付
                  </label>
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="number"
                        value={formData.card_paid || ''}
                        onChange={(e) => handlePaymentChange('card_paid', parseFloat(e.target.value) || 0)}
                        step="0.01"
                        min="0"
                        max={formData.purchase_price_total}
                        placeholder="0.00"
                        ref={cardPaidRef}
                        className="w-full px-4 py-3 pr-12 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400">¥</span>
                    </div>
                    <select
                      name="card_id"
                      value={formData.card_id}
                      onChange={handleInputChange}
                      className="px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
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
                  {errors.card_id && (
                    <p className="mt-1 text-sm text-red-300">{errors.card_id}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                      ref={pointPaidRef}
                      className="w-full px-4 py-3 pr-12 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400">¥</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    余额支付
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.balance_paid || ''}
                      readOnly
                      className="w-full px-4 py-3 pr-12 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600/50 rounded-xl text-gray-600 dark:text-gray-400 cursor-not-allowed"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-500">¥</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">自动计算</p>
                </div>

                {errors.payment && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-sm text-red-300">{errors.payment}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 预期积分 */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-2xl">
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <div className="w-1 h-6 bg-gradient-to-b from-amber-500 to-orange-500 rounded-full"></div>
                预期积分
              </h2>

              {/* 平台积分 - 组合式布局 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                      ref={platformPointsRef}
                      className="w-full px-4 py-3 pr-12 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400">P</span>
                  </div>
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
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">选择平台</option>
                    {pointsPlatforms.map((platform) => (
                      <option key={platform.id} value={platform.id}>
                        {platform.display_name} (¥{platform.yen_conversion_rate})
                      </option>
                    ))}
                  </select>
                  {errors.platform_points_platform_id && (
                    <p className="mt-1 text-sm text-red-300">{errors.platform_points_platform_id}</p>
                  )}
                </div>
              </div>

              {/* 额外平台积分 - 组合式布局 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    额外积分数量
                    <span className="text-xs text-gray-500 ml-2">(如d point)</span>
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
                      ref={extraPointsRef}
                      className="w-full px-4 py-3 pr-12 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400">P</span>
                  </div>
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
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">选择平台</option>
                    {pointsPlatforms.map((platform) => (
                      <option key={platform.id} value={platform.id}>
                        {platform.display_name} (¥{platform.yen_conversion_rate})
                      </option>
                    ))}
                  </select>
                  {errors.extra_platform_points_platform_id && (
                    <p className="mt-1 text-sm text-red-300">{errors.extra_platform_points_platform_id}</p>
                  )}
                </div>
              </div>

              {/* 信用卡积分 - 组合式布局 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    信用卡积分数量
                    {formData.card_id && paymentMethods.find(pm => pm.id === formData.card_id) && (
                      <span className="ml-2 text-xs text-emerald-300">
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
                      ref={cardPointsRef}
                      className="w-full px-4 py-3 pr-12 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400">P</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">根据卡片返点率自动计算，可手动调整</p>
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
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">选择平台</option>
                    {pointsPlatforms.map((platform) => (
                      <option key={platform.id} value={platform.id}>
                        {platform.display_name} (¥{platform.yen_conversion_rate})
                      </option>
                    ))}
                  </select>
                  {errors.card_points_platform_id && (
                    <p className="mt-1 text-sm text-red-300">{errors.card_points_platform_id}</p>
                  )}
                  {formData.card_id && formData.card_points_platform_id && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                      已从支付方式自动设置
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 凭证上传 */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-2xl">
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <div className="w-1 h-6 bg-gradient-to-b from-rose-500 to-pink-500 rounded-full"></div>
                凭证上传
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  采购截图
                </label>

                {imagePreview ? (
                  <div className="relative group">
                    <div className="relative w-full h-48 rounded-xl overflow-hidden bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600">
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
                      className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer bg-gray-100 dark:bg-gray-700 hover:bg-white dark:bg-gray-700 transition-all">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <svg className="w-12 h-12 mb-3 text-gray-500 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-semibold">点击上传</span>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">PNG, JPG 或 WEBP (最大 5MB)</p>
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
                  <p className="mt-1 text-sm text-red-300">{errors.image}</p>
                )}
              </div>
            </div>
          </div>

          {/* 备注 */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-2xl">
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <div className="w-1 h-6 bg-gradient-to-b from-cyan-500 to-blue-500 rounded-full"></div>
                备注
              </h2>

              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
                placeholder="添加备注信息..."
                className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all resize-none"
              />
            </div>
          </div>

          {/* 提交按钮 */}
          {errors.submit && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
              <p className="text-sm text-red-300">{errors.submit}</p>
            </div>
          )}

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:transform-none"
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
              className="px-8 py-4 bg-white dark:bg-gray-700 hover:bg-slate-700/50 text-gray-700 dark:text-gray-300 hover:text-white font-semibold rounded-xl transition-all border border-gray-300 dark:border-gray-600"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
