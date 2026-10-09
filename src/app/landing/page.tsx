"use client";

import { CTA } from "@/components/landing/CTA";
import { Features } from "@/components/landing/Features";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Navbar } from "@/components/landing/Navbar";
import { Stats } from "@/components/landing/Stats";

export default function LandingPage() {
	return (
		<div className="min-h-screen bg-white">
			<Navbar />
			<main>
				<Hero />
				<Features />
				<HowItWorks />
				<Stats />
				<CTA />
			</main>
			<Footer />
		</div>
	);
}
