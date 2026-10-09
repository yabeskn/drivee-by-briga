"use client";
import { getPricingTier } from "@/lib/appointments/pricing";
import type { DurationHours } from "@/lib/appointments/types";

interface PackageSelectorProps {
	selectedHours: DurationHours;
	allowedDurations: DurationHours[];
	onSelectHours: (hours: DurationHours) => void;
}

export function PackageSelector({
	selectedHours,
	allowedDurations,
	onSelectHours,
}: PackageSelectorProps) {
	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
					<span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
						1
					</span>
					Pilih Paket Durasi Armada EV
				</h3>
				<span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
					100% Chauffeur-Driven
				</span>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
				{allowedDurations.map((hours) => {
					const tier = getPricingTier(hours);
					const isSelected = selectedHours === hours;
					const isPopular = tier.isPopularBadge;

					return (
						<button
							key={hours}
							type="button"
							onClick={() => onSelectHours(hours)}
							className={`relative rounded-xl p-4 cursor-pointer transition-all duration-200 border-2 text-left w-full ${
								isSelected
									? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 shadow-md ring-2 ring-emerald-500/20"
									: "border-gray-200 dark:border-gray-800 hover:border-emerald-300 dark:hover:border-emerald-700 bg-white dark:bg-gray-900"
							}`}
						>
							{/* Popular Badge */}
							{isPopular && (
								<div className="absolute -top-3 right-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1">
									<span>⭐ Rekomendasi / Best Value</span>
								</div>
							)}

							<div className="flex justify-between items-start mb-2">
								<div>
									<h4 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
										Paket {hours} Jam
										{tier.savingsVsHourlyPct && (
											<span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded">
												Hemat {tier.savingsVsHourlyPct}%
											</span>
										)}
									</h4>
									<p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
										{tier.description}
									</p>
								</div>
								<div className="text-right">
									<div className="text-lg font-black text-gray-900 dark:text-white">
										Rp {(tier.grossFareIdr / 1000).toLocaleString("id-ID")}k
									</div>
									<div className="text-[11px] text-gray-500 dark:text-gray-400">
										~Rp {(tier.hourlyRateIdr / 1000).toFixed(0)}k/jam
									</div>
								</div>
							</div>

							<div className="pt-2.5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
								<div className="flex items-center gap-1.5">
									<svg
										className="w-4 h-4 text-emerald-600"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										role="img"
										aria-label="Kilometer icon"
									>
										<title>Ikon Jarak</title>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M13 10V3L4 14h7v7l9-11h-7z"
										/>
									</svg>
									<span>Termasuk {tier.includedKm} km jarak tempuh</span>
								</div>
								<div className="font-medium text-emerald-700 dark:text-emerald-400">
									{isSelected ? "✓ Dipilih" : "Pilih"}
								</div>
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}
