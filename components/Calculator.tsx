'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useCalculatorContext } from '@/components/CalculatorProvider';
import { card, button } from '@/lib/theme';

export function Calculator() {
  const { isOpen, closeCalculator, insertValue, focusedInput } = useCalculatorContext();
  const [display, setDisplay] = useState('0');
  const [currentOperand, setCurrentOperand] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  // Reset calculator when opened
  useEffect(() => {
    if (isOpen) {
      setDisplay('0');
      setCurrentOperand(null);
      setOperator(null);
      setWaitingForOperand(false);
    }
  }, [isOpen]);

  const handleNumber = useCallback((num: string) => {
    if (waitingForOperand) {
      setDisplay(num);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? num : display + num);
    }
  }, [display, waitingForOperand]);

  const handleDecimal = useCallback(() => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
    } else if (display.indexOf('.') === -1) {
      setDisplay(display + '.');
    }
  }, [display, waitingForOperand]);

  const handleOperator = useCallback((nextOperator: string) => {
    const inputValue = parseFloat(display);

    if (currentOperand === null) {
      setCurrentOperand(inputValue);
    } else if (operator) {
      const currentValue = currentOperand || 0;
      const newValue = calculate(currentValue, inputValue, operator);
      setDisplay(String(newValue));
      setCurrentOperand(newValue);
    }

    setWaitingForOperand(true);
    setOperator(nextOperator);
  }, [currentOperand, display, operator]);

  const handleEquals = useCallback(() => {
    const inputValue = parseFloat(display);

    if (currentOperand !== null && operator) {
      const newValue = calculate(currentOperand, inputValue, operator);
      setDisplay(String(newValue));
      setCurrentOperand(null);
      setOperator(null);
      setWaitingForOperand(true);
    }
  }, [currentOperand, display, operator]);

  const handleClear = useCallback(() => {
    setDisplay('0');
    setCurrentOperand(null);
    setOperator(null);
    setWaitingForOperand(false);
  }, []);

  const handleInsert = useCallback(() => {
    const value = parseFloat(display);
    if (!isNaN(value) && focusedInput) {
      insertValue(value);
    }
  }, [display, focusedInput, insertValue]);

  // Keyboard support
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key;

      if (key >= '0' && key <= '9') {
        event.preventDefault();
        handleNumber(key);
      } else if (key === '.') {
        event.preventDefault();
        handleDecimal();
      } else if (key === '+' || key === '-' || key === '*' || key === '/') {
        event.preventDefault();
        const op = key === '*' ? '×' : key === '/' ? '÷' : key;
        handleOperator(op);
      } else if (key === 'Enter' || key === '=') {
        event.preventDefault();
        handleEquals();
      } else if (key === 'Escape') {
        event.preventDefault();
        closeCalculator();
      } else if (key === 'Backspace') {
        event.preventDefault();
        setDisplay(display.length > 1 ? display.slice(0, -1) : '0');
      } else if (key === 'c' || key === 'C') {
        event.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, display, handleNumber, handleDecimal, handleOperator, handleEquals, handleClear, closeCalculator]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="hidden md:block fixed inset-0 bg-black/20 z-40"
        onClick={closeCalculator}
      />

      {/* Calculator Modal */}
      <div className="hidden md:flex fixed bottom-8 right-8 z-50">
        <div className={`${card.primary} shadow-2xl w-80 p-4`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              计算器
            </h3>
            <button
              onClick={closeCalculator}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              aria-label="关闭计算器"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Display */}
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-right text-2xl font-mono font-semibold text-gray-900 dark:text-white break-all">
              {display}
            </div>
            {operator && (
              <div className="text-right text-sm text-gray-500 dark:text-gray-400 mt-1">
                {currentOperand} {operator}
              </div>
            )}
          </div>

          {/* Buttons Grid */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {/* Row 1: Clear and operators */}
            <button
              onClick={handleClear}
              className="col-span-2 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-lg font-medium transition-colors py-3"
            >
              {display !== '0' || currentOperand !== null ? 'AC' : 'C'}
            </button>
            <CalcButton onClick={() => handleOperator('÷')} variant="operator">÷</CalcButton>
            <CalcButton onClick={() => handleOperator('×')} variant="operator">×</CalcButton>

            {/* Row 2: 7-9, minus */}
            <CalcButton onClick={() => handleNumber('7')}>7</CalcButton>
            <CalcButton onClick={() => handleNumber('8')}>8</CalcButton>
            <CalcButton onClick={() => handleNumber('9')}>9</CalcButton>
            <CalcButton onClick={() => handleOperator('-')} variant="operator">-</CalcButton>

            {/* Row 3: 4-6, plus */}
            <CalcButton onClick={() => handleNumber('4')}>4</CalcButton>
            <CalcButton onClick={() => handleNumber('5')}>5</CalcButton>
            <CalcButton onClick={() => handleNumber('6')}>6</CalcButton>
            <CalcButton onClick={() => handleOperator('+')} variant="operator">+</CalcButton>

            {/* Row 4: 1-3, equals */}
            <CalcButton onClick={() => handleNumber('1')}>1</CalcButton>
            <CalcButton onClick={() => handleNumber('2')}>2</CalcButton>
            <CalcButton onClick={() => handleNumber('3')}>3</CalcButton>
            <button
              onClick={handleEquals}
              className="row-span-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg font-medium transition-colors text-xl"
            >
              =
            </button>

            {/* Row 5: 0, decimal */}
            <CalcButton onClick={() => handleNumber('0')} className="col-span-2">0</CalcButton>
            <CalcButton onClick={handleDecimal}>.</CalcButton>
          </div>

          {/* Insert Button */}
          <button
            onClick={handleInsert}
            disabled={!focusedInput}
            className={`${button.success} w-full`}
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
            插入结果
          </button>

          {/* Keyboard shortcuts hint */}
          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 text-center">
            键盘快捷键: 数字键 · 运算符 · Enter(=) · Esc(关闭)
          </div>
        </div>
      </div>
    </>
  );
}

// Helper component for calculator buttons
interface CalcButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'number' | 'operator';
  className?: string;
}

function CalcButton({ onClick, children, variant = 'number', className = '' }: CalcButtonProps) {
  const baseClass = "rounded-lg font-medium transition-colors py-3 text-lg";
  const variantClass = variant === 'operator'
    ? "bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 active:bg-gray-500 dark:active:bg-gray-400 text-gray-900 dark:text-white"
    : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 active:bg-gray-400 dark:active:bg-gray-500 text-gray-900 dark:text-white";

  return (
    <button
      onClick={onClick}
      className={`${baseClass} ${variantClass} ${className}`}
    >
      {children}
    </button>
  );
}

// Calculate helper function
function calculate(left: number, right: number, operator: string): number {
  switch (operator) {
    case '+':
      return left + right;
    case '-':
      return left - right;
    case '×':
      return left * right;
    case '÷':
      return right !== 0 ? left / right : 0;
    default:
      return right;
  }
}
