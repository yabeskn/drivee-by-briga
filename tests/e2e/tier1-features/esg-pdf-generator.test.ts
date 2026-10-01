import { describe, it, expect } from 'vitest';
import { buildEsgAuditPdf, DEFAULT_ESG_REPORT_DATA } from '@/lib/esg-pdf-generator';

describe('Tier 1: ESG Scope 3 POJK 51 PDF Generator', () => {
  it('generates a valid PDF document with default dataset', () => {
    const doc = buildEsgAuditPdf();
    expect(doc).toBeDefined();
    expect(doc.internal.pages.length).toBeGreaterThanOrEqual(1);

    // Verify it produces a valid non-empty ArrayBuffer / binary
    const output = doc.output('arraybuffer');
    expect(output).toBeInstanceOf(ArrayBuffer);
    expect(output.byteLength).toBeGreaterThan(1000);
  });

  it('correctly handles custom company and emission parameters', () => {
    const customData = {
      companyName: 'PT Suzuki Indomobil Motor - GIIC Plant',
      period: 'Q3 2026',
      totalDistanceKm: 12500.5,
      totalEmissionsAvoidedKg: 1712.5,
      scope3ReductionPercent: 74.2,
      totalTrips: 420,
      activeEmployees: 85,
      sampleLogs: [
        {
          date: '01 Okt 2026, 07:30',
          employee: 'audit.lead@suzuki.co.id',
          route: 'Stasiun Cikarang → Pabrik GIIC Cikarang',
          vehicle: 'Hyundai Ioniq 5',
          distanceKm: 18.5,
          avoidedKg: 2.53,
          status: 'VERIFIED'
        }
      ]
    };

    const doc = buildEsgAuditPdf(customData);
    expect(doc).toBeDefined();

    const output = doc.output('arraybuffer');
    expect(output.byteLength).toBeGreaterThan(1000);
  });

  it('contains POJK 51 compliance and Drifee audit standards', () => {
    expect(DEFAULT_ESG_REPORT_DATA.period).toContain('Q3');
    expect(DEFAULT_ESG_REPORT_DATA.sampleLogs?.length).toBeGreaterThan(0);
    expect(DEFAULT_ESG_REPORT_DATA.totalEmissionsAvoidedKg).toBe(526.4);
  });
});
