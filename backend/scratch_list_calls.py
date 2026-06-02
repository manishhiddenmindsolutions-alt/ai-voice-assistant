import asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect('postgresql://postgres:postgres@localhost:5432/Voice-Agent')
    
    # Get 5 latest calls
    calls = await conn.fetch("SELECT id, session_id, status, started_at, agent_id FROM calls ORDER BY started_at DESC LIMIT 5")
    if not calls:
        print("No calls found in database.")
        await conn.close()
        return
        
    for call in calls:
        print(f"\n======================================")
        print(f"Call ID: {call['id']}")
        print(f"Session ID: {call['session_id']}")
        print(f"Agent ID: {call['agent_id']}")
        print(f"Status: {call['status']}")
        print(f"Started At: {call['started_at']}")
        
        # Get transcripts
        transcripts = await conn.fetch("SELECT role, content, timestamp FROM transcripts WHERE call_id = $1 ORDER BY id ASC", call['id'])
        if not transcripts:
            print("  No transcripts for this call.")
        else:
            for t in transcripts:
                print(f"  [{t['timestamp'].strftime('%H:%M:%S')}] {t['role'].upper()}: {t['content']}")
                
    await conn.close()

asyncio.run(main())
