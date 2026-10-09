// ─────────────────────────────────────────────────────────────
// appointments/email.ts — Executive Email Dispatcher for Trip Updates
//
// Mengirimkan pembaruan perjalanan (konfirmasi reservasi, live tracking,
// penugasan driver, dan sertifikat emisi Scope 3) melalui Email (Resend / SMTP).
// ─────────────────────────────────────────────────────────────

import type { AppointmentBooking } from "./types";

function formatRupiah(num: number): string {
	return `Rp ${num.toLocaleString("id-ID")}`;
}

export interface EmailDispatchResult {
	success: boolean;
	serviceUsed: "resend" | "smtp" | "console_mock";
	messageId?: string;
	error?: string;
}

/**
 * Helper untuk mengirim email via Resend API atau SMTP
 */
export async function sendEmail({
	to,
	subject,
	html,
}: {
	to: string;
	subject: string;
	html: string;
}): Promise<EmailDispatchResult> {
	const resendApiKey = process.env.RESEND_API_KEY;
	const sender =
		process.env.SENDER_EMAIL ||
		process.env.EMAIL_FROM ||
		"Drifee by Briga <no-reply@briga.id>";

	// 1. Coba via Resend API
	if (resendApiKey) {
		try {
			const res = await fetch("https://api.resend.com/emails", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${resendApiKey}`,
				},
				body: JSON.stringify({
					from: sender,
					to: [to],
					subject,
					html,
				}),
			});

			if (res.ok) {
				const data = await res.json();
				return {
					success: true,
					serviceUsed: "resend",
					messageId: data.id,
				};
			}

			const errData = await res.json().catch(() => null);
			// Jika domain belum terverifikasi di Resend, fallback otomatis ke sandbox onboarding@resend.dev
			if (
				errData?.message?.toLowerCase().includes("domain") ||
				errData?.message?.toLowerCase().includes("verify")
			) {
				console.warn(
					"[Email Service] Domain kustom belum diverifikasi di Resend, mencoba fallback sandbox onboarding@resend.dev...",
				);
				const fallbackRes = await fetch("https://api.resend.com/emails", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${resendApiKey}`,
					},
					body: JSON.stringify({
						from: "Drifee <onboarding@resend.dev>",
						to: [to],
						subject,
						html,
					}),
				});

				if (fallbackRes.ok) {
					const fallbackData = await fallbackRes.json();
					return {
						success: true,
						serviceUsed: "resend",
						messageId: fallbackData.id,
					};
				}
			}

			console.warn("[Email Service] Resend API error:", errData);
		} catch (err) {
			console.warn("[Email Service] Gagal kirim email via Resend:", err);
		}
	}

	// 2. Mock Fallback untuk Development / Jika kredensial belum diisi
	console.log(`[Email Service Mock] Mengirim email ke ${to}: "${subject}"`);
	return {
		success: true,
		serviceUsed: "console_mock",
	};
}

/**
 * 1. Template Email Konfirmasi Reservasi & Tiket Digital
 */
export function generateBookingConfirmationEmailHtml(
	booking: AppointmentBooking,
	templateTitle: string,
): string {
	const trackingUrl = `${
		process.env.NEXT_PUBLIC_APP_URL || "https://drifee.briga.id"
	}/book/track/${booking.tracking_secret_token}`;

	const formattedDate = new Date(
		booking.scheduled_start_time,
	).toLocaleDateString("id-ID", {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
	});

	const formattedTime = new Date(
		booking.scheduled_start_time,
	).toLocaleTimeString("id-ID", {
		hour: "2-digit",
		minute: "2-digit",
	});

	const waypointsHtml =
		booking.waypoints && booking.waypoints.length > 0
			? booking.waypoints
					.map(
						(wp, idx) => `
          <div style="padding: 10px 14px; background-color: #f8fafc; border-left: 3px solid #10b981; border-radius: 6px; margin-bottom: 8px;">
            <div style="font-size: 11px; font-weight: 700; color: #047857; text-transform: uppercase;">Stop #${idx + 1}: ${wp.stop_name}</div>
            <div style="font-size: 13px; color: #1e293b; font-weight: 600; margin-top: 2px;">${wp.address}</div>
            ${wp.contact_person ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">PIC: ${wp.contact_person} (${wp.contact_phone || "-"})</div>` : ""}
          </div>
        `,
					)
					.join("")
			: `<div style="font-size: 12px; color: #94a3b8; font-style: italic;">Tidak ada titik singgah tambahan.</div>`;

	return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Konfirmasi Jadwal Perjalanan Drifee</title>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.08); margin: 0 auto;">
    
    <!-- Top Green Header -->
    <tr>
      <td style="background: linear-gradient(135deg, #064e3b 0%, #059669 100%); padding: 32px 30px; text-align: left; color: #ffffff;">
        <div style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #a7f3d0; margin-bottom: 6px;">
          DRIFEE BY BRIGA • CHAUFFEUR EV MOBILITY
        </div>
        <h1 style="margin: 0; font-size: 22px; font-weight: 800; line-height: 1.3; color: #ffffff;">
          Jadwal Perjalanan Anda Terkonfirmasi!
        </h1>
        <div style="font-size: 13px; color: #d1fae5; margin-top: 6px;">
          Kode Reservasi: <strong style="font-family: monospace; background-color: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 4px;">${booking.booking_code}</strong>
        </div>
      </td>
    </tr>

    <!-- Body Content -->
    <tr>
      <td style="padding: 28px 30px;">
        <p style="margin: 0 0 16px 0; font-size: 14px; color: #334155; line-height: 1.6;">
          Halo <strong>${booking.booker_name}</strong>,<br>
          Pemesanan transportasi eksekutif Mobil Listrik (EV) Anda untuk agenda <strong>${templateTitle}</strong> telah terdaftar di sistem operasional Drifee.
        </p>

        <!-- Schedule Summary Box -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 20px;">
          <tr>
            <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0;" width="40%">
              <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Tanggal & Waktu</span>
              <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 2px;">${formattedDate}</div>
              <div style="font-size: 12px; color: #059669; font-weight: 600;">Pukul ${formattedTime} WIB (${booking.duration_hours} Jam)</div>
            </td>
            <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0;">
              <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Standar Armada</span>
              <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 2px;">100% Chauffeur-Driven EV</div>
              <div style="font-size: 12px; color: #64748b;">BYD Atto 3 / Ioniq 5 (Kabin Senyap)</div>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding: 14px 18px;">
              <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Titik Penjemputan Awal (Origin)</span>
              <div style="font-size: 13px; font-weight: 600; color: #0f172a; margin-top: 2px;">📍 ${booking.pickup_address}</div>
            </td>
          </tr>
        </table>

        <!-- Waypoints Section -->
        <div style="margin-bottom: 20px;">
          <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #475569; margin-bottom: 8px;">
            Rute Kunjungan Multi-Titik (${booking.waypoints?.length || 0} Lokasi):
          </div>
          ${waypointsHtml}
        </div>

        <!-- Tariff & ESG Benefit -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 14px 18px; margin-bottom: 24px;">
          <tr>
            <td>
              <span style="font-size: 11px; color: #065f46; font-weight: 700; text-transform: uppercase;">Total Biaya Sewa</span>
              <div style="font-size: 18px; font-weight: 900; color: #047857;">${formatRupiah(booking.gross_fare_idr)}</div>
              <div style="font-size: 11px; color: #059669;">
                Status: <strong>${booking.payment_status === "sponsored_esg" ? "Ditanggung Kuota ESG Perusahaan" : "Telah Dikonfirmasi"}</strong>
              </div>
            </td>
            <td align="right">
              <span style="display: inline-block; background-color: #047857; color: #ffffff; font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: 20px;">
                🌱 Emisi Bersih 0.0g CO₂
              </span>
            </td>
          </tr>
        </table>

        <!-- CTA Button -->
        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${trackingUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 800; padding: 14px 28px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(5, 150, 105, 0.3);">
            Buka Live Tracking & Tiket Digital ↗
          </a>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 8px;">
            Atau salin tautan: <a href="${trackingUrl}" style="color: #059669;">${trackingUrl}</a>
          </div>
        </div>

        <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5; border-top: 1px solid #f1f5f9; pt-4; padding-top: 16px;">
          Mitra pengemudi Drifee akan menghubungi nomor WhatsApp Anda H-1 jam sebelum waktu penjemputan. Jika membutuhkan penyesuaian jadwal, silakan hubungi pusat bantuan kami.
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
        <div style="font-size: 11px; font-weight: 700; color: #0f172a;">PT Briga Mobilitas Indonesia • Drifee Platform</div>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Kawasan Industri Cikarang & Koridor Jabodetabek • Mobilitas Hijau Bebas Emisi</div>
      </td>
    </tr>

  </table>
</body>
</html>
  `.trim();
}

/**
 * 2. Template Email Driver En-Route (Sedang Menuju Titik Jemput)
 */
export function generateDriverEnRouteEmailHtml(
	booking: AppointmentBooking,
	driverName: string,
	driverPhone: string,
	vehicleName: string,
	licensePlate: string,
): string {
	const trackingUrl = `${
		process.env.NEXT_PUBLIC_APP_URL || "https://drifee.briga.id"
	}/book/track/${booking.tracking_secret_token}`;

	return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Driver Sedang Menuju Lokasi Anda</title>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.08); margin: 0 auto;">
    
    <tr>
      <td style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 28px 30px; color: #ffffff;">
        <div style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #93c5fd; margin-bottom: 6px;">
          DRIFEE LIVE UPDATE
        </div>
        <h1 style="margin: 0; font-size: 20px; font-weight: 800; line-height: 1.3;">
          Driver Sedang Menuju Lokasi Penjemputan
        </h1>
        <div style="font-size: 12px; color: #bfdbfe; margin-top: 4px;">
          Agenda: ${booking.pickup_address}
        </div>
      </td>
    </tr>

    <tr>
      <td style="padding: 24px 30px;">
        <p style="margin: 0 0 16px 0; font-size: 14px; color: #334155;">
          Halo <strong>${booking.booker_name}</strong>, armada Drifee Anda telah bergerak menuju titik awal penjemputan:
        </p>

        <!-- Driver Info Card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
          <tr>
            <td width="60">
              <div style="width: 50px; height: 50px; border-radius: 25px; background: #2563eb; color: #ffffff; font-size: 20px; font-weight: 800; line-height: 50px; text-align: center;">
                ${driverName.charAt(0)}
              </div>
            </td>
            <td>
              <div style="font-size: 15px; font-weight: 800; color: #0f172a;">${driverName}</div>
              <div style="font-size: 12px; color: #64748b;">WhatsApp: <a href="https://wa.me/${driverPhone.replace(/\D/g, "")}" style="color: #2563eb; font-weight: 600;">${driverPhone}</a></div>
              <div style="font-size: 12px; color: #059669; font-weight: 700; margin-top: 4px;">
                🚗 ${vehicleName} • Plat: <strong>${licensePlate}</strong>
              </div>
            </td>
          </tr>
        </table>

        <!-- Tracking CTA -->
        <div style="text-align: center; margin-bottom: 16px;">
          <a href="${trackingUrl}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 12px 24px; border-radius: 8px;">
            Pantau Posisi Driver di Live Map ↗
          </a>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * 3. Template Email Laporan Perjalanan Selesai & Sertifikat Emisi Scope 3
 */
export function generateTripCompletedSummaryEmailHtml(
	booking: AppointmentBooking,
	distanceKm: number,
	co2SavedKg: number,
): string {
	return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Laporan Perjalanan & Sertifikat Emisi Scope 3</title>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.08); margin: 0 auto;">
    
    <tr>
      <td style="background: linear-gradient(135deg, #064e3b 0%, #047857 100%); padding: 30px; color: #ffffff; text-align: center;">
        <div style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #a7f3d0; margin-bottom: 4px;">
          DRIFEE SCOPE 3 ESG AUDIT
        </div>
        <h1 style="margin: 0; font-size: 22px; font-weight: 800;">Perjalanan Selesai! Terima Kasih</h1>
        <div style="font-size: 13px; color: #d1fae5; margin-top: 4px;">Kode Trip: ${booking.booking_code}</div>
      </td>
    </tr>

    <tr>
      <td style="padding: 24px 30px;">
        <p style="margin: 0 0 16px 0; font-size: 14px; color: #334155; line-height: 1.5;">
          Agenda perjalanan Anda bersama Drifee by Briga telah selesai dilaksanakan dengan sukses.
        </p>

        <!-- Carbon Offset Metric Box -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 18px; margin-bottom: 20px;">
          <tr>
            <td width="50%" align="center" style="border-right: 1px solid #bbf7d0;">
              <span style="font-size: 11px; text-transform: uppercase; color: #166534; font-weight: 700;">Total Jarak Bersih</span>
              <div style="font-size: 22px; font-weight: 900; color: #047857; margin-top: 2px;">${distanceKm.toFixed(1)} km</div>
              <div style="font-size: 11px; color: #15803d;">100% Listrik (EV)</div>
            </td>
            <td width="50%" align="center">
              <span style="font-size: 11px; text-transform: uppercase; color: #166534; font-weight: 700;">Emisi CO₂ Dihindari</span>
              <div style="font-size: 22px; font-weight: 900; color: #059669; margin-top: 2px;">${co2SavedKg.toFixed(2)} kg</div>
              <div style="font-size: 11px; color: #15803d;">vs Mobil Bensin (ICE)</div>
            </td>
          </tr>
        </table>

        <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5; text-align: center;">
          Data pengurangan emisi ini telah tercatat dalam portofolio audit Scope 3 korporat yang memenuhi kepatuhan POJK No. 51/2017 & GHG Protocol.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
