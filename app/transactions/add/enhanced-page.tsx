// app/transactions/add/enhanced-page.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase, uploadImage } from '@/lib/supabase/client';
import { processImageForUpload } from '@/lib/image-utils';
import { 
  calculateROI, 
  calculateTotalProfit,
  calculatePaymentDate,
  calculatePointsExpiryDate,
  formatCurrency,
  formatROI
} from '@/lib/financial/calculator';
import type { PaymentMethod } from '@/types/database.types';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface EnhancedFormData {
  // 基本信息
  date: string;
  product_name: string;
  
  // 成本信息
  purchase_price_total: number;
  card_paid: number;
  point_paid: number;
  balance_paid: number;
  card_id: string;
  
  // 积分信息
  expected_platform_points: number;
  expected_card_points: number;
  points_expiry_date: string;
  
  // 销售信息(可选,用于预测)
  estimated_selling_price: number;
  estimated_platform_fee: number;
  estimated_shipping_fee: number;
  
  // 其他
  image_url?: string;
  notes?: string;
}

export default function EnhancedAddTransactionPage() {
  const router = useRouter();
  
  const [formData, setFormData] = useState<EnhancedFormData>({
    date: new Date().toISOString().split('T')[0],
    product_name: '',
    purchase_price_total: 0,
    card_paid: 0,
    point_paid: 0,
    balance_paid: 0,
    card_id: '',
    expected_platform_points: 0,
    expected_card_points: 0,
    points_expiry_date: calculatePointsExpiryDate(new Date()).toISOString().split('T')[0],
    estimated_selling_price: 0,
    estimated_platform_fee: 0,
    estimated_shipping_fee: 0,
    image_url: '',
    notes: '',
  });

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // 计算预览
  const [preview, setPreview] = useState({
    expectedPaymentDate: '',
    estimatedROI: 0,
    estimatedProfit: 0,
    pointsValue: 0,
  });

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  useEffect(() => {
    updatePreview();
  }, [formData, selectedMethod]);

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

  const updatePreview = () => {
    if (!selectedMethod) return;

    // 计算预计还款日期
    if (formData.card_paid > 0 && selectedMethod.closing_day && selectedMethod.payment_day) {
      const paymentDate = calculatePaymentDate(
        new Date(formData.date),
        selectedMethod.closing_day,
        selectedMethod.payment_day,
        selectedMethod.payment_same_month || false
      );
      setPreview(prev => ({
        ...prev,
        expectedPaymentDate: paymentDate.toISOString().split('T')[0],
      }));
    }

    // 计算预估 ROI(如果填写了销售价格)
    if (formData.estimated_selling_price > 0) {
      const roi = calculateROI(
        formData.estimated_selling_price,
        formData.estimated_platform_fee,
        formData.estimated_shipping_fee,
        formData.purchase_price_total,
        formData.expected_platform_points,
        formData.expected_card_points,
        selectedMethod.point_rate || 1.0,
        formData.point_paid
      );

      const profit = calculateTotalProfit(
        formData.estimated_selling_price,
        formData.estimated_platform_fee,
        formData.estimated_shipping_fee,
        formData.purchase_price_total,
        formData.expected_platform_points,
        formData.expected_card_points,
        selectedMethod.point_rate || 1.0
      );

      const pointsValue = (formData.expected_platform_points + formData.expected_card_points)
        * (selectedMethod.point_rate || 1.0);

      setPreview(prev => ({
        ...prev,
        estimatedROI: roi,
        estimatedProfit: profit,
        pointsValue: pointsValue,
      }));
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }

    // 如果选择了支付方式,更新选中的支付方式对象
    if (name === 'card_id') {
      const method = paymentMethods.find(m => m.id === value);
      setSelectedMethod(method || null);
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = parseFloat(value) || 0;
    setFormData((prev) => ({
      ...prev,
      [name]: numValue,
    }));
  };

  const calculateBalancePaid = (
    total: number,
    cardPaid: number,
    pointPaid: number
  ): number => {
    const balance = total - cardPaid - pointPaid;
    return Math.max(0, balance);
  };

  const handlePaymentChange = (field: 'card_paid' | 'point_paid', value: number) => {
    const newFormData = { ...formData, [field]: value };
    
    const balancePaid = calculateBalancePaid(
      newFormData.purchase_price_total,
      newFormData.card_paid,
      newFormData.point_paid
    );
    
    setFormData({
      ...newFormData,
      balance_paid: balancePaid,
    });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 支持常见图片格式 + HEIC/HEIF
    const isValidImage = file.type.startsWith('image/') ||
                        file.name.toLowerCase().endsWith('.heic') ||
                        file.name.toLowerCase().endsWith('.heif');

    if (!isValidImage) {
      setErrors((prev) => ({ ...prev, image: '请选择图片文件（支持JPG、PNG、HEIC等格式）' }));
      return;
    }

    setSelectedImage(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      let imageUrl = formData.image_url;

      if (selectedImage) {
        const compressed = await processImageForUpload(selectedImage);
        imageUrl = await uploadImage(compressed);
      }

      const { data, error } = await supabase
        .from('transactions')
        .insert([
          {
            date: formData.date,
            product_name: formData.product_name,
            purchase_price_total: formData.purchase_price_total,
            card_paid: formData.card_paid,
            point_paid: formData.point_paid,
            balance_paid: formData.balance_paid,
            card_id: formData.card_id || null,
            expected_platform_points: formData.expected_platform_points,
            expected_card_points: formData.expected_card_points,
            points_expiry_date: formData.points_expiry_date,
            image_url: imageUrl,
            notes: formData.notes,
            status: 'in_stock',
          },
        ])
        .select()
        .single();

      if (error) throw error;

      router.push('/dashboard');
    } catch (error: any) {
      console.error('保存失败:', error);
      setErrors({ submit: error.message || '保存失败,请重试' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
      {/* 装饰性背景元素 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="relative max-w-4xl mx-auto px-4 py-8">
        {/* 标题区域 */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">返回</span>
          </button>
          
          <h1 className="text-4xl font-bold text-white mb-2">
            记录新交易
          </h1>
          <p className="text-slate-400">智能财务分析,实时计算ROI</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 预览卡片 */}
          {(preview.estimatedROI !== 0 || preview.expectedPaymentDate) && (
            <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 backdrop-blur-xl rounded-2xl p-6 border border-indigo-700/50 shadow-2xl">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                智能预测
              </h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {preview.expectedPaymentDate && (
                  <div className="text-center">
                    <div className="text-slate-400 text-sm mb-1">预计还款日</div>
                    <div className="text-lg font-bold text-emerald-400">
                      {new Date(preview.expectedPaymentDate).toLocaleDateString('zh-CN', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>
                  </div>
                )}
                
                {preview.estimatedROI !== 0 && (
                  <>
                    <div className="text-center">
                      <div className="text-slate-400 text-sm mb-1">预估 ROI</div>
                      <div className={`text-lg font-bold ${preview.estimatedROI >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatROI(preview.estimatedROI)}
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-slate-400 text-sm mb-1">预估利润</div>
                      <div className={`text-lg font-bold ${preview.estimatedProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatCurrency(preview.estimatedProfit)}
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-slate-400 text-sm mb-1">积分价值</div>
                      <div className="text-lg font-bold text-amber-400">
                        {formatCurrency(preview.pointsValue)}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 基本信息 */}
          <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-800/50 shadow-2xl">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>
              基本信息
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  日期 <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  商品名称 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="product_name"
                  value={formData.product_name}
                  onChange={handleInputChange}
                  placeholder="例: Nintendo Switch OLED"
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  required
                />
                {errors.product_name && (
                  <p className="mt-1 text-sm text-red-400">{errors.product_name}</p>
                )}
              </div>
            </div>
          </div>

          {/* 其余部分与原版相同,这里省略以节省空间 */}
          {/* 包括: 采购成本、混合支付、预期积分、预估销售(新增)、凭证上传、备注 */}

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-slate-700 disabled:to-slate-700 text-white font-semibold rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed shadow-lg"
          >
            {isSubmitting ? '保存中...' : '保存交易'}
          </button>
        </form>
      </div>
    </div>
  );
}