'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, uploadImage } from '@/lib/supabase/client';
import { processImageForUpload, isValidImageFile } from '@/lib/image-utils';
import type { PaymentMethod, TransactionFormData, PointsPlatform, Transaction } from '@/types/database.types';
import { createPurchasePlatform } from '@/lib/api/platforms';
import { usePlatforms } from '@/contexts/PlatformsContext';
import { parseNumberInput } from '@/lib/number-utils';
import { getTodayString, formatDateToLocal } from '@/lib/utils/dateUtils';
import { useJanProductAutoFill } from '@/hooks/useJanProductAutoFill';
import type { AmazonPointConfig } from '@/lib/amazon-point-config';

export interface PersistData {
  formData: TransactionFormData;
  imageUrl: string;
  isPending: boolean;
  continueAdding: boolean;
}

interface UseTransactionFormOptions {
  mode: 'create' | 'edit';
  initialData?: Partial<TransactionFormData>;
  initialIsPending?: boolean;
  transaction?: Transaction | null;
  amazonConfig?: AmazonPointConfig | null;
  onPersist: (data: PersistData) => Promise<void>;
}

export function useTransactionForm({
  mode,
  initialData,
  initialIsPending = mode === 'create',
  transaction,
  amazonConfig,
  onPersist,
}: UseTransactionFormOptions) {
  // ──── Form data ────
  const [formData, setFormData] = useState<TransactionFormData>({
    date: getTodayString(),
    product_name: '',
    quantity: 1,
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

  // ──── UI state ────
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [pointsPlatforms, setPointsPlatforms] = useState<PointsPlatform[]>([]);
  const { purchasePlatforms, refreshPlatforms } = usePlatforms();
  const [newPurchasePlatformName, setNewPurchasePlatformName] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, setIsPending] = useState(initialIsPending);
  const [showScanner, setShowScanner] = useState(false);
  const [continueAdding, setContinueAdding] = useState(false);
  const continueAddingRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  // ──── Data fetching ────
  const fetchPaymentMethods = useCallback(async () => {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (error) { console.error('获取支付方式失败:', error); return; }
    setPaymentMethods(data || []);
  }, []);

  const fetchPointsPlatforms = useCallback(async () => {
    const { data, error } = await supabase
      .from('points_platforms')
      .select('*')
      .eq('is_active', true)
      .order('display_name');
    if (error) { console.error('获取积分平台失败:', error); return; }
    setPointsPlatforms(data || []);
  }, []);

  useEffect(() => {
    Promise.all([fetchPaymentMethods(), fetchPointsPlatforms()]);
  }, [fetchPaymentMethods, fetchPointsPlatforms]);

  // ──── initialData merge ────
  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({ ...prev, ...initialData }));
    }
  }, [initialData]);

  useEffect(() => {
    if (initialData?.image_url) {
      setImagePreview(initialData.image_url);
    }
  }, [initialData]);

  // Sync isPending when initialIsPending changes (edit mode: async DB load)
  useEffect(() => {
    setIsPending(initialIsPending);
  }, [initialIsPending]);

  // ──── Amazon helpers (create mode only) ────
  const isAmazonPlatform = useCallback((platformId: string | undefined): boolean => {
    if (!platformId) return false;
    const platform = purchasePlatforms.find(p => p.id === platformId);
    return platform?.name === 'Amazon';
  }, [purchasePlatforms]);

  const autoCalcAmazonPoints = useCallback((
    total: number,
    pointPaid: number,
    cfg: AmazonPointConfig,
  ) => {
    const platformPoints = Math.floor(total * (cfg.amazon_point_rate + cfg.campaign_rate) / 100);
    const cardPoints = Math.floor((total - pointPaid) * cfg.card_rate / 100);
    const dPointsRaw = Math.floor(total * cfg.d_point_rate / 100);
    const extraPoints = Math.min(dPointsRaw, cfg.d_point_cap);
    return { platformPoints, cardPoints, extraPoints };
  }, []);

  const computeAmazonPointUpdates = useCallback((
    total: number,
    pointPaid: number,
    cfg: AmazonPointConfig,
    platforms: PointsPlatform[],
  ): Partial<TransactionFormData> => {
    const { platformPoints, cardPoints, extraPoints } = autoCalcAmazonPoints(total, pointPaid, cfg);
    const amazonP = platforms.find(p => p.display_name.includes('Amazon'));
    const dPointP = platforms.find(p => p.display_name.includes('d'));

    return {
      expected_platform_points: platformPoints,
      expected_card_points: cardPoints,
      extra_platform_points: extraPoints,
      ...(amazonP ? { platform_points_platform_id: amazonP.id } : {}),
      ...(dPointP && extraPoints > 0 ? { extra_platform_points_platform_id: dPointP.id } : {}),
    };
  }, [autoCalcAmazonPoints]);

  // ──── calculateBalancePaid ────
  const calculateBalancePaid = useCallback((total: number, cardPaid: number, pointPaid: number): number => {
    return Math.max(0, total - cardPaid - pointPaid);
  }, []);

  // ──── JAN auto-fill ────
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

  // ──── Handlers ────
  const handleInputChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    setFormData(prev => {
      const next = { ...prev, [name]: value };

      if (name === 'card_id' && value) {
        const selectedCard = paymentMethods.find(pm => pm.id === value);
        if (selectedCard) {
          next.card_points_platform_id = selectedCard.card_points_platform_id || '';
          if (next.card_paid > 0) {
            next.expected_card_points = Math.floor(next.card_paid * selectedCard.point_rate);
          }
        }
      }

      if (mode === 'create' && name === 'purchase_platform_id' && value && amazonConfig?.auto_calc_enabled) {
        if (isAmazonPlatform(value) && prev.purchase_price_total > 0) {
          Object.assign(next, computeAmazonPointUpdates(prev.purchase_price_total, prev.point_paid, amazonConfig, pointsPlatforms));
        }
      }

      return next;
    });

    // Clear field error
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  }, [paymentMethods, mode, amazonConfig, isAmazonPlatform, computeAmazonPointUpdates, pointsPlatforms]);

  const handleNumberChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = parseNumberInput(value, 0);
    setFormData(prev => ({ ...prev, [name]: numValue }));
  }, []);

  const handlePaymentChange = useCallback((field: 'card_paid' | 'point_paid', value: string) => {
    const numValue = parseNumberInput(value, 0);
    setFormData(prev => {
      const newFormData = { ...prev, [field]: numValue };
      const balancePaid = calculateBalancePaid(
        newFormData.purchase_price_total,
        newFormData.card_paid,
        newFormData.point_paid
      );

      let cardPoints = newFormData.expected_card_points;
      if (field === 'card_paid' && newFormData.card_id) {
        const selectedCard = paymentMethods.find(pm => pm.id === newFormData.card_id);
        if (selectedCard) {
          cardPoints = Math.floor(numValue * selectedCard.point_rate);
        }
      }

      // Amazon card points recalculation (point_paid change affects card points)
      if (mode === 'create' && field === 'point_paid' && amazonConfig?.auto_calc_enabled) {
        if (prev.purchase_platform_id && isAmazonPlatform(prev.purchase_platform_id) && prev.purchase_price_total > 0) {
          cardPoints = autoCalcAmazonPoints(prev.purchase_price_total, numValue, amazonConfig).cardPoints;
        }
      }

      return { ...newFormData, balance_paid: balancePaid, expected_card_points: cardPoints };
    });
  }, [paymentMethods, calculateBalancePaid, mode, amazonConfig, isAmazonPlatform, autoCalcAmazonPoints]);

  const handleDateChange = useCallback((date: Date | null) => {
    setFormData(prev => ({ ...prev, date: formatDateToLocal(date) }));
  }, []);

  const handleUnitPriceChange = useCallback((value: string) => {
    const val = parseNumberInput(value, 0);
    setFormData(prev => {
      const qty = prev.quantity || 1;
      const newTotal = Math.round(val * qty * 100) / 100;
      const balancePaid = calculateBalancePaid(newTotal, prev.card_paid, prev.point_paid);

      // Amazon auto-calc (create mode only)
      const amazonUpdates = (mode === 'create' && amazonConfig?.auto_calc_enabled && isAmazonPlatform(prev.purchase_platform_id) && newTotal > 0)
        ? computeAmazonPointUpdates(newTotal, prev.point_paid, amazonConfig, pointsPlatforms)
        : {};

      return {
        ...prev,
        unit_price: val,
        purchase_price_total: newTotal,
        balance_paid: balancePaid,
        ...amazonUpdates,
      };
    });
  }, [calculateBalancePaid, mode, amazonConfig, isAmazonPlatform, computeAmazonPointUpdates, pointsPlatforms]);

  const handleTotalPriceChange = useCallback((value: string) => {
    const total = parseNumberInput(value, 0);
    setFormData(prev => {
      const balancePaid = calculateBalancePaid(total, prev.card_paid, prev.point_paid);

      // Amazon auto-calc (create mode only)
      const amazonUpdates = (mode === 'create' && amazonConfig?.auto_calc_enabled && isAmazonPlatform(prev.purchase_platform_id) && total > 0)
        ? computeAmazonPointUpdates(total, prev.point_paid, amazonConfig, pointsPlatforms)
        : {};

      return { ...prev, purchase_price_total: total, balance_paid: balancePaid, ...amazonUpdates };
    });
  }, [calculateBalancePaid, mode, amazonConfig, isAmazonPlatform, computeAmazonPointUpdates, pointsPlatforms]);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isValidImageFile(file)) {
      setErrors(prev => ({ ...prev, image: '请选择图片文件（支持JPG、PNG、HEIC等格式）' }));
      return;
    }

    setSelectedImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const clearImage = useCallback(() => {
    setSelectedImage(null);
    setImagePreview('');
  }, []);

  const handleAddPurchasePlatform = useCallback(async () => {
    const name = newPurchasePlatformName.trim();
    if (!name) return;
    const created = await createPurchasePlatform(name);
    if (created) {
      await refreshPlatforms();
      setFormData(prev => ({ ...prev, purchase_platform_id: created.id }));
      setNewPurchasePlatformName('');
    }
  }, [newPurchasePlatformName, refreshPlatforms]);

  // ──── Validation ────
  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.product_name.trim()) {
      newErrors.product_name = '请输入商品名称';
    }

    if (mode === 'edit' && (!formData.quantity || formData.quantity < 1)) {
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
  }, [formData, mode]);

  // ──── Submit ────
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      let imageUrl: string = formData.image_url || '';
      if (selectedImage) {
        const compressed = await processImageForUpload(selectedImage);
        imageUrl = await uploadImage(compressed);
      }

      await onPersist({
        formData,
        imageUrl,
        isPending,
        continueAdding: continueAddingRef.current,
      });
    } catch (error: unknown) {
      console.error('保存失败:', error);
      const message = error instanceof Error ? error.message : '保存失败,请重试';
      setErrors(prev => ({ ...prev, submit: message }));
    } finally {
      setIsSubmitting(false);
      setContinueAdding(false);
      continueAddingRef.current = false;
    }
  }, [formData, selectedImage, isPending, validateForm, onPersist]);

  const triggerSubmitAndContinue = useCallback(() => {
    setContinueAdding(true);
    continueAddingRef.current = true;
    formRef.current?.requestSubmit();
  }, []);

  // ──── Computed values ────
  const quantityLocked = mode === 'edit' && !!(transaction && transaction.quantity_sold > 0);

  const quantityWarning = quantityLocked && transaction
    ? `该商品已售出 ${transaction.quantity_sold} 件，无法修改总数量`
    : null;

  const showPendingToggle = mode === 'create'
    ? true
    : !!(transaction
      && (transaction.status === 'pending' || transaction.status === 'in_stock')
      && transaction.quantity_sold === 0);

  const getCardPointRateLabel = useCallback((): string | null => {
    if (!formData.card_id) return null;
    const card = paymentMethods.find(pm => pm.id === formData.card_id);
    if (!card) return null;
    return `(返点率: ${card.point_rate * 100}%)`;
  }, [formData.card_id, paymentMethods]);

  return {
    // State
    formData,
    setFormData,
    errors,
    isSubmitting,
    isPending,
    setIsPending,
    continueAdding,
    selectedImage,
    imagePreview,
    showScanner,
    setShowScanner,
    paymentMethods,
    pointsPlatforms,
    purchasePlatforms,
    newPurchasePlatformName,
    setNewPurchasePlatformName,
    formRef,

    // Handlers
    handleInputChange,
    handleNumberChange,
    handlePaymentChange,
    handleDateChange,
    handleUnitPriceChange,
    handleTotalPriceChange,
    handleImageSelect,
    clearImage,
    handleAddPurchasePlatform,
    handleSubmit,
    triggerSubmitAndContinue,

    // JAN
    janLooking,

    // Computed
    quantityLocked,
    quantityWarning,
    showPendingToggle,
    getCardPointRateLabel,
  };
}
