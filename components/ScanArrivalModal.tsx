// components/ScanArrivalModal.tsx — 扫码到货（对齐买取X /orders/scan）
// 扫一个 JAN → 列出这个 JAN 还有未到件数的进货（未到货 + 只到了一部分）：每笔可「N 个全部标记到货」或「只到部分」选数量；
// 底部「全部标记到货」一次记完所有笔。标记后可撤销（删掉刚记的到货明细），再「继续扫描」。到货明细与状态同步见 lib/api/arrivals.ts。
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { BarcodeDetector } from 'barcode-detector';
import { addArrival, deleteArrivals, findArrivalCandidates, type ArrivalTransaction } from '@/lib/api/arrivals';
import { arrivedQty, notArrivedQty } from '@/lib/utils/arrivals';
import { formatCurrency } from '@/lib/financial/calculator';
import { button } from '@/lib/theme';

interface ScanArrivalModalProps {
  onClose: () => void;
}

type Phase = 'scanning' | 'results';

interface ScanResult {
  jan: string;
  open: ArrivalTransaction[];
  arrivedCount: number;
  productName: string | null;
}

interface LastDone {
  arrivalIds: string[];
  message: string;
}

export default function ScanArrivalModal({ onClose }: ScanArrivalModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeRef = useRef(true);
  const phaseRef = useRef<Phase>('scanning');
  const cooldownRef = useRef(false);
  const handleDetectedRef = useRef<((code: string) => void) | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualInput, setManualInput] = useState('');

  const [phase, setPhase] = useState<Phase>('scanning');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [partialQty, setPartialQty] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [lastDone, setLastDone] = useState<LastDone | null>(null);
  const [error, setError] = useState('');
  const [successCount, setSuccessCount] = useState(0);
  const [flashSuccess, setFlashSuccess] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const load = useCallback(async (jan: string) => {
    const r = await findArrivalCandidates(jan);
    setResult({ jan, ...r });
    setPartialQty({});
    return r;
  }, []);

  const lookupJanCode = useCallback(async (code: string) => {
    cooldownRef.current = true;
    setError('');
    setLastDone(null);
    try {
      const r = await load(code);
      if (r.open.length === 0 && r.arrivedCount === 0) {
        setNotFound(true);
        navigator.vibrate?.([50, 50, 50]);
        setTimeout(() => {
          setNotFound(false);
          cooldownRef.current = false;
        }, 2000);
        return;
      }
      setPhase('results');
    } catch (e) {
      setError(e instanceof Error ? e.message : '查询失败，请检查网络连接');
      cooldownRef.current = false;
    }
  }, [load]);

  handleDetectedRef.current = (code: string) => {
    if (cooldownRef.current || phaseRef.current !== 'scanning') return;
    lookupJanCode(code);
  };

  // Camera + BarcodeDetector setup
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (!activeRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const track = stream.getVideoTracks()[0];
        const caps = track.getCapabilities?.() as any;
        if (caps?.torch) setTorchSupported(true);

        const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
        setCameraReady(true);

        interval = setInterval(async () => {
          if (!activeRef.current || !videoRef.current) return;
          if (phaseRef.current !== 'scanning' || cooldownRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0 && codes[0].rawValue) {
              handleDetectedRef.current?.(codes[0].rawValue);
            }
          } catch { /* per-frame errors ignored */ }
        }, 200);
      } catch (err: any) {
        if (!activeRef.current) return;
        setCameraError(
          err.name === 'NotAllowedError'
            ? '相机权限被拒绝，请在浏览器设置里允许使用相机。'
            : '无法启动相机，请确认没有其他应用正在占用相机。'
        );
      }
    };

    start();
    return () => {
      activeRef.current = false;
      if (interval) clearInterval(interval);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await (track as any).applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch { /* device doesn't support torch */ }
  }, [torchOn]);

  const handleManualSubmit = useCallback(() => {
    const code = manualInput.trim();
    if (!code || cooldownRef.current) return;
    setManualInput('');
    setManualMode(false);
    lookupJanCode(code);
  }, [manualInput, lookupJanCode]);

  /** 给若干笔记到货：[交易, 数量][] */
  const mark = useCallback(async (items: [ArrivalTransaction, number][]) => {
    if (!result || saving || items.length === 0) return;
    setSaving(true);
    setError('');
    const ids: string[] = [];
    let failed = 0;
    for (const [tx, qty] of items) {
      try {
        ids.push((await addArrival(tx.id, qty)).id);
      } catch {
        failed++;
      }
    }
    const total = items.reduce((sum, [, q]) => sum + q, 0);
    if (ids.length > 0) {
      navigator.vibrate?.(120);
      setFlashSuccess(true);
      setTimeout(() => setFlashSuccess(false), 500);
      setSuccessCount(c => c + 1);
      setLastDone({ arrivalIds: ids, message: `已标记到货${failed ? '' : ` ${total} 个`}` });
    }
    if (failed) setError(`${failed} 笔更新失败`);
    await load(result.jan).catch(() => undefined);
    setSaving(false);
  }, [result, saving, load]);

  const undo = useCallback(async () => {
    if (!lastDone || !result || saving) return;
    setSaving(true);
    try {
      await deleteArrivals(lastDone.arrivalIds);
      setLastDone(null);
      setSuccessCount(c => Math.max(0, c - 1));
      await load(result.jan);
    } catch (e) {
      setError(e instanceof Error ? e.message : '撤销失败');
    } finally {
      setSaving(false);
    }
  }, [lastDone, result, saving, load]);

  const scanNext = useCallback(() => {
    cooldownRef.current = false;
    setResult(null);
    setLastDone(null);
    setError('');
    setPhase('scanning');
  }, []);

  const open = result?.open ?? [];
  const totalOpenQty = open.reduce((sum, t) => sum + notArrivedQty(t), 0);

  return (
    <div className="fixed inset-0 z-[10002] bg-black flex flex-col">
      {/* Success flash */}
      {flashSuccess && (
        <div className="absolute inset-0 z-10 pointer-events-none" style={{ background: 'color-mix(in srgb, var(--color-primary) 25%, transparent)' }} />
      )}
      {/* Not-found flash */}
      {notFound && (
        <div className="absolute inset-0 z-10 pointer-events-none" style={{ background: 'color-mix(in srgb, var(--color-danger) 20%, transparent)' }} />
      )}

      {/* Top bar：pt 叠加 safe-area，避免 PWA 全屏下按钮被刘海遮挡 */}
      <div className="flex items-center justify-between px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] bg-black/70 z-20 flex-shrink-0">
        <div className="flex items-center gap-1">
          {/* Torch */}
          {torchSupported && (
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-lg transition-colors ${torchOn ? 'text-[var(--color-warning)]' : 'text-white/50 hover:text-white'}`}
              aria-label="手电筒"
            >
              <svg className="w-6 h-6" fill={torchOn ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </button>
          )}
          {/* Manual input toggle */}
          <button
            onClick={() => setManualMode(m => !m)}
            className={`p-2 rounded-lg transition-colors ${manualMode ? 'text-[var(--color-primary)]' : 'text-white/50 hover:text-white'}`}
            aria-label="手动输入 JAN"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>

        <p className="text-white text-sm font-medium">
          扫码到货
        </p>

        <div className="flex items-center gap-2">
          {successCount > 0 && (
            <span className="text-[var(--color-primary)] text-sm font-semibold">已到货 {successCount} 次</span>
          )}
          <button onClick={onClose} className="p-2 text-white/60 hover:text-white" aria-label="关闭">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Manual input bar */}
      {manualMode && (
        <div className="px-4 py-2 bg-black/80 flex gap-2 z-20 flex-shrink-0">
          <input
            type="number"
            inputMode="numeric"
            value={manualInput}
            onChange={e => setManualInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
            placeholder="JAN 条码（条码读不出来时）"
            autoFocus
            className="flex-1 bg-white/10 text-white placeholder-white/30 rounded-lg px-3 py-2 text-sm border border-white/20 focus:outline-none focus:border-[var(--color-primary)]"
          />
          <button
            onClick={handleManualSubmit}
            className="px-4 py-2 bg-[var(--color-primary-bg)] hover:bg-[var(--color-primary-bg-hover)] text-[var(--color-text-inverted)] rounded-lg text-sm font-medium transition-colors"
          >
            查询
          </button>
        </div>
      )}

      {/* Camera feed */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`w-full h-full object-cover transition-opacity duration-200 ${phase !== 'scanning' ? 'opacity-20' : 'opacity-100'}`}
        />

        {/* Viewfinder */}
        {cameraReady && !cameraError && phase === 'scanning' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-32 relative">
              <div className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 border-[var(--color-primary)] rounded-tl-sm" />
              <div className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 border-[var(--color-primary)] rounded-tr-sm" />
              <div className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 border-[var(--color-primary)] rounded-bl-sm" />
              <div className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 border-[var(--color-primary)] rounded-br-sm" />
              <div className="absolute inset-x-4 top-1/2 h-0.5 bg-[var(--color-primary-fill)] animate-pulse" />
            </div>
            <p className="absolute bottom-[calc(50%-80px)] text-white/50 text-xs">
              请将商品条码对准取景框
            </p>
          </div>
        )}

        {/* Not found toast */}
        {notFound && (
          <div className="absolute inset-x-0 bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] flex justify-center pointer-events-none">
            <div className="bg-[var(--color-danger-bg)] backdrop-blur-sm text-white text-sm px-5 py-2.5 rounded-full shadow-lg">
              没有这个 JAN 的未到货进货
            </div>
          </div>
        )}

        {/* Camera error */}
        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center px-6">
              <svg className="w-12 h-12 text-[var(--color-danger-on-black)] mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-white text-sm">{cameraError}</p>
            </div>
          </div>
        )}
      </div>

      {/* 扫描结果 */}
      {phase === 'results' && result && (
        <div className="bg-[var(--color-bg-elevated)] rounded-t-2xl shadow-[var(--shadow-lg)] flex flex-col max-h-[75vh] flex-shrink-0 pb-[env(safe-area-inset-bottom,0px)]">
          <div className="px-4 pt-4 pb-3 border-b border-[var(--color-border)]">
            <p className="font-semibold text-[var(--color-text)] text-sm line-clamp-2">
              {result.productName ?? '（无商品名）'}
            </p>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)] font-mono">{result.jan}</p>
            {open.length > 0 ? (
              <p className="mt-2 text-sm text-[var(--color-text)]">
                <span className="inline-flex items-center h-[22px] px-1.5 mr-2 rounded-[var(--radius-sm)] text-sm bg-[var(--label-warning-bg)] text-[var(--label-warning-fg)]">未到货</span>
                进货 {open.length} 笔 / 未到货 {totalOpenQty} 个
              </p>
            ) : (
              <div className="mt-2">
                <p className="text-sm font-semibold text-[var(--color-text)]">全部已到货</p>
                <p className="text-xs text-[var(--color-text-secondary)]">此 JAN 的 {result.arrivedCount} 笔进货已全部记录为到货。</p>
              </div>
            )}
            {lastDone && (
              <div className="mt-3 flex items-center justify-between rounded-[var(--radius-md)] bg-[var(--color-success-subtle)] px-3 py-2 text-sm text-[var(--color-success)]">
                <span>{lastDone.message}</span>
                <button onClick={undo} disabled={saving} className="font-semibold underline">撤销</button>
              </div>
            )}
            {error && <p className="mt-2 text-sm text-[var(--color-danger)]">{error}</p>}
          </div>

          <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3">
            {open.map(tx => {
              const remaining = notArrivedQty(tx);
              const arrived = arrivedQty(tx);
              const partial = Math.min(partialQty[tx.id] ?? 1, remaining);
              return (
                <div key={tx.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--color-text-secondary)]">
                    <span>{tx.date}</span>
                    <span>{tx.purchase_platforms?.name ?? '—'}</span>
                    {tx.payment_methods?.name && <span>{tx.payment_methods.name}</span>}
                    <span className="font-mono">{tx.order_number || '无订单号'}</span>
                  </div>
                  <p className="text-sm text-[var(--color-text)]">
                    {tx.unit_price != null && <span className="font-mono">{formatCurrency(tx.unit_price)} × {tx.quantity}</span>}
                    <span className="ml-2 text-[var(--color-warning)] font-semibold">未到货 {remaining} 个</span>
                    {arrived > 0 && <span className="ml-2 text-[var(--color-text-secondary)]">已到货 {arrived} 个</span>}
                  </p>
                  <button onClick={() => mark([[tx, remaining]])} disabled={saving} className={button.primary + ' w-full'}>
                    {remaining} 个全部标记到货
                  </button>
                  {remaining > 1 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--color-text-secondary)] shrink-0">只到部分</span>
                      <button
                        onClick={() => setPartialQty(m => ({ ...m, [tx.id]: Math.max(1, partial - 1) }))}
                        className={button.secondary + ' px-3'}
                        aria-label="减少数量"
                      >−</button>
                      <span className="w-8 text-center tabular-nums font-semibold text-[var(--color-text)]">{partial}</span>
                      <button
                        onClick={() => setPartialQty(m => ({ ...m, [tx.id]: Math.min(remaining - 1, partial + 1) }))}
                        className={button.secondary + ' px-3'}
                        aria-label="增加数量"
                      >+</button>
                      <button onClick={() => mark([[tx, partial]])} disabled={saving || partial >= remaining} className={button.secondary + ' flex-1'}>
                        到货
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="px-4 pt-2 pb-4 space-y-2 border-t border-[var(--color-border)]">
            {open.length > 1 && (
              <button
                onClick={() => mark(open.map(t => [t, notArrivedQty(t)] as [ArrivalTransaction, number]))}
                disabled={saving}
                className={button.primary + ' w-full'}
              >
                全部标记到货（{totalOpenQty} 个）
              </button>
            )}
            <button onClick={scanNext} disabled={saving} className={button.secondary + ' w-full'}>继续扫描</button>
          </div>
        </div>
      )}
    </div>
  );
}
