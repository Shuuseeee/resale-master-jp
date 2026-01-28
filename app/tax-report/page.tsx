// app/tax-report/page.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  generateTaxReportDetails,
  generateTaxReportSummary,
  getAvailableYears,
  type TaxReportDetail,
  type TaxReportSummary,
} from '@/lib/api/tax-report';
import { formatCurrency } from '@/lib/financial/calculator';
import { layout, heading, card, button, input, badge } from '@/lib/theme';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function TaxReportPage() {
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [summary, setSummary] = useState<TaxReportSummary | null>(null);
  const [details, setDetails] = useState<TaxReportDetail[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    loadAvailableYears();
  }, []);

  useEffect(() => {
    if (selectedYear) {
      loadTaxReport();
    }
  }, [selectedYear]);

  const loadAvailableYears = async () => {
    const years = await getAvailableYears();
    setAvailableYears(years);
    if (years.length > 0 && !years.includes(selectedYear)) {
      setSelectedYear(years[0]);
    }
  };

  const loadTaxReport = async () => {
    setLoading(true);
    try {
      const [summaryData, detailsData] = await Promise.all([
        generateTaxReportSummary(selectedYear),
        generateTaxReportDetails(selectedYear),
      ]);
      setSummary(summaryData);
      setDetails(detailsData);
      setCurrentPage(1);
    } catch (error) {
      console.error('加载税务报表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (!summary || details.length === 0) {
      alert('没有数据可导出');
      return;
    }

    setExporting(true);
    try {
      const workbook = XLSX.utils.book_new();

      // 创建汇总表
      const summaryData = [
        ['日本税务申报报表 - 年度汇总'],
        ['年度', summary.year],
        [],
        ['収入項目'],
        ['総売上高（现金）', summary.totalRevenue],
        ['積分収入', summary.totalPointsValue],
        ['総收入', summary.totalIncome],
        [],
        ['経費項目'],
        ['仕入れコスト', summary.purchaseCosts],
        ['平台手数料', summary.platformFees],
        ['送料', summary.shippingFees],
        ['耗材費', summary.suppliesCosts],
        ['必要経費合計', summary.totalExpenses],
        [],
        ['所得金額'],
        ['所得金額（収入 - 経費）', summary.netIncome],
        ['现金収入', summary.cashIncome],
        ['取引件数', summary.transactionCount],
      ];

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, '年度汇总');

      // 创建明细表
      const detailsData = [
        [
          '取引日',
          '商品名',
          '数量',
          '売却数',
          '購入価格',
          '売却価格',
          '平台手数料',
          '送料',
          '積分回報',
          '现金利益',
          '総利益',
          '備考',
        ],
        ...details.map(d => [
          d.transactionDate,
          d.productName,
          d.quantity,
          d.quantitySold,
          d.purchasePrice,
          d.sellingPrice,
          d.platformFee,
          d.shippingFee,
          d.pointsReward,
          d.cashProfit,
          d.totalProfit,
          d.notes,
        ]),
      ];

      const detailsSheet = XLSX.utils.aoa_to_sheet(detailsData);
      XLSX.utils.book_append_sheet(workbook, detailsSheet, '取引明细');

      // 导出文件
      XLSX.writeFile(workbook, `税务申报_${summary.year}年度.xlsx`);
    } catch (error) {
      console.error('导出Excel失败:', error);
      alert('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  };

  const exportToPDF = () => {
    if (!summary || details.length === 0) {
      alert('没有数据可导出');
      return;
    }

    setExporting(true);
    try {
      const doc = new jsPDF();

      // 添加中文字体支持（使用内置字体）
      doc.setFont('helvetica');

      // 标题
      doc.setFontSize(18);
      doc.text('Tax Report - Annual Summary', 105, 15, { align: 'center' });
      doc.setFontSize(14);
      doc.text(`Year: ${summary.year}`, 105, 25, { align: 'center' });

      // 年度汇总表
      doc.setFontSize(12);
      doc.text('Annual Summary', 14, 40);

      autoTable(doc, {
        startY: 45,
        head: [['Item', 'Amount (JPY)']],
        body: [
          ['Total Revenue (Cash)', formatCurrency(summary.totalRevenue)],
          ['Points Income', formatCurrency(summary.totalPointsValue)],
          ['Total Income', formatCurrency(summary.totalIncome)],
          ['Purchase Costs', formatCurrency(summary.purchaseCosts)],
          ['Platform Fees', formatCurrency(summary.platformFees)],
          ['Shipping Fees', formatCurrency(summary.shippingFees)],
          ['Supplies Costs', formatCurrency(summary.suppliesCosts)],
          ['Total Expenses', formatCurrency(summary.totalExpenses)],
          ['Net Income', formatCurrency(summary.netIncome)],
          ['Cash Income', formatCurrency(summary.cashIncome)],
          ['Transaction Count', summary.transactionCount.toString()],
        ],
        theme: 'grid',
        styles: { fontSize: 10 },
      });

      // 交易明细表
      doc.addPage();
      doc.setFontSize(12);
      doc.text('Transaction Details', 14, 15);

      autoTable(doc, {
        startY: 20,
        head: [
          [
            'Date',
            'Product',
            'Qty',
            'Purchase',
            'Selling',
            'Platform',
            'Shipping',
            'Points',
            'Profit',
          ],
        ],
        body: details.map(d => [
          d.transactionDate,
          d.productName.substring(0, 20),
          d.quantitySold.toString(),
          formatCurrency(d.purchasePrice),
          formatCurrency(d.sellingPrice),
          formatCurrency(d.platformFee),
          formatCurrency(d.shippingFee),
          formatCurrency(d.pointsReward),
          formatCurrency(d.totalProfit),
        ]),
        theme: 'grid',
        styles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 30 },
          2: { cellWidth: 15 },
          3: { cellWidth: 22 },
          4: { cellWidth: 22 },
          5: { cellWidth: 20 },
          6: { cellWidth: 20 },
          7: { cellWidth: 20 },
          8: { cellWidth: 22 },
        },
      });

      // 保存PDF
      doc.save(`税务申报_${summary.year}年度.pdf`);
    } catch (error) {
      console.error('导出PDF失败:', error);
      alert('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  };

  // 分页
  const totalPages = Math.ceil(details.length / itemsPerPage);
  const paginatedDetails = details.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading && !summary) {
    return (
      <div className={layout.page + ' flex items-center justify-center'}>
        <div className="flex items-center gap-3 text-gray-900 dark:text-white">
          <svg
            className="animate-spin h-8 w-8"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span className="text-xl">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={layout.page}>
      <div className={layout.container}>
        {/* 标题区域 */}
        <div className={layout.section}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className={heading.h1 + ' mb-2'}>税务申报报表</h1>
              <p className="text-gray-600 dark:text-gray-400">
                生成符合日本确定申告要求的年度报表
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className={input.base + ' w-32'}
                disabled={loading}
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>
                    {year}年
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {summary && (
          <>
            {/* 年度汇总卡片 */}
            <div className={card.primary + ' p-6 shadow-2xl mb-8'}>
              <div className="flex items-center justify-between mb-6">
                <h2 className={heading.h2}>
                  {selectedYear}年度 - 副業所得汇总
                </h2>
                <div className="flex gap-3">
                  <button
                    onClick={exportToExcel}
                    disabled={exporting || details.length === 0}
                    className={button.success + ' flex items-center gap-2'}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    {exporting ? '导出中...' : '导出Excel'}
                  </button>
                  <button
                    onClick={exportToPDF}
                    disabled={exporting || details.length === 0}
                    className={button.primary + ' flex items-center gap-2'}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>
                    {exporting ? '导出中...' : '导出PDF'}
                  </button>
                </div>
              </div>

              {/* 収入項目 */}
              <div className="mb-6">
                <h3 className={heading.h3 + ' mb-4 text-emerald-600 dark:text-emerald-400'}>
                  収入項目
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className={card.stat + ' border-emerald-500/30'}>
                    <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                      総売上高（现金）
                    </div>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(summary.totalRevenue)}
                    </div>
                  </div>
                  <div className={card.stat + ' border-amber-500/30'}>
                    <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                      積分収入
                    </div>
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                      {formatCurrency(summary.totalPointsValue)}
                    </div>
                  </div>
                  <div className={card.stat + ' border-blue-500/30'}>
                    <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                      総収入
                    </div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(summary.totalIncome)}
                    </div>
                  </div>
                </div>
              </div>

              {/* 経費項目 */}
              <div className="mb-6">
                <h3 className={heading.h3 + ' mb-4 text-red-600 dark:text-red-400'}>
                  必要経費
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className={card.stat}>
                    <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                      仕入れコスト
                    </div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(summary.purchaseCosts)}
                    </div>
                  </div>
                  <div className={card.stat}>
                    <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                      平台手数料
                    </div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(summary.platformFees)}
                    </div>
                  </div>
                  <div className={card.stat}>
                    <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                      送料
                    </div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(summary.shippingFees)}
                    </div>
                  </div>
                  <div className={card.stat}>
                    <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                      耗材費
                    </div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(summary.suppliesCosts)}
                    </div>
                  </div>
                  <div className={card.stat + ' border-red-500/30'}>
                    <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                      経費合計
                    </div>
                    <div className="text-xl font-bold text-red-600 dark:text-red-400">
                      {formatCurrency(summary.totalExpenses)}
                    </div>
                  </div>
                </div>
              </div>

              {/* 所得金額 */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <h3 className={heading.h3 + ' mb-4 text-indigo-600 dark:text-indigo-400'}>
                  副業所得
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className={card.stat + ' border-indigo-500/30'}>
                    <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                      所得金額（収入 - 経費）
                    </div>
                    <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(summary.netIncome)}
                    </div>
                  </div>
                  <div className={card.stat}>
                    <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                      现金収入
                    </div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(summary.cashIncome)}
                    </div>
                  </div>
                  <div className={card.stat}>
                    <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                      取引件数
                    </div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                      {summary.transactionCount}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 取引明细表 */}
            <div className={card.primary + ' shadow-2xl overflow-hidden'}>
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className={heading.h2}>取引明细書</h2>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  共 {details.length} 笔交易
                </p>
              </div>

              {details.length === 0 ? (
                <div className="p-12 text-center">
                  <svg
                    className="w-16 h-16 text-gray-600 dark:text-gray-400 mx-auto mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="text-gray-600 dark:text-gray-400 text-lg">
                    该年度暂无已售出交易记录
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                            取引日
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                            商品名
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                            数量
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                            購入価格
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                            売却価格
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                            手数料
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                            送料
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                            積分
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                            利益
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {paginatedDetails.map(detail => (
                          <tr
                            key={detail.transactionId}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          >
                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              {detail.transactionDate}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                              {detail.productName}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 text-center">
                              {detail.quantitySold}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right font-mono">
                              {formatCurrency(detail.purchasePrice)}
                            </td>
                            <td className="px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400 text-right font-mono">
                              {formatCurrency(detail.sellingPrice)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 text-right font-mono">
                              {formatCurrency(detail.platformFee)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 text-right font-mono">
                              {formatCurrency(detail.shippingFee)}
                            </td>
                            <td className="px-4 py-3 text-sm text-amber-600 dark:text-amber-400 text-right font-mono">
                              {formatCurrency(detail.pointsReward)}
                            </td>
                            <td
                              className={`px-4 py-3 text-sm text-right font-mono font-semibold ${
                                detail.totalProfit >= 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-red-600 dark:text-red-400'
                              }`}
                            >
                              {formatCurrency(detail.totalProfit)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* 分页 */}
                  {totalPages > 1 && (
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        显示 {(currentPage - 1) * itemsPerPage + 1} 到{' '}
                        {Math.min(currentPage * itemsPerPage, details.length)} 条，共{' '}
                        {details.length} 条
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className={button.secondary}
                        >
                          上一页
                        </button>
                        <span className="px-4 py-2 text-gray-900 dark:text-white">
                          {currentPage} / {totalPages}
                        </span>
                        <button
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className={button.secondary}
                        >
                          下一页
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
