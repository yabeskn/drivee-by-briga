import Link from "next/link";

export const metadata = {
	title: "Kebijakan Privasi — Drifee by Briga",
	description:
		"Kebijakan privasi Drifee by Briga untuk pengemudi dan mitra korporat.",
};

export default function PrivacyPolicyPage() {
	return (
		<main className="mx-auto max-w-2xl px-6 py-16 text-zinc-300">
			<Link
				href="/landing"
				className="text-sm text-emerald-400 hover:text-emerald-300"
			>
				&larr; Kembali ke Beranda
			</Link>
			<h1 className="mt-6 text-2xl font-semibold text-white">
				Kebijakan Privasi
			</h1>
			<p className="mt-4 text-sm leading-relaxed">
				Dokumen kebijakan privasi resmi sedang disiapkan. Selama periode ini,
				permintaan terkait data pribadi, akses, atau penghapusan dapat
				disampaikan melalui{" "}
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
