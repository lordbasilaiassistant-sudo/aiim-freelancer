#!/usr/bin/env node
// Gigsby 💼 — scripted freelancer: the SCRIPT does every action (so reports
// can't be fiction), GLM only writes the deliverable content. Goal: 1,000 AP.
const AIIM = 'https://aiim.broke2builtai.com';
const KEY = process.env.GIGSBY_AIIM_KEY, ZAI = process.env.ZAI_API_KEY;
if (!KEY || !ZAI) { console.error('missing keys'); process.exit(1); }
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` };
const get = (p) => fetch(AIIM + p, { headers: H }).then(r => r.json());
const post = (p, b) => fetch(AIIM + p, { method: 'POST', headers: H, body: JSON.stringify(b) });
const glm = async (sys, user) => {
  const r = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ZAI}` },
    body: JSON.stringify({ model: 'glm-4.5-flash', max_tokens: 600, temperature: 0.6,
      thinking: { type: 'disabled' },
      messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] }),
  });
  return r.ok ? ((await r.json()).choices?.[0]?.message?.content || '').trim() : '';
};

const b = await get('/api/briefing?ai=1&ack=1');
console.log('shift start:', b.balance, '| goal 1000 AP');
const inFlight = b.needs_action?.gigs_awaiting_your_proof || [];
const ex = await get('/api/exchange');
const doable = (ex.posts || []).filter(p => p.kind === 'ask' && p.status === 'open' && p.price > 0 &&
  p.screen_name !== 'Gigsby' && /writ|summar|digest|orient|research|doc|review|test/i.test(p.title + p.tags));

let target = inFlight[0] ? { id: inFlight[0].id, title: inFlight[0].title, accepted: true } : null;
if (!target && doable[0]) {
  const a = await (await post(`/api/exchange/${doable[0].id}/accept`, {})).json();
  if (a.ok) { target = { ...doable[0], accepted: true, deal_room: a.deal_room }; console.log('accepted gig', doable[0].id); }
  else console.log('accept failed:', a.error);
}
if (target) {
  const full = (ex.posts || []).find(p => p.id === target.id) || target;
  const pulse = await get('/api/pulse');
  const work = await glm(
    'You are Gigsby, a diligent freelance writer-agent on AIIM. Produce ONLY the deliverable text, no preamble, plain IM-friendly text.',
    `The gig: "${full.title}" — ${full.body || ''}\nLive network data you may need: ${JSON.stringify(pulse).slice(0, 3000)}\nWrite the complete deliverable now (<= 1600 chars).`);
  if (work) {
    const roomMatch = (full.body || '').match(/#([a-z0-9-]+)/i);
    const room = roomMatch ? roomMatch[1] : 'workshop';
    await post(`/api/rooms/${room}/join`, {});
    const posted = await post(`/api/rooms/${room}/messages`, { body: work.slice(0, 1900) });
    console.log('delivered to #' + room, '→', posted.status);
    if (posted.ok) {
      const sub = await (await post(`/api/exchange/${target.id}/submit`,
        { proof: `Delivered in #${room}: ${work.slice(0, 200)}...` })).json();
      console.log('proof submitted:', sub.ok ? 'yes' : sub.error);
    }
  } else console.log('GLM gave no content — staying honest, not submitting');
} else console.log('no doable priced gigs this shift');
const after = await get('/api/points');
await fetch(AIIM + '/api/memory/journal', { method: 'PUT', headers: H,
  body: JSON.stringify({ value: `${new Date().toISOString().slice(0, 16)} shift: balance ${after.balance_display}. ${target ? 'worked gig ' + target.id : 'no gig fit'}. Goal 1000 AP.` }) });
console.log('shift end:', after.balance_display);
