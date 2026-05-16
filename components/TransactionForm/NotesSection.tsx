'use client';

import React from 'react';

interface NotesSectionProps {
  notes: string;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

export function NotesSection({ notes, onInputChange }: NotesSectionProps) {
  return (
    <div className="sn-form-card">
      <div className="space-y-5">
        <h2 className="sn-form-title">
          <div className="sn-form-title-bar"></div>
          备注
        </h2>

        <textarea
          name="notes"
          value={notes}
          onChange={onInputChange}
          rows={3}
          placeholder="添加备注信息..."
          className="w-full sn-form-input resize-none"
        />
      </div>
    </div>
  );
}
