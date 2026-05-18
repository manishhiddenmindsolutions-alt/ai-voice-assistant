import livekit.agents.llm as llm
import dataclasses
def create_cmd():
    async def calendar_fn(summary: str, start_time: str, duration_mins: int = 30):
        pass
    return calendar_fn

schema = {
    "name": "my_tool",
    "description": "Schedule a new meeting or event.",
    "parameters": {
        "type": "object",
        "properties": {
            "summary": {"type": "string", "description": "A short title or summary for the meeting."},
            "start_time": {"type": "string", "description": "The date and time of the meeting. Please use ISO 8601 format or natural language like 'tomorrow at 3pm'."},
            "duration_mins": {"type": "integer", "description": "Duration of the meeting in minutes. Defaults to 30.", "default": 30}
        },
        "required": ["summary", "start_time"]
    }
}

t = llm.function_tool(create_cmd(), raw_schema=schema)
print("Type:", type(t))
print("Info:", getattr(t, 'info', 'No Info'))
print("Raw Info:", getattr(t, '__livekit_raw_tool_info', 'No Raw Info'))
