// The lecture-hall screen during a HackUTD workshop: slides on the ideas the workshops teach, each a diagram
// that animates the way the system actually runs. RAG, then MCP, then agents with tools, then a live demo
// putting them together.
import { Screen, C, SANS, MONO, text, rect, line, arrow, ease, clamp } from './kit.js';

const node = (ctx, x, y, w, h, label, { on = false, sub = '', color = C.blue } = {}) => {
  rect(ctx, x, y, w, h, { fill: on ? 'rgba(255,154,60,0.16)' : '#121923', stroke: on ? C.orange : color, lw: 2, r: 8 });
  text(ctx, label, x + w / 2, y + h / 2 - (sub ? 8 : 0), { size: 16, font: SANS, weight: '700', color: C.ink, align: 'center' });
  if (sub) text(ctx, sub, x + w / 2, y + h / 2 + 12, { size: 12, color: C.dim, align: 'center' });
};
const packet = (ctx, x0, y0, x1, y1, k, label, color = C.orange) => {
  if (k <= 0 || k >= 1) return; const x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k;
  ctx.font = `12px ${MONO}`; const tw = ctx.measureText(label).width + 14;
  rect(ctx, x - tw / 2, y - 11, tw, 22, { fill: '#0b0f14', stroke: color, r: 11 }); text(ctx, label, x, y, { size: 12, color, align: 'center' });
};

export class BoardScreen extends Screen {
  constructor(w, h) { super(w, h, [12, 12, 13, 10]); this.goto(0); }
  frameTitle(ctx, n, title, sub) {
    text(ctx, title, 40, 46, { size: 30, font: SANS, weight: '800', color: C.ink });
    text(ctx, sub, 40, 80, { size: 15, font: SANS, color: C.dim });
    text(ctx, `HackUTD workshop  ·  ${n}/4`, this.w - 30, this.h - 22, { size: 12, color: C.faint, align: 'right' });
    rect(ctx, 40, 98, 60, 3, { fill: C.orange });
  }
  draw(ctx) { this[`s${this.step}`](ctx, this.st); }
  // RAG: retrieve the relevant chunks, put them in the prompt, answer from them
  s0(ctx, t) {
    this.frameTitle(ctx, 1, 'Retrieval-augmented generation', 'Look things up first, then answer from what you found');
    const y = 250;
    node(ctx, 40, y - 30, 150, 60, 'Question', { sub: '"when is judging?"', on: t < 2 });
    node(ctx, 250, y - 30, 130, 60, 'Embed', { sub: 'text → vector', on: t >= 2 && t < 3.5 });
    // the vector store, with chunks; the nearest three light up
    rect(ctx, 440, 130, 200, 250, { fill: '#121923', stroke: t >= 3.5 && t < 6 ? C.orange : C.blue, lw: 2, r: 8 });
    text(ctx, 'Vector store', 540, 150, { size: 15, font: SANS, weight: '700', align: 'center' });
    const chunks = ['schedule.md #4', 'faq.md #2', 'rules.md #7', 'schedule.md #9', 'venue.md #1', 'prizes.md #3', 'faq.md #6'];
    const hit = [0, 3, 1];
    chunks.forEach((c, i) => { const on = t >= 4 && hit.includes(i); rect(ctx, 456, 172 + i * 28, 168, 22, { fill: on ? 'rgba(255,154,60,0.25)' : '#0d131b', stroke: on ? C.orange : C.line, r: 4 }); text(ctx, c, 466, 183 + i * 28, { size: 12, color: on ? C.orange : C.dim }); if (on) text(ctx, (0.91 - hit.indexOf(i) * 0.06).toFixed(2), 616, 183 + i * 28, { size: 11, color: C.orange, align: 'right' }); });
    node(ctx, 700, y - 60, 130, 120, 'Prompt', { sub: 'question + chunks', on: t >= 6 && t < 8 });
    node(ctx, 870, y - 30, 110, 60, 'LLM', { on: t >= 8 && t < 9.5, color: C.purple });
    arrow(ctx, 190, y, 248, y); arrow(ctx, 380, y, 438, y); arrow(ctx, 640, y, 698, y); arrow(ctx, 830, y, 868, y);
    packet(ctx, 190, y - 40, 250, y - 40, (t - 1) / 1, 'query');
    packet(ctx, 380, y - 40, 440, y - 40, (t - 2.5) / 1, '[0.12, -0.4, …]');
    packet(ctx, 640, y - 80, 700, y - 80, (t - 5) / 1, 'top-3');
    if (t > 9) {
      rect(ctx, 600, 410, 380, 92, { fill: '#121923', stroke: C.green, lw: 2, r: 8 });
      text(ctx, 'Judging starts Sunday at 11:00 in the', 616, 436, { size: 14 });
      text(ctx, 'ECSW atrium.  [schedule.md #4]', 616, 458, { size: 14 });
      text(ctx, 'grounded: every claim points at a chunk', 616, 484, { size: 12, color: C.green });
    }
    text(ctx, 'Same model, no retraining: the knowledge lives in the store and can be updated any time.', 40, 530, { size: 14, color: C.dim, font: SANS, alpha: clamp(t - 9.5) });
  }
  // MCP: one protocol between the app and any number of tool servers
  s1(ctx, t) {
    this.frameTitle(ctx, 2, 'Model Context Protocol', 'One standard way to plug tools and data into any AI app');
    node(ctx, 40, 150, 260, 230, '', { color: C.purple });
    text(ctx, 'Host app', 170, 172, { size: 16, font: SANS, weight: '700', align: 'center' });
    node(ctx, 70, 196, 200, 60, 'LLM', { color: C.purple, on: t > 9 && t < 11 });
    node(ctx, 70, 290, 200, 60, 'MCP client', { on: (t > 1 && t < 3) || (t > 5 && t < 7) });
    const servers = [['files', 'read_file, search'], ['database', 'query'], ['calendar', 'list_events, create']];
    servers.forEach(([n, tools], i) => { const y = 140 + i * 90; node(ctx, 480, y, 200, 64, `${n} server`, { sub: tools, on: (t > 3 && t < 5) || (i === 1 && t > 7 && t < 9) }); line(ctx, [[270, 320], [480, y + 32]], { color: C.faint, lw: 2, dash: [6, 5] }); });
    text(ctx, 'JSON-RPC', 380, 300, { size: 12, color: C.dim, align: 'center' });
    for (let i = 0; i < 3; i++) packet(ctx, 270, 320, 480, 172 + i * 90, (t - 1.2 - i * 0.2) / 1.6, 'tools/list');
    for (let i = 0; i < 3; i++) packet(ctx, 480, 172 + i * 90, 270, 320, (t - 3.4 - i * 0.2) / 1.4, 'tools', C.green);
    packet(ctx, 270, 320, 480, 262, (t - 6) / 1.4, 'tools/call');
    packet(ctx, 480, 262, 270, 320, (t - 8) / 1.2, 'result', C.green);
    const J = t < 5.5 ? ['{ "method": "tools/list" }', '', '← { "tools": [', '    { "name": "query",', '      "inputSchema": { … } },', '    … ] }']
      : ['{ "method": "tools/call",', '  "params": {', '    "name": "query",', '    "arguments": {', '      "sql": "SELECT room FROM', '        events WHERE …" } } }', '', '← { "content": [ … ] }'];
    rect(ctx, 720, 140, 270, 250, { fill: '#0d131b', stroke: C.line, r: 8 });
    J.forEach((l, i) => text(ctx, l, 734, 164 + i * 24, { size: 13, color: l.startsWith('←') ? C.green : C.ink }));
    text(ctx, 'Write a server once and it works in every MCP app; the model sees its tools and decides when to call them.', 40, 430, { size: 14, font: SANS, color: C.dim, alpha: clamp(t - 9) });
  }
  // agents: the model calls tools in a loop until it can answer
  s2(ctx, t) {
    this.frameTitle(ctx, 3, 'Agents and tools', 'A model in a loop: think, call a tool, read the result, repeat');
    const cx = 230, cy = 300, R = 110;
    const phase = Math.floor(t / 1.6) % 4, done = t > 10.5;
    ctx.strokeStyle = C.faint; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.3); ctx.stroke();
    [['LLM', -Math.PI / 2], ['tool call', 0], ['run tool', Math.PI / 2], ['observation', Math.PI]].forEach(([n, a], i) => {
      const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
      rect(ctx, x - 70, y - 22, 140, 44, { fill: i === phase && !done ? 'rgba(255,154,60,0.2)' : '#121923', stroke: i === phase && !done ? C.orange : C.blue, lw: 2, r: 22 });
      text(ctx, n, x, y, { size: 15, font: SANS, weight: '700', align: 'center' });
    });
    const a = (t / 1.6) * Math.PI / 2 - Math.PI / 2; if (!done) rect(ctx, cx + Math.cos(a) * R - 6, cy + Math.sin(a) * R - 6, 12, 12, { fill: C.orange, r: 6 });
    // a real trace
    const T = [
      ['user', 'Which room is the RAG workshop in, and is it full?', C.blue],
      ['call', 'get_schedule(event="RAG workshop")', C.orange],
      ['result', '{"room": "ECSS 2.410", "time": "16:00"}', C.green],
      ['call', 'check_capacity(room="ECSS 2.410")', C.orange],
      ['result', '{"seats": 120, "registered": 134}', C.green],
      ['answer', 'ECSS 2.410 at 4pm. It is oversubscribed', C.ink],
      ['', '(134 for 120 seats), so get there early.', C.ink],
    ];
    rect(ctx, 420, 140, 570, 330, { fill: '#0d131b', stroke: C.line, r: 8 });
    text(ctx, 'trace', 436, 160, { size: 12, color: C.dim });
    T.forEach(([k, v, col], i) => { if (t < i * 1.5) return; const y = 196 + i * 38; text(ctx, k, 436, y, { size: 12, color: C.dim }); text(ctx, v, 506, y, { size: 14, color: col }); });
    text(ctx, 'The model never runs code itself: it asks, your code runs the tool, and the result goes back in.', 40, 520, { size: 14, font: SANS, color: C.dim, alpha: clamp(t - 10) });
  }
  // the hands-on part: build one
  s3(ctx, t) {
    this.frameTitle(ctx, 4, 'Now you build one', 'An agent with a RAG tool, in about 20 lines');
    const SRC = [
      'tools = [{',
      '  "name": "search_docs",',
      '  "description": "Search the hackathon docs",',
      '  "input_schema": {"type": "object",',
      '    "properties": {"q": {"type": "string"}}}}]',
      '',
      'while True:',
      '    reply = llm(messages, tools=tools)',
      '    if reply.stop_reason != "tool_use":',
      '        break                    # final answer',
      '    q = reply.tool_input["q"]',
      '    hits = store.search(embed(q), k=3)   # RAG',
      '    messages += [reply, tool_result(hits)]',
    ];
    rect(ctx, 40, 130, 600, 380, { fill: '#0d131b', stroke: C.line, r: 8 });
    const n = Math.floor(t * 2.2);
    SRC.forEach((l, i) => { if (i > n) return; text(ctx, l, 60, 160 + i * 26, { size: 15, color: C.ink }); });
    if (n < SRC.length) rect(ctx, 60 + ctx.measureText(SRC[Math.min(n, SRC.length - 1)]).width + 4, 152 + Math.min(n, SRC.length - 1) * 26, 9, 16, { fill: C.orange });
    const tips = ['Tools are just functions with a schema', 'The loop is the agent', 'RAG is one tool among many', 'Expose them over MCP to reuse anywhere'];
    tips.forEach((s, i) => { if (t < 2 + i * 1.6) return; rect(ctx, 670, 150 + i * 70, 320, 52, { fill: '#121923', stroke: C.orange, r: 8 }); text(ctx, s, 686, 176 + i * 70, { size: 14, font: SANS, color: C.ink }); });
  }
}
