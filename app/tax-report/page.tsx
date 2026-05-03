// app/tax-report/page.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  generateTaxReportDetails,
  generateTaxInventoryItems,
  generateTaxReportSummary,
  getAvailableYears,
  type TaxReportDetail,
  type TaxInventoryItem,
  type TaxReportSummary,
} from '@/lib/api/tax-report';
import { formatCurrency } from '@/lib/financial/calculator';
import { layout, heading, card, button, input } from '@/lib/theme';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadJapaneseFont } from '@/lib/pdf-font-loader';

const reportCardClass = 'sn-detail-card';
const statLabelClass = 'text-sm text-[var(--color-text-muted)] mb-1';
const statValueClass = 'font-bold text-[var(--color-text)]';
const tableHeadClass = 'px-4 py-3 text-xs font-semibold uppercase text-[var(--color-text-muted)]';
const tableCellClass = 'px-4 py-3 text-sm text-[var(--color-text)]';

export default function TaxReportPage() {
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [summary, setSummary] = useState<TaxReportSummary | null>(null);
  const [details, setDetails] = useState<TaxReportDetail[]>([]);
  const [inventoryItems, setInventoryItems] = useState<TaxInventoryItem[]>([]);
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
      const inventoryData = await generateTaxInventoryItems(selectedYear);
      setSummary(summaryData);
      setDetails(detailsData);
      setInventoryItems(inventoryData);
      setCurrentPage(1);
    } catch (error) {
      console.error('加载税务报表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (!summary || details.length === 0) {
      alert('没有可导出的数据');
      return;
    }

    setExporting(true);
    try {
      const workbook = XLSX.utils.book_new();

      // 申告入力用サマリー
      const summaryData = [
        ['確定申告入力用サマリー'],
        ['年度', summary.year],
        [],
        ['収入の部'],
        ['売上高（現金）', summary.totalRevenue],
        ['ポイント相当額', summary.totalPointsValue],
        ['収入合計', summary.totalIncome],
        [],
        ['必要経費の部'],
        ['仕入金額（売上原価按分）', summary.purchaseCosts],
        ['販売手数料', summary.platformFees],
        ['送料', summary.shippingFees],
        ['消耗品費', summary.suppliesCosts],
        ['必要経費合計', summary.totalExpenses],
        [],
        ['所得金額'],
        ['雑所得金額（収入 - 経費）', summary.netIncome],
        ['現金ベース収支', summary.cashIncome],
        ['販売記録件数', summary.transactionCount],
        ['期末棚卸数量（参考）', summary.endingInventoryQuantity],
        ['期末棚卸金額（参考）', summary.endingInventoryValue],
        [],
        ['注記'],
        ['本資料は申告入力・記帳・税理士確認用の補助資料です。税務署への提出書類そのものではありません。'],
        ['ポイント相当額、売上原価、期末棚卸資産、消耗品費の取扱いは、実際の申告方針または税理士の判断に合わせて確認してください。'],
        ['期末棚卸は、購入日が年度末以前で、年度末までの販売・返品数量を差し引いた参考値です。'],
      ];

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, '申告入力用サマリー');

      // 保存用取引台帳
      const detailsData = [
        [
          '販売日',
          '購入日',
          '購入先',
          '商品名',
          'JAN',
          '仕入注文番号',
          '販売注文番号',
          '数量',
          '販売数量',
          '仕入単価',
          '販売単価',
          '仕入金額',
          '売却価格',
          '販売先',
          '販売手数料',
          '送料',
          'ポイント相当額',
          '現金利益',
          '総利益',
          '備考',
        ],
        ...details.map(d => [
          d.saleDate,
          d.purchaseDate,
          d.purchasePlatformName || '',
          d.productName,
          d.janCode,
          d.purchaseOrderNumber,
          d.saleOrderNumber,
          d.quantity,
          d.quantitySold,
          d.purchaseUnitPrice,
          d.sellingPricePerUnit,
          d.purchasePrice,
          d.sellingPrice,
          d.sellingPlatformName || '',
          d.platformFee,
          d.shippingFee,
          d.pointsReward,
          d.cashProfit,
          d.totalProfit,
          d.notes,
        ]),
      ];

      const detailsSheet = XLSX.utils.aoa_to_sheet(detailsData);
      XLSX.utils.book_append_sheet(workbook, detailsSheet, '保存用取引台帳');

      // 年末棚卸参考表
      const inventoryData = [
        [
          '仕入日',
          '購入先',
          '商品名',
          'JAN',
          '仕入注文番号',
          '仕入数量',
          '年度末までの販売数量',
          '年度末までの返品数量',
          '期末数量',
          '仕入単価',
          '期末棚卸金額',
          '備考',
        ],
        ...inventoryItems.map(item => [
          item.purchaseDate,
          item.purchasePlatformName || '',
          item.productName,
          item.janCode,
          item.purchaseOrderNumber,
          item.quantityPurchased,
          item.quantitySoldByYearEnd,
          item.quantityReturnedByYearEnd,
          item.endingQuantity,
          item.unitCost,
          item.endingInventoryValue,
          item.notes,
        ]),
      ];

      const inventorySheet = XLSX.utils.aoa_to_sheet(inventoryData);
      XLSX.utils.book_append_sheet(workbook, inventorySheet, '期末棚卸参考表');

      XLSX.writeFile(workbook, `kakutei_shinkoku_${summary.year}_support.xlsx`);
    } catch (error) {
      console.error('Excel导出失败:', error);
      alert('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  };

  const exportToPDF = async () => {
    if (!summary || details.length === 0) {
      alert('没有可导出的数据');
      return;
    }

    setExporting(true);
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      // 加载 CJK 字体
      await loadJapaneseFont(doc);

      doc.setFontSize(16);
      doc.text('確定申告入力用サマリー', 105, 15, { align: 'center' });
      doc.setFontSize(12);
      doc.text(`${summary.year}年度`, 105, 23, { align: 'center' });

      doc.setFontSize(11);
      doc.text('申告入力用サマリー', 14, 35);

      autoTable(doc, {
        startY: 40,
        head: [['項目', '金額（円）']],
        body: [
          ['売上高（現金）', formatCurrency(summary.totalRevenue)],
          ['ポイント相当額', formatCurrency(summary.totalPointsValue)],
          ['収入合計', formatCurrency(summary.totalIncome)],
          ['仕入金額（売上原価按分）', formatCurrency(summary.purchaseCosts)],
          ['販売手数料', formatCurrency(summary.platformFees)],
          ['送料', formatCurrency(summary.shippingFees)],
          ['消耗品費', formatCurrency(summary.suppliesCosts)],
          ['必要経費合計', formatCurrency(summary.totalExpenses)],
          ['雑所得金額', formatCurrency(summary.netIncome)],
          ['現金ベース収支', formatCurrency(summary.cashIncome)],
          ['販売記録件数', summary.transactionCount.toString() + '件'],
          ['期末棚卸数量（参考）', summary.endingInventoryQuantity.toString() + '点'],
          ['期末棚卸金額（参考）', formatCurrency(summary.endingInventoryValue)],
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

      doc.addPage();
      doc.setFontSize(11);
      doc.text('保存用取引台帳', 14, 15);

      autoTable(doc, {
        startY: 22,
        head: [
          [
            '販売日',
            '購入先',
            '商品名',
            'JAN',
            '数量',
            '仕入金額',
            '売却価格',
            '販売先',
            '手数料',
            '送料',
            'ポイント',
            '利益',
          ],
        ],
        body: details.map(d => [
          d.saleDate,
          d.purchasePlatformName || '',
          d.productName,
          d.janCode,
          d.quantitySold.toString(),
          formatCurrency(d.purchasePrice),
          formatCurrency(d.sellingPrice),
          d.sellingPlatformName || '',
          formatCurrency(d.platformFee),
          formatCurrency(d.shippingFee),
          formatCurrency(d.pointsReward),
          formatCurrency(d.totalProfit),
        ]),
        theme: 'grid',
        styles: {
          font: 'NotoSansJP',
          fontSize: 6,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [66, 139, 202],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 6,
          halign: 'center',
        },
        columnStyles: {
          0: { cellWidth: 18, halign: 'center' },
          1: { cellWidth: 18 },
          2: { cellWidth: 28 },
          3: { cellWidth: 20 },
          4: { cellWidth: 9, halign: 'center' },
          5: { cellWidth: 17, halign: 'right' },
          6: { cellWidth: 17, halign: 'right' },
          7: { cellWidth: 18 },
          8: { cellWidth: 15, halign: 'right' },
          9: { cellWidth: 15, halign: 'right' },
          10: { cellWidth: 15, halign: 'right' },
          11: { cellWidth: 19, halign: 'right' },
        },
        margin: { left: 5, right: 5 },
      });

      doc.addPage();
      doc.setFontSize(11);
      doc.text('期末棚卸参考表', 14, 15);

      autoTable(doc, {
        startY: 22,
        head: [
          [
            '仕入日',
            '購入先',
            '商品名',
            'JAN',
            '期末数量',
            '仕入単価',
            '棚卸金額',
          ],
        ],
        body: inventoryItems.map(item => [
          item.purchaseDate,
          item.purchasePlatformName || '',
          item.productName,
          item.janCode,
          item.endingQuantity.toString(),
          formatCurrency(item.unitCost),
          formatCurrency(item.endingInventoryValue),
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
          1: { cellWidth: 28 },
          2: { cellWidth: 56 },
          3: { cellWidth: 28 },
          4: { cellWidth: 18, halign: 'center' },
          5: { cellWidth: 28, halign: 'right' },
          6: { cellWidth: 30, halign: 'right' },
        },
        margin: { left: 14, right: 14 },
      });

      doc.save(`kakutei_shinkoku_${summary.year}_support.pdf`);
    } catch (error) {
      console.error('PDF导出失败:', error);
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
        <div className="flex items-center gap-3 text-[var(--color-text)]">
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
              <h1 className={heading.h1 + ' mb-2'}>税务申报报告</h1>
              <p className="text-[var(--color-text-muted)]">
                页面用于中文操作；导出的 Excel/PDF 使用日本报税资料语境的日文术语和文件名。
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
            <div className="mb-8 rounded-[var(--radius-lg)] border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.08)] p-4 text-sm text-[var(--color-text)]">
              <div className="mb-2 font-semibold text-[var(--color-warning)]">日本报税说明</div>
              <p className="leading-relaxed text-[var(--color-text-muted)]">
                导出资料定位为申告输入、记账保存和税理士核对用的补助资料，不等同于默认需要把全部交易明细提交给国税厅。积分相当额、売上原価、期末棚卸资产和消耗品费的处理会影响申告口径，请按实际申告方针或税理士意见确认。
              </p>
            </div>

            {/* 年度汇总卡片 */}
            <div className={reportCardClass + ' mb-8'}>
              <div className="flex items-center justify-between mb-6">
                <h2 className={heading.h2}>
                  {selectedYear}年度 申告输入用汇总
                </h2>
                <div className="flex gap-3">
                  <button
                    onClick={exportToExcel}
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
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    {exporting ? '导出中...' : '日文 Excel 导出'}
                  </button>
                  <button
                    onClick={exportToPDF}
                    disabled={exporting || details.length === 0}
                    className={button.secondary + ' flex items-center gap-2'}
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
                    {exporting ? '导出中...' : '日文 PDF 导出'}
                  </button>
                </div>
              </div>

              {/* 收入 */}
              <div className="mb-6">
                <h3 className="mb-4 text-[17px] font-semibold text-[var(--color-primary)]">
                  收入
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className={card.stat + ' border-[rgba(16,185,129,0.3)]'}>
                    <div className={statLabelClass}>
                      销售额（现金）
                    </div>
                    <div className="text-2xl font-bold text-[var(--color-primary)]">
                      {formatCurrency(summary.totalRevenue)}
                    </div>
                  </div>
                  <div className={card.stat + ' border-[rgba(245,158,11,0.3)]'}>
                    <div className={statLabelClass}>
                      积分相当额
                    </div>
                    <div className="text-2xl font-bold text-[var(--color-warning)]">
                      {formatCurrency(summary.totalPointsValue)}
                    </div>
                  </div>
                  <div className={card.stat + ' border-[rgba(59,130,246,0.3)]'}>
                    <div className={statLabelClass}>
                      收入合计
                    </div>
                    <div className="text-2xl font-bold text-[var(--color-info)]">
                      {formatCurrency(summary.totalIncome)}
                    </div>
                  </div>
                </div>
              </div>

              {/* 必要经费 */}
              <div className="mb-6">
                <h3 className="mb-4 text-[17px] font-semibold text-[var(--color-danger)]">
                  必要经费
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className={card.stat}>
                    <div className={statLabelClass}>
                      采购成本（售出按分）
                    </div>
                    <div className={'text-xl ' + statValueClass}>
                      {formatCurrency(summary.purchaseCosts)}
                    </div>
                  </div>
                  <div className={card.stat}>
                    <div className={statLabelClass}>
                      平台手续费
                    </div>
                    <div className={'text-xl ' + statValueClass}>
                      {formatCurrency(summary.platformFees)}
                    </div>
                  </div>
                  <div className={card.stat}>
                    <div className={statLabelClass}>
                      运费
                    </div>
                    <div className={'text-xl ' + statValueClass}>
                      {formatCurrency(summary.shippingFees)}
                    </div>
                  </div>
                  <div className={card.stat}>
                    <div className={statLabelClass}>
                      耗材成本
                    </div>
                    <div className={'text-xl ' + statValueClass}>
                      {formatCurrency(summary.suppliesCosts)}
                    </div>
                  </div>
                  <div className={card.stat + ' border-[rgba(239,68,68,0.3)]'}>
                    <div className={statLabelClass}>
                      经费合计
                    </div>
                    <div className="text-xl font-bold text-[var(--color-danger)]">
                      {formatCurrency(summary.totalExpenses)}
                    </div>
                  </div>
                </div>
              </div>

              {/* 所得金额 */}
              <div className="border-t border-[var(--color-border)] pt-6">
                <h3 className="mb-4 text-[17px] font-semibold text-[var(--color-info)]">
                  所得金额
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className={card.stat + ' border-[rgba(59,130,246,0.3)]'}>
                    <div className={statLabelClass}>
                      杂项所得估算（收入 - 经费）
                    </div>
                    <div className="text-3xl font-bold text-[var(--color-info)]">
                      {formatCurrency(summary.netIncome)}
                    </div>
                  </div>
                  <div className={card.stat}>
                    <div className={statLabelClass}>
                      现金收入
                    </div>
                    <div className={'text-3xl ' + statValueClass}>
                      {formatCurrency(summary.cashIncome)}
                    </div>
                  </div>
                  <div className={card.stat}>
                    <div className={statLabelClass}>
                      交易件数
                    </div>
                    <div className={'text-3xl ' + statValueClass}>
                      {summary.transactionCount}
                    </div>
                  </div>
                  <div className={card.stat}>
                    <div className={statLabelClass}>
                      期末棚卸数量（参考）
                    </div>
                    <div className={'text-3xl ' + statValueClass}>
                      {summary.endingInventoryQuantity}
                    </div>
                  </div>
                  <div className={card.stat + ' border-[rgba(245,158,11,0.3)]'}>
                    <div className={statLabelClass}>
                      期末棚卸金额（参考）
                    </div>
                    <div className="text-3xl font-bold text-[var(--color-warning)]">
                      {formatCurrency(summary.endingInventoryValue)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 交易明细表 */}
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-[var(--shadow-sm)]">
              <div className="p-6 border-b border-[var(--color-border)]">
                <h2 className={heading.h2}>交易明细表</h2>
                <p className="text-[var(--color-text-muted)] mt-2">
                  共 {details.length} 条销售记录；导出文件会追加保存用取引台帳和期末棚卸参考表。
                </p>
              </div>

              {details.length === 0 ? (
                <div className="p-12 text-center">
                  <svg
                    className="w-16 h-16 text-[var(--color-text-muted)] mx-auto mb-4"
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
                  <p className="text-[var(--color-text-muted)] text-lg">
                    该年度没有已售出的交易
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[var(--color-bg-subtle)]">
                        <tr>
                          <th className={tableHeadClass + ' text-left'}>
                            销售日
                          </th>
                          <th className={tableHeadClass + ' text-left'}>
                            采购平台
                          </th>
                          <th className={tableHeadClass + ' text-left'}>
                            商品名
                          </th>
                          <th className={tableHeadClass + ' text-left'}>
                            JAN
                          </th>
                          <th className={tableHeadClass + ' text-left'}>
                            订单号
                          </th>
                          <th className={tableHeadClass + ' text-center'}>
                            数量
                          </th>
                          <th className={tableHeadClass + ' text-right'}>
                            采购价格
                          </th>
                          <th className={tableHeadClass + ' text-right'}>
                            销售价格
                          </th>
                          <th className={tableHeadClass + ' text-left'}>
                            销售平台
                          </th>
                          <th className={tableHeadClass + ' text-right'}>
                            手续费
                          </th>
                          <th className={tableHeadClass + ' text-right'}>
                            运费
                          </th>
                          <th className={tableHeadClass + ' text-right'}>
                            积分
                          </th>
                          <th className={tableHeadClass + ' text-right'}>
                            利润
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {paginatedDetails.map(detail => (
                          <tr
                            key={detail.saleRecordId}
                            className="active:opacity-80 transition-colors"
                          >
                            <td className={tableCellClass + ' whitespace-nowrap'}>
                              {detail.saleDate}
                            </td>
                            <td className={tableCellClass + ' whitespace-nowrap'}>
                              {detail.purchasePlatformName || '-'}
                            </td>
                            <td className={tableCellClass}>
                              {detail.productName}
                            </td>
                            <td className={tableCellClass + ' whitespace-nowrap font-mono'}>
                              {detail.janCode || '-'}
                            </td>
                            <td className={tableCellClass + ' whitespace-nowrap'}>
                              {detail.saleOrderNumber || detail.purchaseOrderNumber || '-'}
                            </td>
                            <td className={tableCellClass + ' text-center'}>
                              {detail.quantitySold}
                            </td>
                            <td className={tableCellClass + ' text-right font-mono'}>
                              {formatCurrency(detail.purchasePrice)}
                            </td>
                            <td className="px-4 py-3 text-sm text-[var(--color-primary)] text-right font-mono">
                              {formatCurrency(detail.sellingPrice)}
                            </td>
                            <td className={tableCellClass + ' whitespace-nowrap'}>
                              {detail.sellingPlatformName || '-'}
                            </td>
                            <td className={tableCellClass + ' text-right font-mono'}>
                              {formatCurrency(detail.platformFee)}
                            </td>
                            <td className={tableCellClass + ' text-right font-mono'}>
                              {formatCurrency(detail.shippingFee)}
                            </td>
                            <td className="px-4 py-3 text-sm text-[var(--color-warning)] text-right font-mono">
                              {formatCurrency(detail.pointsReward)}
                            </td>
                            <td
                              className={`px-4 py-3 text-sm text-right font-mono font-semibold ${
                                detail.totalProfit >= 0
                                  ? 'text-[var(--color-primary)]'
                                  : 'text-[var(--color-danger)]'
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
                    <div className="p-4 border-t border-[var(--color-border)] flex items-center justify-between">
                      <div className="text-sm text-[var(--color-text-muted)]">
                        {(currentPage - 1) * itemsPerPage + 1} -{' '}
                        {Math.min(currentPage * itemsPerPage, details.length)} / 共{' '}
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
                        <span className="px-4 py-2 text-[var(--color-text)]">
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
