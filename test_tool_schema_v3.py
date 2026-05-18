import livekit.agents.llm as llm
import livekit.agents.llm._provider_format.openai as oai
def create_calendar_cmd(cid, tk, n):
    async def calendar_fn(summary: str, start_time: str, duration_mins: int = 30):
        """Schedule a new meeting or event."""
        pass
    calendar_fn.__name__ = n
    return calendar_fn
t = llm.function_tool(create_calendar_cmd('c', 't', 'my_tool'), name='my_tool', description='desc')
import json
try:
    print(json.dumps(oai.build_oai_tool(t), indent=2))
except Exception as e:
    print("Error:", e)
    
schema = {
    "name": 'my_tool',
    "description": 'desc',
    "parameters": {
        "type": "object",
        "properties": {
            "summary": {"type": "string"},
            "start_time": {"type": "string"}
        },
        "required": ["summary", "start_time"]
    }
}
t2 = llm.function_tool(create_calendar_cmd('c','t','my_tool'), raw_schema=schema)
try:
    print("raw_schema result:")
    print(json.dumps(oai.build_oai_tool(t2), indent=2))
except Exception as e:
    print("Error:", e)
