'use client';
import React, { useEffect, useRef } from 'react';
import { Drawer, Pill, Dot, IconExternal, IconLink } from '@/components/multiply/ui';
import { useCallMessages } from './useCallMessages';

export function TranscriptDrawer({ call, onClose }) {
  const open = !!call;
  const { messages, connected } = useCallMessages(open ? call?.id : null);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={call?.contact_name || 'Call'}
      subtitle={call ? `${call.phone_number} · ${call.status}` : ''}
      width={580}
    >
      {call && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <LiveBadge call={call} connected={connected} count={messages.length} />

          <Section label="Transcript" right={
            messages.length > 0 ? (
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)' }}>
                {messages.length} msg
              </span>
            ) : null
          }>
            <Transcript messages={messages} status={call.status} />
          </Section>

          <Section label="Disposition">
            {call.disposition ? (
              <Pill color="accent">{call.disposition}</Pill>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                pending — agent hasn't recorded yet
              </span>
            )}
            {call.reason && (
              <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                "{call.reason}"
              </p>
            )}
          </Section>

          <Section label="Timing">
            <KV k="Created" v={fmt(call.created_at)} />
            <KV k="Updated" v={fmt(call.updated_at)} />
            {call.duration_sec != null && <KV k="Duration" v={`${call.duration_sec}s`} />}
            {call.closed_at && <KV k="Closed at" v={fmt(call.closed_at)} />}
          </Section>

          <Section label="SMS link">
            {call.sms_sent_at ? (
              <>
                <KV k="Sent" v={fmt(call.sms_sent_at)} />
                {call.sms_sid && <KV k="Twilio SID" v={call.sms_sid} mono />}
              </>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                Not sent. Agent will fire send_quiz_link only on verbal yes.
              </span>
            )}
          </Section>

          <Section label="HappyRobot">
            {call.hr_run_id && <KV k="Run ID" v={call.hr_run_id} mono />}
            {call.hr_session_id && <KV k="Session ID" v={call.hr_session_id} mono />}
            {call.transcript_url && (
              <a href={call.transcript_url} target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--accent)', marginTop: 6 }}>
                <IconExternal size={11} /> open transcript
              </a>
            )}
            {call.recording_url && (
              <a href={call.recording_url} target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--accent)', marginTop: 6 }}>
                <IconLink size={11} /> recording
              </a>
            )}
          </Section>
        </div>
      )}
    </Drawer>
  );
}

function LiveBadge({ call, connected, count }) {
  if (call.status === 'live') {
    return (
      <Pill color="info" size="md">
        <Dot color="info" pulse size={6} />
        Live · streaming · {count} {count === 1 ? 'message' : 'messages'}
      </Pill>
    );
  }
  if (call.status === 'completed') {
    return (
      <Pill color="success" size="md">
        <Dot color="success" size={6} /> Completed · {count} messages
      </Pill>
    );
  }
  if (call.status === 'triggered') {
    return (
      <Pill color="neutral" size="md">
        <Dot color="neutral" pulse size={6} /> Dialing…
      </Pill>
    );
  }
  if (call.status === 'failed') {
    return (
      <Pill color="danger" size="md">
        <Dot color="danger" size={6} /> Failed
      </Pill>
    );
  }
  return null;
}

function Transcript({ messages, status }) {
  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div style={{
        padding: 18,
        background: 'var(--bg-subtle)',
        borderRadius: 'var(--radius-md)',
        textAlign: 'center',
        color: 'var(--text-tertiary)',
        fontSize: 12,
      }}>
        {status === 'live' ? 'Waiting for first message…' :
         status === 'triggered' ? 'Call ringing — transcript will appear once they pick up.' :
         'No transcript captured.'}
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      style={{
        background: 'var(--bg-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: 12,
        maxHeight: 360,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        border: '1px solid var(--border-subtle)',
      }}
    >
      {messages.map((m) => (
        <Bubble key={m.id} message={m} />
      ))}
      {status === 'live' && (
        <div style={{ alignSelf: 'flex-start', padding: '2px 4px' }}>
          <span className="blink" style={{ color: 'var(--text-quaternary)', fontFamily: 'var(--mono)', fontSize: 12 }}>▋</span>
        </div>
      )}
    </div>
  );
}

function Bubble({ message }) {
  const isAgent = message.role === 'agent' || message.role === 'assistant';
  const isUser = message.role === 'user' || message.role === 'lead' || message.role === 'human';
  const isTool = message.role === 'tool' || message.role === 'system';

  if (isTool) {
    return (
      <div style={{
        alignSelf: 'center',
        fontSize: 10,
        fontFamily: 'var(--mono)',
        color: 'var(--text-tertiary)',
        background: 'var(--surface)',
        border: '1px dashed var(--border)',
        padding: '3px 8px',
        borderRadius: 'var(--radius-sm)',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
      }}>
        {message.role} · {message.content?.slice(0, 80)}
      </div>
    );
  }

  return (
    <div style={{
      alignSelf: isAgent ? 'flex-start' : 'flex-end',
      maxWidth: '78%',
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
    }}>
      <span style={{
        fontSize: 10,
        color: 'var(--text-tertiary)',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        paddingLeft: isAgent ? 2 : 0,
        paddingRight: isAgent ? 0 : 2,
        textAlign: isAgent ? 'left' : 'right',
      }}>
        {isAgent ? 'Alex (agent)' : isUser ? 'Contact' : message.role}
        {' · '}
        {fmtTime(message.ts)}
      </span>
      <div style={{
        padding: '8px 12px',
        fontSize: 13,
        lineHeight: 1.5,
        background: isAgent ? 'var(--surface)' : 'var(--accent)',
        color: isAgent ? 'var(--text)' : '#fff',
        border: isAgent ? '1px solid var(--border)' : '1px solid var(--accent)',
        borderRadius: isAgent
          ? 'var(--radius-md) var(--radius-md) var(--radius-md) 2px'
          : 'var(--radius-md) var(--radius-md) 2px var(--radius-md)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {message.content}
      </div>
    </div>
  );
}

function Section({ label, right, children }) {
  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <div style={{
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          color: 'var(--text-tertiary)',
        }}>{label}</div>
        {right}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</div>
    </div>
  );
}

function KV({ k, v, mono }) {
  return (
    <div style={{ display: 'flex', gap: 10, fontSize: 12 }}>
      <span style={{ color: 'var(--text-tertiary)', minWidth: 80 }}>{k}</span>
      <span style={{
        color: 'var(--text)',
        fontFamily: mono ? 'var(--mono)' : 'var(--sans)',
        wordBreak: 'break-all',
      }}>{v}</span>
    </div>
  );
}

function fmt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}
