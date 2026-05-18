import livekit.agents.llm as llm
import json

def create_calendar_cmd(cid, tk, n):
    async def calendar_fn(summary: str, start_time: str, duration_mins: int = 30):
        """Schedule a new meeting or event."""
        pass
    calendar_fn.__name__ = n
    return calendar_fn

t = llm.function_tool(create_calendar_cmd('c', 't', 'my_tool'), name='my_tool', description='desc')

try:
    from livekit.plugins.openai import models
    print(json.dumps(models._format_tool(t), indent=2))
except Exception as e:
    try:
        from livekit.plugins.openai.models import _format_tool
        print(json.dumps(_format_tool(t), indent=2))
    except Exception as e2:
        print('Error:', e2)
