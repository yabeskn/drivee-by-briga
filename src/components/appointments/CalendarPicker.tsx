"use client";

import React from "react";

interface CalendarPickerProps {
	selectedDate: string; // YYYY-MM-DD
	selectedTime: string; // HH:mm
	onSelectDate: (date: string) => void;
	onSelectTime: (time: string) => void;
	advanceDays?: number;
}

const AVAILABLE_HOURS = [
	"07:00",
	"08:00",
	"09:00",
	"10:00",
	"11:00",
	"13:00",
	"14:00",
	"15:00",
	"16:00",
	"17:00",
];

export function CalendarPicker({
	selectedDate,
	selectedTime,
	onSelectDate,
	onSelectTime,
	advanceDays = 14,
}: CalendarPickerProps) {
	// Generate date chips for the next X days
	const dates = React.useMemo(() => {
		const list: Array<{
			dateStr: string;
			dayName: string;
			dayNum: number;
			monthName: string;
		}> = [];
		const today = new Date();

		for (let i = 1; i <= advanceDays; i++) {
			const d = new Date(today);
			d.setDate(today.getDate() + i);

			const dateStr = d.toISOString().split("T")[0];
			const dayName = d.toLocaleDateString("id-ID", { weekday: "short" });
			const dayNum = d.getDate();
			const monthName = d.toLocaleDateString("id-ID", { month: "short" });

			list.push({ dateStr, dayName, dayNum, monthName });
		}
		return list;
	}, [advanceDays]);

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
					<span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
						2
					</span>
					Pilih Tanggal & Jam Penjemputan
				</h3>
				<span className="text-xs text-gray-500">
					Waktu Indonesia Barat (WIB)
				</span>
			</div>

			{/* Date Horizontal Carousel */}
			<div className="space-y-1.5">
				<span className="block text-xs font-medium text-gray-600 dark:text-gray-300">
					Tanggal Agenda:
				</span>
				<div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
					{dates.map((item) => {
						const isSelected = selectedDate === item.dateStr;
						return (
							<button
								key={item.dateStr}
								type="button"
								onClick={() => onSelectDate(item.dateStr)}
								className={`flex-shrink-0 flex flex-col items-center justify-center w-16 py-2.5 px-1.5 rounded-xl border text-center transition-all ${
									isSelected
										? "border-emerald-600 bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/20"
										: "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:border-emerald-400"
								}`}
							>
								<span className="text-[10px] uppercase font-semibold tracking-wider">
									{item.dayName}
								</span>
								<span className="text-lg font-bold my-0.5">{item.dayNum}</span>
								<span className="text-[10px] opacity-80">{item.monthName}</span>
							</button>
						);
					})}
				</div>
			</div>

			{/* Time Slot Grid */}
			<div className="space-y-1.5">
				<span className="block text-xs font-medium text-gray-600 dark:text-gray-300">
					Jam Siap Jemput:
				</span>
				<div className="grid grid-cols-5 sm:grid-cols-5 gap-2">
					{AVAILABLE_HOURS.map((hour) => {
						const isSelected = selectedTime === hour;
						return (
							<button
								key={hour}
								type="button"
								onClick={() => onSelectTime(hour)}
								className={`py-2 text-xs font-semibold rounded-lg border transition-all text-center ${
									isSelected
										? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
										: "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:border-emerald-400"
								}`}
							>
								{hour}
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
}
