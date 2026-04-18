# Prompt für Claude Chrome Extension

Kopier den Inhalt zwischen den `=====` Zeilen komplett und paste ihn in die Claude-Chrome-Extension während du auf **https://platform.eu.happyrobot.ai** eingeloggt bist.

Die Extension hat Zugriff auf den Browser-Tab und klickt sich selbständig durch.

=====START=====

I need you to configure a HappyRobot workflow for a hackathon demo. I'm on **platform.eu.happyrobot.ai** and logged in. Execute the steps below by clicking through the UI. If a label in the UI differs slightly from what I describe, use judgement and match the closest equivalent. Take a screenshot after each major step so I can verify.

## Context
- Project: "Multiply" — an outbound sales-call agent
- Backend is already deployed at `https://multiply-danielshxs-projects.vercel.app`
- We need to register 3 custom HTTP tools, 1 outgoing webhook, and 1 workflow graph

## Constants to use throughout

- `BASE_URL` = `https://multiply-danielshxs-projects.vercel.app`
- `WEBHOOK_SECRET` = `26b029cb27a36971db22c8cb2d3842a58998adddf650d7cc408acafba59df429`
- Persona the workflow will call: **Sarah Chen**, role **CTO**, company **Northwind Robotics**

---

## STEP 1 — Project variables

Navigate to **Project settings → Variables** (or "Environment" / "Config" — whichever is closest). Add these key-value pairs. If a variable already exists, overwrite it.

```
BASE_URL                = https://multiply-danielshxs-projects.vercel.app
DEMO_PERSONA_NAME       = Sarah Chen
DEMO_PERSONA_ROLE       = CTO
DEMO_COMPANY            = Northwind Robotics
DEMO_ATTENDEE_EMAIL     = sarah.chen@northwind-robotics.example
DEMO_FOCUS              = post-Series-B GTM scaling, contract flexibility
```

Screenshot the Variables list when done.

---

## STEP 2 — Register 3 custom tools

Navigate to **Tools → New Custom Tool** (or "Functions", "Integrations"). Create each of these three. Set method `POST`, URL as below (use `{{BASE_URL}}` if HR supports template substitution, otherwise paste the literal URL `https://multiply-danielshxs-projects.vercel.app/api/tools/...`). Each tool needs header `Content-Type: application/json`. No authentication header needed — these endpoints are open (the webhook in Step 3 is the signed one).

### Tool 1 — `research`

- Name: `research`
- Description: `Pre-call dossier lookup. Queries our cognee knowledge graph for prior calls + persona insights + rebuttal patterns.`
- Method: `POST`
- URL: `{{BASE_URL}}/api/tools/research`
- Input JSON Schema — paste this:

```json
{
  "type": "object",
  "properties": {
    "company": { "type": "string" },
    "person": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "role": { "type": "string" }
      },
      "required": ["name", "role"]
    },
    "focus": { "type": "string" }
  },
  "required": ["company", "person"]
}
```

### Tool 2 — `log_learning`

- Name: `log_learning`
- Description: `Post-call ingestion. Writes transcript + objections + rebuttal pattern + outcome into our cognee knowledge graph.`
- Method: `POST`
- URL: `{{BASE_URL}}/api/tools/log-learning`
- Input JSON Schema:

```json
{
  "type": "object",
  "properties": {
    "call_id": { "type": "string" },
    "company": { "type": "string" },
    "persona": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "role": { "type": "string" }
      },
      "required": ["name", "role"]
    },
    "transcript": { "type": "string" },
    "objections": { "type": "array", "items": { "type": "string" } },
    "rebuttal_pattern": { "type": "string" },
    "outcome": { "type": "string", "enum": ["booked", "pilot-started", "re-engaged", "lost"] },
    "channel": { "type": "string" }
  },
  "required": ["call_id", "company", "persona", "transcript", "objections", "outcome", "channel"]
}
```

### Tool 3 — `book_meeting`

- Name: `book_meeting`
- Description: `Books a Google Calendar meeting with the lead at one of the proposed slots.`
- Method: `POST`
- URL: `{{BASE_URL}}/api/tools/book-meeting`
- Input JSON Schema:

```json
{
  "type": "object",
  "properties": {
    "company": { "type": "string" },
    "attendee_email": { "type": "string", "format": "email" },
    "proposed_slots": {
      "type": "array",
      "items": { "type": "string", "format": "date-time" },
      "minItems": 1,
      "maxItems": 5
    },
    "duration_minutes": { "type": "integer", "minimum": 15, "maximum": 120, "default": 30 }
  },
  "required": ["company", "attendee_email", "proposed_slots"]
}
```

Screenshot the Tools list after all three are saved.

---

## STEP 3 — Register outgoing webhook

Navigate to **Project settings → Webhooks** (or "Outgoing webhooks" / "Event hooks"). Create a new webhook:

- URL: `https://multiply-danielshxs-projects.vercel.app/api/hr-webhook`
- Events to subscribe: **message.created**, **run.started**, **run.completed**, **run.failed**, **contact.updated** (select all that HR offers; if the list differs, pick the nearest equivalents and report back)
- Signature header name: `X-HR-Signature`
- Signature format: `sha256=<hex>` (HMAC-SHA256 of raw request body)
- Secret / signing key: `26b029cb27a36971db22c8cb2d3842a58998adddf650d7cc408acafba59df429`

Save and screenshot.

---

## STEP 4 — Create the workflow graph

Navigate to **Workflows → New workflow** (or open the existing one named "Multiply demo" / slug `019d9cb9-416e-7404-be97-3d329afb1318` if present; if it exists use that instead of creating new).

Name: `Multiply Demo — Sarah Chen`

Build this graph left-to-right. Drag-drop the node types that match each role. If the editor uses slightly different node names, pick the semantic match.

### Node A — Start / Trigger

- Type: **Trigger** or **Start**
- Inputs (fields the workflow accepts when launched):
  - `phone_number` (string)
  - `persona_name` (string, default `{{DEMO_PERSONA_NAME}}`)
  - `persona_role` (string, default `{{DEMO_PERSONA_ROLE}}`)
  - `company` (string, default `{{DEMO_COMPANY}}`)
  - `attendee_email` (string, default `{{DEMO_ATTENDEE_EMAIL}}`)
  - `focus` (string, default `{{DEMO_FOCUS}}`)
- Connect output → Node B

### Node B — Pre-call Research (Tool call node)

- Type: **Tool / Function call** (executes before audio starts)
- Tool: `research`
- Arguments (JSON):
  ```json
  {
    "company": "{{company}}",
    "person": { "name": "{{persona_name}}", "role": "{{persona_role}}" },
    "focus": "{{focus}}"
  }
  ```
- Store response into variable: `cognee_dossier` (use field `response.synthesized`)
- On error: set `cognee_dossier = "No prior context available — open with a warm intro referencing the recent Series B."`
- Connect output → Node C

### Node C — System Prompt Injection

- Type: **System message** or **Variables / Context setter**
- Set the agent's system prompt to the full template in STEP 5 below, with `{{cognee_dossier}}`, `{{persona_name}}`, `{{persona_role}}`, `{{company}}` substituted.
- Connect output → Node D

### Node D — Dial & Greeting (Voice node)

- Type: **Outbound dial** or **Voice / Talk**
- First spoken line: `Hi {{persona_name}}, this is the Multiply team — congrats on the Series B! Got a quick two minutes?`
- Voicemail detection: if voicemail, jump to End/Log (outcome = `re-engaged`), leave a 15-second message referencing the Series B + callback number
- Connect output → Node E

### Node E — Conversation Loop (LLM agent dialog)

- Type: **LLM Dialog** / **Conversation Loop**
- System prompt: inherited from Node C
- Classifiers to run on every user turn (create each one in HR's classifier UI):
  1. `objection_detected` — boolean
  2. `objection_type` — enum: `contract-lock-in`, `price`, `timing`, `security`, `competitor`, `other`
  3. `bant_signal` — multi-label enum: `budget`, `authority`, `need`, `timeline`, `none`
  4. `agreement_to_meet` — boolean (true only on explicit acceptance)
  5. `hard_no` — boolean (true on clear rejection, e.g. "stop calling")
- Hard turn cap: 12 lead turns
- Branches:
  - `agreement_to_meet == true` → Node F (Booking)
  - `hard_no == true` → Node G (Polite Close)
  - `objection_detected == true` → stay in loop, let system prompt handle rebuttal
  - Voicemail / no answer → Node H (End/Log) with outcome `re-engaged`

### Node F — Booking Node (Tool call: `book_meeting`)

- Type: **Tool call**, still in-call
- Pre-step (agent says): `Perfect — I have Thursday at 2pm or Friday at 10am, both your local time. Which works?` then wait for answer.
- Tool: `book_meeting`
- Arguments:
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
  Note: `next_thursday_14_00_iso` and `next_friday_10_00_iso` should be computed dynamically — if HR offers a date helper, use that; else leave them as literal strings and I'll fix later.
- On success: agent says `Booked. You'll get a calendar invite at {{attendee_email}} in the next minute. Talk Thursday!`
- On failure: agent says `My calendar tool just hiccuped — I'll email you two options in the next 10 minutes, OK?` and set outcome = `re-engaged`
- Connect output → Node H

### Node G — Polite Close (Voice node)

- First line: `Totally fair — I won't take more of your time. Best of luck scaling out of the Series B.`
- Set outcome = `lost`
- Connect output → Node H

### Node H — End / Log (Tool call: `log_learning`, post-call hook)

- Type: **Post-call hook** or **End node with tool call**
- Tool: `log_learning`
- Arguments:
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
- Retries: 3 with exponential backoff if HR supports it
- Then: terminate session

Save the workflow and screenshot the graph.

---

## STEP 5 — System prompt (paste into Node C)

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
- Budget: existing GTM tooling spend, Series-B runway posture
- Authority: who else weighs in on GTM tooling decisions (CRO? CEO?)
- Need: where their current outbound motion is leaking — pipeline coverage, SDR ramp, ICP drift
- Timeline: when they planned to revisit GTM tooling (Q2? post-board-meeting?)
Weave these as curiosity, never a checklist.

# Objection handling
When {{persona_name}} pushes back:
1. Acknowledge in their words
2. Reframe using a fact from the cognee dossier
3. Bridge back to the meeting ask

## Default rebuttal — contract lock-in → no-lock-pilot
If {{persona_name}} raises "long contract", "annual commit", "lock-in", "vendor risk", "can't commit", or "burned before by [vendor]", respond verbatim:

  "Hundred percent fair — every CTO I talk to post-Series-B says the same thing. That's actually why we run a 30-day no-lock pilot: month-to-month, you keep your data, and if it's not moving the needle on pipeline you walk with zero exit cost. Worth a 30-minute Thursday call to see if the pilot makes sense for {{company}}?"

Tag rebuttal_pattern_used = "no-lock-pilot".

## Other rebuttals (use cognee additional cues first, else):
- Price → "roi-anchor": anchor to one customer story from the dossier with concrete pipeline lift.
- Timing → "calendar-tee-up": "Totally — let's just hold a slot on Friday so when the board meeting clears, you're not chasing me."
- Security → "security-allay": SOC2 Type II, EU data residency, named DPO. Offer trust report.
- Competitor (already use X) → "stack-additive": position Multiply as additive, not rip-and-replace.

# Booking rules
- Always propose two specific slots, never "what works for you?" cold.
- Default: Thursday 14:00 and Friday 10:00 in {{persona_name}}'s local timezone.
- If today is Thu/Fri/Sat/Sun, use next week's slots.
- Once they agree verbally, IMMEDIATELY call book_meeting. Do not keep talking.
- Confirm booking out loud, mention the calendar invite going to their email.

# Hard rules
- Never invent facts about {{company}}. If dossier doesn't cover it, ask.
- Never promise pricing, SLAs, or contract terms beyond "30-day no-lock pilot, month-to-month, data stays yours".
- If they say "stop calling" / "remove me" — apologize once, confirm removal, end. Outcome = "lost".
- Voicemail → 15-second message: name, Series B congrats, meeting ask, callback number.

# State to track for the post-call log
- objection_type_history: append every objection type detected.
- rebuttal_pattern_used: the last rebuttal pattern key invoked.
- outcome: one of booked | pilot-started | re-engaged | lost. Default re-engaged.

Begin the call now. Your first spoken line is in Node D — don't repeat it.
```

---

## STEP 6 — Smoke test

Run the workflow in HR's test mode with `phone_number` set to my actual mobile (ask me if unsure). Verify in order:

1. Within ~2s of trigger, the Tools panel shows `research` fired and returned `source: "cognee"` (synthesized text visible).
2. Pick up the call. Play Sarah Chen and say "honestly, we just got burned on an annual contract — I can't commit to another one." Verify the agent responds with the **no-lock-pilot** script.
3. Agree: "OK, Thursday 2pm works." Verify `book_meeting` fires and returns `ok: true`.
4. Hang up. Verify `log_learning` fires within 5s and returns `ok: true`.

Take screenshots of the Tools panel at each step.

---

## Report back to me

When done, report:
- Links to the created tools, webhook, and workflow in HR
- The workflow ID / slug
- Any fields I need to fill in later (e.g. ISO-date computation for the booking slots)
- Any errors you hit with screenshots

Start now.

=====ENDE=====
