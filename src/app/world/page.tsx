import type { Metadata } from 'next';
import { WorldPage } from '@/components/world/WorldPage';

export const metadata: Metadata = { title: 'World map · Ch’usay' };

export default function Page() {
  return <WorldPage />;
}
