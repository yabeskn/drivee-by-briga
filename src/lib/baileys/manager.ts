import { BaileysAgent } from "./agent";
import { type AgentConfig, loadConfig } from "./config";

class AgentManager {
	private agents: Map<string, BaileysAgent> = new Map();
	private currentIndex = 0;

	constructor() {
		this.initialize();
	}

	private initialize(): void {
		const config = loadConfig();
		for (const agentConfig of config.agents) {
			const agent = new BaileysAgent(agentConfig);
			this.agents.set(agentConfig.id, agent);
		}
	}

	getAgent(id: string): BaileysAgent | undefined {
		return this.agents.get(id);
	}

	getAllAgents(): BaileysAgent[] {
		return Array.from(this.agents.values());
	}

	getActiveAgents(): BaileysAgent[] {
		return this.getAllAgents().filter((a) => a.isActive);
	}

	getNextAvailableAgent(): BaileysAgent | null {
		const activeAgents = this.getActiveAgents();
		if (activeAgents.length === 0) return null;

		// Round-robin
		const agent = activeAgents[this.currentIndex % activeAgents.length];
		this.currentIndex++;
		return agent;
	}

	/**
	 * Mengubah status konfigurasi agen secara nyata.
	 *
	 * Status `active` akan mencoba membuka koneksi WhatsApp; bila transport
	 * tidak tersedia, operasi dikembalikan sebagai gagal — bukan dilaporkan
	 * sukses palsu.
	 */
	async setAgentStatus(
		id: string,
		status: AgentConfig["status"],
	): Promise<{
		success: boolean;
		status: AgentConfig["status"];
		error?: string;
	}> {
		const agent = this.agents.get(id);
		if (!agent) {
			return { success: false, status, error: `Agent ${id} tidak ditemukan` };
		}

		agent.config.status = status;

		if (status === "active") {
			const result = await agent.connect();
			if (!result.success) {
				// Kembalikan ke status sebelumnya supaya status runtime tidak
				// menyesatkan; konfigurasi tetap 'inactive' sampai transport siap.
				agent.config.status = "inactive";
				await agent.disconnect();
				return {
					success: false,
					status: "inactive",
					error: result.error,
				};
			}
		} else {
			await agent.disconnect();
		}

		return { success: true, status: agent.config.status };
	}

	async sendMessage(
		phone: string,
		message: string,
	): Promise<{ success: boolean; agentId?: string; error?: string }> {
		const agent = this.getNextAvailableAgent();
		if (!agent) {
			return { success: false, error: "No active agents available" };
		}

		const result = await agent.sendMessage(phone, message);
		return { ...result, agentId: result.agentId ?? agent.id };
	}

	getStatus() {
		return this.getAllAgents().map((a) => a.getStatusInfo());
	}
}

export const agentManager = new AgentManager();
