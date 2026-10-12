import { Suspense } from 'react';
import RequestForm from '@/components/market/RequestForm';

export default function NewRequestPage() {
  return (
    <Suspense fallback={<p className="p-10 text-center text-stone-500">Đang tải…</p>}>
      <RequestForm />
    </Suspense>
  );
}
