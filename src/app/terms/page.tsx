import Link from "next/link";

export const metadata = {
	title: "Syarat & Ketentuan — Drifee by Briga",
	description: "Syarat dan ketentuan penggunaan layanan Drifee by Briga.",
};

export default function TermsPage() {
	return (
		<main className="mx-auto max-w-2xl px-6 py-16 text-zinc-300">
			<Link
				href="/landing"
				className="text-sm text-emerald-400 hover:text-emerald-300"
			>
				&larr; Kembali ke Beranda
			</Link>
			<h1 className="mt-6 text-2xl font-semibold text-white">
				Syarat &amp; Ketentuan
			</h1>
			<p className="mt-4 text-sm leading-relaxed">
				Dokumen syarat dan ketentuan resmi sedang disiapkan. Untuk pertanyaan
				selama periode ini, silakan hubungi{" "}
				<a
					href="mailto:info@briga.id"
					className="text-emerald-400 hover:text-emerald-300"
				>
					info@briga.id
				</a>
				.
			</p>
		</main>
	);
}
