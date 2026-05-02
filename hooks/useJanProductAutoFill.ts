import { useEffect, useRef, useState } from 'react';

const JAN_PATTERN = /^\d{8,13}$/;
const INITIAL_DELAY_MS = 500;
const RETRY_BASE_DELAY_MS = 1200;
const RETRY_MAX_DELAY_MS = 10000;
const MAX_RETRIES = 30;

interface UseJanProductAutoFillOptions {
  janCode: string;
  productName: string;
  onProductNameChange: (productName: string) => void;
  enabled?: boolean;
}

function getNextDelay(attempt: number) {
  return Math.min(
    RETRY_MAX_DELAY_MS,
    Math.round(RETRY_BASE_DELAY_MS * Math.pow(1.5, attempt)),
  );
}

async function fetchJanProductName(jan: string): Promise<string> {
  try {
    const res = await fetch(`/api/jan-product/${jan}`);
    if (!res.ok) return '';

    const data = await res.json().catch(() => null);
    const productName = data?.product_name;

    return typeof productName === 'string' ? productName.trim() : '';
  } catch {
    return '';
  }
}

export function useJanProductAutoFill({
  janCode,
  productName,
  onProductNameChange,
  enabled = true,
}: UseJanProductAutoFillOptions) {
  const [isLooking, setIsLooking] = useState(false);
  const timerRef = useRef<number | null>(null);
  const janCodeRef = useRef(janCode);
  const productNameRef = useRef(productName);
  const onProductNameChangeRef = useRef(onProductNameChange);

  useEffect(() => {
    janCodeRef.current = janCode;
  }, [janCode]);

  useEffect(() => {
    productNameRef.current = productName;
  }, [productName]);

  useEffect(() => {
    onProductNameChangeRef.current = onProductNameChange;
  }, [onProductNameChange]);

  useEffect(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const jan = janCode.trim();
    const currentProductName = productName.trim();

    if (!enabled || !JAN_PATTERN.test(jan) || currentProductName) {
      setIsLooking(false);
      return;
    }

    let cancelled = false;

    const runLookup = async (attempt: number) => {
      if (cancelled) return;

      setIsLooking(true);
      const fetchedProductName = await fetchJanProductName(jan);

      if (cancelled) return;
      if (janCodeRef.current.trim() !== jan || productNameRef.current.trim()) {
        setIsLooking(false);
        return;
      }

      if (fetchedProductName) {
        onProductNameChangeRef.current(fetchedProductName);
        setIsLooking(false);
        return;
      }

      if (attempt >= MAX_RETRIES - 1) {
        setIsLooking(false);
        return;
      }

      timerRef.current = window.setTimeout(() => {
        void runLookup(attempt + 1);
      }, getNextDelay(attempt));
    };

    timerRef.current = window.setTimeout(() => {
      void runLookup(0);
    }, INITIAL_DELAY_MS);

    return () => {
      cancelled = true;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, janCode, productName]);

  return { isLooking };
}
