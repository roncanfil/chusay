'use client';

import { useState, type ReactNode } from 'react';

// "Move to" stays one small button until it's tapped, so an opened idea isn't a wall of trip names; the choices open in place
export function MoveTo({ label = 'Move to', children }: { label?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="inline-field move-to">
      <button type="button" className="btn-sm filter-btn" aria-expanded={open} onClick={() => setOpen(o => !o)}>{label}<span className="caret" aria-hidden="true">›</span></button>
      {open && <span className="chips">{children}</span>}
    </div>
  );
}
