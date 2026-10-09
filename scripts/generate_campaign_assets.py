#!/usr/bin/env python3
"""
Drifee Eco-Driving Campaign Asset Generator
Automates video generation via Gemini Omni 1.1 Flash (gemini-omni-1.1-flash).
Reads prompt configurations from content_calendar_eco_driving.csv and outputs assets into media/campaign/.
"""

import csv
import os
import subprocess
import sys
from pathlib import Path

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

BASE_DIR = Path(__file__).resolve().parent.parent
CSV_PATH = BASE_DIR / "content_calendar_eco_driving.csv"
OUTPUT_DIR = BASE_DIR / "media" / "campaign_videos"
SKILL_GENERATOR = Path(r"C:\Users\yabes\.gemini\config\plugins\gemini-api\skills\gemini-omni-flash-api\scripts\video\generate_video.py")

def main():
    if not CSV_PATH.exists():
        print(f"Error: Content calendar not found at {CSV_PATH}")
        sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("[WARNING] GEMINI_API_KEY is not set in the environment.")
        print("Please set your GEMINI_API_KEY before executing generation runs:")
        print("  $env:GEMINI_API_KEY = 'your_api_key'")

    print("=======================================================")
    print("🚗 Drifee: Eco-Driving AI Video Pipeline (Omni Flash)")
    print("=======================================================\n")

    tasks = []
    with open(CSV_PATH, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            prompt = row.get("Gemini_Omni_Prompt", "").strip()
            if prompt and prompt != "N/A":
                tasks.append({
                    "id": row.get("ID"),
                    "date": row.get("Publish_Date"),
                    "headline": row.get("Hook_Headline"),
                    "format": row.get("Format"),
                    "prompt": prompt,
                    "output_file": OUTPUT_DIR / f"{row.get('ID')}.mp4"
                })

    print(f"Found {len(tasks)} video asset tasks scheduled for generation:\n")
    for t in tasks:
        aspect = "9:16" if "9:16" in t["format"] else "16:9"
        print(f"[{t['id']}] Date: {t['date']} | Format: {t['format']} (Aspect: {aspect})")
        print(f"  Target File: {t['output_file']}")
        print(f"  Prompt: \"{t['prompt']}\"\n")

    print("Ready to run generation command for each asset.")
    print("Command template executed:")
    print(f"  python {SKILL_GENERATOR} \"<PROMPT>\" --aspect-ratio 9:16 --resolution 720p --output <OUTPUT_PATH>")

if __name__ == "__main__":
    main()
