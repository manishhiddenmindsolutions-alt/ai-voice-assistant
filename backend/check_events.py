import asyncio
import asyncpg
import aiohttp
from datetime import datetime
import sys

async def main():
    conn = await asyncpg.connect('postgresql://postgres:postgres@localhost:5432/Voice-Agent')
    row = await conn.fetchrow("SELECT access_token FROM integrations WHERE provider = 'google' AND access_token IS NOT NULL LIMIT 1")
    await conn.close()
    
    from app.core.security import vault
    access_token = vault.decrypt(row['access_token'])
    
    calendar_id = "be56506922832a9c40baa2f2c6491b7f7a1bd1e2cfbe5ec25afa0d56bb48d1e2@group.calendar.google.com"
    url = f"https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events"
    
    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers={"Authorization": f"Bearer {access_token}"}) as events_resp:
            events_data = await events_resp.json()
            if events_resp.status == 200:
                events = events_data.get('items', [])
                sorted_events = sorted(events, key=lambda x: x.get('created', ''), reverse=True)
                for e in sorted_events[:2]:
                    start = e.get('start', {}).get('dateTime', e.get('start', {}).get('date', 'No start'))
                    summary = e.get('summary', 'No Title').encode(sys.stdout.encoding, errors='replace').decode(sys.stdout.encoding)
                    link = e.get('htmlLink', 'No Link')
                    print(f"- {summary} at {start}\n  Link: {link}\n")
            else:
                print(f"Error fetching events: {events_resp.status}")

asyncio.run(main())
