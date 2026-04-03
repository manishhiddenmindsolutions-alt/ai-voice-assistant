# =============================================================================
# SECTION 1: IMPORTS
# =============================================================================
# Each import serves a specific role in this app:

import streamlit as st       # Streamlit — builds the web UI (buttons, chat, layout)
import asyncio               # asyncio — lets us run async code (needed for LiveKit SDK)
import threading             # threading — runs audio capture in a background thread
                             #   (Streamlit's main thread can't block on audio I/O)
import time                  # time — used for sleep(1) to auto-refresh the transcript
import requests              # requests — makes HTTP calls to our FastAPI backend
import numpy as np           # numpy — processes raw audio samples as numeric arrays
import sounddevice as sd     # sounddevice — accesses the OS microphone & speaker
from livekit import rtc      # livekit.rtc — LiveKit's real-time communication SDK
                             #   (Room, AudioSource, AudioStream, AudioFrame, etc.)
from pathlib import Path     # pathlib — clean cross-platform file path handling


# =============================================================================
# SECTION 2: CONFIGURATION & CONSTANTS
# =============================================================================

# URL of our FastAPI backend that creates LiveKit rooms & tokens
BACKEND_URL = "http://127.0.0.1:8000"

# Audio format settings — must match what LiveKit & Sarvam STT expect
SAMPLE_RATE = 48000   # 48 kHz — standard high-quality sample rate
                      # LiveKit internally resamples to 16kHz for STT if needed
CHANNELS = 1          # Mono audio — voice doesn't need stereo
CHUNK_SIZE = 960      # Number of audio samples per chunk sent to LiveKit
                      # At 48kHz, 960 samples = 20ms of audio per chunk
                      # This is the standard WebRTC frame size

# ── Noise Gate Threshold ──
# PURPOSE: Filters out background noise / silence before sending to LiveKit
# HOW IT WORKS:
#   1. We calculate the RMS (Root Mean Square) of each audio chunk
#   2. RMS measures the "loudness" of the audio
#   3. If RMS < GATE_THRESHOLD → we send silence (zeros) instead of actual audio
#   4. If RMS >= GATE_THRESHOLD → we send the real audio data
#
# WHY 100?
#   - Too LOW (e.g. 50): Background noise leaks through → STT gets confused
#   - Too HIGH (e.g. 300): Clips the start of words! When you say "Kota",
#     the "K" is quiet, so it gets gated out. STT then hears "ota" → "वोटा"
#   - 100 is the sweet spot: blocks silence but preserves speech onset
GATE_THRESHOLD = 70

# Path to the agent's log file — we parse it for the live chat transcript
# Using Path(__file__).parent so it works regardless of where Streamlit runs from
LOG_PATH = Path(__file__).parent / "logs" / "agent.log"


# =============================================================================
# SECTION 3: STREAMLIT PAGE CONFIG & SESSION STATE
# =============================================================================

# Set the browser tab title and icon
st.set_page_config(page_title="Property AI Broker", page_icon="🎙️")

# Session state persists across Streamlit reruns (button clicks, auto-refresh)
# We track whether the user is currently connected to a LiveKit session
if "connected" not in st.session_state:
    st.session_state.connected = False  # Start disconnected


# =============================================================================
# SECTION 4: AUDIO PLAYBACK — Receiving agent's voice from LiveKit
# =============================================================================
# This function plays audio coming FROM the AI agent (the agent's TTS voice)
# It subscribes to the agent's audio track and pipes it to your speaker

async def play_audio(track):
    """
    Receives audio frames from the AI agent's audio track and plays them
    through the user's speaker/headphones in real-time.

    Flow: LiveKit Room → AudioStream → sounddevice OutputStream → Speaker
    """

    # Create a LiveKit AudioStream that reads from the subscribed track
    # We tell it to expect 48kHz mono audio (matching our constants)
    stream = rtc.AudioStream(
        track,                        # The remote audio track from the AI agent
        sample_rate=SAMPLE_RATE,      # 48000 Hz — resample to this rate
        num_channels=CHANNELS,        # 1 channel (mono)
    )

    # Open a sounddevice output stream — this is the connection to your speaker
    # dtype="int16" means each audio sample is a 16-bit integer (-32768 to +32767)
    out = sd.OutputStream(
        samplerate=SAMPLE_RATE,  # Must match the AudioStream's sample rate
        channels=CHANNELS,       # Mono output
        dtype="int16",           # PCM 16-bit — standard audio format
    )
    out.start()  # Begin accepting audio data for playback

    try:
        # Loop forever, receiving audio frames from the agent
        async for frame_event in stream:
            # Each frame_event contains one chunk of audio from the agent
            if isinstance(frame_event, rtc.AudioFrameEvent):
                # Extract raw PCM bytes and interpret as numpy int16 array
                pcm = np.frombuffer(
                    frame_event.frame.data,  # Raw audio bytes from LiveKit
                    dtype=np.int16,          # Each sample is 2 bytes (int16)
                )
                # Write the audio samples to the speaker — you hear the agent!
                out.write(pcm)

    except Exception:
        # If the stream ends or errors (e.g., room disconnects), fail silently
        pass

    finally:
        # Always clean up audio resources, even on error
        out.stop()          # Stop accepting new audio data
        out.close()         # Release the speaker device
        await stream.aclose()  # Close the LiveKit audio stream


# =============================================================================
# SECTION 5: MICROPHONE CAPTURE — Sending user's voice to LiveKit
# =============================================================================
# This function captures audio FROM your microphone and sends it TO LiveKit
# The agent's STT (Sarvam) will then transcribe what you say

async def capture_mic(audio_source, stop_event, loop):
    """
    Captures microphone audio in real-time and sends it to LiveKit.

    Args:
        audio_source: LiveKit AudioSource — the "pipe" to push mic audio into
        stop_event:   threading.Event — set this to stop recording
        loop:         asyncio event loop — needed to schedule async calls
                      from the synchronous sounddevice callback

    Flow: Microphone → sounddevice callback → noise gate → LiveKit AudioSource
    """

    # ── The Callback Function ──
    # sounddevice calls this function every time a new chunk of mic audio is ready
    # It runs on sounddevice's internal audio thread (NOT the main thread)
    # That's why we use run_coroutine_threadsafe to push data to the async world
    def callback(indata, frames, time_info, status):
        """
        Called by sounddevice every 20ms (CHUNK_SIZE=960 samples at 48kHz).

        Args:
            indata:    numpy array of shape (frames, channels), dtype=int16
                       This is the raw audio from your microphone
            frames:    number of audio samples in this chunk (= CHUNK_SIZE = 960)
            time_info: timing info (we don't use it)
            status:    error flags from sounddevice (we don't check it here)
        """

        # Step 1: Extract mono audio from the input
        # indata shape can be (960, 1) for mono — we flatten it to (960,)
        # If stereo (960, 2), we take only the first channel
        audio_data = indata[:, 0] if indata.ndim > 1 else indata.flatten()
        # Result: audio_data is a 1D numpy array of 960 int16 samples

        # Step 2: Calculate RMS (Root Mean Square) — a measure of loudness
        # ⚠️ CRITICAL: We cast to float32 BEFORE squaring!
        # Why? Because int16 values squared can overflow:
        #   32767² = 1,073,676,289 — this exceeds int16 max (32767)
        #   and even int32 can have issues with accumulated sums
        # float32 handles large values safely without overflow
        rms = np.sqrt(                          # Step 2c: Square root → final RMS value
            np.mean(                            # Step 2b: Average of all squared samples
                audio_data.astype(np.float32)   # Step 2a: Cast int16 → float32 (safe)
                ** 2                            # Square each sample
            )
        )
        # Result: rms is a single float — e.g., 50.0 (quiet) or 5000.0 (loud)

        # Step 3: Apply Noise Gate
        # If the audio is below our threshold, it's background noise / silence
        # We replace it with actual zeros to prevent STT from hearing noise
        if rms < GATE_THRESHOLD:
            # Audio is too quiet → send silence (all zeros)
            # This prevents Sarvam STT from trying to transcribe background hum
            processed = np.zeros(frames, dtype=np.int16).tobytes()
        else:
            # Audio is loud enough → this is real speech, send it as-is
            processed = audio_data.astype(np.int16).tobytes()
        # Result: processed is bytes — either silence or real mic audio

        # Step 4: Send the audio frame to LiveKit (async, from sync callback)
        # audio_source.capture_frame() is async, but this callback is sync
        # So we use run_coroutine_threadsafe to schedule it on the event loop
        asyncio.run_coroutine_threadsafe(
            audio_source.capture_frame(         # Push audio into LiveKit's pipeline
                rtc.AudioFrame(
                    data=processed,             # The raw audio bytes (silence or speech)
                    sample_rate=SAMPLE_RATE,    # 48000 Hz
                    num_channels=CHANNELS,      # 1 (mono)
                    samples_per_channel=frames, # 960 samples in this frame
                )
            ),
            loop,  # The asyncio event loop to schedule on
        )
        # After this, LiveKit sends the audio to the room → agent's STT processes it

    # ── Open the Microphone ──
    # sd.InputStream opens the OS default microphone and starts recording
    # The `callback` function above is called every time a new chunk is ready
    with sd.InputStream(
        samplerate=SAMPLE_RATE,   # Record at 48000 Hz
        channels=CHANNELS,        # Mono recording (1 channel)
        dtype="int16",            # Each sample is a 16-bit integer
        blocksize=CHUNK_SIZE,     # 960 samples per callback = 20ms of audio
        callback=callback,        # Our function that processes each chunk
    ):
        # The mic is now recording! The callback fires every 20ms automatically
        # We just sit here and wait until stop_event is set (user clicks Stop)
        while not stop_event.is_set():
            await asyncio.sleep(0.1)  # Check every 100ms if we should stop
    # When we exit this `with` block, the mic stream is automatically closed


# =============================================================================
# SECTION 6: LIVEKIT ROOM CONNECTION — Connects everything together
# =============================================================================
# This function joins a LiveKit room, publishes your mic, and subscribes
# to the agent's audio — it's the "glue" between mic, speaker, and LiveKit

async def run_livekit(url, token, stop_event):
    """
    Connects to a LiveKit room, publishes microphone audio, and plays
    back the AI agent's responses through the speaker.

    Args:
        url:        LiveKit server WebSocket URL (e.g., wss://xyz.livekit.cloud)
        token:      JWT token for authentication (created by our backend)
        stop_event: threading.Event — signals when to disconnect
    """

    # Get the current async event loop — needed for mic callback scheduling
    curr_loop = asyncio.get_running_loop()

    # Create a LiveKit Room object — represents a real-time communication session
    room = rtc.Room()

    # ── Event Handler: When the agent's audio track becomes available ──
    # This fires when the AI agent starts speaking (publishes an audio track)
    @room.on("track_subscribed")
    def on_track(track, publication, participant):
        """Called when we receive a new track from another participant (the agent)."""
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            # It's an audio track from the agent — start playing it!
            asyncio.create_task(play_audio(track))

    # Connect to the LiveKit room using the URL and token from our backend
    # auto_subscribe=True means we automatically receive the agent's tracks
    await room.connect(
        url,                                               # LiveKit server URL
        token,                                             # Auth token
        options=rtc.RoomOptions(auto_subscribe=True),      # Auto-subscribe to agent
    )

    # ── Publish our microphone as a track in the room ──
    # Step 1: Create an AudioSource — this is the "input pipe" for our mic audio
    source = rtc.AudioSource(SAMPLE_RATE, CHANNELS)  # 48kHz, mono

    # Step 2: Create a LocalAudioTrack from the source — wraps it as a publishable track
    track = rtc.LocalAudioTrack.create_audio_track(
        "mic",     # Track name (arbitrary label)
        source,    # The AudioSource we'll push mic frames into
    )

    # Step 3: Publish the track to the room so the agent can hear us
    await room.local_participant.publish_track(
        track,  # Our mic track
        rtc.TrackPublishOptions(
            source=rtc.TrackSource.SOURCE_MICROPHONE,  # Tell LiveKit this is a mic
        ),
    )

    # ── Start capturing mic audio (blocks until stop_event is set) ──
    await capture_mic(source, stop_event, curr_loop)

    # ── Clean up: disconnect from the room ──
    await room.disconnect()


# =============================================================================
# SECTION 7: AUDIO THREAD — Runs LiveKit in a background thread
# =============================================================================
# Streamlit runs on its own thread and can't be blocked by audio I/O.
# We run the entire LiveKit + mic + speaker pipeline in a separate thread
# with its own asyncio event loop.

def start_audio_thread(url, token, stop_event):
    """
    Entry point for the background audio thread.
    Creates a new asyncio event loop and runs the LiveKit session in it.

    Args:
        url:        LiveKit server URL
        token:      Auth JWT token
        stop_event: threading.Event to signal shutdown
    """
    # Create a brand new asyncio event loop for this thread
    # (Each thread needs its own event loop — can't share with Streamlit's)
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)  # Set it as this thread's default loop

    try:
        # Run the LiveKit session until stop_event is set
        loop.run_until_complete(run_livekit(url, token, stop_event))
    finally:
        loop.close()  # Clean up the event loop when done


# =============================================================================
# SECTION 8: STREAMLIT UI — The visible web interface
# =============================================================================

# ── Page Title ──
st.title("🏠 Rajasthan Property AI Broker")

# ── Connect / Disconnect Button ──
if not st.session_state.connected:
    # Show the "Start" button when not connected
    if st.button("🚀 Start Session", use_container_width=True):
        try:
            # Call our FastAPI backend to create a LiveKit room + get a token
            res = requests.post(f"{BACKEND_URL}/start-session", timeout=10).json()

            if "error" in res:
                st.error(res["error"])  # Backend returned an error
            else:
                # Success! Start the audio thread with the room URL and token
                stop_event = threading.Event()  # Create a stop signal

                thread = threading.Thread(
                    target=start_audio_thread,   # Function to run in background
                    args=(res["url"], res["token"], stop_event),  # LiveKit credentials
                    daemon=True,  # Thread dies when main app exits
                )
                thread.start()  # Launch the audio thread

                # Save state so Streamlit remembers we're connected across reruns
                st.session_state.stop_event = stop_event
                st.session_state.connected = True
                st.rerun()  # Refresh the page to show "Stop" button

        except requests.ConnectionError:
            st.error(f"Cannot reach backend at {BACKEND_URL}")
        except Exception as e:
            st.error(f"Error: {e}")

else:
    # Show the "Stop" button when connected
    if st.button("🛑 Stop Session", use_container_width=True):
        st.session_state.stop_event.set()    # Signal the audio thread to stop
        st.session_state.connected = False   # Update state
        st.rerun()                           # Refresh to show "Start" button


# ── Divider ──
st.divider()


# =============================================================================
# SECTION 9: LIVE CHAT TRANSCRIPT — Reads agent logs and shows conversation
# =============================================================================
# We parse the agent's log file to display the conversation in real-time.
# The agent logs lines like:
#   [USER SAID] "कोटा में प्रॉपर्टी चाहिए"
#   [AGENT REPLY] "Kota mein 2 options hain..."

st.write("### 💬 Live Chat")

if LOG_PATH.exists():
    # Read the entire log file
    text = LOG_PATH.read_text(encoding="utf-8", errors="replace")

    # Show only the last 20 lines (most recent conversation)
    for line in text.splitlines()[-20:]:

        if "[USER SAID]" in line:
            # Extract the user's speech and show it as a user chat bubble
            user_text = line.split("[USER SAID]")[-1].strip().strip('"')
            st.chat_message("user").write(user_text)

        elif "[AGENT REPLY]" in line:
            # Extract the agent's reply and show it as an assistant chat bubble
            agent_text = line.split("[AGENT REPLY]")[-1].strip().strip('"')
            st.chat_message("assistant").write(agent_text)


# =============================================================================
# SECTION 10: AUTO-REFRESH — Keeps the transcript updating in real-time
# =============================================================================
# When connected, we want the chat to update automatically as new logs appear.
# Streamlit reruns the entire script on each refresh, so we just wait 1 second
# and trigger a rerun. This creates a ~1 second polling loop for new messages.

if st.session_state.connected:
    time.sleep(1)    # Wait 1 second before refreshing
    st.rerun()       # Re-execute this entire script → chat updates with new lines