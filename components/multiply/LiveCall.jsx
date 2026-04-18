'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Pill, Dot, Button, Avatar, IconMic, IconPause, IconPlay, IconStop, IconHand, IconWhisper, IconX } from './ui';
import { TRANSCRIPT, LEAD, OBJECTIONS, QUEUED_ACTIONS, WHISPER_SUGGESTIONS, RESPONSES } from './mockData';
import { MapPin } from './MapPin';

export function LiveCall({ onClose, takeover, onTakeover, onResumeAgent, showToast }) {
  const [transcript, setTranscript] = useState([]);
  const [paused, setPaused] = useState(false);
  const [callTime, setCallTime] = useState(252);
  const [whisperInput, setWhisperInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [agentThought, setAgentThought] = useState(
    'Sarah raised contract-lock-in objection → playbook RAG returned 3 rebuttal patterns. Picked "no-lock-pilot" (highest win-rate for CTO persona, 73%). Offering 2-week pilot preserves momentum without committing her.'
  );
  const [confidence, setConfidence] = useState(78);
  const [transcriptIdx, setTranscriptIdx] = useState(0);
  const [streamingText, setStreamingText] = useState('');
  const [closed, setClosed] = useState(false);
  const [cogneeDossier, setCogneeDossier] = useState(null);
  const [cogneeLoading, setCogneeLoading] = useState(true);

  const transcriptRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Fire precall brief + research in parallel — precall is the smart
        // orchestrator that combines cognee + news + persona inference
        const [briefRes, researchRes] = await Promise.all([
          fetch('/api/intel/precall', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              company: LEAD.company,
              person: { name: LEAD.name, role: LEAD.role },
              focus: 'objection handling for post-Series-B CTO',
            }),
          }).then((r) => r.json()).catch(() => null),
          fetch('/api/tools/research', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              company: LEAD.company,
              person: { name: LEAD.name, role: LEAD.role },
              focus: 'objection patterns and prior call outcomes',
            }),
          }).then((r) => r.json()).catch(() => null),
        ]);
        if (!cancelled) {
          setCogneeDossier({
            ...(researchRes ?? {}),
            brief: briefRes,
          });
        }
      } catch (e) {
        if (!cancelled) setCogneeDossier({ error: e.message });
      } finally {
        if (!cancelled) setCogneeLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (paused || takeover || closed) return;
    if (transcriptIdx >= TRANSCRIPT.length) return;

    const currentLine = TRANSCRIPT[transcriptIdx];

    if (currentLine.streaming) {
      let i = 0;
      const full = currentLine.text;
      const id = setInterval(() => {
        if (i >= full.length) { clearInterval(id); return; }
        i += 2;
        setStreamingText(full.slice(0, Math.min(i, full.length)));
      }, 30);
      setTranscript(prev => [...prev, { ...currentLine, text: '' }]);
      setTranscriptIdx(i => i + 1);
      return () => clearInterval(id);
    }

    const delay = transcriptIdx === 0 ? 400 : 1400;
    const id = setTimeout(() => {
      setTranscript(prev => [...prev, currentLine]);
      setTranscriptIdx(i => i + 1);

      if (currentLine.tag === 'objection') {
        setTimeout(() => {
          setAgentThought('Objection detected: "contract lock-in." Negotiator activated. Scanning playbook RAG for rebuttal patterns matched to CTO persona and post-raise stage...');
          showToast?.('Negotiator agent activated · objection detected', 'warning');
        }, 400);
      }
      if (currentLine.t === '02:20') {
        setTimeout(() => {
          setAgentThought('Rebuttal deployed. Monitoring for acceptance signals. Pre-queuing pilot agreement template and two-week kickoff slot.');
          setConfidence(82);
        }, 500);
      }
      if (currentLine.t === '02:44') {
        setTimeout(() => {
          setAgentThought('Buying signal confirmed. Closer agent taking over. Calendar tool called: fetching dual availability for Sarah + VP Platform next week.');
          setConfidence(91);
          showToast?.('Closer agent took over · booking path active', 'success');
        }, 500);
      }
    }, delay);

    return () => clearTimeout(id);
  }, [transcriptIdx, paused, takeover, closed, showToast]);

  useEffect(() => {
    if (paused || closed) return;
    const id = setInterval(() => setCallTime(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [paused, closed]);

  useEffect(() => {
    if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [transcript, streamingText]);

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const sendWhisper = () => {
    const text = whisperInput.trim();
    if (!text) return;
    setWhisperInput('');
    setTyping(true);
    setAgentThought(`Whisper received from operator: "${text}". Integrating into next turn without breaking conversational flow...`);
    showToast?.('Whisper sent · agent adjusting', 'info');

    setTimeout(() => {
      setTyping(false);
      const reply = RESPONSES[text] || `Just a quick pivot — ${text.toLowerCase()}. Then I'll circle back to the pilot proposal.`;
      setTranscript(prev => [...prev, { t: formatTime(callTime + 3), who: 'ai', text: reply, whispered: true }]);
    }, 1800);
  };

  const handleTakeover = () => {
    onTakeover();
    setAgentThought('Operator has taken over. Agent now in observe-only mode. Will resume on your command.');
  };

  const handleResume = () => {
    onResumeAgent();
    setAgentThought('Agent resumed control. Parsing recent operator turns for continuity and picking up the thread.');
  };

  const handleEnd = () => {
    setClosed(true);
    setAgentThought('Call ended. Post-call intelligence pipeline running: extracting BANT, sentiment arc, rebuttals. Writing structured learning to cognee knowledge graph...');
    showToast?.('Call ended · analyzing transcript', 'info');

    const fullTranscript = transcript
      .map(l => `[${l.t}] ${l.who === 'ai' ? 'Agent' : l.who === 'operator' ? 'You' : LEAD.name}: ${l.text}`)
      .join('\n');

    // Postcall intel = auto-extract BANT + sentiment + objections + rebuttals + writes to cognee
    fetch('/api/intel/postcall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        call_id: `live-${Date.now()}`,
        company: LEAD.company,
        persona: { name: LEAD.name, role: LEAD.role },
        transcript: fullTranscript,
        channel: 'phone',
      }),
    })
      .then(r => r.json())
      .then(d => {
        const lines = [
          `Outcome: ${d.outcome}`,
          d.confidence?.close_probability ? `Close probability: ${d.confidence.close_probability}%` : '',
          d.objections?.length ? `${d.objections.length} objection${d.objections.length > 1 ? 's' : ''} detected` : '',
          d.rebuttals?.length ? `${d.rebuttals.length} rebuttal${d.rebuttals.length > 1 ? 's' : ''} deployed` : '',
        ].filter(Boolean).join(' · ');
        showToast?.(`Intel done · ${lines}`, 'success');
      })
      .catch(() => showToast?.('Intel write failed — check /api/intel/postcall', 'warning'));

    // Also suggest next-best-actions
    fetch('/api/intel/next-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead: {
          company: LEAD.company,
          persona_role: LEAD.role,
          stage: 'booked',
          last_outcome: 'booked',
          hours_since_last_touch: 0,
        },
      }),
    }).catch(() => null);

    setTimeout(onClose, 3000);
  };

  const handleOperatorSend = (text) => {
    setTranscript(prev => [...prev, { t: formatTime(callTime), who: 'operator', text }]);
  };

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'rgba(10, 10, 10, 0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      zIndex: 100,
      animation: 'backdrop-in 200ms ease',
    }}
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 'min(1320px, 96vw)',
        height: 'min(820px, 94vh)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'slide-in-up-lg 320ms cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: 'var(--shadow-xl)',
      }}>
        <CallHeader
          callTime={formatTime(callTime)}
          paused={paused}
          takeover={takeover}
          closed={closed}
          onClose={onClose}
        />
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', overflow: 'hidden' }}>
          <TranscriptPanel
            ref={transcriptRef}
            transcript={transcript}
            streamingText={streamingText}
            paused={paused}
            takeover={takeover}
            closed={closed}
            typing={typing}
            whisperInput={whisperInput}
            setWhisperInput={setWhisperInput}
            sendWhisper={sendWhisper}
            onOperatorSend={handleOperatorSend}
            onPause={() => { setPaused(p => !p); showToast?.(paused ? 'Agent resumed' : 'Agent paused · silence on line', paused ? 'success' : 'warning'); }}
            onTakeover={takeover ? handleResume : handleTakeover}
            onEnd={handleEnd}
          />
          <ReasoningPanel
            thought={agentThought}
            confidence={confidence}
            takeover={takeover}
            cogneeDossier={cogneeDossier}
            cogneeLoading={cogneeLoading}
          />
        </div>
      </div>
    </div>
  );
}

function CallHeader({ callTime, paused, takeover, closed, onClose }) {
  return (
    <div style={{
      padding: '16px 24px',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: 'var(--bg-subtle)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Avatar initials={LEAD.initials} size={42} />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
            <span style={{ fontSize: 16, fontWeight: 500, letterSpacing: -0.2 }}>{LEAD.name}</span>
            {!closed && !takeover && !paused && (
              <Pill color="danger" size="sm">
                <Dot color="danger" pulse size={5} />
                Recording
              </Pill>
            )}
            {takeover && (
              <Pill color="warning" size="sm">
                <Dot color="warning" pulse size={5} />
                You are driving
              </Pill>
            )}
            {paused && <Pill color="warning" size="sm">Paused</Pill>}
            {closed && <Pill color="success" size="sm">Call ended</Pill>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {LEAD.role} · {LEAD.company} · voice call · {LEAD.phone}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1 }}>Duration</div>
          <div style={{ fontSize: 18, fontWeight: 500, fontFamily: 'var(--mono)', fontVariantNumeric: 'tabular-nums' }}>{callTime}</div>
        </div>
        <button onClick={onClose} style={{
          width: 32, height: 32, borderRadius: 'var(--radius-sm)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
        onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
        >
          <IconX size={13} />
        </button>
      </div>
    </div>
  );
}

const TranscriptPanel = React.forwardRef(function TranscriptPanel({
  transcript, streamingText, paused, takeover, closed, typing,
  whisperInput, setWhisperInput, sendWhisper, onOperatorSend,
  onPause, onTakeover, onEnd,
}, ref) {
  const [opInput, setOpInput] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', overflow: 'hidden' }}>
      <div style={{
        padding: '12px 24px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-tertiary)', fontFamily: 'var(--mono)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconMic size={12} />
          Live transcript
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)' }}>
          voice model v4 · whisper enabled
        </div>
      </div>

      <div ref={ref} style={{ flex: 1, overflowY: 'auto', padding: '12px 24px' }}>
        {transcript.map((line, i) => {
          const isLastAi = i === transcript.length - 1 && line.who === 'ai' && streamingText;
          return <TranscriptLine key={i} line={line} streamingText={isLastAi ? streamingText : null} />;
        })}
        {typing && <TypingIndicator />}
        {paused && <SystemNote>Agent paused — line is silent.</SystemNote>}
        {takeover && <SystemNote kind="warning">You are driving the conversation. The agent is observing.</SystemNote>}
        {closed && <SystemNote kind="success">Call ended. Post-call actions queued.</SystemNote>}
      </div>

      {!takeover && !closed && (
        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)' }}>
          <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
            {WHISPER_SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => setWhisperInput(s)}
                style={{
                  fontSize: 11, padding: '4px 10px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 999,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--purple-soft)'; e.currentTarget.style.borderColor = 'var(--purple-border)'; e.currentTarget.style.color = 'var(--purple)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                {s}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--purple)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
              <IconWhisper size={12} /> Whisper
            </div>
            <input
              value={whisperInput}
              onChange={e => setWhisperInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendWhisper()}
              placeholder="Private nudge — Sarah will not see this..."
              style={{
                flex: 1, fontSize: 13, padding: '8px 12px',
                background: 'var(--surface)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text)',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--purple)'}
              onBlur={e => e.target.style.borderColor = 'var(--border-strong)'}
            />
            <Button variant="primary" size="md" onClick={sendWhisper} disabled={!whisperInput.trim()}>
              Send
            </Button>
          </div>
        </div>
      )}

      {takeover && !closed && (
        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border-subtle)', background: 'var(--warning-soft)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--warning)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
              <IconHand size={12} /> You
            </div>
            <input
              value={opInput}
              onChange={e => setOpInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && opInput.trim()) { onOperatorSend(opInput); setOpInput(''); } }}
              placeholder="Type what to say to Sarah..."
              style={{
                flex: 1, fontSize: 13, padding: '8px 12px',
                background: 'var(--surface)',
                border: '1px solid var(--warning)',
                borderRadius: 'var(--radius-sm)',
              }}
            />
            <Button variant="accent" size="md" onClick={() => { if (opInput.trim()) { onOperatorSend(opInput); setOpInput(''); } }}>
              Speak
            </Button>
          </div>
        </div>
      )}

      {!closed && (
        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 6 }}>
          <Button variant="default" size="md" onClick={onPause} icon={paused ? <IconPlay size={11} /> : <IconPause size={11} />}>
            {paused ? 'Resume' : 'Pause'}
          </Button>
          <Button variant={takeover ? 'accent' : 'default'} size="md" onClick={onTakeover} icon={<IconHand size={12} />}>
            {takeover ? 'Return to agent' : 'Take over'}
          </Button>
          <div style={{ flex: 1 }} />
          <Button variant="danger" size="md" onClick={onEnd} icon={<IconStop size={11} />}>
            End call
          </Button>
        </div>
      )}
    </div>
  );
});

function TranscriptLine({ line, streamingText }) {
  const isAi = line.who === 'ai';
  const isOp = line.who === 'operator';
  const label = isAi ? 'Agent' : isOp ? 'You' : 'Sarah';
  const labelColor = isAi ? 'var(--accent)' : isOp ? 'var(--warning)' : 'var(--text)';
  const displayText = streamingText !== null && streamingText !== undefined ? streamingText : line.text;

  return (
    <div style={{
      display: 'flex', gap: 12, padding: '10px 0',
      animation: 'slide-in-up 300ms ease',
      borderLeft: line.whispered ? '2px solid var(--purple)' : 'none',
      paddingLeft: line.whispered ? 14 : 0,
      marginLeft: line.whispered ? -16 : 0,
      background: line.whispered ? 'var(--purple-soft)' : 'transparent',
      borderRadius: line.whispered ? '0 4px 4px 0' : 0,
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)', width: 42, flexShrink: 0, paddingTop: 3 }}>{line.t}</div>
      <div style={{ fontSize: 10, fontWeight: 600, color: labelColor, width: 52, flexShrink: 0, paddingTop: 3, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <div style={{ flex: 1, fontSize: 14, lineHeight: 1.55, color: 'var(--text)' }}>
        {displayText}
        {streamingText !== null && streamingText !== undefined && <span className="blink" style={{ display: 'inline-block', width: 7, height: 14, background: 'var(--accent)', verticalAlign: -2, marginLeft: 2 }} />}
        {line.tag && !streamingText && (
          <Pill color={line.tagColor === 'accent' ? 'accent' : line.tagColor === 'info' ? 'info' : 'neutral'} size="xs" style={{ marginLeft: 8 }}>
            {line.tag}
          </Pill>
        )}
        {line.whispered && !streamingText && (
          <Pill color="purple" size="xs" style={{ marginLeft: 8 }}>whispered nudge</Pill>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '10px 0' }}>
      <div style={{ width: 42, flexShrink: 0 }} />
      <div style={{ width: 52, flexShrink: 0, fontSize: 10, fontWeight: 600, color: 'var(--accent)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1, paddingTop: 3 }}>Agent</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 0' }}>
        <Dot color="accent" pulse size={5} />
        <Dot color="accent" pulse size={5} />
        <Dot color="accent" pulse size={5} />
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 6, fontStyle: 'italic' }}>incorporating whisper...</span>
      </div>
    </div>
  );
}

function SystemNote({ children, kind = 'info' }) {
  const tones = {
    info: { bg: 'var(--info-soft)', fg: 'var(--info)', bd: 'var(--info-border)' },
    warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)', bd: 'var(--warning-border)' },
    success: { bg: 'var(--success-soft)', fg: 'var(--success)', bd: 'var(--success-border)' },
  };
  const c = tones[kind];
  return (
    <div style={{
      margin: '14px 0',
      padding: '10px 14px',
      background: c.bg,
      border: `1px solid ${c.bd}`,
      borderRadius: 'var(--radius-md)',
      fontSize: 12,
      color: c.fg,
      fontFamily: 'var(--mono)',
      textAlign: 'center',
    }}>
      — {children} —
    </div>
  );
}

function ReasoningPanel({ thought, confidence, takeover, cogneeDossier, cogneeLoading }) {
  const [munichTime, setMunichTime] = React.useState('');
  React.useEffect(() => {
    const tick = () => {
      const t = new Date().toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' });
      setMunichTime(`${t} · Munich local`);
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-subtle)' }}>
      <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-tertiary)', fontFamily: 'var(--mono)' }}>
          Agent reasoning
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        <Section label="Lead HQ · prospector enriched" compact>
          <MapPin
            company={LEAD.company}
            address="Maximilianstraße 12, 80539 München, Germany"
            localTime={munichTime}
          />
        </Section>

        {cogneeDossier?.brief && cogneeDossier.brief.ok && (
          <Section label={`Pre-call brief · ${cogneeDossier.brief.confidence_score}% context`} compact>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {cogneeDossier.brief.opener_hint && (
                <div style={{
                  padding: 10,
                  background: 'var(--accent-soft)',
                  border: '1px solid var(--accent-border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 12,
                  lineHeight: 1.5,
                }}>
                  <div style={{ fontSize: 9, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--accent-text)', fontWeight: 600, marginBottom: 3 }}>
                    💡 Opener hint
                  </div>
                  <div style={{ color: 'var(--text)' }}>{cogneeDossier.brief.opener_hint}</div>
                </div>
              )}
              {cogneeDossier.brief.ready_rebuttals?.slice(0, 3).map((r, i) => (
                <div key={i} style={{
                  padding: 8,
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 11,
                  display: 'flex',
                  gap: 6,
                  alignItems: 'center',
                }}>
                  <span style={{ fontFamily: 'var(--mono)', color: 'var(--purple)', fontWeight: 500 }}>{r.pattern}</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>→ if {r.trigger}</span>
                </div>
              ))}
              {cogneeDossier.brief.recent_news?.[0] && (
                <div style={{
                  padding: 8,
                  background: 'var(--info-soft)',
                  border: '1px solid var(--info-border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 11,
                  color: 'var(--info)',
                }}>
                  📰 {cogneeDossier.brief.recent_news[0].headline.slice(0, 100)}
                </div>
              )}
            </div>
          </Section>
        )}

        <Section label="Cognee dossier · pre-call recall" compact>
          {cogneeLoading ? (
            <div style={{ padding: 12, fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)' }}>
              Querying cognee knowledge graph...
            </div>
          ) : cogneeDossier?.synthesized ? (
            <div style={{
              padding: '12px 14px',
              background: 'var(--purple-soft)',
              border: '1px solid var(--purple-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              lineHeight: 1.6,
              color: 'var(--purple)',
              marginBottom: 8,
            }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                <Dot color="purple" pulse size={5} />
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1 }}>
                  cognee · graph_completion
                </span>
              </div>
              <div style={{ color: 'var(--text)' }}>{cogneeDossier.synthesized}</div>
            </div>
          ) : (
            <div style={{ padding: 10, fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)' }}>
              No prior intelligence in graph. Researcher running cold.
            </div>
          )}
        </Section>

        <Section label="Current thought" compact>
          <div style={{
            padding: '12px 14px',
            background: takeover ? 'var(--warning-soft)' : 'var(--surface)',
            border: `1px solid ${takeover ? 'var(--warning-border)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-md)',
            fontSize: 12,
            lineHeight: 1.65,
            color: takeover ? 'var(--warning)' : 'var(--text-secondary)',
            fontFamily: 'var(--mono)',
            animation: 'fade-in 300ms ease',
          }} key={thought.slice(0, 30)}>
            {thought}
          </div>
        </Section>

        <Section label="Close-to-meeting confidence">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${confidence}%`,
                background: confidence > 85 ? 'var(--success)' : confidence > 70 ? 'var(--accent)' : 'var(--warning)',
                borderRadius: 3,
                transition: 'width 600ms ease',
              }} />
            </div>
            <div className="serif" style={{ fontSize: 22, fontWeight: 400, fontVariantNumeric: 'tabular-nums', minWidth: 44, textAlign: 'right', color: confidence > 85 ? 'var(--success)' : 'var(--text)' }}>
              {confidence}%
            </div>
          </div>
        </Section>

        <Section label="BANT · auto-extracted">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {Object.entries(LEAD.bant).map(([k, v]) => (
              <div key={k} style={{
                padding: '9px 11px',
                background: 'var(--success-soft)',
                border: '1px solid var(--success-border)',
                borderRadius: 'var(--radius-sm)',
              }}>
                <div style={{ fontSize: 10, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3, fontFamily: 'var(--mono)', fontWeight: 500 }}>
                  {k}
                </div>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{v}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section label="Objections">
          {OBJECTIONS.map((o, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
              <Dot
                color={o.status === 'resolved' ? 'success' : o.status === 'probing' ? 'accent' : 'neutral'}
                pulse={o.status === 'probing'}
                size={6}
              />
              <span style={{ fontSize: 12, flex: 1, color: o.status === 'predicted' ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}>{o.text}</span>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)' }}>{o.status} · {o.time}</span>
            </div>
          ))}
        </Section>

        <Section label="Queued post-call actions">
          {QUEUED_ACTIONS.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0' }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--border-strong)', marginTop: 7, flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{a.text}</div>
              <Pill color="neutral" size="xs">{a.channel}</Pill>
            </div>
          ))}
        </Section>
      </div>
    </div>
  );
}

function Section({ label, children, compact }) {
  return (
    <div style={{
      marginBottom: 16,
      paddingBottom: compact ? 0 : 16,
      borderBottom: compact ? 'none' : '1px solid var(--border)',
    }}>
      <div style={{
        fontSize: 10, color: 'var(--text-tertiary)',
        textTransform: 'uppercase', letterSpacing: 1.2,
        marginBottom: 10, fontFamily: 'var(--mono)', fontWeight: 500,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}
