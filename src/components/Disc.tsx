'use client';

import type { CSSProperties, ReactNode } from 'react';
import { discIsOpen, toggleDisc, useSession } from '@/lib/store';

// one open/close section, remembered per key for this session
export function Disc({ k, head, children, open = true, cls = '', style, onOpen }: {
  k: string; head: ReactNode; children: ReactNode; open?: boolean; cls?: string; style?: CSSProperties; onOpen?: () => void;
}) {
  const isOpen = discIsOpen(useSession(), k, open);
  return (
    <section className={`disc ${cls}`} style={style}>
      <button type="button" className="disc-head" aria-expanded={isOpen} onClick={() => { toggleDisc(k, open, isOpen); if (!isOpen) onOpen?.(); }}>
        <span className="caret" aria-hidden="true">›</span>{head}
      </button>
      {isOpen && <div className="disc-body">{children}</div>}
    </section>
  );
}
