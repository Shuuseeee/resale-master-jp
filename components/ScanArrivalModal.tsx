// components/ScanArrivalModal.tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { BarcodeDetector } from 'barcode-detector';
import { getTransactionsByJanCode, markTransactionArrived, type PendingArrivalTransaction } from '@/lib/api/financial';

interface ScanArrivalModalProps {
  onClose: () => void;
}

type Phase = 'scanning' | 'results' | 'confirming';

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
  const [matches, setMatches] = useState<PendingArrivalTransaction[]>([]);
  const [selected, setSelected] = useState<PendingArrivalTransaction | null>(null);
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const [flashSuccess, setFlashSuccess] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const lookupJanCode = useCallback(async (code: string) => {
    cooldownRef.current = true;
    const txs = await getTransactionsByJanCode(code);

    if (txs.length === 0) {
      setNotFound(true);
      setTimeout(() => {
        setNotFound(false);
        cooldownRef.current = false;
      }, 2000);
      navigator.vibrate?.([50, 50, 50]);
      return;
    }

    setMatches(txs);
    if (txs.length === 1) {
      setSelected(txs[0]);
      setQty(txs[0].quantity);
      setPhase('confirming');
    } else {
      setPhase('results');
    }
  }, []);

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
            ? 'カメラのアクセスが拒否されました。設定から許可してください。'
            : 'カメラを起動できませんでした。'
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

  const handleSelectTransaction = useCallback((tx: PendingArrivalTransaction) => {
    setSelected(tx);
    setQty(tx.quantity);
    setPhase('confirming');
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!selected || saving) return;
    setSaving(true);
    const ok = await markTransactionArrived(selected.id);
    setSaving(false);

    if (ok) {
      navigator.vibrate?.(120);
      setFlashSuccess(true);
      setTimeout(() => setFlashSuccess(false), 500);
      setSuccessCount(c => c + 1);
    } else {
      alert('着荷確認に失敗しました。もう一度試してください。');
    }

    cooldownRef.current = false;
    setSelected(null);
    setMatches([]);
    setPhase('scanning');
  }, [selected, saving]);

  const handleBack = useCallback(() => {
    cooldownRef.current = false;
    setSelected(null);
    setMatches([]);
    setPhase('scanning');
  }, []);

  return (
    <div className="fixed inset-0 z-[10002] bg-black flex flex-col">
      {/* Success flash */}
      {flashSuccess && (
        <div className="absolute inset-0 z-10 bg-apple-blue/25 pointer-events-none" />
      )}
      {/* Not-found flash */}
      {notFound && (
        <div className="absolute inset-0 z-10 bg-red-500/20 pointer-events-none" />
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/70 z-20 flex-shrink-0">
        <div className="flex items-center gap-1">
          {/* Torch */}
          {torchSupported && (
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-lg transition-colors ${torchOn ? 'text-yellow-400' : 'text-white/50 hover:text-white'}`}
              aria-label="フラッシュ"
            >
              <svg className="w-6 h-6" fill={torchOn ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </button>
          )}
          {/* Manual input toggle */}
          <button
            onClick={() => setManualMode(m => !m)}
            className={`p-2 rounded-lg transition-colors ${manualMode ? 'text-apple-blue' : 'text-white/50 hover:text-white'}`}
            aria-label="手動入力"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>

        <p className="text-white text-sm font-medium">
          {phase === 'scanning' ? 'バーコードをスキャン' : phase === 'results' ? '取引を選択' : '着荷確認'}
        </p>

        <div className="flex items-center gap-2">
          {successCount > 0 && (
            <span className="text-apple-blue text-sm font-semibold">{successCount}件✓</span>
          )}
          <button onClick={onClose} className="p-2 text-white/60 hover:text-white" aria-label="閉じる">
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
            placeholder="JANコードを入力..."
            autoFocus
            className="flex-1 bg-white/10 text-white placeholder-white/30 rounded-lg px-3 py-2 text-sm border border-white/20 focus:outline-none focus:border-apple-blue"
          />
          <button
            onClick={handleManualSubmit}
            className="px-4 py-2 bg-apple-blue hover:bg-apple-blue/90 text-white rounded-lg text-sm font-medium transition-colors"
          >
            検索
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
              <div className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 border-apple-blue rounded-tl-sm" />
              <div className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 border-apple-blue rounded-tr-sm" />
              <div className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 border-apple-blue rounded-bl-sm" />
              <div className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 border-apple-blue rounded-br-sm" />
              <div className="absolute inset-x-4 top-1/2 h-0.5 bg-apple-blue/60 animate-pulse" />
            </div>
            <p className="absolute bottom-[calc(50%-80px)] text-white/50 text-xs">
              バーコードを枠に合わせてください
            </p>
          </div>
        )}

        {/* Not found toast */}
        {notFound && (
          <div className="absolute inset-x-0 bottom-6 flex justify-center pointer-events-none">
            <div className="bg-red-500/90 backdrop-blur-sm text-white text-sm px-5 py-2.5 rounded-full shadow-lg">
              未着荷の商品が見つかりませんでした
            </div>
          </div>
        )}

        {/* Camera error */}
        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center px-6">
              <svg className="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-white text-sm">{cameraError}</p>
            </div>
          </div>
        )}
      </div>

      {/* Results bottom sheet */}
      {phase === 'results' && (
        <div className="bg-white dark:bg-gray-900 rounded-t-2xl shadow-card-md flex flex-col max-h-[55vh] flex-shrink-0">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-apple-separator dark:border-apple-sepDark">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">取引を選択</h3>
            <button onClick={handleBack} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="overflow-y-auto flex-1">
            {matches.map((tx, i) => (
              <button
                key={tx.id}
                onClick={() => handleSelectTransaction(tx)}
                className={`w-full px-4 py-3.5 flex flex-col gap-1 text-left active:bg-apple-blue/5 transition-colors ${i < matches.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''}`}
              >
                <span className="font-medium text-gray-900 dark:text-white text-sm">{tx.product_name}</span>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-apple-gray-1">
                  <span className="bg-apple-gray-5 dark:bg-white/10 px-1.5 py-0.5 rounded">{tx.purchase_platforms?.name ?? '—'}</span>
                  <span>{tx.order_number ?? '注文番号なし'}</span>
                  <span>{tx.date}</span>
                  <span className="text-gray-900 dark:text-white font-medium">{tx.quantity}個</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Confirming bottom sheet */}
      {phase === 'confirming' && selected && (
        <div className="bg-white dark:bg-gray-900 rounded-t-2xl shadow-card-md px-4 pt-4 pb-8 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">着荷確認</h3>
            <button onClick={handleBack} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Transaction info */}
          <div className="mb-4 bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3">
            <p className="font-medium text-gray-900 dark:text-white text-sm mb-1">{selected.product_name}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-apple-gray-1">
              <span className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-1.5 py-0.5 rounded">{selected.purchase_platforms?.name ?? '—'}</span>
              <span>{selected.order_number ?? '注文番号なし'}</span>
              <span>{selected.date}</span>
            </div>
          </div>

          {/* Quantity stepper */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-apple-gray-1">到着数量</span>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setQty(q => Math.max(1, q - 1))}
                className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-200 text-xl font-light active:scale-90 transition-transform"
              >−</button>
              <span className="text-xl font-semibold text-gray-900 dark:text-white w-6 text-center tabular-nums">{qty}</span>
              <button
                onClick={() => setQty(q => Math.min(selected.quantity, q + 1))}
                className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-200 text-xl font-light active:scale-90 transition-transform"
              >＋</button>
            </div>
          </div>

          <button
            onClick={handleConfirm}
            disabled={saving}
            className="w-full py-3.5 bg-apple-blue hover:bg-apple-blue/90 active:bg-apple-blue/80 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors active:scale-[0.98] text-sm"
          >
            {saving ? '処理中...' : '着荷確認する'}
          </button>
        </div>
      )}
    </div>
  );
}
