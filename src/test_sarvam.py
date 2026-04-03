import os

import requests
from dotenv import load_dotenv

# Load your API key
load_dotenv(".env.local")
api_key = os.getenv("SARVAM_API_KEY")

print("📡 Connecting to Sarvam API...")

# THE CORRECT URL THIS TIME!
url = "https://api.sarvam.ai/text-to-speech"
payload = {
    "inputs": ["नमस्ते मनीष! यह एक सीधा परीक्षण है।"],
    "target_language_code": "hi-IN",
    "speaker": "ritu",
    "model": "bulbul:v3",
}
headers = {"api-subscription-key": api_key, "Content-Type": "application/json"}

response = requests.post(url, json=payload, headers=headers)

print(f"HTTP Status Code: {response.status_code}")

if response.status_code == 200:
    print("✅ SUCCESS! Sarvam generated audio.")
else:
    print("❌ SARVAM REJECTED THE REQUEST. Here is their exact error:")
    print(response.json())
