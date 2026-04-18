export const INITIAL_SIGNALS = [
  {
    id: 'sig_01',
    company: 'Northwind Robotics',
    type: 'funding',
    icon: 'F',
    color: 'accent',
    desc: 'Closed $48M Series B led by Accel. CTO posted about scaling infra.',
    tags: ['Funding', 'ICP match'],
    score: 94,
    time: 2,
  },
  {
    id: 'sig_02',
    company: 'Vantage Biotech',
    type: 'hiring',
    icon: 'H',
    color: 'warning',
    desc: 'Posted 6 new DevOps roles in EU. Job specs mention Kubernetes, Terraform.',
    tags: ['Hiring', 'Tech stack'],
    score: 88,
    time: 8,
  },
  {
    id: 'sig_03',
    company: 'Meridian Logistics',
    type: 'social',
    icon: 'S',
    color: 'purple',
    desc: 'VP Ops posted on LinkedIn: "evaluating ETL vendors this quarter."',
    tags: ['Intent', 'Decision-maker'],
    score: 91,
    time: 14,
  },
  {
    id: 'sig_04',
    company: 'Acme Fintech',
    type: 'stack',
    icon: 'T',
    color: 'success',
    desc: 'Added Snowflake + Fivetran to stack. Churn signal on legacy tool.',
    tags: ['Stack diff'],
    score: 72,
    time: 23,
  },
  {
    id: 'sig_05',
    company: 'Orbital Health',
    type: 'ma',
    icon: 'M',
    color: 'info',
    desc: 'Acquired by Philips. New parent is existing customer — warm path.',
    tags: ['M&A', 'Warm path'],
    score: 86,
    time: 41,
  },
];

export const INCOMING_SIGNALS = [
  { company: 'Tidemark Capital', type: 'funding', icon: 'F', color: 'accent', desc: 'Raised $22M Series A. CFO hired from portfolio co.', tags: ['Funding'], score: 81 },
  { company: 'Helix Labs', type: 'hiring', icon: 'H', color: 'warning', desc: 'VP Engineering opened 4 senior platform roles in 48h.', tags: ['Hiring'], score: 76 },
  { company: 'Parallax Systems', type: 'intent', icon: 'I', color: 'purple', desc: 'CTO visited pricing page 4 times this week. Compared 2 competitors.', tags: ['Buying intent', 'Hot'], score: 93 },
  { company: 'Coastline Commerce', type: 'stack', icon: 'T', color: 'success', desc: 'Removed legacy ETL tool from stack. Actively shopping.', tags: ['Stack diff', 'Churn'], score: 84 },
  { company: 'Ferrous Foundry', type: 'social', icon: 'S', color: 'purple', desc: 'Head of Data tweeted frustration about data pipeline reliability.', tags: ['Pain signal'], score: 69 },
];

export const LEAD = {
  id: 'lead_northwind',
  name: 'Sarah Chen',
  initials: 'SC',
  role: 'CTO',
  company: 'Northwind Robotics',
  location: 'Munich, DE',
  phone: '+49 89 •• ••• 4712',
  email: 's.chen@northwind.io',
  score: 94,
  bant: {
    budget: '~$180K',
    authority: 'Sarah + VP Platform',
    need: 'Platform rebuild',
    timeline: '4–6 weeks',
  },
  timeline: [
    { time: '-2m', channel: 'Signal', text: 'Series B announcement detected via TechCrunch + LinkedIn' },
    { time: '-1m', channel: 'Email', text: 'Outbound sent · referenced prior vendor at last company' },
    { time: '0m', channel: 'Open', text: 'Email opened from Munich IP, twice in 40 seconds' },
    { time: 'now', channel: 'Call', text: 'Sarah picked up. Call in progress.' },
  ],
};

export const TRANSCRIPT = [
  { t: '00:04', who: 'ai', text: 'Hi Sarah — thanks for picking up. I saw the Series B announcement this morning, congratulations on closing with Accel. Is this still a good moment for a quick two-minute chat?' },
  { t: '00:18', who: 'human', text: 'Sure, I have a few minutes. You caught me between calls.' },
  { t: '00:25', who: 'ai', text: "Appreciated. I'll be direct — you mentioned scaling infra in your LinkedIn post. At your previous company you ran Terraform plus Argo. Is that the direction here, or are you reconsidering the stack post-raise?" },
  { t: '00:46', who: 'human', text: 'Reconsidering, actually. We inherited a messy Helm setup from the early team and we need to decide in the next four to six weeks whether to rebuild or migrate.', tag: 'timeline captured', tagColor: 'info' },
  { t: '01:09', who: 'ai', text: "That's a familiar fork. Most teams your size pick migration and regret it at 800 nodes. Quick one — who else is in that decision with you?", tag: 'authority probe', tagColor: 'info' },
  { t: '01:24', who: 'human', text: 'Just me and our VP Platform. Board wants us to move fast so the buck stops with me.' },
  { t: '01:38', who: 'ai', text: 'Good. Budget-wise, post-raise teams usually earmark 8 to 12% of engineering opex for platform. Does that match your shape, or is it tighter?' },
  { t: '01:58', who: 'human', text: "Honestly I'm not sure we want to commit to another annual vendor contract right now. Last time we did that it took six months to unwind.", tag: 'objection', tagColor: 'accent' },
  { t: '02:20', who: 'ai', text: "That's fair, and I hear it often. We actually don't do annual lock-in below the enterprise tier — it's monthly, cancel any time, and the migration tooling is open-source so you keep it either way. Would a two-week pilot on one cluster change the shape of this conversation?" },
  { t: '02:44', who: 'human', text: 'A pilot I could do. Send me something I can skim tonight and let\'s put thirty minutes on the calendar with my VP Platform next week.' },
  { t: '03:02', who: 'ai', text: "Perfect. I'll send a one-pager in the next five minutes and three time slots that match both your calendars for next week. Thursday or Friday afternoon Munich time — preference?" },
  { t: '03:24', who: 'human', text: 'Thursday works. Late afternoon.' },
  { t: '03:31', who: 'ai', text: "Locked. You'll get the invite and the one-pager before we hang up. One last thing — anything specific you want us to cover in the demo so it's not wasted?", streaming: true },
];

export const PIPELINE = {
  detected: [
    { company: 'Orbital Health', score: 86, time: '41m', moved: false },
    { company: 'Acme Fintech', score: 72, time: '23m', moved: false },
    { company: 'Lumen AI', score: 68, time: '1h', moved: false },
    { company: 'Tidemark Capital', score: 81, time: '3m', moved: true },
  ],
  engaged: [
    { company: 'Northwind Robotics', score: 94, time: 'live', moved: true, active: true },
    { company: 'Vantage Biotech', score: 88, time: '6m', moved: false },
    { company: 'Helix Labs', score: 81, time: '2h', moved: false },
  ],
  qualified: [
    { company: 'Meridian Logistics', score: 91, time: '4m', moved: true },
    { company: 'Kite Capital', score: 84, time: '18m', moved: true },
    { company: 'Nexus Retail', score: 79, time: '3h', moved: false },
  ],
  booked: [
    { company: 'Polaris Data', score: 92, time: '32m', moved: true },
    { company: 'Bridgepoint', score: 87, time: '2h', moved: false },
  ],
  closed: [
    { company: 'Atlas Group', score: 95, time: '1h', moved: true },
    { company: 'Forge Robotics', score: 89, time: '5h', moved: false },
  ],
};

export const AGENT_LOOP = [
  { num: 1, name: 'Prospector', desc: 'Enriched account · 420 employees, Series B, Munich HQ', status: 'done', time: '2m' },
  { num: 2, name: 'Research', desc: 'Found CTO Sarah Chen · prior customer at last role', status: 'done', time: '2m' },
  { num: 3, name: 'Personaliser', desc: 'Chose angle: infra scaling post-raise · variant B tone', status: 'done', time: '1m' },
  { num: 4, name: 'Qualifier', desc: 'Voice call in progress · extracting BANT fields', status: 'live', time: 'live' },
  { num: 5, name: 'Negotiator', desc: 'Standby · triggers on objection detection', status: 'queued', time: '—' },
  { num: 6, name: 'Closer', desc: 'Standby · triggers on buying intent', status: 'queued', time: '—' },
];

export const KPIS = [
  { label: 'Signals ingested today', value: 2847, delta: '+312 vs yesterday', deltaKind: 'up' },
  { label: 'Leads auto-opened', value: 184, delta: '+14% this week', deltaKind: 'up' },
  { label: 'Meetings booked', value: 37, delta: '11 in last 24h', deltaKind: 'up' },
  { label: 'Reply rate · 7d', value: '28.4%', delta: 'Variant B winning', deltaKind: 'up' },
];

export const OBJECTIONS = [
  { text: 'Annual contract lock-in', status: 'resolved', time: '01:58' },
  { text: 'Demo scope anxiety', status: 'probing', time: '03:31' },
  { text: 'Procurement process', status: 'predicted', time: 'next call' },
];

export const QUEUED_ACTIONS = [
  { text: 'Send one-pager · within 5 min of hang-up', channel: 'Email' },
  { text: 'Propose 3 meeting slots · dual calendar', channel: 'Calendar' },
  { text: 'Notify AE Markus in Slack', channel: 'Slack' },
  { text: 'Update HubSpot · stage → Qualified', channel: 'CRM' },
];

export const WHISPER_SUGGESTIONS = [
  'ask about their current MTTR before pitching',
  'mention the Accel connection — our CEO knows the partner',
  'softer tone, she seems time-constrained',
  'push for Thursday 3pm specifically',
];

export const RESPONSES = {
  'ask about their current MTTR before pitching':
    "Before we go further — what's your current mean time to recovery when a cluster hiccups? That'll tell me whether this conversation is about cost or about reliability.",
  'mention the Accel connection — our CEO knows the partner':
    "Worth mentioning — our CEO knows Rich at Accel well, so if it'd help to have him loop in with a reference customer of similar scale, I can set that up.",
  'softer tone, she seems time-constrained':
    "I'll keep this tight since I know you're between calls. One question and then I'll send details async.",
  'push for Thursday 3pm specifically':
    'Thursday at 3pm Munich time is open on both calendars — want me to lock it now and send the invite?',
};
