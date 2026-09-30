import { supabase } from './client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  image?: string;
}

export async function signInWithGoogle(): Promise<{ success: boolean; error?: string }> {
  try {
    const redirectTo = process.env.NEXT_PUBLIC_APP_URL
      ? process.env.NEXT_PUBLIC_APP_URL + '/go'
      : 'http://localhost:3000/go';

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || '',
    name: user.user_metadata?.full_name || user.email || '',
    image: user.user_metadata?.avatar_url,
  };
}
