'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/pl');
  }, [router]);
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-taupe">Przekierowywanie...</p>
    </div>
  );
}
