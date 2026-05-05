import { Suspense } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import AtelierClient from '../AtelierClient.jsx';

export const Route = createFileRoute('/')({
  ssr: false,
  validateSearch: (search) => search,
  component: IndexRoute,
});

function IndexRoute() {
  const searchParams = Route.useSearch();

  return (
    <Suspense fallback={null}>
      <AtelierClient searchParams={searchParams} />
    </Suspense>
  );
}
