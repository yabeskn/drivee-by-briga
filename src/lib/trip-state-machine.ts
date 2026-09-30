// ─────────────────────────────────────────────────────────────
// trip-state-machine.ts — Trip Lifecycle: Scope 3 Absolut
//
// Alur: IDLE → DISPATCHED → PASSENGER_PICKED_UP → COMPLETED
//
// ATURAN KERAS (hard rule):
//   startTelemetryRecording() WAJIB dipanggil tepat pada transisi
//   IDLE → DISPATCHED. Perekaman odometer, GPS, dan estimasi daya
//   baterai TIDAK BOLEH menunggu penumpang naik. Deadhead miles
//   (jarak kosong menuju titik jemput) adalah bagian integral dari
//   emisi Scope 3 dan wajib masuk ke payload database.
//
//   Transisi yang tidak mengikuti urutan valid → INVALID.
// ─────────────────────────────────────────────────────────────

import type { TripPhase, TripPhaseTransition } from "@/types/telematics";

/** Transisi legal antar-fase trip. */
const VALID_TRANSITIONS: Record<TripPhase, TripPhase[]> = {
	IDLE: ["DISPATCHED"],
	DISPATCHED: ["PASSENGER_PICKED_UP", "COMPLETED"],
	PASSENGER_PICKED_UP: ["COMPLETED"],
	COMPLETED: [],
};

export interface TransitionResult {
	/** true jika transisi legal dan state machine berpindah fase */
	moved: boolean;
	from: TripPhase;
	to: TripPhase;
	reason: string;
}

export interface DispatchHandlers {
	/**
	 * WAJIB: mulai perekaman telematik (odometer, GPS, estimasi daya
	 * baterai). Dipanggil otomatis pada transisi IDLE → DISPATCHED.
	 */
	startTelemetryRecording: () => void | Promise<void>;
}

/**
 * Mesin state trip yang tidak bisa "lupa" memulai telematik:
 * transisi IDLE → DISPATCHED selalu mengeksekusi
 * startTelemetryRecording() sebelum fase baru di-commit.
 */
export class TripStateMachine {
	private phase: TripPhase = "IDLE";
	private readonly timeline: TripPhaseTransition[] = [];
	private readonly handlers: DispatchHandlers;

	constructor(handlers: DispatchHandlers) {
		this.handlers = handlers;
	}

	get currentPhase(): TripPhase {
		return this.phase;
	}

	get transitions(): readonly TripPhaseTransition[] {
		return this.timeline;
	}

	/** Apakah perekaman seharusnya sudah berjalan? (sejak DISPATCHED) */
	get isRecordingExpected(): boolean {
		return this.phase === "DISPATCHED" || this.phase === "PASSENGER_PICKED_UP";
	}

	/**
	 * OTW Jemput — transisi IDLE → DISPATCHED.
	 * Memanggil startTelemetryRecording() pada TITIK INI (deadhead
	 * miles mulai direkam sejak detik pertama).
	 */
	async dispatch(): Promise<TransitionResult> {
		const from = this.phase;
		const to: TripPhase = "DISPATCHED";
		if (!this.validate(from, to)) {
			return {
				moved: false,
				from,
				to,
				reason: `Transisi ${from} → ${to} tidak valid`,
			};
		}
		// Hard rule: telematik menyala SEBELUM fase di-commit.
		await this.handlers.startTelemetryRecording();
		return this.commit(from, to);
	}

	/** Penumpang sudah naik — deadhead selesai. */
	pickUpPassenger(): TransitionResult {
		const from = this.phase;
		const to: TripPhase = "PASSENGER_PICKED_UP";
		if (!this.validate(from, to)) {
			return {
				moved: false,
				from,
				to,
				reason: `Transisi ${from} → ${to} tidak valid`,
			};
		}
		return this.commit(from, to);
	}

	/** Akhir trip — menghentikan fase apapun (kecuali sudah COMPLETED). */
	complete(): TransitionResult {
		const from = this.phase;
		const to: TripPhase = "COMPLETED";
		if (from === "COMPLETED") {
			return { moved: false, from, to, reason: "Trip sudah COMPLETED" };
		}
		if (from === "IDLE") {
			return {
				moved: false,
				from,
				to,
				reason: "Transisi IDLE → COMPLETED tidak valid (tidak ada perjalanan)",
			};
		}
		return this.commit(from, to);
	}

	/** Batalkan trip sebelum dispatch (kembali IDLE). */
	cancelBeforeDispatch(): TransitionResult {
		if (this.phase !== "IDLE") {
			return {
				moved: false,
				from: this.phase,
				to: "IDLE",
				reason: "Hanya IDLE yang dapat di-cancel",
			};
		}
		return {
			moved: true,
			from: "IDLE",
			to: "IDLE",
			reason: "Trip dibatalkan sebelum dispatch",
		};
	}

	/** Snapshot timeline untuk payload database. */
	getTimeline(): TripPhaseTransition[] {
		return [...this.timeline];
	}

	private validate(from: TripPhase, to: TripPhase): boolean {
		return VALID_TRANSITIONS[from].includes(to);
	}

	private commit(from: TripPhase, to: TripPhase): TransitionResult {
		this.phase = to;
		this.timeline.push({ from, to, at: new Date().toISOString() });
		return { moved: true, from, to, reason: "OK" };
	}
}
