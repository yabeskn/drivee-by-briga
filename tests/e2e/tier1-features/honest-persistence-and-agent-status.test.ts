/**
 * Tier 1: Feature Coverage — Honest Status & Real Persistence
 *
 * Requirements:
 * - WhatsApp agent (Baileys) must NOT report status `connected` without a real
 *   socket, and must refuse to "send" a message when it has no transport.
 *   (Previously `connect()` flipped status to `connected` unconditionally and
 *   `sendMessage()` returned `{ success: true }` without sending anything.)
 * - Persistence endpoints must not fabricate success or IDs:
 *   `/api/crm/driver` GET, `/api/activity/log`, `/api/register/driver`,
 *   `/api/register/vehicle` must write to / read from the database and surface
 *   real errors (503 when unconfigured, 404 when a driver does not exist).
 *
 * Source: Survey finding — endpoints with hardcoded responses masking missing
 * implementation.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BaileysAgent, type WhatsAppSocket } from "@/lib/baileys/agent";
import type { AgentConfig } from "@/lib/baileys/config";

// ── Fixtures ─────────────────────────────────────────────────

const agentConfig: AgentConfig = {
	id: "agent-test",
	name: "Test Agent",
	phone: "081234567890",
	sessionPath: "./sessions/agent-test",
	rateLimitPerMinute: 5,
	dailyLimit: 100,
	status: "active",
	region: "jakarta",
};

function readSource(path: string): string {
	return readFileSync(resolve(process.cwd(), path), "utf-8");
}

// ── WhatsApp agent: no fake connection ───────────────────────

describe("Tier 1: WhatsApp Agent Must Not Fake Connection", () => {
	afterEach(() => {
		// nothing to tear down; each test builds its own agent
	});

	it("5.1: should NOT report connected when the socket factory fails", async () => {
		const agent = new BaileysAgent(agentConfig, async () => {
			throw new Error('paket "baileys" belum terpasang');
		});

		const result = await agent.connect();

		expect(result.success).toBe(false);
		expect(agent.currentStatus).not.toBe("connected");
		// Status must be explicit about the missing transport.
		expect(agent.currentStatus).toBe("unavailable");
		expect(agent.isActive).toBe(false);
	});

	it("5.2: should NOT report connected when the factory resolves to a non-socket", async () => {
		const agent = new BaileysAgent(agentConfig, async () => {
			// Objek yang bentuknya salah tidak boleh dianggap socket valid.
			return {} as unknown as WhatsAppSocket;
		});

		const result = await agent.connect();

		expect(result.success).toBe(false);
		expect(agent.currentStatus).not.toBe("connected");
		expect(agent.isActive).toBe(false);
	});

	it("5.3: should refuse to send a message when not connected, and not count it as sent", async () => {
		const sent: string[] = [];
		const agent = new BaileysAgent(agentConfig, async () => {
			throw new Error("tidak ada transport");
		});

		await agent.connect();

		const result = await agent.sendMessage("081298765432", "Halo");

		expect(result.success).toBe(false);
		expect(result.error).toBeTruthy();
		// The message counter must not increase for a message that was never sent.
		expect(agent.getStatusInfo().messageCount).toBe(0);
		expect(sent).toHaveLength(0);
		expect(agent.canSend()).toBe(false);
	});

	it("5.4: should send and count only when a real socket is connected", async () => {
		const sent: Array<{ jid: string; text: string }> = [];
		const agent = new BaileysAgent(agentConfig, async () => ({
			async sendMessage(jid: string, content: { text: string }) {
				sent.push({ jid, text: content.text });
			},
			end() {},
		}));

		const connectResult = await agent.connect();
		expect(connectResult.success).toBe(true);
		expect(agent.currentStatus).toBe("connected");
		expect(agent.isActive).toBe(true);

		const result = await agent.sendMessage("081298765432", "Halo");

		expect(result.success).toBe(true);
		expect(sent).toEqual([
			{ jid: "081298765432@s.whatsapp.net", text: "Halo" },
		]);
		expect(agent.getStatusInfo().messageCount).toBe(1);
	});

	it("5.5: should surface a transport error when sending fails on a live socket", async () => {
		const agent = new BaileysAgent(agentConfig, async () => ({
			async sendMessage() {
				throw new Error("connection closed");
			},
			end() {},
		}));

		await agent.connect();
		const result = await agent.sendMessage("081298765432", "Halo");

		expect(result.success).toBe(false);
		expect(result.error).toContain("connection closed");
		// A failed send must not be counted as a delivered message.
		expect(agent.getStatusInfo().messageCount).toBe(0);
	});

	it("5.6: should expose lastError in status diagnostics for the admin UI", async () => {
		const agent = new BaileysAgent(agentConfig, async () => {
			throw new Error("boom");
		});

		await agent.connect();
		const info = agent.getStatusInfo();

		expect(info.lastError).toContain("boom");
		expect(info.hasSocket).toBe(false);
		expect(info.isActive).toBe(false);
	});

	it("5.7: should set status to disconnected after disconnect()", async () => {
		const agent = new BaileysAgent(agentConfig, async () => ({
			async sendMessage() {},
			end() {},
		}));

		await agent.connect();
		expect(agent.currentStatus).toBe("connected");

		await agent.disconnect();

		expect(agent.currentStatus).toBe("disconnected");
		expect(agent.getStatusInfo().hasSocket).toBe(false);
		expect(agent.isActive).toBe(false);
	});
});

// ── Persistence endpoints must not fabricate data ────────────

describe("Tier 1: Endpoints Must Not Fabricate Persistence", () => {
	it("5.8: /api/crm/driver must not return hardcoded data for unknown drivers", () => {
		const source = readSource("src/app/api/crm/driver/route.ts");

		// GET harus query database...
		expect(source).toMatch(/from\(["']drivers["']\)/);
		// ...dan mengembalikan 404, bukan data tiruan.
		expect(source).toContain("Driver not found");
		expect(source).toContain("status: 404");
		// ID harus berasal dari database, bukan dari Date.now().
		expect(source).not.toContain(`drv_\${Date.now()}`);
		// Insert harus benar-benar menulis ke drivers.
		expect(source).toMatch(/from\(["']drivers["']\)\s*\.insert\(/);
	});

	it("5.9: /api/activity/log must insert into activity_logs and honour RLS-safe writes", () => {
		const source = readSource("src/app/api/activity/log/route.ts");

		expect(source).toMatch(/from\(["']activity_logs["']\)/);
		expect(source).toContain(".insert(");
		// Header-derived identity, bukan dari body (anti-pemalsuan jejak audit).
		expect(source).toMatch(/headers\.get\(["']x-forwarded-for["']\)/);
		expect(source).toContain("status: 400");
		expect(source).toContain("status: 503");
	});

	it("5.10: /api/register/driver must upsert a real row instead of a generated ID", () => {
		const source = readSource("src/app/api/register/driver/route.ts");

		expect(source).toContain("upsert(");
		expect(source).toMatch(/onConflict:\s*["']email["']/);
		expect(source).not.toContain(`drv_\${Date.now()}`);
		expect(source).toContain("isAdminConfigured");
	});

	it("5.11: /api/register/vehicle must persist and disclose that photos are not stored", () => {
		const source = readSource("src/app/api/register/vehicle/route.ts");

		expect(source).toMatch(/from\(["']vehicles["']\)/);
		expect(source).toContain(".insert(");
		expect(source).not.toContain(`veh_\${Date.now()}`);
		// Kehujuran soal bukti foto: JSON.stringify(File) menghasilkan {}, jadi foto
		// tidak pernah tersimpan. Endpoint WAJAB melaporkan ini.
		expect(source).toContain("photosStored: false");
		expect(source).toContain("warnings:");
	});

	it("5.12: all four persistence endpoints must fail loudly when Supabase is unconfigured", () => {
		const routes = [
			"src/app/api/crm/driver/route.ts",
			"src/app/api/activity/log/route.ts",
			"src/app/api/register/driver/route.ts",
			"src/app/api/register/vehicle/route.ts",
		];

		for (const route of routes) {
			const source = readSource(route);
			expect(source, `${route} must check isAdminConfigured()`).toContain(
				"isAdminConfigured",
			);
			expect(source, `${route} must return 503 when unconfigured`).toContain(
				"status: 503",
			);
		}
	});
});
