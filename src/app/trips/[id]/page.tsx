import { Suspense } from 'react';
import { TripPage } from '@/components/trip/TripPage';

// the trip id is only known at request time, so it's read inside Suspense and the shell prerenders
export default function Page({ params }: PageProps<'/trips/[id]'>) {
  return <Suspense fallback={null}><Trip params={params} /></Suspense>;
}

async function Trip({ params }: Pick<PageProps<'/trips/[id]'>, 'params'>) {
  const { id } = await params;
  return <TripPage id={id} />;
}
