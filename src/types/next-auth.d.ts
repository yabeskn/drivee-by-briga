// ─────────────────────────────────────────────────────────────
// next-auth.d.ts — Type augmentation untuk NextAuth v4
//
// Callback jwt() di src/lib/auth-options.ts menambahkan `id`
// pada token, sehingga session.user.id tersedia di klien.
// Tanpa augmentasi ini, `session.user.id` error saat build.
// ─────────────────────────────────────────────────────────────

import type { DefaultSession } from "next-auth";

declare module "next-auth" {
	interface Session {
		user: DefaultSession["user"] & {
			/** ID user (disuntikkan dari JWT token oleh callback session) */
			id?: string;
		};
	}
}

declare module "next-auth/jwt" {
	interface JWT {
		/** Disimpan oleh callback jwt() saat sign-in */
		id?: string;
	}
}
