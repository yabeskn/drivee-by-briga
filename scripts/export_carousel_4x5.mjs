// scripts/export_carousel_4x5.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { jsPDF } from "jspdf";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT_DIR, "media", "carousel_4x5");

if (!fs.existsSync(OUTPUT_DIR)) {
	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Data for 6 Carousel Slides (Aspect Ratio 4:5 -> 1080 x 1350 px)
const SLIDES = [
	{
		slideNumber: "01/06",
		badge: "COVER • EFISIENSI EV",
		badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
		tagline: "PANDUAN TELEMATIKA & HABIT",
		title: "4 Hal Sepele yang Bikin Baterai EV Cepat Drop Tanpa Disadari ⚡",
		subtitle:
			"Bukan kapasitas baterai yang kurang awet, tapi kebiasaan menginjak pedal gas yang masih terbawa dari mobil konvensional.",
		hasComparison: true,
		comparison: {
			left: {
				title: "Gaya Agresif (Boros)",
				metric: "28 kWh / 100 km",
				status: "Thermal Spike & Boros Baterai",
				color: "border-rose-200 bg-rose-50/50 text-rose-700",
				meterWidth: "85%",
				meterColor: "bg-rose-500",
			},
			right: {
				title: "Eco-Zen Driver (Optimal)",
				metric: "14 kWh / 100 km",
				status: "+35% Jarak Tempuh Maksimal",
				color: "border-emerald-200 bg-emerald-50/50 text-emerald-700",
				meterWidth: "40%",
				meterColor: "bg-emerald-500",
			},
		},
		footerTip: "🔖 Simpan slide ini buat panduan jalan jauh nanti!",
		cta: "Geser ke Kiri ➔",
	},
	{
		slideNumber: "02/06",
		badge: "MASALAH #1 • AKSELERASI",
		badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
		tagline: "PHANTOM ACCELERATION",
		title: "1. Kaki Kanan Tidak Stabil di Pedal Gas",
		subtitle:
			"Menekan dan melepas pedal secara berulang-ulang di jalan datar menyerap daya 2x lebih banyak dibanding injakan halus yang konstan.",
		bulletPoints: [
			{
				bold: "Lonjakan Arus Instan:",
				text: "Torsi instan EV memicu lonjakan panas pada sel baterai tiap kali pedal dibejek mendadak.",
			},
			{
				bold: "Solusi Cerdas:",
				text: "Pertahankan posisi injakan pedal gas secara konstan atau manfaatkan fitur Adaptive Cruise Control.",
			},
		],
		footerTip: "💡 Trik: Jangan mengocok pedal gas EV seperti motor matik!",
		cta: "Lanjut ke Masalah #2 ➔",
	},
	{
		slideNumber: "03/06",
		badge: "MASALAH #2 • PENGEREMAN",
		badgeColor: "bg-sky-50 text-sky-700 border-sky-200",
		tagline: "KINETIC ENERGY LOSS",
		title: "2. Mengabaikan Regenerative Braking",
		subtitle:
			"Menginjak rem cakram fisik secara mendadak membuang energi kinetik yang seharusnya bisa mengisi ulang baterai Anda secara gratis.",
		bulletPoints: [
			{
				bold: "One-Pedal Driving:",
				text: "Manfaatkan deselerasi deseleratif motor untuk mengisi daya (rekuperasi) hingga 15-20% energi perjalanan.",
			},
			{
				bold: "Seni Antisipasi:",
				text: "Lepas pedal gas 50 meter sebelum lampu merah atau tikungan, biarkan mobil meluncur mulus (coasting).",
			},
		],
		footerTip:
			"🔋 Rekuperasi energi yang konsisten menambah belasan kilometer range!",
		cta: "Lanjut ke Masalah #3 ➔",
	},
	{
		slideNumber: "04/06",
		badge: "MASALAH #3 • KECEPATAN",
		badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
		tagline: "AERODYNAMIC DRAG",
		title: "3. Cruising di Atas 100 km/jam di Tol",
		subtitle:
			"Berbeda dari mobil bensin, resistensi angin (aerodynamic drag) pada mobil listrik melonjak secara eksponensial di atas 90 km/jam.",
		bulletPoints: [
			{
				bold: "Fakta Konsumsi Daya:",
				text: "Menaikkan kecepatan dari 80 km/jam ke 110 km/jam bisa memotong jarak tempuh baterai hingga 25%.",
			},
			{
				bold: "Sweet Spot EV:",
				text: "Kecepatan ekonomis paling ideal untuk perjalanan jarak jauh adalah 75 - 90 km/jam di lajur tengah.",
			},
		],
		footerTip:
			"⏱️ Hanya beda 5-10 menit waktu tempuh, tapi hemat 1 kali sesi charging!",
		cta: "Lanjut ke Masalah #4 ➔",
	},
	{
		slideNumber: "05/06",
		badge: "MASALAH #4 • SUHU KABIN",
		badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
		tagline: "HVAC THERMAL LOAD",
		title: "4. Memaksa AC Dingin Ekstrem saat Kabin Panas",
		subtitle:
			"Langsung menyetel AC ke suhu 16°C saat mobil baru terparkir di bawah terik matahari menyedot 3–5 kW daya murni baterai.",
		bulletPoints: [
			{
				bold: "Kompresor Bekerja Keras:",
				text: "Beban kompresor AC langsung menyita persentase baterai signifikan sebelum mobil sempat bergerak.",
			},
			{
				bold: "Solusi Praktis:",
				text: "Buka semua kaca selama 1 menit pertama untuk membuang hawa panas, baru nyalakan AC di suhu nyaman 22-24°C.",
			},
		],
		footerTip:
			"❄️ Suhu 23°C sudah sangat sejuk dan menghemat daya kompresor hingga 40%.",
		cta: "Simpulan & Tantangan ➔",
	},
	{
		slideNumber: "06/06",
		badge: "RINGKASAN • KESIMPULAN",
		badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
		tagline: "SUMMARY & ACTION",
		title:
			"Nyetir Halus Bukan Cuma Hemat Daya, Tapi Menjaga Kesehatan Baterai 🌿",
		subtitle:
			"Mengadopsi gaya Eco-Driving memperpanjang State of Health (SoH) baterai dan memberi kenyamanan maksimal bagi penumpang.",
		bulletPoints: [
			{
				bold: "Tantangan Hari Ini:",
				text: "Coba terapkan injakan pedal halus dan one-pedal driving pada perjalanan pulang kantor hari ini.",
			},
			{
				bold: "Gabung Komunitas:",
				text: "Bagikan skor efisiensi kWh/100km Anda di kolom komentar! Siapa driver paling zen minggu ini?",
			},
		],
		footerTip:
			"👥 Tag temanmu yang sering mengeluh baterai EV-nya cepat habis!",
		cta: "Follow @Drifee by Briga",
	},
];

function generateSlideHtml(slide, index) {
	return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Inter', sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .font-heading {
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
    /* Fixed 4:5 Social Canvas (1080 x 1350 px) */
    .canvas-4x5 {
      width: 1080px;
      height: 1350px;
      box-sizing: border-box;
      background: #FFFFFF;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 72px 80px;
    }
  </style>
</head>
<body>
  <div class="canvas-4x5 shadow-2xl">
    <!-- Top Header Bar -->
    <div>
      <div class="flex items-center justify-between pb-8 border-b border-slate-100">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-sm font-bold text-xl">
            ⚡
          </div>
          <div>
            <div class="font-heading font-extrabold text-2xl text-slate-900 tracking-tight">Drifee</div>
            <div class="text-xs font-semibold text-slate-400 tracking-widest uppercase">Smart EV Telematics</div>
          </div>
        </div>
        
        <div class="flex items-center space-x-3">
          <span class="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold border ${slide.badgeColor}">
            <span class="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
            ${slide.badge}
          </span>
          <span class="text-slate-400 font-heading font-bold text-sm tracking-wider">
            ${slide.slideNumber}
          </span>
        </div>
      </div>

      <!-- Tagline & Main Title -->
      <div class="mt-12">
        <div class="text-xs font-extrabold tracking-widest uppercase text-emerald-600 mb-3 font-heading">
          ${slide.tagline}
        </div>
        <h1 class="font-heading font-extrabold text-slate-900 text-5xl leading-[1.2] tracking-tight">
          ${slide.title}
        </h1>
        <p class="text-slate-600 text-xl leading-relaxed mt-6 font-normal">
          ${slide.subtitle}
        </p>
      </div>
    </div>

    <!-- Center Card / Content Area -->
    <div class="my-auto py-6">
      ${
				slide.hasComparison
					? `
        <!-- Telematics Comparison Card -->
        <div class="grid grid-cols-2 gap-6 bg-slate-50/80 p-6 rounded-3xl border border-slate-200/80">
          <!-- Left: Agresif -->
          <div class="p-6 rounded-2xl bg-white border ${slide.comparison.left.color} shadow-sm flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-bold uppercase tracking-wider text-rose-600">Gaya Agresif</span>
                <span class="text-xl">⚠️</span>
              </div>
              <div class="font-heading font-extrabold text-3xl text-slate-900 mb-1">
                ${slide.comparison.left.metric}
              </div>
              <div class="text-xs font-medium text-rose-600 mb-6">
                ${slide.comparison.left.status}
              </div>
            </div>
            <div>
              <div class="text-xs font-semibold text-slate-400 mb-2">Daya Terserap (Boros)</div>
              <div class="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div class="${slide.comparison.left.meterColor} h-3 rounded-full" style="width: ${slide.comparison.left.meterWidth};"></div>
              </div>
            </div>
          </div>

          <!-- Right: Eco-Zen -->
          <div class="p-6 rounded-2xl bg-white border ${slide.comparison.right.color} shadow-sm flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-bold uppercase tracking-wider text-emerald-600">Eco-Zen Driver</span>
                <span class="text-xl">🌿</span>
              </div>
              <div class="font-heading font-extrabold text-3xl text-slate-900 mb-1">
                ${slide.comparison.right.metric}
              </div>
              <div class="text-xs font-medium text-emerald-600 mb-6">
                ${slide.comparison.right.status}
              </div>
            </div>
            <div>
              <div class="text-xs font-semibold text-slate-400 mb-2">Efisiensi Motor (Optimal)</div>
              <div class="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div class="${slide.comparison.right.meterColor} h-3 rounded-full" style="width: ${slide.comparison.right.meterWidth};"></div>
              </div>
            </div>
          </div>
        </div>
      `
					: `
        <!-- Bullet points with structured cards -->
        <div class="space-y-4">
          ${(slide.bulletPoints || [])
						.map(
							(bp, i) => `
            <div class="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start space-x-4">
              <div class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                ${i + 1}
              </div>
              <div>
                <span class="font-heading font-bold text-slate-900 text-lg mr-1">${bp.bold}</span>
                <span class="text-slate-600 text-lg leading-relaxed">${bp.text}</span>
              </div>
            </div>
          `,
						)
						.join("")}
        </div>
      `
			}
    </div>

    <!-- Bottom Footer Bar -->
    <div class="pt-8 border-t border-slate-100 flex items-center justify-between">
      <!-- Tip / Reminder Pill -->
      <div class="flex items-center space-x-3 text-slate-600 font-medium text-base">
        <span>${slide.footerTip}</span>
      </div>

      <!-- Pagination Dots & CTA -->
      <div class="flex items-center space-x-6">
        <div class="flex items-center space-x-2">
          ${[0, 1, 2, 3, 4, 5]
						.map(
							(dotIndex) => `
            <div class="${dotIndex === index ? "w-8 bg-emerald-500" : "w-2.5 bg-slate-200"} h-2.5 rounded-full transition-all"></div>
          `,
						)
						.join("")}
        </div>
        
        <div class="inline-flex items-center px-5 py-2.5 rounded-xl bg-slate-900 text-white font-heading font-bold text-sm shadow-sm hover:bg-slate-800">
          ${slide.cta}
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

async function renderCarousels() {
	console.log("=========================================================");
	console.log("🎨 Drifee: 4:5 Carousel Generator (Instagram & LinkedIn)");
	console.log("=========================================================\n");

	const browser = await chromium.launch({
		channel: "chrome",
		headless: true,
	});
	const context = await browser.newContext({
		viewport: { width: 1080, height: 1350 },
		deviceScaleFactor: 2, // High-DPI Retina output (2160 x 2700 px crisp clarity)
	});
	const page = await context.newPage();

	const generatedImages = [];

	for (let i = 0; i < SLIDES.length; i++) {
		const slide = SLIDES[i];
		const html = generateSlideHtml(slide, i);
		const tempHtmlPath = path.join(OUTPUT_DIR, `temp_slide_${i + 1}.html`);
		const outputPngPath = path.join(
			OUTPUT_DIR,
			`slide_${String(i + 1).padStart(2, "0")}.png`,
		);

		fs.writeFileSync(tempHtmlPath, html, "utf-8");
		await page.goto(`file://${tempHtmlPath}`);
		await page.waitForLoadState("networkidle");

		// Take pixel-perfect 4:5 screenshot
		await page.locator(".canvas-4x5").screenshot({
			path: outputPngPath,
			type: "png",
		});

		fs.unlinkSync(tempHtmlPath);
		generatedImages.push(outputPngPath);
		console.log(
			`✅ [Slide ${slide.slideNumber}] Rendered: ${path.basename(outputPngPath)} (1080 x 1350 px)`,
		);
	}

	await browser.close();

	// Generate LinkedIn Multi-Page PDF Carousel (Aspect Ratio 4:5 -> 1080 x 1350 pt)
	console.log("\n📄 Compiling LinkedIn Carousel PDF document...");
	const pdfDoc = new jsPDF({
		orientation: "portrait",
		unit: "px",
		format: [1080, 1350],
	});

	for (let i = 0; i < generatedImages.length; i++) {
		const imgData = fs.readFileSync(generatedImages[i]);
		const base64Img = `data:image/png;base64,${imgData.toString("base64")}`;

		if (i > 0) {
			pdfDoc.addPage([1080, 1350], "portrait");
		}
		pdfDoc.addImage(base64Img, "PNG", 0, 0, 1080, 1350);
	}

	const outputPdfPath = path.join(
		OUTPUT_DIR,
		"Drifee_EcoDriving_Carousel_LinkedIn.pdf",
	);
	fs.writeFileSync(outputPdfPath, Buffer.from(pdfDoc.output("arraybuffer")));
	console.log(`✅ [LinkedIn PDF] Saved: ${path.basename(outputPdfPath)}`);

	console.log("\n🎉 ALL ASSETS GENERATED IN media/carousel_4x5/:");
	console.log(
		"   • 6x PNGs (1080 x 1350 px) -> Ready to upload to Instagram Carousel",
	);
	console.log(
		"   • 1x PDF (6 Pages 4:5)     -> Ready to drag-and-drop to LinkedIn Documents Carousel\n",
	);
}

renderCarousels().catch((err) => {
	console.error("Error generating carousel:", err);
	process.exit(1);
});
