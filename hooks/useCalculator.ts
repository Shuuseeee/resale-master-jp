'use client';

import { useEffect } from 'react';
import { useCalculatorContext } from '@/components/CalculatorProvider';
import { useIsDesktop } from '@/hooks/useMediaQuery';

/**
 * Hook to register a number input field with the calculator system
 * Only active on desktop (>=768px)
 *
 * @param inputRef - React ref to the input element
 *
 * @example
 * const quantityRef = useRef<HTMLInputElement>(null);
 * useCalculator(quantityRef);
 *
 * <input ref={quantityRef} type="text" inputMode="numeric" ... />
 */
export function useCalculator(inputRef: React.RefObject<HTMLInputElement | null>) {
  const { setFocusedInput } = useCalculatorContext();
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (!isDesktop) return;

    const input = inputRef.current;
    if (!input) return;

    const handleFocus = () => {
      setFocusedInput(input);
    };

    const handleBlur = () => {
      setFocusedInput(null);
    };

    input.addEventListener('focus', handleFocus);
    input.addEventListener('blur', handleBlur);

    return () => {
      input.removeEventListener('focus', handleFocus);
      input.removeEventListener('blur', handleBlur);
    };
  }, [inputRef, setFocusedInput, isDesktop]);
}
