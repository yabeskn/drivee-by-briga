#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// scripts/daily-payout-reporter.mjs
// Daily Driver Settlement & Carbon Audit Agent — CLI Runner
//
// Cara Penggunaan:
//   npm run report:payout
//   npm run report:payout -- --date=2026-10-01
//   npm run report:payout -- --recipient=founder@briga.id
// ─────────────────────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

// 1. Baca environment variables dari .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const env = {};
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
    }
  }
}

// Merge with process.env
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';
const resendApiKey = process.env.RESEND_API_KEY || env.RESEND_API_KEY || '';
const adminEmail = process.env.ADMIN_REPORT_EMAIL || env.ADMIN_REPORT_EMAIL || 'info@briga.id';
const senderEmail = process.env.SENDER_EMAIL || env.SENDER_EMAIL || 'Drive-e Report <report@briga.id>';

// 2. Parse argumen CLI
const args = process.argv.slice(2);
let targetDate;
let recipientEmail = adminEmail;

for (const arg of args) {
  if (arg.startsWith('--date=')) {
    targetDate = arg.split('=')[1];
  } else if (arg.startsWith('--recipient=')) {
    recipientEmail = arg.split('=')[1];
  }
}

// 3. Tentukan tanggal WIB jika tidak disediakan
if (!targetDate) {
  const now = new Date();
  const wibTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  targetDate = wibTime.toISOString().slice(0, 10);
}

const startIso = `${targetDate}T00:00:00+07:00`;
const endIso = `${targetDate}T23:59:59.999+07:00`;

const EV_CAR_CO2_SAVED_PER_KM = 0.137; // kg CO2 avoided vs ICE
const DEFAULT_FEE_RATE = 0.15; // 15% platform fee
const BRC_TO_IDR = 5000;

function formatIdr(num) {
  return `Rp ${Math.round(num).toLocaleString('id-ID')}`;
}

function escapeCsv(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function main() {
  console.log('='.repeat(75));
  console.log(' DRIVEE BY BRIGA — DAILY DRIVER SETTLEMENT & CARBON AUDIT AGENT');
  console.log('='.repeat(75));
  console.log(`Periode Laporan  : ${targetDate} (00:00 - 23:00 WIB)`);
  console.log(`Tujuan Notifikasi: ${recipientEmail}`);
  console.log(`Supabase Target  : ${supabaseUrl ? supabaseUrl : '(Mode Standalone / In-Memory)'}`);
  console.log('-'.repeat(75));

  let trips = [];
  let driversList = [];

  if (supabaseUrl && serviceKey) {
    try {
      const supabase = createClient(supabaseUrl, serviceKey);

      // Query trips
      const { data: tripData, error: tripErr } = await supabase
        .from('trips')
        .select('*')
        .gte('start_time', startIso)
        .lte('start_time', endIso)
        .neq('verification_status', 'rejected');

      if (tripErr) {
        console.warn(`[Supabase Error] Gagal membaca trips: ${tripErr.message}`);
      } else if (tripData) {
        trips = tripData;
      }

      // Query drivers (dengan fallback jika skema bank belum dimigrasi)
      let { data: driverData, error: driverErr } = await supabase
        .from('drivers')
        .select('id, name, phone, email, bank_name, bank_account_number, bank_account_holder');

      if (driverErr && driverErr.message.includes('bank_name')) {
        const fallbackQuery = await supabase
          .from('drivers')
          .select('id, name, phone, email');
        driverData = fallbackQuery.data;
        driverErr = fallbackQuery.error;
      }

      if (driverErr) {
        console.warn(`[Supabase Error] Gagal membaca drivers: ${driverErr.message}`);
      } else if (driverData) {
        driversList = driverData;
      }
    } catch (dbErr) {
      console.warn(`[Database Error] Koneksi ke Supabase gagal: ${dbErr.message}`);
    }
  }

  // Map drivers by ID
  const driverMap = new Map();
  for (const d of driversList) {
    driverMap.set(d.id, d);
  }

  // Agregasi settlements per driver
  const settlementMap = new Map();

  for (const t of trips) {
    const driverId = t.driver_id;
    const d = driverMap.get(driverId) || {
      id: driverId,
      name: `Pengemudi #${driverId?.slice(0, 6) || 'Unknown'}`,
      phone: '-',
    };

    const dist = Number(t.distance_km) || 0;
    const revDist = Number(t.revenue_distance_km) || dist;
    const co2 = Number(
      (t.co2_avoided_kg ?? t.esg_co2_avoided_kg ?? dist * EV_CAR_CO2_SAVED_PER_KM).toFixed(2)
    );

    let gross = 0;
    let payout = 0;

    if (t.financial_split?.driverNetPayoutIdr) {
      gross = t.financial_split.grossFareIdr;
      payout = t.financial_split.driverNetPayoutIdr;
    } else {
      gross = Math.max(15000, Math.round((15000 + revDist * 4500) / 1000) * 1000);
      const voucherCoins = Number(t.financial_split?.brcCoinsUsed || 0);
      const subsidyIdr = Math.min(voucherCoins * BRC_TO_IDR, gross);
      const standardFee = Math.round(gross * DEFAULT_FEE_RATE);
      const absorbed = Math.min(subsidyIdr, standardFee);
      const effFee = Math.max(0, standardFee - absorbed);
      payout = gross - effFee;
    }

    let bankInfo = 'Rekening Belum Ada (Hubungi WA)';
    if (d.bank_name?.trim() && d.bank_account_number?.trim()) {
      bankInfo = `${d.bank_name.trim()} - ${d.bank_account_number.trim()}${d.bank_account_holder?.trim() ? ` a.n. ${d.bank_account_holder.trim()}` : ''}`;
    }

    let item = settlementMap.get(driverId);
    if (!item) {
      item = {
        driverId,
        driverName: d.name || `Pengemudi #${driverId.slice(0, 6)}`,
        driverPhone: d.phone || '-',
        bankInfo,
        tripCount: 0,
        totalCo2AvoidedKg: 0,
        totalPayoutIdr: 0,
      };
      settlementMap.set(driverId, item);
    }

    item.tripCount += 1;
    item.totalCo2AvoidedKg = Number((item.totalCo2AvoidedKg + co2).toFixed(2));
    item.totalPayoutIdr += payout;
  }

  const driverSettlements = Array.from(settlementMap.values()).sort(
    (a, b) => b.totalPayoutIdr - a.totalPayoutIdr
  );

  const totalDrivers = driverSettlements.length;
  const totalTrips = driverSettlements.reduce((sum, d) => sum + d.tripCount, 0);
  const totalCo2 = Number(
    driverSettlements.reduce((sum, d) => sum + d.totalCo2AvoidedKg, 0).toFixed(2)
  );
  const totalPayout = driverSettlements.reduce((sum, d) => sum + d.totalPayoutIdr, 0);

  // Print Terminal Summary
  console.log(`\nHASIL AUDIT SETTLEMENT HARIAN (${driverSettlements.length} Pengemudi):`);
  console.log('-'.repeat(110));
  console.log(
    `| ${'Nama Pengemudi'.padEnd(20)} | ${'Nomor HP'.padEnd(14)} | ${'Info Rekening Bank'.padEnd(30)} | ${'Trip'.padStart(5)} | ${'CO2 (kg)'.padStart(9)} | ${'Transfer (Rp)'.padStart(14)} |`
  );
  console.log('-'.repeat(110));

  if (driverSettlements.length === 0) {
    console.log(`| ${'Tidak ada trip yang tercatat pada tanggal ini.'.padEnd(106)} |`);
  } else {
    for (const d of driverSettlements) {
      console.log(
        `| ${d.driverName.slice(0, 20).padEnd(20)} | ${d.driverPhone.slice(0, 14).padEnd(14)} | ${d.bankInfo.slice(0, 30).padEnd(30)} | ${String(d.tripCount).padStart(5)} | ${d.totalCo2AvoidedKg.toFixed(2).padStart(9)} | ${formatIdr(d.totalPayoutIdr).padStart(14)} |`
      );
    }
  }

  console.log('-'.repeat(110));
  console.log(
    `| ${'TOTAL KESELURUHAN'.padEnd(68)} | ${String(totalTrips).padStart(5)} | ${totalCo2.toFixed(2).padStart(9)} | ${formatIdr(totalPayout).padStart(14)} |`
  );
  console.log('='.repeat(110));

  // Generate CSV File
  const csvHeaders = [
    'Nama Pengemudi',
    'Nomor HP',
    'Info Rekening Bank',
    'Jumlah Trip',
    'Total Emisi CO2 Dihindari (kg)',
    'Total Uang Transfer (Rp)',
  ];
  const csvRows = [csvHeaders.map(escapeCsv).join(',')];
  for (const d of driverSettlements) {
    csvRows.push(
      [
        escapeCsv(d.driverName),
        escapeCsv(d.driverPhone),
        escapeCsv(d.bankInfo),
        d.tripCount,
        d.totalCo2AvoidedKg.toFixed(2),
        d.totalPayoutIdr,
      ].join(',')
    );
  }
  csvRows.push([escapeCsv('TOTAL'), '', '', totalTrips, totalCo2.toFixed(2), totalPayout].join(','));

  const csvContent = csvRows.join('\r\n');
  const reportsDir = path.resolve(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  const csvFilePath = path.join(reportsDir, `daily-payout-${targetDate}.csv`);
  fs.writeFileSync(csvFilePath, csvContent, 'utf8');
  console.log(`\n[CSV Export] Berhasil disimpan di: ${csvFilePath}`);

  // Send Email if Resend API Key is available
  if (resendApiKey) {
    console.log(`\n[Email Dispatch] Mengirim laporan via Resend ke ${recipientEmail}...`);
    try {
      const csvBase64 = Buffer.from(csvContent, 'utf-8').toString('base64');
      const emailHtml = `
        <h2>Rekap Settlement Pengemudi & Audit Karbon - ${targetDate}</h2>
        <p><strong>Total Transfer:</strong> ${formatIdr(totalPayout)}</p>
        <p><strong>Total Emisi CO₂ Dihindari:</strong> ${totalCo2.toFixed(2)} kg</p>
        <p><strong>Total Trip:</strong> ${totalTrips} perjalanan</p>
        <p>Silakan lihat lampiran CSV untuk daftar lengkap perincian transfer rekening.</p>
      `;

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: senderEmail,
          to: [recipientEmail],
          subject: `[Drive-e] Rekap Settlement Pengemudi & Audit Karbon - ${targetDate}`,
          html: emailHtml,
          attachments: [
            {
              filename: `daily-payout-${targetDate}.csv`,
              content: csvBase64,
            },
          ],
        }),
      });

      if (response.ok) {
        const json = await response.json();
        console.log(`[Email Dispatch] Sukses dikirim! Message ID: ${json.id}`);
      } else {
        const errText = await response.text();
        console.warn(`[Email Dispatch] Resend error (${response.status}): ${errText}`);
      }
    } catch (emailErr) {
      console.warn(`[Email Dispatch] Gagal mengirim email: ${emailErr.message}`);
    }
  } else {
    console.log('[Email Dispatch] RESEND_API_KEY tidak disetel. Email dilewati (file CSV tersimpan lokal).');
  }

  console.log('\nProses selesai.');
}

main().catch((err) => {
  console.error('\nFatal Error:', err);
  process.exit(1);
});
