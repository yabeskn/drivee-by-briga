# Drivee by Briga

**Smart EV Fleet Telematics PWA** — Track trips, eco-driving score, and earn BrigaCoins rewards.

![Drivee Logo](./public/icon.svg)

## Features

- **Real-time GPS Tracking** — Monitor vehicle location and routes
- **Eco-Driving Score** — Analyze driving patterns and improve efficiency
- **BrigaCoins Rewards** — Earn incentives for eco-friendly driving
- **Offline Mode** — Data stored safely and auto-syncs when online
- **Anti-Spoofing** — Photo verification for odometer and battery
- **Bilingual** — Indonesian & English support
- **PWA** — Installable on home screen, works offline

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database:** IndexedDB (Dexie.js)
- **Maps:** Leaflet + CARTO
- **Deployment:** Vercel + Cloudflare

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yabeskn/drivee-by-briga.git
cd drivee-by-briga

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | App URL | `https://drivee.briga.id` |
| `ALLOWED_ORIGINS` | CORS allowed origins | `https://drivee.briga.id` |
| `OSRM_URL` | OSRM routing server | `https://router.project-osrm.org` |

## Project Structure

```
src/
├── app/
│   ├── api/              # API routes
│   ├── landing/          # Landing page
│   ├── register/         # Registration forms
│   └── page.tsx          # Main PWA app
├── components/
│   ├── forms/            # Form components
│   ├── landing/          # Landing page components
│   ├── layout/           # Layout components
│   └── screens/          # App screens
├── hooks/                # Custom hooks
├── i18n/                 # Internationalization
├── lib/                  # Utilities & services
└── types/                # TypeScript types
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run linter |

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Set environment variables
4. Deploy

### Docker

```bash
docker build -t drivee .
docker run -p 3000:3000 drivee
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

© 2026 Drivee by Briga. PT Briga Energi Indonesia.

## Contact

- Website: [briga.id](https://briga.id)
- Email: [email protected]
