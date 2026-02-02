'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useIsDesktop } from '@/hooks/useMediaQuery';

interface CalculatorContextValue {
  isOpen: boolean;
  openCalculator: () => void;
  closeCalculator: () => void;
  focusedInput: HTMLInputElement | null;
  setFocusedInput: (input: HTMLInputElement | null) => void;
  insertValue: (value: number) => void;
}

const CalculatorContext = createContext<CalculatorContextValue | undefined>(undefined);

export function useCalculatorContext() {
  const context = useContext(CalculatorContext);
  if (!context) {
    throw new Error('useCalculatorContext must be used within CalculatorProvider');
  }
  return context;
}

interface CalculatorProviderProps {
  children: React.ReactNode;
}

export function CalculatorProvider({ children }: CalculatorProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedInput, setFocusedInput] = useState<HTMLInputElement | null>(null);
  const isDesktop = useIsDesktop();

  const openCalculator = useCallback(() => {
    if (isDesktop) {
      setIsOpen(true);
    }
  }, [isDesktop]);

  const closeCalculator = useCallback(() => {
    setIsOpen(false);
  }, []);

  const insertValue = useCallback((value: number) => {
    if (focusedInput) {
      // Set the value
      focusedInput.value = value.toString();

      // Trigger React's onChange by dispatching input event
      const event = new Event('input', { bubbles: true });
      focusedInput.dispatchEvent(event);

      // Close calculator after insertion
      closeCalculator();
    }
  }, [focusedInput, closeCalculator]);

  // Global keyboard shortcut: Ctrl/Cmd+K
  useEffect(() => {
    if (!isDesktop) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifierKey = isMac ? event.metaKey : event.ctrlKey;

      if (modifierKey && event.key === 'k') {
        event.preventDefault();
        openCalculator();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDesktop, openCalculator]);

  const value: CalculatorContextValue = {
    isOpen,
    openCalculator,
    closeCalculator,
    focusedInput,
    setFocusedInput,
    insertValue,
  };

  return (
    <CalculatorContext.Provider value={value}>
      {children}
    </CalculatorContext.Provider>
  );
}
