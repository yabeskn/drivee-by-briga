import { describe, expect, it } from "vitest";
import {
	generateBookingConfirmationEmailHtml,
	generateDriverEnRouteEmailHtml,
	generateTripCompletedSummaryEmailHtml,
} from "@/lib/appointments/email";
import {
	calculateAppointmentFare,
	calculateOvertimeFare,
	getPricingTier,
} from "@/lib/appointments/pricing";
import {
	createAppointmentBooking,
	getBookingByTrackingToken,
	getTemplateBySlug,
} from "@/lib/appointments/service";
import {
	calculateHaversineDistanceKm,
	optimizeMultiStopRoute,
} from "@/lib/appointments/tsp-router";

describe("Appointment Setter Engine", () => {
	describe("Decoy Pricing & Take-Rate Split", () => {
		it("should match verified 8h best value pricing structure", () => {
			const tier8 = getPricingTier(8);
			expect(tier8.grossFareIdr).toBe(495_000);
			expect(tier8.driverTakeRatePct).toBe(0.85);
			expect(tier8.driverPayoutIdr).toBe(420_750); // Covers Rp 260k rental + profit
			expect(tier8.platformFeeIdr).toBe(74_250);
			expect(tier8.isPopularBadge).toBe(true);
			expect(tier8.savingsVsHourlyPct).toBe(44);
		});

		it("should calculate correct decoy 4h and anchor 2h fares", () => {
			const tier2 = getPricingTier(2);
			expect(tier2.grossFareIdr).toBe(220_000);
			expect(tier2.driverPayoutIdr).toBe(187_000);

			const tier4 = getPricingTier(4);
			expect(tier4.grossFareIdr).toBe(380_000);
			expect(tier4.driverPayoutIdr).toBe(323_000);
		});

		it("should correctly compute fare with corporate BrigaCoin subsidy", () => {
			// 10 BRC = Rp 50.000
			const calc = calculateAppointmentFare(8, 10);
			expect(calc.baseFareIdr).toBe(495_000);
			expect(calc.discountIdr).toBe(50_000);
			expect(calc.finalPayableIdr).toBe(445_000);
			// Driver payout remains protected at 85% gross
			expect(calc.driverPayoutIdr).toBe(420_750);
		});

		it("should calculate overtime fares with 85% driver take-rate", () => {
			const overtime = calculateOvertimeFare(2); // 2 hours overtime
			expect(overtime.overtimeHours).toBe(2);
			expect(overtime.overtimeFareIdr).toBe(120_000); // 2 * 60k
			expect(overtime.driverOvertimePayoutIdr).toBe(102_000); // 85% of 120k
			expect(overtime.platformOvertimeFeeIdr).toBe(18_000); // 15%
		});
	});

	describe("TSP Multi-Stop Routing & Scope 3 Carbon Estimation", () => {
		it("should accurately compute haversine distance between coordinates", () => {
			// Jakarta (Halim) to Cikarang
			const dist = calculateHaversineDistanceKm(
				-6.2483,
				106.8839,
				-6.3312,
				107.1416,
			);
			expect(dist).toBeGreaterThan(25);
			expect(dist).toBeLessThan(35);
		});

		it("should optimize multi-stop route and calculate CO2 avoided", async () => {
			const origin = {
				name: "Stasiun Halim Whoosh",
				address: "Stasiun Halim",
				lat: -6.2483,
				lng: 106.8839,
			};

			const waypoints = [
				{
					name: "Stop 1: Grand Wisata",
					address: "Grand Wisata",
					lat: -6.2848,
					lng: 107.0371,
				},
				{
					name: "Stop 2: Lippo Cikarang",
					address: "Lippo Cikarang",
					lat: -6.3312,
					lng: 107.1416,
				},
				{
					name: "Stop 3: MM2100",
					address: "MM2100 Cikarang Barat",
					lat: -6.2974,
					lng: 107.0984,
				},
			];

			const result = await optimizeMultiStopRoute(origin, waypoints);
			expect(result.optimizedOrder.length).toBe(4); // origin + 3 stops
			expect(result.totalDistanceKm).toBeGreaterThan(0);
			expect(result.estimatedCo2AvoidedKg).toBeGreaterThan(0);
			expect(result.polyline.length).toBeGreaterThanOrEqual(4);
		});
	});

	describe("Booking Lifecycle & Secret Tracking Token", () => {
		it("should retrieve demo template by slug", async () => {
			const tpl = await getTemplateBySlug("cikarang-executive-visit");
			expect(tpl).toBeDefined();
			expect(tpl?.slug).toBe("cikarang-executive-visit");
			expect(tpl?.default_duration).toBe(8);
		});

		it("should create booking with DRF-APT code and random tracking token", async () => {
			const res = await createAppointmentBooking({
				templateSlug: "cikarang-executive-visit",
				bookerName: "Dr. Pratama",
				bookerPhone: "081234567890",
				scheduledDate: "2026-10-15",
				scheduledStartTime: "08:00:00",
				durationHours: 8,
				pickupAddress: "Lobi Hotel Mulia Jakarta",
				pickupLat: -6.215,
				pickupLng: 106.8,
				waypoints: [
					{
						stop_name: "Pabrik Cikarang 1",
						address: "Kawasan Industri GIIC",
						lat: -6.3688,
						lng: 107.1852,
					},
				],
			});

			expect(res.success).toBe(true);
			expect(res.booking).toBeDefined();
			expect(res.booking?.booking_code).toMatch(/^DRF-APT-\d{6}-[A-F0-9]{6}$/);
			expect(res.booking?.driver_payout_idr).toBe(420_750);
			expect(res.booking?.tracking_secret_token).toHaveLength(48); // 24 hex bytes = 48 chars

			// Verify token lookup
			const token = res.booking?.tracking_secret_token;
			if (!token) throw new Error("Expected token to exist");
			const fetched = await getBookingByTrackingToken(token);
			expect(fetched).toBeDefined();
			expect(fetched?.booker_name).toBe("Dr. Pratama");
			expect(fetched?.waypoints?.length).toBe(1);
		});
	});

	describe("Multi-Channel Email Notifications", () => {
		it("should generate professional HTML email for booking confirmation", () => {
			const mockBooking = {
				id: "b-01",
				booking_code: "DRF-APT-261015-XYZ123",
				booker_name: "Ibu Dian HR",
				booker_phone: "081299998888",
				booker_email: "dian@cikarang-corp.com",
				guest_count: 1,
				scheduled_date: "2026-10-15",
				scheduled_start_time: "2026-10-15T08:00:00Z",
				scheduled_end_time: "2026-10-15T16:00:00Z",
				duration_hours: 8 as const,
				pickup_address: "Stasiun Halim Whoosh",
				pickup_lat: -6.2483,
				pickup_lng: 106.8839,
				gross_fare_idr: 495_000,
				platform_fee_idr: 74_250,
				driver_payout_idr: 420_750,
				payment_status: "sponsored_esg" as const,
				booking_status: "unassigned" as const,
				tracking_secret_token: "token-secret-123456",
				waypoints: [
					{
						stop_order: 1,
						stop_name: "Pabrik Cikarang 1",
						address: "Kawasan Industri GIIC",
						lat: -6.3688,
						lng: 107.1852,
					},
				],
			};

			const confirmHtml = generateBookingConfirmationEmailHtml(
				mockBooking,
				"Executive Factory Tour",
			);
			expect(confirmHtml).toContain("DRF-APT-261015-XYZ123");
			expect(confirmHtml).toContain("Ibu Dian HR");
			expect(confirmHtml).toContain("Stasiun Halim Whoosh");
			expect(confirmHtml).toContain("token-secret-123456");

			const enRouteHtml = generateDriverEnRouteEmailHtml(
				mockBooking,
				"Pak Joko",
				"081288887777",
				"BYD Atto 3",
				"B 1234 DRI",
			);
			expect(enRouteHtml).toContain("Pak Joko");
			expect(enRouteHtml).toContain("B 1234 DRI");

			const completedHtml = generateTripCompletedSummaryEmailHtml(
				mockBooking,
				120.5,
				16.51,
			);
			expect(completedHtml).toContain("120.5 km");
			expect(completedHtml).toContain("16.51 kg");
		});
	});

	describe("Shared Lynk.id Account (Brigawan Ecosystem)", () => {
		it("should safely ignore orders from other Brigawan products without error", async () => {
			const { POST } = await import(
				"@/app/api/appointments/webhook/lynk/route"
			);
			const { NextRequest } = await import("next/server");

			// Simulasi transaksi produk Brigawan lain (bukan Drifee)
			const fakeBrigawanReq = new NextRequest(
				"http://localhost:3000/api/appointments/webhook/lynk",
				{
					method: "POST",
					body: JSON.stringify({
						order_id: "BRG-OTHER-9999",
						status: "SUCCESS",
						amount: 50000,
						notes: "Produk Marketplace Brigawan",
					}),
				},
			);

			const response = await POST(fakeBrigawanReq);
			const json = await response.json();
			expect(response.status).toBe(200);
			expect(json.success).toBe(true);
			expect(json.ignored).toBe(true);
			expect(json.message).toContain("Non-Drifee order acknowledged");
		});
	});
});
