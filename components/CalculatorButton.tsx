'use client';

import React from 'react';
import { useCalculatorContext } from '@/components/CalculatorProvider';
import { Calculator } from '@/components/Calculator';

export function CalculatorButton() {
  const { openCalculator } = useCalculatorContext();

  return (
    <>
      {/* Floating Action Button - Desktop Only */}
      <button
        onClick={openCalculator}
        className="hidden md:flex fixed bottom-8 right-8 z-30 w-14 h-14 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-full shadow-lg hover:shadow-xl transition-all items-center justify-center group"
        aria-label="打开计算器 (Ctrl/Cmd+K)"
      >
        <svg
          className="w-6 h-6 transition-transform group-hover:scale-110"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      </button>

      {/* Calculator Component */}
      <Calculator />
    </>
  );
}
