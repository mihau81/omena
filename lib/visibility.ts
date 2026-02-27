import { headers } from 'next/headers';

export async function getUserVisibility(): Promise<number> {
  const h = await headers();
  const val = h.get('x-user-visibility');
  return val ? parseInt(val, 10) : 0;
}

export async function getUserId(): Promise<string | null> {
  const h = await headers();
  const val = h.get('x-user-id');
  return val || null;
}

export async function getUserType(): Promise<'user' | 'admin' | 'anonymous'> {
  const h = await headers();
  const val = h.get('x-user-type');
  if (val === 'user' || val === 'admin') return val;
  return 'anonymous';
}
