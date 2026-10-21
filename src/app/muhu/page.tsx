import type { Metadata } from 'next';
import { MuhuPage } from '@/components/muhu/MuhuPage';

export const metadata: Metadata = { title: 'Muhu · Ch’usay' };

export default function Page() {
  return <MuhuPage />;
}
