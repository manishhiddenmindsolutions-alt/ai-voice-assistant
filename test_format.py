import livekit.agents.llm as llm
def create_cmd():
    async def calendar_fn(summary: str, start_time: str, duration_mins: int = 30):
        """
        Schedule a new meeting or event.
        Args:
            summary: A short title or summary for the meeting.
            start_time: The date and time of the meeting. Please use ISO 8601 format or natural language like 'tomorrow at 3pm'.
            duration_mins: Duration of the meeting in minutes. Defaults to 30.
        """
        pass
    return calendar_fn
t = llm.function_tool(create_cmd(), name='x', description='y')
import json
try:
    from livekit.agents.llm._provider_format import build_function_format
    # Let's see what openAI format gives
    print(build_function_format(t))
except Exception as e:
    print(e)
