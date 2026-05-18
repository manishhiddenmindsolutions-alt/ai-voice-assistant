import asyncio
import asyncpg
from datetime import datetime

async def main():
    conn = await asyncpg.connect('postgresql://postgres:postgres@localhost:5432/Voice-Agent')
    # Get latest session id
    row = await conn.fetchrow("SELECT session_id FROM calls ORDER BY started_at DESC LIMIT 1")
    if not row:
        print("No calls found")
        await conn.close()
        return
        
    session_id = row['session_id']
    print(f"Latest Session: {session_id}")
    
    rows = await conn.fetch("SELECT t.role, t.content FROM transcripts t JOIN calls c ON t.call_id = c.id WHERE c.session_id = $1 ORDER BY t.id ASC", session_id)
    if not rows:
        print("No transcripts for this session.")
    else:
        for r in rows:
            print(f"{r['role'].upper()}: {r['content']}")
            
    await conn.close()

asyncio.run(main())
