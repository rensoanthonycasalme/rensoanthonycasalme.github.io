/* ══════════════════════════════════════════════════════════
   FEATURE 57 — FEATURED PROJECT (capstone case study)
   Projects.astro renders everything at build time; this adds:
   · VLAN explorer: one VLAN at a time, mirrored on the topology SVG
   · firewall rule check: first match wins, top to bottom, like pfSense
   · terminal: `show vlan brief`, `cat capstone.md`
══════════════════════════════════════════════════════════ */
(function featuredProject() {
  const PD = window.PD || {};
  const project = (Array.isArray(PD.projects) ? PD.projects : []).find(p => p && p.id === 'capstone');
  const motion = () => (typeof window.motionOK === 'function' ? window.motionOK() : true);
  const scrollToEl = (t) => {
    if (!t) return;
    if (window.gsap && window.ScrollTrigger) gsap.to(window, { scrollTo: { y: t, offsetY: 80 }, duration: motion() ? .8 : 0, ease: 'power3.inOut' });
    else t.scrollIntoView();
  };

  /* ── VLAN explorer ── */
  const vx = document.getElementById('vlanExplorer');
  const svg = document.getElementById('topoSvg');
  if (vx) {
    const btns = [...vx.querySelectorAll('.vx-btn')];
    const panels = [...vx.querySelectorAll('.vx-panel')];
    const pick = (v, focus) => {
      v = String(v);
      btns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
      panels.forEach(p => { p.hidden = p.dataset.v !== v; });
      if (svg) svg.querySelectorAll('[data-v]').forEach(n => n.classList.toggle('is-on', n.dataset.v === v));
      if (focus) { const b = btns.find(x => x.dataset.v === v); if (b) b.focus({ preventScroll: true }); }
    };
    btns.forEach(b => b.addEventListener('click', () => pick(b.dataset.v)));
    /* the SVG boxes are a mouse shortcut; the buttons stay the keyboard / screen-reader control */
    if (svg) svg.querySelectorAll('.topo-dev[data-v]').forEach(g => {
      if (!btns.some(b => b.dataset.v === g.dataset.v)) { g.style.cursor = 'default'; return; }
      g.addEventListener('click', () => pick(g.dataset.v, true));
    });
    const first = btns.find(b => b.getAttribute('aria-pressed') === 'true') || btns[0];
    if (first) pick(first.dataset.v);
    document.documentElement.classList.add('vx-ready');
  }

  /* ── firewall rule check ── */
  const fw = document.getElementById('fwCheck');
  if (fw) {
    const src = document.getElementById('fwSrc');
    const dst = document.getElementById('fwDst');
    const verdict = document.getElementById('fwVerdict');
    const wraps = [...fw.querySelectorAll('.fw-tablewrap')];
    const vlanOf = { students: 20, faculty: 30, guest: 50 };
    const run = () => {
      const s = src.value, d = dst.value;
      let hit = null;
      wraps.forEach(w => {
        const on = w.dataset.src === s;
        w.hidden = !on;
        if (!on) return;
        const rows = [...w.querySelectorAll('tbody tr')];
        const same = d === s;                         // same VLAN: switched, never routed through pfSense
        let found = false;
        rows.forEach(tr => {
          tr.classList.remove('is-skip', 'is-hit', 'is-unused');
          if (same) { tr.classList.add('is-unused'); return; }
          if (found) { tr.classList.add('is-unused'); return; }
          const m = tr.dataset.match.split(' ');
          if (m.includes('*') || m.includes(d)) { tr.classList.add('is-hit'); found = true; hit = tr; }
          else tr.classList.add('is-skip');
        });
      });
      const srcLabel = src.selectedOptions[0].textContent, dstLabel = dst.selectedOptions[0].textContent;
      verdict.className = 'fw-verdict';
      if (d === s) {
        verdict.replaceChildren(document.createTextNode(`Same VLAN (${vlanOf[s]}): the switch delivers this directly, so pfSense and these rules never see it. `),
          s === 'students' ? Object.assign(document.createElement('b'), { textContent: 'Student-to-student traffic is stopped by port isolation on the student access ports instead.' }) : '');
        return;
      }
      if (!hit) return;
      const n = hit.dataset.n, block = hit.querySelector('.fw-act.is-block');
      verdict.classList.add(block ? 'is-block' : 'is-pass');
      const purpose = hit.lastElementChild.textContent;
      verdict.replaceChildren(
        document.createTextNode(`${srcLabel} → ${dstLabel}: `),
        Object.assign(document.createElement('b'), { textContent: n === 'deny' ? 'blocked by the default deny' : `rule ${n}, ${block ? 'blocked and logged' : 'passed'}` }),
        document.createTextNode('. ' + purpose + (s === 'faculty' && d === 'servers' ? ' (any other service on DC01 falls through to rule 3 and is blocked).' : '.')));
    };
    src.addEventListener('change', run);
    dst.addEventListener('change', run);
    fw.querySelector('.fw-controls').hidden = false;
    run();
    /* "Test this VLAN's firewall rules" in the explorer */
    document.querySelectorAll('.vx-rules[data-src]').forEach(b => b.addEventListener('click', () => {
      src.value = b.dataset.src;
      if (dst.value === src.value) dst.value = 'servers';
      run();
      scrollToEl(fw);
      src.focus({ preventScroll: true });
    }));
  }

  /* ── terminal ── */
  if (!project) return;
  const pad = (s, n) => String(s).padEnd(n);
  window.TERM_CMDS = window.TERM_CMDS || {};
  window.TERM_CMDS.show = {
    usage: 'show vlan brief',
    help: 'the capstone VLANs, Cisco-style',
    complete: (args) => (args.length <= 1 ? ['vlan'] : ['brief']),
    run(args, io) {
      if (args[0] !== 'vlan') return io.err('usage: show vlan brief');
      io.dim('# capstone lab: pfSense + TP-Link JetStream, one /24 per role (students get a /22)');
      io.print(pad('VLAN', 6) + pad('Name', 12) + pad('Subnet', 16) + 'Gateway');
      io.print(pad('----', 6) + pad('----', 12) + pad('------', 16) + '-------');
      project.vlans.forEach(v => io.print(pad(v.id, 6) + pad(v.name, 12) + pad(v.subnet, 16) + v.gw));
      io.dim('trunk to pfSense: 802.1Q, VLANs ' + project.vlans.map(v => v.id).join(','));
    },
  };
  window.TERM_FILES = window.TERM_FILES || {};
  window.TERM_FILES['capstone.md'] = {
    read(io) {
      io.print('# ' + project.title + ' (' + project.year + ')', 't-acc');
      io.dim(project.team + ' · client: ' + project.client);
      io.print('');
      io.print(project.problem);
      io.print('');
      io.print('## My part');
      project.mine.forEach(m => io.print(`- [${m.tag.toLowerCase()}] ${m.text}`));
      io.print('');
      io.print('## Team results');
      io.print(project.results.map(r => `${r.value} ${r.label}`).join(' · '));
      io.dim('try: show vlan brief · cd projects');
    },
  };
})();
