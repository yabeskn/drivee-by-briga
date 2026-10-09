"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SupabaseSignInButton } from "@/components/SupabaseSignInButton";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { supabase } from "@/lib/supabase/client";

function LoginContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const nextParam = searchParams.get("next");
	const [phone, setPhone] = useState("");
	const [isSending, setIsSending] = useState(false);
	const [sendResult, setSendResult] = useState<{
		success: boolean;
		message: string;
	} | null>(null);

	const [email, setEmail] = useState("yabeskn@briga.id");
	const [password, setPassword] = useState("");
	const [isEmailLoading, setIsEmailLoading] = useState(false);
	const [emailError, setEmailError] = useState<string | null>(null);

	useEffect(() => {
		const redirectLoggedInUser = (sessionUser?: {
			id: string;
			user_metadata?: { full_name?: string };
			email?: string;
		}) => {
			localStorage.setItem("drivee_logged_in", "true");
			if (sessionUser) {
				localStorage.setItem("drivee_driver_id", sessionUser.id);
				localStorage.setItem(
					"drivee_name",
					sessionUser.user_metadata?.full_name || sessionUser.email || "Driver",
				);
			}
			if (nextParam?.startsWith("/") && !nextParam.startsWith("//")) {
				router.replace(nextParam);
				return;
			}
			const hasDriverId = localStorage.getItem("drivee_driver_id");
			router.replace(hasDriverId ? "/go" : "/commuter");
		};

		supabase.auth.getSession().then(({ data: { session } }) => {
			if (session?.user) {
				redirectLoggedInUser(session.user);
			} else {
				localStorage.removeItem("drivee_logged_in");
			}
		});

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			if (session?.user) {
				redirectLoggedInUser(session.user);
			}
		});

		return () => {
			subscription.unsubscribe();
		};
	}, [router, nextParam]);

	const handleEmailSignIn = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!email || !password) return;
		setIsEmailLoading(true);
		setEmailError(null);

		try {
			const { data, error } = await supabase.auth.signInWithPassword({
				email: email.trim(),
				password,
			});

			if (error) {
				setEmailError(error.message);
				setIsEmailLoading(false);
				return;
			}

			if (data?.session) {
				await fetch("/api/auth/session", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						access_token: data.session.access_token,
						refresh_token: data.session.refresh_token,
						expires_in: data.session.expires_in,
					}),
				}).catch(() => {});

				localStorage.setItem("drivee_logged_in", "true");
				localStorage.setItem("drivee_driver_id", data.session.user.id);
				const driverName =
					data.session.user.user_metadata?.full_name ||
					data.session.user.email ||
					"Driver";
				localStorage.setItem("drivee_name", driverName);

				if (nextParam?.startsWith("/") && !nextParam.startsWith("//")) {
					router.replace(nextParam);
					return;
				}
				router.replace("/go");
			}
		} catch {
			setEmailError("Gagal masuk. Periksa koneksi internet Anda.");
		} finally {
			setIsEmailLoading(false);
		}
	};

	const handleSendVerification = async () => {
		if (!phone) return;
		setIsSending(true);
		setSendResult(null);

		try {
			const res = await fetch("/api/verify-phone", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ phone }),
			});
			const data = await res.json();
			setSendResult({
				success: data.success,
				message: data.message || data.error,
			});
		} catch {
			setSendResult({ success: false, message: "Network error" });
		} finally {
			setIsSending(false);
		}
	};

	return (
		<div className="min-h-screen bg-black flex items-center justify-center p-4">
			<div className="w-full max-w-md">
				<div className="flex items-center justify-between mb-8">
					<div className="flex items-center space-x-2">
						<div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
							<svg viewBox="0 0 512 512" className="w-5 h-5" aria-hidden="true">
								<rect width="512" height="512" rx="128" fill="#000000" />
								<circle
									cx="256"
									cy="256"
									r="200"
									fill="#052e16"
									stroke="#10b981"
									strokeWidth="12"
								/>
								<path
									d="M280 120L190 280H270L230 400L350 240H270L280 120Z"
									fill="#10b981"
								/>
								<path
									d="M200 150 L200 362 L280 362 Q350 362 350 256 Q350 150 280 150 Z"
									fill="none"
									stroke="#ffffff"
									strokeWidth="16"
									strokeLinejoin="round"
								/>
								<circle cx="380" cy="380" r="24" fill="#F59E0B" />
								<text
									x="380"
									y="388"
									fontFamily="Arial, sans-serif"
									fontSize="24"
									fontWeight="bold"
									fill="#052e16"
									textAnchor="middle"
								>
									$
								</text>
								<path
									d="M130 380 Q150 360 130 340 Q110 360 130 380"
									fill="#34d399"
								/>
							</svg>
						</div>
						<span className="text-lg font-semibold text-white">Drifee</span>
					</div>
					<LanguageSwitcher />
				</div>

				{/* Shortcut Mode Uji Coba Telemetri & Kalibrasi */}
				<div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-5 mb-6 shadow-lg shadow-emerald-950/50">
					<div className="flex items-center gap-2 mb-2">
						<span className="text-base">🧪</span>
						<h2 className="text-sm font-bold text-emerald-400">
							Mode Uji Coba & Kalibrasi Telemetri
						</h2>
					</div>
					<p className="text-xs text-zinc-300 mb-4 leading-relaxed">
						Uji langsung sensor gerak HP, GPS, habit berkendara, dan kalkulasi
						emisi karbon tanpa perlu booking kendaraan.
					</p>
					<button
						type="button"
						onClick={async () => {
							try {
								await fetch("/api/auth/demo-session", { method: "POST" });
							} catch {
								// ignore fetch errors
							}
							localStorage.setItem("drivee_logged_in", "true");
							localStorage.setItem("drivee_driver_id", "tester-driver-01");
							localStorage.setItem("drivee_vehicle_id", "ev-wuling-air-01");
							router.push("/go");
						}}
						className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-white font-medium rounded-lg text-sm transition-all shadow-md shadow-emerald-500/20"
					>
						Mulai Pengujian di HP →
					</button>
				</div>

				{/* Akun Real Drifee (Email & Password) */}
				<div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 mb-6">
					<h2 className="text-lg font-semibold text-white mb-2">
						Masuk dengan Akun (Email & Password)
					</h2>
					<p className="text-sm text-zinc-400 mb-4">
						Masuk menggunakan email dan password akun terdaftar Anda.
					</p>

					<form onSubmit={handleEmailSignIn} className="space-y-4">
						<div>
							<label
								className="block text-sm text-zinc-400 mb-1"
								htmlFor="drifee-email-input"
							>
								Email
							</label>
							<input
								id="drifee-email-input"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="yabeskn@briga.id"
								required
								className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 text-sm"
							/>
						</div>

						<div>
							<label
								className="block text-sm text-zinc-400 mb-1"
								htmlFor="drifee-password-input"
							>
								Password
							</label>
							<input
								id="drifee-password-input"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								placeholder="••••••••"
								required
								className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 text-sm"
							/>
						</div>

						{emailError && (
							<div className="p-3 rounded-lg text-xs bg-red-950/50 border border-red-800/50 text-red-400">
								{emailError}
							</div>
						)}

						<button
							type="submit"
							disabled={isEmailLoading || !email || !password}
							className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-medium rounded-lg text-sm transition-all"
						>
							{isEmailLoading ? "Memproses..." : "Masuk ke Drifee →"}
						</button>
					</form>
				</div>

				<div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 mb-6">
					<h2 className="text-lg font-semibold text-white mb-2">
						Sign in with Google
					</h2>
					<p className="text-sm text-zinc-400 mb-4">
						Use your Google account to sign in to Drifee.
					</p>
					<SupabaseSignInButton />
				</div>

				<div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6">
					<h2 className="text-lg font-semibold text-white mb-2">
						Verify Phone Number
					</h2>
					<p className="text-sm text-zinc-400 mb-4">
						Enter your WhatsApp number to receive a verification link.
					</p>

					<div className="space-y-4">
						<div>
							<label
								className="block text-sm text-zinc-400 mb-1"
								htmlFor="drifee-field-1"
							>
								Phone Number
							</label>
							<input
								id="drifee-field-1"
								type="tel"
								value={phone}
								onChange={(e) => setPhone(e.target.value)}
								placeholder="0812xxxxxxx"
								className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
							/>
						</div>

						<button
							type="button"
							onClick={handleSendVerification}
							disabled={!phone || isSending}
							className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors"
						>
							{isSending ? "Sending..." : "Send Verification Link"}
						</button>

						{sendResult && (
							<div
								className={`p-3 rounded-lg text-sm ${sendResult.success ? "bg-emerald-950/50 text-emerald-400" : "bg-red-950/50 text-red-400"}`}
							>
								{sendResult.message}
							</div>
						)}
					</div>
				</div>

				<div className="mt-6 text-center">
					<p className="text-xs text-zinc-500">
						By signing in, you agree to our Terms of Service and Privacy Policy.
					</p>
				</div>
			</div>
		</div>
	);
}

export default function LoginPage() {
	return (
		<LanguageProvider>
			<Suspense
				fallback={
					<div className="min-h-screen bg-black flex items-center justify-center text-zinc-500">
						Loading...
					</div>
				}
			>
				<LoginContent />
			</Suspense>
		</LanguageProvider>
	);
}
