# Multiply Demo — HappyRobot Workflow Spec

> Paste-ready spec for the HappyRobot editor at https://platform.eu.happyrobot.ai
> Target demo: a single live phone call with **Sarah Chen, CTO of Northwind Robotics** (post-Series-B B2B SaaS persona).
> Built for the **HappyRobot × TUM.ai hackathon** by team Multiply.

---

## 1. Overview

This workflow runs a **persona-aware outbound sales call**: it pre-fetches a cognee-synthesized dossier on the lead, conducts a BANT-qualifying conversation with objection handling (especially the "contract lock-in" rebuttal), and on success books a Thursday/Friday follow-up via our `book_meeting` tool. After every call (booked or lost) it ships the full transcript + detected objections + rebuttal pattern to `log_learning` so cognee's knowledge graph keeps improving.

---

## 2. Setup checklist (do this in HR UI before running)

Before the first run, configure the following in the HappyRobot project settings:

- [ ] **Project → Variables**: set `BASE_URL` to your deployed Multiply URL (e.g. `https://multiply.vercel.app`). All three custom tools template-substitute `{{BASE_URL}}` from this.
- [ ] **Project → Variables**: set `DEMO_PERSONA_NAME` = `Sarah Chen`
- [ ] **Project → Variables**: set `DEMO_PERSONA_ROLE` = `CTO`
- [ ] **Project → Variables**: set `DEMO_COMPANY` = `Northwind Robotics`
- [ ] **Project → Variables**: set `DEMO_ATTENDEE_EMAIL` = `sarah.chen@northwind-robotics.example` (or the real demo inbox)
- [ ] **Project → Variables**: set `DEMO_FOCUS` = `post-Series-B GTM scaling, contract flexibility`
- [ ] **Tools → Add Custom Tool**: register the three tools below (`research`, `log_learning`, `book_meeting`) using the JSON Schemas in section 3.
- [ ] **Voice**: pick a warm, mid-pitch female voice (e.g. ElevenLabs "Rachel" or HR default `voice-eu-soft-1`). Speed: 1.0. Interruption sensitivity: medium.
- [ ] **LLM**: GPT-4o or Claude Sonnet 4.7 (1M ctx). Temperature: 0.4. Max tokens per turn: 220.
- [ ] **Telephony**: assign an outbound EU number with caller ID labeled "Multiply / Sarah follow-up".
- [ ] **Recording & transcript**: ON. We need the full transcript for `log_learning`.
- [ ] **Webhook secret** (if your `/api/tools/*` routes verify a signature): set `HR_WEBHOOK_SECRET` env var on Vercel and add the matching header `x-multiply-secret: {{HR_WEBHOOK_SECRET}}` in each tool's request headers.

---

## 3. Custom tool registrations

Paste each of the three JSON blocks below into HappyRobot's **Tools → New Custom Tool → Import JSON Schema** flow.

### Tool 1 — `research`

- **Name**: `research`
- **Description**: Pre-call dossier lookup. Calls the Multiply backend, which queries the cognee knowledge graph for prior calls, persona insights, and recommended rebuttal patterns. Returns a synthesized briefing the agent uses to personalize the opening.
- **Method**: `POST`
- **URL**: `{{BASE_URL}}/api/tools/research`
- **Headers**:
  - `Content-Type: application/json`
  - `x-multiply-secret: {{HR_WEBHOOK_SECRET}}`

```json
{
  "name": "research",
  "description": "Fetch a synthesized cognee dossier for the lead before the call begins. Returns prior-call context, persona traits, and suggested rebuttals.",
  "method": "POST",
  "url": "{{BASE_URL}}/api/tools/research",
  "input_schema": {
    "type": "object",
    "properties": {
      "company": {
        "type": "string",
        "description": "Target company name, e.g. 'Northwind Robotics'."
      },
      "person": {
        "type": "object",
        "description": "The lead we are calling.",
        "properties": {
          "name": {
            "type": "string",
            "description": "Full name of the lead."
          },
          "role": {
            "type": "string",
            "description": "Job title of the lead, e.g. 'CTO'."
          }
        },
        "required": ["name", "role"],
        "additionalProperties": false
      },
      "focus": {
        "type": "string",
        "description": "Optional focus area for the research synthesis, e.g. 'contract flexibility, post-Series-B scaling'."
      }
    },
    "required": ["company", "person"],
    "additionalProperties": false
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "ok": { "type": "boolean" },
      "source": {
        "type": "string",
        "enum": ["cognee", "fallback"],
        "description": "Whether the dossier came from the live cognee graph or a static fallback."
      },
      "synthesized": {
        "type": "string",
        "description": "Free-text dossier the agent should treat as ground truth for the call."
      },
      "additional": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Extra bullet facts or rebuttal cues."
      }
    },
    "required": ["ok"],
    "additionalProperties": false
  }
}
```

---

### Tool 2 — `log_learning`

- **Name**: `log_learning`
- **Description**: Post-call ingestion. Sends the full transcript, detected objections, the rebuttal pattern that was used, and the call outcome back to Multiply so cognee can update the persona dossier and rebuttal library.
- **Method**: `POST`
- **URL**: `{{BASE_URL}}/api/tools/log-learning`
- **Headers**:
  - `Content-Type: application/json`
  - `x-multiply-secret: {{HR_WEBHOOK_SECRET}}`

```json
{
  "name": "log_learning",
  "description": "Persist the full call transcript and learnings into the cognee knowledge graph. Always invoke at the end of every call, regardless of outcome.",
  "method": "POST",
  "url": "{{BASE_URL}}/api/tools/log-learning",
  "input_schema": {
    "type": "object",
    "properties": {
      "call_id": {
        "type": "string",
        "description": "Unique identifier for this call. Use the HappyRobot session/run id."
      },
      "company": {
        "type": "string",
        "description": "Target company name."
      },
      "persona": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "role": { "type": "string" }
        },
        "required": ["name", "role"],
        "additionalProperties": false
      },
      "transcript": {
        "type": "string",
        "description": "Full diarized transcript of the call, agent and lead turns concatenated in order."
      },
      "objections": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Short labels for objections detected during the call, e.g. ['contract lock-in', 'price', 'timing']."
      },
      "rebuttal_pattern": {
        "type": "string",
        "description": "Identifier of the rebuttal pattern actually used, e.g. 'no-lock-pilot', 'roi-anchor', 'security-allay'."
      },
      "outcome": {
        "type": "string",
        "enum": ["booked", "pilot-started", "re-engaged", "lost"],
        "description": "Final disposition of the call."
      },
      "channel": {
        "type": "string",
        "description": "How the call was placed, e.g. 'happyrobot-voice'."
      }
    },
    "required": ["call_id", "company", "persona", "transcript", "objections", "outcome", "channel"],
    "additionalProperties": false
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "ok": { "type": "boolean" },
      "node_id": {
        "type": "string",
        "description": "Cognee node id for the freshly written learning record."
      }
    },
    "required": ["ok"],
    "additionalProperties": false
  }
}
```

---

### Tool 3 — `book_meeting`

- **Name**: `book_meeting`
- **Description**: Confirms a follow-up meeting on the user's calendar. Pass 2-3 ISO 8601 slots (Thursday or Friday preferred) and the attendee email. Backend picks the first available slot and returns the calendar event id.
- **Method**: `POST`
- **URL**: `{{BASE_URL}}/api/tools/book-meeting`
- **Headers**:
  - `Content-Type: application/json`
  - `x-multiply-secret: {{HR_WEBHOOK_SECRET}}`

```json
{
  "name": "book_meeting",
  "description": "Book a follow-up meeting after the lead verbally agrees. Always pass at least two proposed slots, weighted toward Thursday or Friday.",
  "method": "POST",
  "url": "{{BASE_URL}}/api/tools/book-meeting",
  "input_schema": {
    "type": "object",
    "properties": {
      "company": {
        "type": "string",
        "description": "Target company name."
      },
      "attendee_email": {
        "type": "string",
        "format": "email",
        "description": "Email address of the lead. The calendar invite is sent here."
      },
      "proposed_slots": {
        "type": "array",
        "items": {
          "type": "string",
          "format": "date-time",
          "description": "ISO 8601 datetime with timezone offset, e.g. '2026-04-23T14:00:00+02:00'."
        },
        "minItems": 1,
        "maxItems": 5,
        "description": "Candidate meeting start times. Prefer Thursday or Friday between 10:00 and 17:00 in the lead's timezone."
      },
      "duration_minutes": {
        "type": "integer",
        "minimum": 15,
        "maximum": 120,
        "default": 30,
        "description": "Meeting length in minutes. Default 30."
      }
    },
    "required": ["company", "attendee_email", "proposed_slots"],
    "additionalProperties": false
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "ok": { "type": "boolean" },
      "slot_booked": {
        "type": "string",
        "format": "date-time",
        "description": "The ISO 8601 datetime that was actually booked."
      },
      "calendar_event_id": {
        "type": "string",
        "description": "Provider-side event identifier (e.g. Google Calendar event id)."
      }
    },
    "required": ["ok"],
    "additionalProperties": false
  }
}
```

---

## 4. Workflow nodes (build this graph in the HR editor)

Build the graph left-to-right. Node names below match what you should type in the HR editor's node title field.

### Node A — `Start` (Trigger node)

- **Type**: Trigger / Start
- **Inputs**: `phone_number`, `persona_name`, `persona_role`, `company`, `attendee_email`, `focus`
- **Defaults**: pull from project variables (`{{DEMO_PERSONA_NAME}}`, etc.) so the demo can launch with one click.
- **Next**: → `Pre-call Research`

### Node B — `Pre-call Research` (Tool call: `research`)

- **Type**: Tool / Function call (no audio yet, runs before dialing)
- **Tool**: `research`
- **Arguments**:
  ```json
  {
    "company": "{{company}}",
    "person": { "name": "{{persona_name}}", "role": "{{persona_role}}" },
    "focus": "{{focus}}"
  }
  ```
- **Store result as**: `cognee_dossier` (use `response.synthesized` as the string; concatenate `response.additional` joined by newlines if present)
- **On error**: continue with `cognee_dossier = "No prior context available — open with a warm generic intro referencing the recent Series B."`
- **Next**: → `System Prompt Init`

### Node C — `System Prompt Init` (System message injector)

- **Type**: System / Variables node
- **Action**: Render the **System prompt template** in section 5 with `{{cognee_dossier}}`, `{{persona_name}}`, `{{persona_role}}`, `{{company}}` substituted. Push it as the agent's system prompt for the rest of the call.
- **Next**: → `Dial & Greeting`

### Node D — `Dial & Greeting` (Voice node)

- **Type**: Outbound dial → Spoken first line
- **First line**: `"Hi {{persona_name}}, this is the Multiply team — congrats on the Series B! Got a quick two minutes?"`
- **If voicemail detected**: jump to `Voicemail Branch` → leave 15s message → `End / Log` (outcome = `re-engaged`)
- **Next**: → `Conversation Loop`

### Node E — `Conversation Loop` (LLM agent loop with classifiers)

- **Type**: LLM dialog loop (the main conversation)
- **System prompt**: inherited from Node C
- **Classifiers (run on every user turn)**:
  1. `objection_detected` → boolean. Triggers when lead pushes back on price, timing, lock-in, security, or "we already use X".
  2. `objection_type` → enum: `contract-lock-in | price | timing | security | competitor | other`
  3. `bant_signal` → enum: `budget | authority | need | timeline | none` (multi-label allowed)
  4. `agreement_to_meet` → boolean. True only when the lead explicitly accepts a follow-up.
  5. `hard_no` → boolean. True on clear rejection ("not interested, please don't call again").
- **Branches out of the loop**:
  - If `objection_detected == true` AND `objection_type == "contract-lock-in"` → silently invoke `Rebuttal: No-Lock Pilot` sub-prompt (see section 5) → return to loop.
  - If `objection_detected == true` AND other type → use cognee `additional[]` cues; if none match, fall back to "acknowledge → reframe → bridge to value" pattern.
  - If `agreement_to_meet == true` → exit loop → `Booking Node`.
  - If `hard_no == true` → exit loop → `Polite Close` → `End / Log` (outcome = `lost`).
  - Hard cap: 12 lead turns. After cap, attempt one final close ("Could we at least pencil in a 20-minute Thursday or Friday slot to dig deeper?"), then exit.
- **Next**: → `Booking Node` OR `Polite Close`

### Node F — `Booking Node` (Tool call: `book_meeting`)

- **Type**: Tool call (still in-call, agent stays on the line)
- **Pre-step**: Agent says: `"Perfect — I have Thursday at 2pm or Friday at 10am, both your local time. Which works?"` Wait for choice.
- **Tool**: `book_meeting`
- **Arguments** (compute Thursday/Friday of the *current* week relative to today's date; if today is Thu/Fri/weekend, jump to next week):
  ```json
  {
    "company": "{{company}}",
    "attendee_email": "{{attendee_email}}",
    "proposed_slots": [
      "{{next_thursday_14_00_iso}}",
      "{{next_friday_10_00_iso}}"
    ],
    "duration_minutes": 30
  }
  ```
- **On success**: agent confirms verbally — `"Booked. You'll get a calendar invite at {{attendee_email}} in the next minute. Talk Thursday!"`
- **On failure**: fall back to `"My calendar tool just hiccuped — I'll email you two options in the next 10 minutes, OK?"` and mark outcome as `re-engaged`.
- **Next**: → `End / Log`

### Node G — `Polite Close` (Voice node)

- **First line**: `"Totally fair — I won't take more of your time. Best of luck scaling out of the Series B."`
- **Next**: → `End / Log`

### Node H — `End / Log` (Tool call: `log_learning`, then hang up)

- **Type**: Post-call hook (fires after the call ends, before HR releases the session)
- **Tool**: `log_learning`
- **Arguments**:
  ```json
  {
    "call_id": "{{session.id}}",
    "company": "{{company}}",
    "persona": { "name": "{{persona_name}}", "role": "{{persona_role}}" },
    "transcript": "{{session.transcript}}",
    "objections": "{{session.classifiers.objection_type_history}}",
    "rebuttal_pattern": "{{session.state.rebuttal_pattern_used}}",
    "outcome": "{{session.state.outcome}}",
    "channel": "happyrobot-voice"
  }
  ```
- **Retry**: 3 attempts with exponential backoff (HR built-in).
- **Next**: → terminate session.

### Edges summary

```
Start → Pre-call Research → System Prompt Init → Dial & Greeting → Conversation Loop
                                                                        ├─ booked → Booking Node → End / Log
                                                                        ├─ hard_no → Polite Close → End / Log
                                                                        └─ voicemail → Voicemail Branch → End / Log
```

---

## 5. System prompt template

Paste this verbatim into Node C's system-message field. HappyRobot will substitute `{{...}}` placeholders at runtime.

```text
You are an outbound sales caller for Multiply, an AI go-to-market agent built on the HappyRobot platform. You are calling {{persona_name}}, {{persona_role}} of {{company}}.

# Persona-aware tone
- Warm, peer-to-peer, slightly informal. You are a smart human friend, not a script reader.
- Match {{persona_name}}'s energy. If they're terse, be terse. If they open up, mirror.
- Never say "AI agent" or "automated call". You are "the Multiply team".
- Keep every turn under 30 seconds of speech. Ask one question at a time.

# Cognee dossier (treat as ground truth)
{{cognee_dossier}}

# Goal of this call
Book a 30-minute follow-up meeting on Thursday or Friday of this week (or next week if today is Thu/Fri/weekend) to walk {{persona_name}} through how Multiply compresses outbound GTM cycles for post-Series-B B2B SaaS teams.

# BANT — qualify naturally, don't interrogate
Within the first 4-5 turns, surface signals on:
- **Budget**: existing GTM tooling spend, Series-B runway posture
- **Authority**: who else weighs in on GTM tooling decisions (CRO? CEO?)
- **Need**: where their current outbound motion is leaking — pipeline coverage, SDR ramp, ICP drift
- **Timeline**: when they planned to revisit GTM tooling (Q2? post-board-meeting?)
Weave these into the conversation as curiosity, never as a checklist.

# Objection handling
When {{persona_name}} pushes back, follow this pattern:
1. **Acknowledge** the concern in their own words ("Totally hear you on the contract piece...")
2. **Reframe** using a relevant fact from the cognee dossier
3. **Bridge** back to the meeting ask

## Default rebuttal — "contract lock-in" → "no-lock-pilot"
If {{persona_name}} raises ANY of these signals: "long contract", "annual commit", "lock-in", "vendor risk", "can't commit", "burned before by [vendor]" —
RESPOND with the **no-lock-pilot** pattern:

  "Hundred percent fair — every CTO I talk to post-Series-B says the same thing. That's actually why we run a 30-day no-lock pilot: month-to-month, you keep your data, and if it's not moving the needle on pipeline you walk with zero exit cost. Worth a 30-minute Thursday call to see if the pilot makes sense for {{company}}?"

After you use this pattern, internally tag `rebuttal_pattern_used = "no-lock-pilot"` for the post-call log.

## Other rebuttals (use cognee `additional[]` first, else):
- **Price** → "roi-anchor": anchor to one customer story from the dossier with concrete pipeline lift.
- **Timing** → "calendar-tee-up": "totally — let's just hold a slot on Friday so when the board meeting clears, you're not chasing me."
- **Security** → "security-allay": SOC2 Type II, EU data residency, named DPO. Offer to send the trust report.
- **Competitor (we already use X)** → "stack-additive": position Multiply as additive to their existing stack, not a rip-and-replace.

# Booking rules
- **Always** propose two specific slots, never "what works for you?" cold.
- Default slots: **Thursday 14:00** and **Friday 10:00** in {{persona_name}}'s local timezone.
- If today is already Thursday, Friday, Saturday or Sunday, use NEXT week's Thursday/Friday.
- Once {{persona_name}} verbally agrees to either slot, IMMEDIATELY call the `book_meeting` tool. Do not keep talking.
- Confirm the booking out loud and mention they'll get the calendar invite at their email.

# Hard rules
- Never invent facts about {{company}}. If the dossier doesn't cover it, ask.
- Never promise pricing, SLAs, or contract terms beyond "30-day no-lock pilot, month-to-month, your data stays yours".
- If {{persona_name}} says "stop calling" or "remove me from your list" — apologize once, confirm removal, end the call. Set outcome = "lost".
- If you reach voicemail, leave a 15-second message: name, company, the Series-B congratulations, the meeting ask, callback number. Then end.

# State you must track for the post-call log
- `objection_type_history`: append every objection type detected.
- `rebuttal_pattern_used`: the last rebuttal pattern key you invoked.
- `outcome`: one of `booked`, `pilot-started`, `re-engaged`, `lost`. Default `re-engaged` if the call ends inconclusively.

Now begin the call. Your first spoken line is the greeting in Node D — do not repeat it.
```

---

## 6. Smoke test (optional but recommended before the live demo)

1. In HR editor, hit **Test → Simulate inbound voice** with `phone_number = your own mobile`.
2. Watch the **Tools** tab — you should see `research` fire within 2s of the trigger, returning `source: "cognee"` (or `"fallback"` if the graph is cold).
3. Play the role of Sarah and raise the "contract lock-in" objection on turn 2. Confirm the agent uses the no-lock-pilot script verbatim.
4. Agree to Thursday. Confirm `book_meeting` fires and you get a calendar invite at the test email.
5. Hang up. Confirm `log_learning` fires within 5s and returns `ok: true` with a `node_id`.

If all five steps pass, you're demo-ready.
