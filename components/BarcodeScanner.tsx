// components/BarcodeScanner.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { BarcodeDetector } from 'barcode-detector';
import { triggerHaptic } from '@/lib/haptic';

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let active = true;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
        setScanning(true);

        intervalRef.current = setInterval(async () => {
          if (!videoRef.current || !active) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              const code = barcodes[0].rawValue;
              if (code) {
                cleanup();
                triggerHaptic('medium');
                onDetected(code);
              }
            }
          } catch { /* ignore per-frame errors */ }
        }, 200);
      } catch (err: any) {
        if (!active) return;
        if (err.name === 'NotAllowedError') {
          setError('カメラのアクセスが拒否されました。設定から許可してください。');
        } else {
          setError('カメラを起動できませんでした。');
        }
      }
    };

    const cleanup = () => {
      active = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };

    start();
    return cleanup;
  }, [onDetected]);

  const handleClose = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/70">
        <p className="text-white text-sm font-medium">
          {error ? '' : 'バーコードをカメラに向けてください'}
        </p>
        <button
          onClick={handleClose}
          className="p-2 text-white/80 hover:text-white transition-colors"
          aria-label="閉じる"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* カメラ映像 */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {/* スキャン枠 */}
        {scanning && !error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-32 border-2 border-[#007AFF] rounded-lg relative">
              {/* 四隅の強調 */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-[#007AFF] rounded-tl" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-[#007AFF] rounded-tr" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-[#007AFF] rounded-bl" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-[#007AFF] rounded-br" />
              {/* スキャンライン */}
              <div className="absolute inset-x-0 top-1/2 h-0.5 bg-[#007AFF]/70 animate-pulse" />
            </div>
          </div>
        )}

        {/* エラー表示 */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center px-6">
              <svg className="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-white text-sm">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* フッター */}
      <div className="px-4 py-4 bg-black/70 flex justify-center">
        <button
          onClick={handleClose}
          className="px-8 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-sm font-medium transition-colors"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
