"use client";

import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { defaultLanguage, type Language } from "./config";
import { en } from "./translations/en";
import type { Translations } from "./translations/id";
import { id } from "./translations/id";

interface LanguageContextType {
	language: Language;
	setLanguage: (lang: Language) => void;
	t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
	undefined,
);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
	const [language, setLanguageState] = useState<Language>(defaultLanguage);

	useEffect(() => {
		const saved = (localStorage.getItem("drifee-language") ||
			localStorage.getItem("drivee-language")) as Language | null;
		if (saved && (saved === "id" || saved === "en")) {
			setLanguageState(saved);
		} else {
			const browserLang = navigator.language.startsWith("id") ? "id" : "en";
			setLanguageState(browserLang);
		}
	}, []);

	const setLanguage = useCallback((lang: Language) => {
		setLanguageState(lang);
		localStorage.setItem("drifee-language", lang);
	}, []);

	const t = language === "id" ? id : en;

	return (
		<LanguageContext.Provider value={{ language, setLanguage, t }}>
			{children}
		</LanguageContext.Provider>
	);
}

export function useLanguage() {
	const context = useContext(LanguageContext);
	if (!context) {
		throw new Error("useLanguage must be used within LanguageProvider");
	}
	return context;
}
