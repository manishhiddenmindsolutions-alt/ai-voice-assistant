import livekit.agents
print(dir(livekit.agents))
try:
    from livekit.agents import pipeline
    print("Pipeline exists")
    print(dir(pipeline))
except ImportError:
    print("Pipeline does NOT exist")

try:
    from livekit.agents import voice
    print("Voice exists")
    print(dir(voice))
except ImportError:
    print("Voice does NOT exist")
