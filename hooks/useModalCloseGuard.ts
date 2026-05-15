'use client';

import { useState, useCallback, useRef } from 'react';

export function useModalCloseGuard(onClose: () => void) {
  const [isDirty, setIsDirty] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const confirmingRef = useRef(false);

  const handleCloseRequest = useCallback(() => {
    if (confirmingRef.current) return;
    if (isDirty) {
      confirmingRef.current = true;
      setShowConfirm(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  const doClose = useCallback(() => {
    confirmingRef.current = false;
    setShowConfirm(false);
    setIsDirty(false);
    onClose();
  }, [onClose]);

  const cancelConfirm = useCallback(() => {
    confirmingRef.current = false;
    setShowConfirm(false);
  }, []);

  return { isDirty, setIsDirty, showConfirm, handleCloseRequest, doClose, cancelConfirm };
}
