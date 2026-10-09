import type { AgentConfig } from "./config";
import { RateLimiter } from "./rate-limiter";

export type AgentStatus =
	| "disconnected"
	| "connecting"
	| "connected"
	| "banned"
	// Transport tidak tersedia (paket `baileys` belum terpasang di environment).
	// Status ini eksplisit supaya UI admin tidak menampilkan agent sebagai aktif
	// padahal tidak ada soket WhatsApp sama sekali.
	| "unavailable";

/**
 * Soket WhatsApp minimal yang dipakai agent. Sengaja abstrak agar implementasi
 * Baileys asli bisa di-inject tanpa membocorkan tipe internal library ke modul lain.
 */
export interface WhatsAppSocket {
	sendMessage(jid: string, content: { text: string }): Promise<void>;
	end(): void;
}

export type SocketFactory = (config: AgentConfig) => Promise<WhatsAppSocket>;

/**
 * Factory bawaan: memuat library `baileys` secara dinamis.
 * Sengaja memakai import dinamis agar modul ini tetap bisa di-bundle di server
 * Next.js dan bisa diuji tanpa paket tersebut terpasang.
 */
const defaultSocketFactory: SocketFactory = async (config) => {
	const baileys = "baileys";
	let mod: unknown;
	try {
		mod = await import(/* webpackIgnore: true */ baileys);
	} catch {
		throw new Error(
			'WhatsApp transport tidak tersedia: paket "baileys" belum terpasang. Jalankan `npm install baileys` untuk mengaktifkan pengiriman pesan.',
		);
	}

	const makeWASocket = (mod as { default?: unknown }).default;
	if (typeof makeWASocket !== "function") {
		throw new Error(
			'Paket "baileys" terpasang tetapi tidak mengekspor entry point yang diharapkan.',
		);
	}

	const socket = await (
		makeWASocket as (opts: unknown) => Promise<WhatsAppSocket>
	)({
		auth: {
			// Riwayat sesi disimpan per-agent agar reconnect tidak diminta ulang.
			// TODO: arahkan ke storage kredensial terenkripsi sebelum dipakai produksi.
			creds: undefined,
		},
		printQRInTerminal: false,
		markOnlineOnConnect: false,
		browser: ["Drifee", "1.0.0"],
		...(config.phone ? { user: config.phone.replace(/\D/g, "") } : {}),
	});

	return socket;
};

export class BaileysAgent {
	readonly config: AgentConfig;
	private status: AgentStatus = "disconnected";
	private rateLimiter: RateLimiter;
	private lastActivity: Date | null = null;
	private messageCount = 0;
	private socket: WhatsAppSocket | null = null;
	private lastError: string | null = null;
	private readonly socketFactory: SocketFactory;

	constructor(
		config: AgentConfig,
		socketFactory: SocketFactory = defaultSocketFactory,
	) {
		this.config = config;
		this.socketFactory = socketFactory;
		this.rateLimiter = new RateLimiter(
			config.rateLimitPerMinute,
			config.dailyLimit,
		);
	}

	get id(): string {
		return this.config.id;
	}

	get name(): string {
		return this.config.name;
	}

	get phone(): string {
		return this.config.phone;
	}

	get currentStatus(): AgentStatus {
		return this.status;
	}

	/**
	 * Agen hanya aktif bila config-nya aktif, punya nomor, dan benar-benar memiliki
	 * soket yang tersambung. Tanpa soket, `isActive` harus false.
	 */
	get isActive(): boolean {
		return (
			this.config.status === "active" &&
			this.status === "connected" &&
			this.socket !== null
		);
	}

	get rateLimitStatus() {
		return this.rateLimiter.getStatus(this.config.id);
	}

	canSend(): boolean {
		return this.isActive && this.rateLimiter.canSend(this.config.id);
	}

	/**
	 * Membuka koneksi WhatsApp.
	 *
	 * Penting: status TIDAK PERNAH dinaikkan ke `connected` tanpa soket nyata.
	 * Bila transport gagal dimuat, agen berstatus `unavailable` dan error
	 * dikembalikan ke pemanggil supaya bisa dilaporkan ke UI.
	 */
	async connect(): Promise<{ success: boolean; error?: string }> {
		if (this.status === "connected" && this.socket) {
			return { success: true };
		}

		if (this.config.status === "banned") {
			this.status = "banned";
			this.lastError = "Agent ditandai banned pada konfigurasi.";
			return { success: false, error: this.lastError };
		}

		this.status = "connecting";
		this.lastError = null;

		try {
			const socket = await this.socketFactory(this.config);
			if (!socket || typeof socket.sendMessage !== "function") {
				throw new Error(
					"Socket factory tidak mengembalikan soket WhatsApp yang valid.",
				);
			}
			this.socket = socket;
			this.status = "connected";
			this.lastActivity = new Date();
			return { success: true };
		} catch (error) {
			// Jangan pernah berpura-pura terhubung.
			this.socket = null;
			this.status = "unavailable";
			this.lastError = error instanceof Error ? error.message : String(error);
			return { success: false, error: this.lastError };
		}
	}

	async disconnect(): Promise<void> {
		try {
			this.socket?.end();
		} catch (error) {
			this.lastError = error instanceof Error ? error.message : String(error);
		} finally {
			this.socket = null;
			this.status = "disconnected";
		}
	}

	async sendMessage(
		phone: string,
		message: string,
	): Promise<{ success: boolean; error?: string; agentId?: string }> {
		if (this.config.status === "banned") {
			return { success: false, error: `Agen ${this.id} berstatus banned` };
		}

		if (this.status !== "connected" || !this.socket) {
			return {
				success: false,
				error: `Agen ${this.id} tidak tersambung (status: ${this.status}). Pesan tidak dikirim.`,
			};
		}

		if (!this.rateLimiter.canSend(this.config.id)) {
			return {
				success: false,
				error: "Rate limit exceeded or agent not active",
			};
		}

		try {
			const jid = phone.includes("@")
				? phone
				: `${phone.replace(/\D/g, "")}@s.whatsapp.net`;
			await this.socket.sendMessage(jid, { text: message });
			this.rateLimiter.record(this.config.id);
			this.messageCount++;
			this.lastActivity = new Date();
			return { success: true, agentId: this.id };
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			this.lastError = reason;
			return { success: false, error: reason };
		}
	}

	getStatusInfo() {
		return {
			id: this.id,
			name: this.name,
			phone: this.phone,
			status: this.currentStatus,
			// Diagnostik: alasan terakhir kegagalan koneksi atau pengiriman.
			lastError: this.lastError,
			isActive: this.isActive,
			hasSocket: this.socket !== null,
			messageCount: this.messageCount,
			lastActivity: this.lastActivity,
			rateLimit: this.rateLimitStatus,
			region: this.config.region,
		};
	}
}
