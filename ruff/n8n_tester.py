import asyncio
import aiohttp
import argparse
import json
import sys

async def test_webhook(url, method, payload, headers=None):
    if headers is None:
        headers = {'Content-Type': 'application/json'}
    
    print(f"🚀 Sending {method} request to: {url}")
    print(f"📦 Payload: {json.dumps(payload, indent=2)}")
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.request(method, url, json=payload, headers=headers) as response:
                status = response.status
                text = await response.text()
                
                print(f"\n✅ Response Status: {status}")
                try:
                    data = json.loads(text)
                    print(f"📝 Response Body (JSON):\n{json.dumps(data, indent=2)}")
                except json.JSONDecodeError:
                    if text.strip():
                        print(f"📝 Response Body (Text):\n{text}")
                    else:
                        print("📝 Response Body: (Empty)")
                
    except Exception as e:
        print(f"❌ Error: {e}")

def main():
    parser = argparse.ArgumentParser(description="n8n Webhook Tester for VoiceForge")
    parser.add_argument("--url", required=True, help="n8n Webhook URL")
    parser.add_argument("--method", default="POST", choices=["POST", "GET", "PUT"], help="HTTP method (default: POST)")
    parser.add_argument("--query", default="Hello from VoiceForge Tester", help="Query string to send in payload")
    parser.add_argument("--config", help="JSON string for additional config (e.g. '{\"user_id\": \"123\"}')")
    
    args = parser.parse_args()
    
    payload = {"query": args.query}
    if args.config:
        try:
            config_data = json.loads(args.config)
            payload.update(config_data)
        except json.JSONDecodeError:
            print("❌ Invalid JSON in --config argument. Please ensure it is valid JSON.")
            sys.exit(1)
            
    try:
        asyncio.run(test_webhook(args.url, args.method, payload))
    except KeyboardInterrupt:
        print("\n🛑 Test cancelled by user.")

if __name__ == "__main__":
    main()
