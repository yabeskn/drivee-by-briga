// ─────────────────────────────────────────────────────────────
// tests/e2e/tier1-features/fleet-crud-and-vision.test.ts
// Unit & Integration Test Suite for:
// 1. Admin Vehicles CRUD & Bluetooth Binding API
// 2. Computer Vision Speedometer Parser (Laya / Lightweight Vision)
// 3. Decentralized Hub & Service Corridor Geofence
// ─────────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	POST as createVehicle,
	GET as getVehicles,
	PATCH as updateVehicle,
} from "@/app/api/admin/vehicles/route";
import { POST as parseSpeedometer } from "@/app/api/vision/parse-speedometer/route";
import {
	checkHubGeofence,
	DECENTRALIZED_SERVICE_CORRIDORS,
	distanceMetersBetween,
} from "@/lib/geofence";

describe("Tier 1: Feature Coverage — Fleet CRUD & Speedometer AI Vision", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	// ── 1. Admin Vehicles CRUD API ──────────────────────────────
	// PERUBAHAN PERILAKU (disengaja): endpoint ini dulu hanya dilindungi
	// middleware "sudah login" dan mengembalikan data tiruan / id palsu
	// (`veh_${Date.now()}`) saat database tidak ada. Sekarang:
	//   - wajib lolos requireAdmin() (role admin di app_metadata)
	//   - tidak ada fallback tiruan; DB kosong → 503, bukan 201 palsu
	describe("1. Fleet Management & Bluetooth Name CRUD API (/api/admin/vehicles)", () => {
		/** Sesi admin yang diverifikasi Supabase Auth. */
		function adminRequest(
			url: string,
			init?: Record<string, unknown>,
		): NextRequest {
			return new NextRequest(url, {
				...init,
				headers: {
					...((init?.headers as Record<string, string>) ?? {}),
					cookie: "sb-access-token=test-admin-token",
				},
			} as ConstructorParameters<typeof NextRequest>[1]);
		}

		/** Sesi user biasa: sudah masuk, tapi bukan admin. */
		function memberRequest(
			url: string,
			init?: Record<string, unknown>,
		): NextRequest {
			return new NextRequest(url, {
				...init,
				headers: {
					...((init?.headers as Record<string, string>) ?? {}),
					cookie: "sb-access-token=test-member-token",
				},
			} as ConstructorParameters<typeof NextRequest>[1]);
		}

		/**
		 * Stub HANYA endpoint /auth/v1/user; permintaan lain diteruskan ke fetch
		 * asli (yang di harness sudah membalas `[]` untuk host supabase.co).
		 * Meny.stub seluruh fetch akan membuat panggilan REST ikutanswered oleh
		 * stub ini dan merusak skenario yang sedang diuji.
		 */
		function stubAuthApi(role: "admin" | "user" | "invalid") {
			const passthrough = globalThis.fetch;
			return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const url =
					typeof input === "string"
						? input
						: input instanceof URL
							? input.toString()
							: (input as Request).url;

				if (url.includes("/auth/v1/user")) {
					if (role === "invalid") return new Response("{}", { status: 401 });
					return new Response(
						JSON.stringify({
							id: role === "admin" ? "admin-uid-1" : "member-uid-1",
							email: `${role}@briga.id`,
							// Sengaja TIDAK menyalin role ke user_metadata: helper admin
							// harus menolaknya, itu yang diuji di test lain.
							app_metadata: role === "admin" ? { role: "admin" } : {},
						}),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					);
				}

				return passthrough(input, init);
			});
		}

		beforeEach(() => {
			process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
		});

		afterEach(() => {
			vi.unstubAllGlobals();
		});

		it("1.1: menolak GET tanpa sesi dengan 401", async () => {
			vi.stubGlobal("fetch", stubAuthApi("user"));
			const res = await getVehicles(
				new NextRequest("http://localhost:3000/api/admin/vehicles"),
			);
			const data = await res.json();

			expect(res.status).toBe(401);
			expect(data.success).toBe(false);
			// Tidak boleh membocorkan daftar kendaraan apa pun.
			expect(data.vehicles).toBeUndefined();
		});

		it("1.2: menolak sesi non-admin dengan 403", async () => {
			vi.stubGlobal("fetch", stubAuthApi("user"));
			const res = await getVehicles(
				memberRequest("http://localhost:3000/api/admin/vehicles"),
			);
			const data = await res.json();

			expect(res.status).toBe(403);
			expect(data.success).toBe(false);
			expect(data.vehicles).toBeUndefined();
		});

		it("1.3: menolak sesi dengan token invalid dengan 401", async () => {
			vi.stubGlobal("fetch", stubAuthApi("invalid"));
			const req = new NextRequest("http://localhost:3000/api/admin/vehicles", {
				headers: { cookie: "sb-access-token=invalid" },
			});
			const res = await getVehicles(req);
			const data = await res.json();

			expect(res.status).toBe(401);
			expect(data.vehicles).toBeUndefined();
		});

		it("1.4: armada kosong dijawab 200 dengan array kosong, bukan kendaraan tiruan", async () => {
			vi.stubGlobal("fetch", stubAuthApi("admin"));
			const res = await getVehicles(
				adminRequest("http://localhost:3000/api/admin/vehicles?q=wuling"),
			);
			const data = await res.json();

			// Database dijawab `[]` oleh harness, jadi ini kondisi "memang kosong".
			expect(res.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.source).toBe("supabase");
			// Inilah perbaikan inti: dulu endpoint ini membalas 200 + 2 mobil palsu.
			expect(data.vehicles).toEqual([]);
		});

		it("1.5: DB tidak terkonfigurasi dijawab 503, tanpa daftar kendaraan", async () => {
			vi.resetModules();
			const previousServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
			process.env.SUPABASE_SERVICE_ROLE_KEY = "";

			try {
				vi.stubGlobal("fetch", stubAuthApi("admin"));
				const fresh = await import("@/app/api/admin/vehicles/route");
				const res = await fresh.GET(
					adminRequest("http://localhost:3000/api/admin/vehicles"),
				);
				const data = await res.json();

				expect(res.status).toBe(503);
				expect(data.success).toBe(false);
				expect(data.vehicles).toBeUndefined();
				expect(data.source).toBe("unavailable");
			} finally {
				process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceKey;
			}
		});

		it("1.6: POST yang gagal disimpan tidak pernah membalas 201 dengan id palsu", async () => {
			vi.stubGlobal("fetch", stubAuthApi("admin"));
			const req = adminRequest("http://localhost:3000/api/admin/vehicles", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					code: "EV-09",
					name: "Wuling BinguoEV Long Range",
					licensePlate: "B 9988 EV",
					bluetoothName: "BINGUO-EV-09",
					rentalPartnerName: "Mitra Rental Berkah Mandiri",
				}),
			});

			const res = await createVehicle(req);
			const data = await res.json();

			// Dulu membalas 201 dengan id `veh_${Date.now()}` yang tidak pernah ada.
			expect(res.status).not.toBe(201);
			expect(data.success).toBe(false);
			expect(data.vehicle).toBeUndefined();
		});

		it("1.7: POST oleh admin tanpa field wajib ditolak 400", async () => {
			vi.stubGlobal("fetch", stubAuthApi("admin"));
			const req = adminRequest("http://localhost:3000/api/admin/vehicles", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "Incomplete EV" }),
			});

			const res = await createVehicle(req);
			const data = await res.json();

			expect(res.status).toBe(400);
			expect(data.success).toBe(false);
			expect(data.error).toContain("wajib diisi");
		});

		it("1.8: PATCH oleh non-admin ditolak 403", async () => {
			vi.stubGlobal("fetch", stubAuthApi("user"));
			const req = memberRequest("http://localhost:3000/api/admin/vehicles", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ code: "EV-01", bluetoothName: "AKAL-AKALAN" }),
			});

			const res = await updateVehicle(req);
			const data = await res.json();

			expect(res.status).toBe(403);
			expect(data.vehicle).toBeUndefined();
		});
	});

	// ── 2. Speedometer Vision API ──────────────────────────────
	describe("2. Speedometer AI Vision Parser API (/api/vision/parse-speedometer)", () => {
		it("2.1: should reject empty image payload with HTTP 400", async () => {
			const req = new NextRequest(
				"http://localhost:3000/api/vision/parse-speedometer",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({}),
				},
			);

			const res = await parseSpeedometer(req);
			const data = await res.json();

			expect(res.status).toBe(400);
			expect(data.success).toBe(false);
			expect(data.error).toContain("image_base64 wajib disertakan");
		});

		it("2.2: should reject expired timestamp (> 120s) as anti-spoofing protection with HTTP 400", async () => {
			const oldTimestamp = Date.now() - 200_000; // ~3.3 minutes ago
			const req = new NextRequest(
				"http://localhost:3000/api/vision/parse-speedometer",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						image_base64:
							"data:image/webp;base64,UklGRmIAAABXRUJQVlA4WAoAAAAQAAAADwAADwAAQUxQSA...",
						timestamp: oldTimestamp,
					}),
				},
			);

			const res = await parseSpeedometer(req);
			const data = await res.json();

			expect(res.status).toBe(400);
			expect(data.success).toBe(false);
			expect(data.error).toContain("kedaluwarsa");
		});

		it("2.3: should successfully parse EV cluster image and extract Odometer and SoC with high confidence", async () => {
			const validPayload = {
				image_base64:
					"data:image/webp;base64,UklGRmIAAABXRUJQVlA4WAoAAAAQAAAADwAADwAAQUxQSA_odo_14250_soc_88_synthetic_image_payload",
				vehicle_code: "EV-01",
				timestamp: Date.now(),
			};

			const req = new NextRequest(
				"http://localhost:3000/api/vision/parse-speedometer",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(validPayload),
				},
			);

			const res = await parseSpeedometer(req);
			const data = await res.json();

			expect(res.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.odometer_km).toBe(14250);
			expect(data.battery_soc_percent).toBe(88);
			expect(data.confidence).toBeGreaterThanOrEqual(0.9);
			expect(data.vehicle_model_matched).toBe("Wuling Air EV");
		});

		it("2.4: should reject anomalous negative odometer with HTTP 422", async () => {
			const invalidPayload = {
				image_base64:
					"data:image/webp;base64,odo:-50_soc:80_invalid_cluster_sample",
				timestamp: Date.now(),
			};

			const req = new NextRequest(
				"http://localhost:3000/api/vision/parse-speedometer",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(invalidPayload),
				},
			);

			const res = await parseSpeedometer(req);
			const data = await res.json();

			expect(res.status).toBe(422);
			expect(data.success).toBe(false);
			expect(data.error).toContain("odometer");
		});

		it("2.5: should reject impossible battery SoC (> 100%) with HTTP 422", async () => {
			const invalidPayload = {
				image_base64:
					"data:image/webp;base64,odo:12000_soc:145_impossible_battery_soc",
				timestamp: Date.now(),
			};

			const req = new NextRequest(
				"http://localhost:3000/api/vision/parse-speedometer",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(invalidPayload),
				},
			);

			const res = await parseSpeedometer(req);
			const data = await res.json();

			expect(res.status).toBe(422);
			expect(data.success).toBe(false);
			expect(data.error).toContain("baterai");
		});
	});

	// ── 3. Decentralized Pool-Less Geofence Corridor ────────────
	describe("3. Decentralized Fleet & Operational Corridor Geofence", () => {
		it("3.1: should include decentralized service corridor in DECENTRALIZED_SERVICE_CORRIDORS", () => {
			expect(DECENTRALIZED_SERVICE_CORRIDORS.length).toBeGreaterThan(0);
			const corridor = DECENTRALIZED_SERVICE_CORRIDORS[0];
			expect(corridor.name).toContain("Jabodetabek");
			expect(corridor.radiusMeters).toBeGreaterThanOrEqual(50_000); // broad coverage
		});

		it("3.2: should calculate distance correctly using distanceMetersBetween", () => {
			// Distance between Cikarang Dry Port and Halim Airport (~37 km)
			const distMeters = distanceMetersBetween(
				-6.30816,
				107.14987,
				-6.26652,
				106.89033,
			);
			const distKm = distMeters / 1000;
			expect(distKm).toBeGreaterThan(25);
			expect(distKm).toBeLessThan(45);
		});

		it("3.3: should allow driver located anywhere in Jabodetabek/Cikarang under decentralized mode", async () => {
			// Mock navigator.geolocation at a random rental house in Cikarang Barat (-6.275, 107.085)
			const mockPosition = {
				coords: {
					latitude: -6.275,
					longitude: 107.085,
					accuracy: 15,
				},
			};

			vi.stubGlobal("navigator", {
				geolocation: {
					getCurrentPosition: (success: (pos: typeof mockPosition) => void) =>
						success(mockPosition),
				},
			});

			const result = await checkHubGeofence({ allowDecentralized: true });
			expect(result.allowed).toBe(true);
			expect(result.reason).toContain("radius");

			vi.unstubAllGlobals();
		});
	});
});
