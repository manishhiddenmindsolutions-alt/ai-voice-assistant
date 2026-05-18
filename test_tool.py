from livekit.agents import llm

def create_cmd(n):
    async def calendar_fn(summary: str, start_time: str, duration_mins: int = 30):
        """Schedule a new meeting or event."""
        return "Done"
    return calendar_fn

tool = llm.function_tool(create_cmd("my_tool"), name="my_tool", description="desc")

print("Tool name:", tool.name)
print("Tool description:", tool.description)
print("Function name:", tool.function.__name__)
