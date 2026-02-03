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
import { loadJapaneseFont } from '@/lib/pdf-font-loader';

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
      alert('エクスポートするデータがありません');
      return;
    }

    setExporting(true);
    try {
      const workbook = XLSX.utils.book_new();

      // 年度集計表を作成
      const summaryData = [
        ['確定申告レポート - 年度集計表'],
        ['年度', summary.year],
        [],
        ['収入の部'],
        ['売上高（現金）', summary.totalRevenue],
        ['ポイント収入', summary.totalPointsValue],
        ['総収入', summary.totalIncome],
        [],
        ['必要経費の部'],
        ['仕入費', summary.purchaseCosts],
        ['販売手数料', summary.platformFees],
        ['送料', summary.shippingFees],
        ['消耗品費', summary.suppliesCosts],
        ['必要経費合計', summary.totalExpenses],
        [],
        ['所得金額'],
        ['雑所得金額（収入 - 経費）', summary.netIncome],
        ['現金収入', summary.cashIncome],
        ['取引件数', summary.transactionCount],
      ];

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, '年度集計');

      // 明細表を作成
      const detailsData = [
        [
          '販売日',
          '購入日',
          '商品名',
          '数量',
          '売却数',
          '購入価格',
          '売却価格',
          '販売手数料',
          '送料',
          'ポイント還元',
          '現金利益',
          '総利益',
          '備考',
        ],
        ...details.map(d => [
          d.saleDate,
          d.purchaseDate,
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
      XLSX.utils.book_append_sheet(workbook, detailsSheet, '取引明細');

      // ファイルをエクスポート
      XLSX.writeFile(workbook, `確定申告レポート_${summary.year}年度.xlsx`);
    } catch (error) {
      console.error('Excelエクスポート失敗:', error);
      alert('エクスポートに失敗しました。もう一度お試しください');
    } finally {
      setExporting(false);
    }
  };

  const exportToPDF = async () => {
    if (!summary || details.length === 0) {
      alert('エクスポートするデータがありません');
      return;
    }

    setExporting(true);
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // 日本語フォントを読み込み
      await loadJapaneseFont(doc);

      // タイトル
      doc.setFontSize(16);
      doc.text('確定申告レポート - 年度集計表', 105, 15, { align: 'center' });
      doc.setFontSize(12);
      doc.text(`${summary.year}年度`, 105, 23, { align: 'center' });

      // 年度集計表
      doc.setFontSize(11);
      doc.text('年度集計', 14, 35);

      autoTable(doc, {
        startY: 40,
        head: [['項目', '金額（円）']],
        body: [
          ['売上高（現金）', formatCurrency(summary.totalRevenue)],
          ['ポイント収入', formatCurrency(summary.totalPointsValue)],
          ['総収入', formatCurrency(summary.totalIncome)],
          ['仕入費', formatCurrency(summary.purchaseCosts)],
          ['販売手数料', formatCurrency(summary.platformFees)],
          ['送料', formatCurrency(summary.shippingFees)],
          ['消耗品費', formatCurrency(summary.suppliesCosts)],
          ['必要経費合計', formatCurrency(summary.totalExpenses)],
          ['雑所得金額', formatCurrency(summary.netIncome)],
          ['現金収入', formatCurrency(summary.cashIncome)],
          ['取引件数', summary.transactionCount.toString() + '件'],
        ],
        theme: 'grid',
        styles: {
          font: 'NotoSansJP',
          fontSize: 9,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [66, 139, 202],
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center',
        },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 80, halign: 'right' },
        },
        margin: { left: 25, right: 25 },
      });

      // 取引明細表
      doc.addPage();
      doc.setFontSize(11);
      doc.text('取引明細書', 14, 15);

      autoTable(doc, {
        startY: 22,
        head: [
          [
            '販売日',
            '商品名',
            '数量',
            '購入価格',
            '売却価格',
            '手数料',
            '送料',
            'ポイント',
            '利益',
          ],
        ],
        body: details.map(d => [
          d.saleDate,
          d.productName,
          d.quantitySold.toString(),
          formatCurrency(d.purchasePrice),
          formatCurrency(d.sellingPrice),
          formatCurrency(d.platformFee),
          formatCurrency(d.shippingFee),
          formatCurrency(d.pointsReward),
          formatCurrency(d.totalProfit),
        ]),
        theme: 'grid',
        styles: {
          font: 'NotoSansJP',
          fontSize: 7,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [66, 139, 202],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 7,
          halign: 'center',
        },
        columnStyles: {
          0: { cellWidth: 22, halign: 'center' },
          1: { cellWidth: 35 },
          2: { cellWidth: 12, halign: 'center' },
          3: { cellWidth: 20, halign: 'right' },
          4: { cellWidth: 20, halign: 'right' },
          5: { cellWidth: 18, halign: 'right' },
          6: { cellWidth: 18, halign: 'right' },
          7: { cellWidth: 18, halign: 'right' },
          8: { cellWidth: 22, halign: 'right' },
        },
        margin: { left: 7, right: 7 },
      });

      doc.save(`確定申告レポート_${summary.year}年度.pdf`);
    } catch (error) {
      console.error('PDFエクスポート失敗:', error);
      alert('エクスポートに失敗しました。もう一度お試しください');
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
          <span className="text-xl">読み込み中...</span>
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
              <h1 className={heading.h1 + ' mb-2'}>確定申告レポート</h1>
              <p className="text-gray-600 dark:text-gray-400">
                確定申告に必要な年度別収支報告書を作成
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className={input.base + ' w-full sm:w-32'}
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
                  {selectedYear}年度 雑所得集計表
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
                    {exporting ? 'エクスポート中...' : 'Excelエクスポート'}
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
                    {exporting ? 'エクスポート中...' : 'PDFエクスポート'}
                  </button>
                </div>
              </div>

              {/* 収入の部 */}
              <div className="mb-6">
                <h3 className={heading.h3 + ' mb-4 text-emerald-600 dark:text-emerald-300'}>
                  収入の部
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className={card.stat + ' border-emerald-500/30'}>
                    <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                      売上高（現金）
                    </div>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">
                      {formatCurrency(summary.totalRevenue)}
                    </div>
                  </div>
                  <div className={card.stat + ' border-amber-500/30'}>
                    <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                      ポイント収入
                    </div>
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-300">
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

              {/* 必要経費の部 */}
              <div className="mb-6">
                <h3 className={heading.h3 + ' mb-4 text-red-600 dark:text-red-300'}>
                  必要経費の部
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className={card.stat}>
                    <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                      仕入費
                    </div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(summary.purchaseCosts)}
                    </div>
                  </div>
                  <div className={card.stat}>
                    <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                      販売手数料
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
                      消耗品費
                    </div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(summary.suppliesCosts)}
                    </div>
                  </div>
                  <div className={card.stat + ' border-red-500/30'}>
                    <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                      経費合計
                    </div>
                    <div className="text-xl font-bold text-red-600 dark:text-red-300">
                      {formatCurrency(summary.totalExpenses)}
                    </div>
                  </div>
                </div>
              </div>

              {/* 所得金額 */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <h3 className={heading.h3 + ' mb-4 text-indigo-600 dark:text-indigo-400'}>
                  所得金額
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className={card.stat + ' border-indigo-500/30'}>
                    <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                      雑所得金額（収入 - 経費）
                    </div>
                    <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(summary.netIncome)}
                    </div>
                  </div>
                  <div className={card.stat}>
                    <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">
                      現金収入
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

            {/* 取引明細表 */}
            <div className={card.primary + ' shadow-2xl overflow-hidden'}>
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className={heading.h2}>取引明細書</h2>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  合計 {details.length} 件の取引
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
                    該当年度の売却済み取引はありません
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                            販売日
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
                            ポイント
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                            利益
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {paginatedDetails.map(detail => (
                          <tr
                            key={detail.saleRecordId}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          >
                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              {detail.saleDate}
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
                            <td className="px-4 py-3 text-sm text-emerald-600 dark:text-emerald-300 text-right font-mono">
                              {formatCurrency(detail.sellingPrice)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 text-right font-mono">
                              {formatCurrency(detail.platformFee)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 text-right font-mono">
                              {formatCurrency(detail.shippingFee)}
                            </td>
                            <td className="px-4 py-3 text-sm text-amber-600 dark:text-amber-300 text-right font-mono">
                              {formatCurrency(detail.pointsReward)}
                            </td>
                            <td
                              className={`px-4 py-3 text-sm text-right font-mono font-semibold ${
                                detail.totalProfit >= 0
                                  ? 'text-emerald-600 dark:text-emerald-300'
                                  : 'text-red-600 dark:text-red-300'
                              }`}
                            >
                              {formatCurrency(detail.totalProfit)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* ページネーション */}
                  {totalPages > 1 && (
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {(currentPage - 1) * itemsPerPage + 1} 〜{' '}
                        {Math.min(currentPage * itemsPerPage, details.length)} 件を表示（全{' '}
                        {details.length} 件）
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className={button.secondary}
                        >
                          前へ
                        </button>
                        <span className="px-4 py-2 text-gray-900 dark:text-white">
                          {currentPage} / {totalPages}
                        </span>
                        <button
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className={button.secondary}
                        >
                          次へ
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
