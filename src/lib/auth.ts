import { getSession } from 'next-auth/react';
import { db } from './db';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  image?: string;
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getSession();
  if (!session?.user?.email) return null;

  return {
    id: session.user.id as string,
    email: session.user.email,
    name: session.user.name || '',
    image: session.user.image || undefined,
  };
}

/**
 * Get or create driver profile for authenticated user.
 * NOTE (WIP): implementasi saat ini masih menumpang tabel tripSessions
 * (IndexedDB) karena belum ada tabel drivers lokal. Fungsi ini belum
 * dipakai oleh route manapun; jadikan no-op yang aman terhadap tipe
 * sampai tabel drivers lokal tersedia.
 */
export async function getOrCreateDriverProfile(_user: AuthUser): Promise<null> {
  // TODO: simpan profil driver ke tabel khusus (bukan tripSessions).
  return null;
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return !!user;
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}
