import { useEffect, useState } from 'react';
import { Track } from 'livekit-client';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  BarVisualizer,
  useVoiceAssistant,
  useLocalParticipant,
  useRoomContext,
  useTracks,
} from '@livekit/components-react';
import { Mic, MicOff, PhoneOff, Activity } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import '@livekit/components-styles';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VoiceSessionProps {
  token: string;
  url: string;
  onDisconnect: () => void;
  agentName?: string;
}

// ─── State config — each voice state gets a distinct color signal ──────────────

const STATE_CONFIG = {
  speaking: { label: 'RESPONDING', color: '#60A5FA', glow: 'rgba(96,165,250,0.14)', ring: 'rgba(96,165,250,0.35)' },
  listening: { label: 'LISTENING', color: '#FBBF24', glow: 'rgba(251,191,36,0.14)', ring: 'rgba(251,191,36,0.35)' },
  thinking: { label: 'THINKING', color: '#A78BFA', glow: 'rgba(167,139,250,0.14)', ring: 'rgba(167,139,250,0.35)' },
  connecting: { label: 'CONNECTING', color: '#52525B', glow: 'rgba(82,82,91,0.08)', ring: 'rgba(82,82,91,0.25)' },
  idle: { label: 'STANDBY', color: '#52525B', glow: 'rgba(82,82,91,0.08)', ring: 'rgba(82,82,91,0.25)' },
} as const;

type Cfg = (typeof STATE_CONFIG)[keyof typeof STATE_CONFIG];

// ─── Root ─────────────────────────────────────────────────────────────────────

const VoiceSession = ({ token, url, onDisconnect, agentName = 'Neural Agent' }: VoiceSessionProps) => {
  const handleDisconnected = () => {
    toast('Session ended', { style: { background: '#111', color: '#fff', border: '1px solid #222' } });
    onDisconnect();
  };
  const handleError = (error: Error) => {
    toast.error(`Connection failed: ${error.message}`);
    setTimeout(onDisconnect, 3000);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', alignItems: 'flex-end',
      background: 'rgba(0,0,0,0.88)',
      backdropFilter: 'blur(28px)',
    }}>
      <AnimatePresence>
        <motion.div
          key="card"
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          style={{
            width: '100%',
            height: '100dvh',
            background: '#080808',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <LiveKitRoom
            token={token} serverUrl={url}
            connect audio video={false}
            onDisconnected={handleDisconnected}
            onError={handleError}
            style={{ display: 'contents' }}
          >
            <VoiceSessionInner onDisconnect={onDisconnect} agentName={agentName} />
          </LiveKitRoom>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// ─── Inner ────────────────────────────────────────────────────────────────────

const VoiceSessionInner = ({ onDisconnect, agentName }: { onDisconnect: () => void; agentName: string }) => {
  const [duration, setDuration] = useState(0);
  const { state, audioTrack } = useVoiceAssistant();
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const tracks = useTracks([Track.Source.Microphone]);
  const localMicTrack = tracks.find((t: any) => t.participant.isLocal);
  const isMuted = !localParticipant?.isMicrophoneEnabled;
  const cfg: Cfg = STATE_CONFIG[state as keyof typeof STATE_CONFIG] ?? STATE_CONFIG.idle;

  useEffect(() => {
    const id = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const toggleMic = async () => {
    if (!localParticipant) return;
    const next = !localParticipant.isMicrophoneEnabled;
    await localParticipant.setMicrophoneEnabled(next);
    toast(next ? '🎙 Microphone on' : '🔇 Microphone off', {
      style: { background: '#111', color: '#fff', border: '1px solid #222' },
    });
  };

  const endCall = () => { room.disconnect(); onDisconnect(); };

  return (
    <>
      <RoomAudioRenderer />

      {/* ── HEADER — flex-shrink:0 guarantees it never gets squashed ─────── */}
      <header style={{
        flexShrink: 0,
        zIndex: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '22px 28px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <motion.div
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              width: 7, height: 7, borderRadius: '50%',
              background: cfg.color, flexShrink: 0,
              transition: 'background 0.6s',
            }}
          />
          <span style={{
            fontFamily: 'ui-monospace,"Cascadia Code",monospace',
            fontSize: 11, letterSpacing: '0.18em',
            color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase',
          }}>
            {agentName}
          </span>
        </div>

        <span style={{
          fontFamily: 'ui-monospace,"Cascadia Code",monospace',
          fontSize: 12, letterSpacing: '0.1em',
          color: 'rgba(255,255,255,0.2)',
          padding: '4px 12px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 8,
        }}>
          {fmt(duration)}
        </span>
      </header>

      {/* ── MAIN — flex:1 + overflowY:auto = scrollable, never clips footer ─ */}
      <main style={{
        flex: 1,
        overflowY: 'auto', overflowX: 'hidden',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '48px 28px 32px',
        position: 'relative',
        gap: 44,
      }}>
        {/* Ambient glow */}
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            width: 360, height: 360,
            borderRadius: '50%',
            background: cfg.glow,
            filter: 'blur(90px)',
            pointerEvents: 'none',
            transition: 'background 1s',
          }}
        />

        {/* Orb */}
        <OrbDisplay state={state} cfg={cfg} />

        {/* Status label */}
        <AnimatePresence mode="wait">
          <motion.p
            key={state}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            style={{
              fontFamily: 'ui-monospace,"Cascadia Code",monospace',
              fontSize: 10, letterSpacing: '0.38em',
              color: cfg.color, textTransform: 'uppercase',
              padding: '5px 16px',
              border: `1px solid ${cfg.ring}`,
              borderRadius: 999,
              background: cfg.glow,
              transition: 'color 0.5s, border-color 0.5s, background 0.5s',
              margin: 0,
            }}
          >
            ● {cfg.label}
          </motion.p>
        </AnimatePresence>

        {/* Visualizer block */}
        <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Agent audio */}
          <div style={{ height: 56, width: '100%' }}>
            {audioTrack
              ? <BarVisualizer trackRef={audioTrack} style={{ width: '100%', height: '100%', color: cfg.color, transition: 'color 0.5s' }} />
              : <IdleBars />
            }
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)' }} />

          {/* Local mic */}
          <div style={{ height: 16, width: '100%', opacity: 0.15 }}>
            {localMicTrack && (
              <BarVisualizer trackRef={localMicTrack} style={{ width: '100%', height: '100%', color: '#fff' }} />
            )}
          </div>
        </div>
      </main>

      {/* ── FOOTER — flex-shrink:0 = ALWAYS visible no matter what ──────────
           This single property is the most critical fix. Without it the footer
           can be pushed out of the visible area when the main area is tall.
      ─────────────────────────────────────────────────────────────────────── */}
      <footer style={{
        flexShrink: 0,
        zIndex: 10,
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        gap: 10,
        padding: '20px 28px 36px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(8,8,8,0.97)',
      }}>

        {/* Mic */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={toggleMic}
          aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          style={{
            width: 58, height: 58, borderRadius: 18, flexShrink: 0,
            border: isMuted ? '1px solid rgba(239,68,68,0.55)' : '1px solid rgba(255,255,255,0.1)',
            background: isMuted ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.05)',
            color: isMuted ? '#F87171' : 'rgba(255,255,255,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
        </motion.button>

        {/* End call */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={endCall}
          aria-label="End call"
          style={{
            width: 80, height: 58, borderRadius: 18, flexShrink: 0,
            background: '#DC2626',
            border: '1px solid rgba(239,68,68,0.5)',
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 28px rgba(220,38,38,0.28)',
            transition: 'all 0.2s',
          }}
        >
          <PhoneOff size={22} strokeWidth={2.5} />
        </motion.button>

        {/* Signal quality */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          aria-label="Signal quality"
          style={{
            width: 58, height: 58, borderRadius: 18, flexShrink: 0,
            border: '1px solid rgba(255,255,255,0.07)',
            background: 'rgba(255,255,255,0.03)',
            color: 'rgba(255,255,255,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          <Activity size={18} />
        </motion.button>
      </footer>
    </>
  );
};

// ─── Orb ──────────────────────────────────────────────────────────────────────

const OrbDisplay = ({ state, cfg }: { state: string; cfg: Cfg }) => {
  const isSpeaking = state === 'speaking';
  const isThinking = state === 'thinking';
  const isListening = state === 'listening';

  return (
    <div style={{ position: 'relative', width: 188, height: 188, flexShrink: 0 }}>

      {/* Outer dashed slow ring */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute', inset: -14, borderRadius: '50%',
          border: `1px dashed ${cfg.ring}`,
          opacity: 0.45, transition: 'border-color 0.7s',
        }}
      />

      {/* Pulse ring — active when speaking */}
      <motion.div
        animate={isSpeaking
          ? { scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }
          : { scale: 1, opacity: 0.2 }
        }
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', inset: -5, borderRadius: '50%',
          border: `1px solid ${cfg.ring}`,
          transition: 'border-color 0.7s',
        }}
      />

      {/* Thinking spinner */}
      {isThinking && (
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
          style={{
            position: 'absolute', inset: 10, borderRadius: '50%',
            border: `1px solid ${cfg.ring}`,
            borderTopColor: 'transparent', borderLeftColor: 'transparent',
          }}
        />
      )}

      {/* Core sphere */}
      <motion.div
        animate={
          isSpeaking ? { scale: [1, 1.03, 1] } :
            isListening ? { scale: [0.97, 1.02, 0.97] } :
              { scale: 1 }
        }
        transition={{ duration: isSpeaking ? 0.9 : 2.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width: '100%', height: '100%', borderRadius: '50%',
          background: `radial-gradient(circle at 35% 32%, ${cfg.color}1A 0%, #0F0F0F 62%)`,
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 0 56px ${cfg.glow}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.9s, box-shadow 0.9s',
        }}
      >
        {/* Inner light source */}
        <motion.div
          animate={{ opacity: [0.55, 1, 0.55], scale: [0.85, 1.1, 0.85] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            width: 14, height: 14, borderRadius: '50%',
            background: cfg.color,
            boxShadow: `0 0 20px ${cfg.color}, 0 0 44px ${cfg.color}66`,
            transition: 'background 0.6s, box-shadow 0.6s',
          }}
        />
      </motion.div>
    </div>
  );
};

// ─── Idle Bars (shown when no agent audio track) ───────────────────────────────

const IdleBars = () => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 4, height: '100%', opacity: 0.1,
  }}>
    {[14, 22, 10, 30, 18, 26, 12, 20, 16, 24, 8, 18].map((h, i) => (
      <motion.div
        key={i}
        animate={{ scaleY: [0.35, 1, 0.35] }}
        transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.08, ease: 'easeInOut' }}
        style={{
          width: 3, height: h, borderRadius: 2,
          background: '#ffffff', transformOrigin: 'bottom',
        }}
      />
    ))}
  </div>
);

export default VoiceSession;