import { Suspense } from 'react';
import AuthForm from '@/components/AuthForm';

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="p-10 text-center text-stone-500">Đang tải…</p>}>
      <AuthForm />
    </Suspense>
  );
}
