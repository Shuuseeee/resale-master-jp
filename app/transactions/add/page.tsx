// app/transactions/add/page.tsx
'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { supabase, uploadImage } from '@/lib/supabase/client';
import { processImageForUpload } from '@/lib/image-utils';
import type { PaymentMethod, TransactionFormData, PointsPlatform } from '@/types/database.types';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { layout, heading, card, button, input } from '@/lib/theme';
import DatePicker from '@/components/DatePicker';
import BarcodeScanner from '@/components/BarcodeScanner';
import { parseNumberInput } from '@/lib/number-utils';
import { createPurchasePlatform } from '@/lib/api/platforms';
import { usePlatforms } from '@/contexts/PlatformsContext';
import { loadAmazonPointConfig, type AmazonPointConfig } from '@/lib/amazon-point-config';
import { getTodayString, formatDateToLocal, parseDateFromLocal } from '@/lib/utils/dateUtils';
import { useJanProductAutoFill } from '@/hooks/useJanProductAutoFill';

function AddTransactionPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 表单状态
  const [formData, setFormData] = useState<TransactionFormData>({
    date: getTodayString(),
    product_name: '',
    quantity: 1, // 默认数量为1
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, setIsPending] = useState(true); // 未着品トグル
  const [amazonConfig, setAmazonConfig] = useState<AmazonPointConfig | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  // 加载支付方式列表和积分平台列表
  useEffect(() => {
    fetchPaymentMethods();
    fetchPointsPlatforms();
    setAmazonConfig(loadAmazonPointConfig());
  }, []);

  // 判断选择的购入先是否为 Amazon
  const isAmazonPlatform = (platformId: string | undefined): boolean => {
    if (!platformId) return false;
    const platform = purchasePlatforms.find(p => p.id === platformId);
    return platform?.name === 'Amazon';
  };

  // Amazon ポイント自動計算
  const autoCalcAmazonPoints = (
    total: number,
    pointPaid: number,
    cfg: AmazonPointConfig,
  ) => {
    // P(サイト) = Amazon ポイント + キャンペーン
    const platformPoints = Math.floor(total * (cfg.amazon_point_rate + cfg.campaign_rate) / 100);
    // P(カード) = カード還元 (ポイント使用分除外)
    const cardPoints = Math.floor((total - pointPaid) * cfg.card_rate / 100);
    // P(他) = d ポイント (上限あり)
    const dPointsRaw = Math.floor(total * cfg.d_point_rate / 100);
    const extraPoints = Math.min(dPointsRaw, cfg.d_point_cap);
    return { platformPoints, cardPoints, extraPoints };
  };

  // Amazon自動計算をフォームに適用
  const applyAmazonAutoCalc = (
    total: number,
    pointPaid: number,
    cfg: AmazonPointConfig,
    platforms: PointsPlatform[],
  ) => {
    const { platformPoints, cardPoints, extraPoints } = autoCalcAmazonPoints(total, pointPaid, cfg);

    // ポイントプラットフォームを名前で自動選択
    const amazonPlatform = platforms.find(p => p.display_name.includes('Amazon'));
    const dPointPlatform = platforms.find(p => p.display_name.includes('d'));

    setFormData(prev => ({
      ...prev,
      expected_platform_points: platformPoints,
      expected_card_points: cardPoints,
      extra_platform_points: extraPoints,
      ...(amazonPlatform ? { platform_points_platform_id: amazonPlatform.id } : {}),
      ...(dPointPlatform && extraPoints > 0 ? { extra_platform_points_platform_id: dPointPlatform.id } : {}),
    }));
  };

  // 复制交易数据
  useEffect(() => {
    const copyId = searchParams.get('copy');
    if (!copyId) return;

    const loadSourceTransaction = async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', copyId)
        .single();

      if (error || !data) return;

      setFormData({
        date: getTodayString(),
        product_name: data.product_name,
        quantity: data.quantity,
        purchase_price_total: data.purchase_price_total,
        card_paid: data.card_paid,
        point_paid: data.point_paid,
        balance_paid: data.balance_paid,
        card_id: data.card_id || '',
        expected_platform_points: data.expected_platform_points,
        expected_card_points: data.expected_card_points,
        extra_platform_points: data.extra_platform_points,
        platform_points_platform_id: data.platform_points_platform_id || '',
        card_points_platform_id: data.card_points_platform_id || '',
        extra_platform_points_platform_id: data.extra_platform_points_platform_id || '',
        jan_code: data.jan_code || '',
        unit_price: data.unit_price || 0,
        purchase_platform_id: data.purchase_platform_id || '',
        order_number: '',
        image_url: '',
        notes: data.notes || '',
      });
      setIsPending(true);
    };

    loadSourceTransaction();
  }, [searchParams]);

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

    // 購入先が Amazon に変更された場合、自動計算
    if (name === 'purchase_platform_id' && value && amazonConfig?.auto_calc_enabled) {
      if (isAmazonPlatform(value) && formData.purchase_price_total > 0) {
        applyAmazonAutoCalc(formData.purchase_price_total, formData.point_paid, amazonConfig, pointsPlatforms);
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

  // 处理数字输入（支持逗号分隔的金额）
  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = parseNumberInput(value, 0);
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

  // 处理支付金额变化（支持逗号分隔的金额）
  const handlePaymentChange = (field: 'card_paid' | 'point_paid', value: string) => {
    const numValue = parseNumberInput(value, 0);
    const newFormData = { ...formData, [field]: numValue };

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
        cardPoints = Math.floor(numValue * selectedCard.point_rate);
      }
    }

    setFormData({
      ...newFormData,
      balance_paid: balancePaid,
      expected_card_points: cardPoints,
    });

    // Amazon カード還元再計算 (ポイント使用分除外のため point_paid 変更時に再計算)
    if (field === 'point_paid' && amazonConfig?.auto_calc_enabled && newFormData.purchase_platform_id && isAmazonPlatform(newFormData.purchase_platform_id) && newFormData.purchase_price_total > 0) {
      const { cardPoints: amazonCardPoints } = autoCalcAmazonPoints(newFormData.purchase_price_total, numValue, amazonConfig);
      setFormData(prev => ({ ...prev, expected_card_points: amazonCardPoints }));
    }
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

  // 提交表单（continueAdding=true 时保存后继续添加）
  const [continueAdding, setContinueAdding] = useState(false);
  const continueAddingRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      let imageUrl = formData.image_url;

      // 上传图片
      if (selectedImage) {
        const compressed = await processImageForUpload(selectedImage);
        imageUrl = await uploadImage(compressed);
      }

      // 插入交易记录
      const { data: newRecord, error } = await supabase
        .from('transactions')
        .insert([
          {
            ...formData,
            status: isPending ? 'pending' : 'in_stock',
            image_url: imageUrl,
            card_id: formData.card_id || null,
            platform_points_platform_id: formData.platform_points_platform_id || null,
            card_points_platform_id: formData.card_points_platform_id || null,
            extra_platform_points: formData.extra_platform_points || 0,
            extra_platform_points_platform_id: formData.extra_platform_points_platform_id || null,
            jan_code: formData.jan_code || null,
            unit_price: formData.unit_price || null,
            purchase_platform_id: formData.purchase_platform_id || null,
            order_number: formData.order_number || null,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Fire-and-forget: seed JAN → product_name into cache
      const jan = formData.jan_code?.trim();
      const pName = formData.product_name?.trim();
      if (jan && /^\d+$/.test(jan) && pName) {
        fetch(`/api/jan-product/${jan}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_name: pName }),
        }).catch(() => {});
      }

      if (continueAddingRef.current && newRecord) {
        // 继续添加：跳转到预填表单
        router.push(`/transactions/add?copy=${newRecord.id}`);
      } else {
        // 默认：返回列表
        router.push('/transactions');
      }
    } catch (error: any) {
      console.error('保存失败:', error);
      setErrors({ submit: error.message || '保存失败,请重试' });
    } finally {
      setIsSubmitting(false);
      setContinueAdding(false);
      continueAddingRef.current = false;
    }
  };

  return (
    <div className={layout.page}>
      <div className="relative max-w-2xl lg:max-w-5xl mx-auto px-4 py-8">
        {/* 标题区域 */}
        <div className={layout.section}>
          <button
            onClick={() => router.back()}
            className={button.ghost + ' flex items-center gap-2 mb-4'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">返回</span>
          </button>

          <h1 className={heading.h1 + ' mb-2'}>
            记录新交易
          </h1>
          <p className="text-[var(--color-text-muted)]">快速录入您的转卖商品信息</p>
        </div>

        {/* 表单卡片 */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start lg:space-y-0">
          <div className="space-y-6">
          <div className="sn-form-card">
            {/* 基本信息 */}
            <div className="space-y-5">
              <h2 className={heading.h3 + ' flex items-center gap-2'}>
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
                  <p className="sn-form-muted">
                    输入JAN码后如果商品名称为空会自动补全（仅限部分常见商品）
                  </p>
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
                    type="text"
                    inputMode="numeric"
                    name="quantity"
                    value={formData.quantity || ''}
                    onChange={handleNumberChange}
                    placeholder="1"
                    className="w-full sn-form-input"
                    required
                  />
                  <p className="sn-form-muted">
                    批量进货时填写总数量，如30个
                  </p>
                </div>

                {/* 未着品トグル */}
                <div className="sn-form-subtle-panel flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-[var(--color-text)]">
                      未到货
                    </label>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      商品尚未到达
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
              </div>
            </div>
          </div>

          {/* 采购信息 */}
          <div className="sn-form-card">
            <div className="space-y-5">
              <h2 className="sn-form-title">
                <div className="sn-form-title-bar"></div>
                采购信息
              </h2>

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
                      const newTotal = Math.round(val * qty * 100) / 100;
                      setFormData(prev => ({
                        ...prev,
                        unit_price: val,
                        purchase_price_total: newTotal,
                        balance_paid: calculateBalancePaid(newTotal, prev.card_paid, prev.point_paid),
                      }));
                      // Amazon 自動計算
                      if (amazonConfig?.auto_calc_enabled && isAmazonPlatform(formData.purchase_platform_id) && newTotal > 0) {
                        applyAmazonAutoCalc(newTotal, formData.point_paid, amazonConfig, pointsPlatforms);
                      }
                    }}
                    placeholder="0.00"
                    className="w-full sn-form-input pr-12"
                  />
                  <span className="sn-form-addon">¥</span>
                </div>
                <p className="sn-form-muted">
                  输入后采购总价将自动计算（单价 × 数量）
                </p>
              </div>

              <div>
                <label className="sn-form-label">
                  采购平台
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
                        {p.name}{p.is_builtin ? '' : ' (自定义)'}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={newPurchasePlatformName}
                    onChange={(e) => setNewPurchasePlatformName(e.target.value)}
                    placeholder="添加新的采购平台..."
                    className="flex-1 sn-form-input py-2"
                  />
                  <button
                    type="button"
                    onClick={handleAddPurchasePlatform}
                    disabled={!newPurchasePlatformName.trim()}
                    className="px-3 py-2 bg-[var(--color-primary)] active:opacity-80 disabled:opacity-50 text-white text-sm rounded-lg transition-all disabled:cursor-not-allowed"
                  >
                    添加
                  </button>
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
                    type="text"
                    inputMode="decimal"
                    name="purchase_price_total"
                    value={formData.purchase_price_total || ''}
                    onChange={(e) => {
                      handleNumberChange(e);
                      const total = parseNumberInput(e.target.value, 0);
                      const balancePaid = calculateBalancePaid(
                        total,
                        formData.card_paid,
                        formData.point_paid
                      );
                      setFormData((prev) => ({ ...prev, balance_paid: balancePaid }));
                      // Amazon 自動計算
                      if (amazonConfig?.auto_calc_enabled && isAmazonPlatform(formData.purchase_platform_id) && total > 0) {
                        applyAmazonAutoCalc(total, formData.point_paid, amazonConfig, pointsPlatforms);
                      }
                    }}
                    placeholder="0.00 或 3,000"
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
                          type="text"
                          inputMode="decimal"
                          value={formData.card_paid || ''}
                          onChange={(e) => handlePaymentChange('card_paid', e.target.value)}
                          placeholder="0.00 或 3,000"
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
                      type="text"
                      inputMode="decimal"
                      value={formData.point_paid || ''}
                      onChange={(e) => handlePaymentChange('point_paid', e.target.value)}
                      placeholder="0.00 或 3,000"
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
                      type="text"
                      inputMode="numeric"
                      name="expected_platform_points"
                      value={formData.expected_platform_points || ''}
                      onChange={handleNumberChange}
                      placeholder="0 或 1,000"
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
                      type="text"
                      inputMode="numeric"
                      name="extra_platform_points"
                      value={formData.extra_platform_points || ''}
                      onChange={handleNumberChange}
                      placeholder="0 或 1,000"
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
                      type="text"
                      inputMode="numeric"
                      name="expected_card_points"
                      value={formData.expected_card_points || ''}
                      onChange={handleNumberChange}
                      placeholder="0 或 1,000"
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

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className={button.primary + ' flex-1 py-3'}
            >
              {isSubmitting && !continueAdding ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  保存中...
                </span>
              ) : (
                '保存'
              )}
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setContinueAdding(true);
                continueAddingRef.current = true;
                // 通过 requestSubmit 触发表单提交（含验证）
                const form = document.querySelector('form');
                form?.requestSubmit();
              }}
              className={button.secondary + ' flex-1 py-3'}
            >
              {isSubmitting && continueAdding ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  保存中...
                </span>
              ) : (
                '保存并继续添加'
              )}
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

export default function AddTransactionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--color-text)]">
          <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-xl">加载中...</span>
        </div>
      </div>
    }>
      <AddTransactionPageContent />
    </Suspense>
  );
}
