// app/supplies/add/page.tsx
'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { SuppliesCostFormData } from '@/types/database.types';
import { layout, heading, card, button } from '@/lib/theme';
import DatePicker from '@/components/DatePicker';
import { useCalculator } from '@/hooks/useCalculator';

// 耗材分类选项
const CATEGORY_OPTIONS = [
  { value: '包装材料', label: '包装材料' },
  { value: '运输耗材', label: '运输耗材' },
  { value: '标签打印', label: '标签打印' },
  { value: '其他', label: '其他' },
];

export default function AddSupplyPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<SuppliesCostFormData>({
    category: '包装材料',
    amount: 0,
    purchase_date: new Date().toISOString().split('T')[0],
    description: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Calculator ref
  const amountRef = useRef<HTMLInputElement>(null);

  // Initialize calculator
  useCalculator(amountRef);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: parseFloat(value) || 0 }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.category) {
      newErrors.category = '请选择耗材分类';
    }

    if (formData.amount <= 0) {
      newErrors.amount = '金额必须大于0';
    }

    if (!formData.purchase_date) {
      newErrors.purchase_date = '请选择采购日期';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('supplies_costs').insert([
        {
          category: formData.category,
          amount: formData.amount,
          purchase_date: formData.purchase_date,
          description: formData.description || null,
          notes: formData.notes || null,
        },
      ]);

      if (error) throw error;

      router.push('/supplies');
    } catch (error: any) {
      console.error('保存失败:', error);
      setErrors({ submit: error.message || '保存失败，请重试' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={layout.page}>
      <div className="relative max-w-2xl mx-auto px-4 py-8">
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

          <h1 className={heading.h1 + ' mb-2'}>添加耗材记录</h1>
          <p className="text-gray-600 dark:text-gray-400">记录包装、运输等耗材采购</p>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className={card.primary + ' p-6 shadow-2xl'}>
            <div className="space-y-5">
              <h2 className={heading.h3 + ' flex items-center gap-2'}>
                <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-indigo-500 rounded-full"></div>
                耗材信息
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    耗材分类 <span className="text-red-300">*</span>
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    required
                  >
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {errors.category && (
                    <p className="mt-1 text-sm text-red-300">{errors.category}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    采购日期 <span className="text-red-300">*</span>
                  </label>
                  <DatePicker
                    selected={formData.purchase_date ? new Date(formData.purchase_date) : null}
                    onChange={(date) => {
                      setFormData((prev) => ({
                        ...prev,
                        purchase_date: date ? date.toISOString().split('T')[0] : ''
                      }));
                    }}
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                  {errors.purchase_date && (
                    <p className="mt-1 text-sm text-red-300">{errors.purchase_date}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  金额 <span className="text-red-300">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount || ''}
                    onChange={handleNumberChange}
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    ref={amountRef}
                    className="w-full px-4 py-3 pr-12 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    required
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400">
                    ¥
                  </span>
                </div>
                {errors.amount && (
                  <p className="mt-1 text-sm text-red-300">{errors.amount}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  描述
                </label>
                <input
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="例: A4气泡袋 100个"
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  备注
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="添加备注信息..."
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none"
                />
              </div>
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
              className="flex-1 py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:transform-none"
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
                '保存耗材记录'
              )}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-8 py-4 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-xl transition-all border border-gray-300 dark:border-gray-600"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
