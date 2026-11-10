'use strict';

/* ---------- Configuratie ---------- */

const CHECKS = [
  { id: 'info', title: 'Toestelgegevens' },
  { id: 'screen', title: 'Scherm', verdict: true },
  { id: 'keyboard', title: 'Toetsenbord', verdict: true },
  { id: 'touchpad', title: 'Touchpad', verdict: true },
  { id: 'camera', title: 'Camera', verdict: true },
  { id: 'mic', title: 'Microfoon', verdict: true },
  { id: 'audio', title: 'Speakers', verdict: true },
  { id: 'power', title: 'Accu en netwerk', verdict: true },
  { id: 'visual', title: 'Visuele inspectie' },
  { id: 'summary', title: 'Samenvatting' },
];

const VISUAL_ITEMS = [
  { id: 'housing', label: 'Behuizing zonder krassen, deuken of barsten' },
  { id: 'hinges', label: 'Scharnieren stevig, scherm blijft in elke stand staan' },
  { id: 'usb', label: 'Alle USB-poorten herkennen een apparaat' },
  { id: 'video', label: 'Video-uitgang (HDMI of USB-C) geeft beeld' },
  { id: 'charger', label: 'Oplader aanwezig, kabel en stekker onbeschadigd' },
  { id: 'wifi', label: 'Wifi maakt verbinding met het bedrijfsnetwerk' },
  { id: 'bluetooth', label: 'Bluetooth vindt een apparaat' },
  { id: 'login', label: 'Inloggen werkt en updates zijn geïnstalleerd' },
];

const SCREEN_COLORS = [
  ['#ffffff', 'Wit'],
  ['#000000', 'Zwart'],
  ['#ff0000', 'Rood'],
  ['#00ff00', 'Groen'],
  ['#0000ff', 'Blauw'],
  ['linear-gradient(90deg, #000, #fff)', 'Grijsverloop'],
];

const TOUCH_ITEMS = [
  ['move', 'Cursor bewegen'],
  ['left', 'Linkerklik'],
  ['right', 'Rechterklik'],
  ['double', 'Dubbelklik'],
  ['vscroll', 'Verticaal scrollen'],
  ['hscroll', 'Horizontaal scrollen'],
];

const letters = s => [...s].map(c => [`Key${c}`, c]);
const KEY_ROWS = [
  [['Escape', 'Esc'], ...Array.from({ length: 12 }, (_, i) => [`F${i + 1}`, `F${i + 1}`]), ['Delete', 'Del']],
  [['Backquote', '`'], ...[...'1234567890'].map(d => [`Digit${d}`, d]), ['Minus', '-'], ['Equal', '='], ['Backspace', 'Backspace', 2]],
  [['Tab', 'Tab', 1.5], ...letters('QWERTYUIOP'), ['BracketLeft', '['], ['BracketRight', ']'], ['Backslash', '\\', 1.5]],
  [['CapsLock', 'Caps Lock', 1.8], ...letters('ASDFGHJKL'), ['Semicolon', ';'], ['Quote', "'"], ['Enter', 'Enter', 2.2]],
  [['ShiftLeft', 'Shift', 2.3], ...letters('ZXCVBNM'), ['Comma', ','], ['Period', '.'], ['Slash', '/'], ['ShiftRight', 'Shift', 2.7]],
  [['ControlLeft', 'Ctrl', 1.3], ['MetaLeft', 'Win', 1.3], ['AltLeft', 'Alt', 1.3], ['Space', 'Spatie', 6], ['AltRight', 'Alt Gr', 1.3], ['ControlRight', 'Ctrl', 1.3], ['ArrowLeft', '←'], ['ArrowUp', '↑'], ['ArrowDown', '↓'], ['ArrowRight', '→']],
];
const ALL_KEYS = KEY_ROWS.flat().map(k => k[0]);

const STATUS_LABEL = { ok: 'Werkt', fout: 'Defect', open: 'Nog niet getest', nvt: 'N.v.t.' };
const INSPECT_LABEL = { ok: 'In orde', fout: 'Defect', nvt: 'N.v.t.' };
const OVERALL_LABEL = { ok: 'Goedgekeurd', fout: 'Afgekeurd', open: 'Niet compleet' };
const OVERALL_TEXT = {
  ok: 'Alle onderdelen werken. De laptop kan worden uitgeleverd.',
  fout: 'Eén of meer onderdelen zijn defect. Lever deze laptop niet uit en meld het defect.',
  open: 'Nog niet alle onderdelen zijn beoordeeld. Rond de open onderdelen af voordat je de laptop uitlevert.',
};
const NO_MEDIA = 'Deze browser geeft geen toegang tot camera of microfoon. Open de app via http://localhost:3000 in Chrome of Edge.';

/* ---------- Hulpfuncties ---------- */

const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const head = (title, intro) => `<header class="check-head"><h1>${title}</h1>${intro ? `<p>${intro}</p>` : ''}</header>`;
const alsoCheck = items => `<h2 class="sub">Controleer ook met de hand</h2><ul class="plain">${items.map(i => `<li>${i}</li>`).join('')}</ul>`;

function mediaError(err, what) {
  if (err.name === 'NotAllowedError') return `Toegang tot de ${what} is geweigerd. Sta de ${what} toe via het pictogram in de adresbalk en probeer het opnieuw.`;
  if (err.name === 'NotFoundError') return `Er is geen ${what} gevonden. Controleer of de ${what} niet is uitgeschakeld met een schuifje, een toets, in Windows of in de BIOS.`;
  if (err.name === 'NotReadableError') return `De ${what} wordt al gebruikt door een ander programma of reageert niet. Sluit andere programma's en probeer het opnieuw.`;
  return `De ${what} kon niet starten (${err.name}). Probeer het opnieuw.`;
}

/* ---------- Status ---------- */

function freshState() {
  return {
    reportId: Date.now().toString(36),
    info: { serial: '', model: '', tech: '', recipient: '' },
    results: Object.fromEntries(CHECKS.filter(c => c.verdict).map(c => [c.id, { status: 'open', note: '' }])),
    keys: { hit: new Set(), skip: new Set(), extra: new Set() },
    touch: new Set(),
    power: { unplugged: false, plugged: false },
    visual: Object.fromEntries(VISUAL_ITEMS.map(v => [v.id, 'open'])),
    visualNote: '',
    current: 'info',
    saved: false,
  };
}

let state = freshState();
let cleanup = null;
const main = $('#main');

function statusOf(id) {
  if (id === 'info') return state.info.serial.trim() && state.info.model.trim() ? 'ok' : 'open';
  if (id === 'visual') {
    const v = Object.values(state.visual);
    if (v.includes('fout')) return 'fout';
    if (v.includes('open')) return 'open';
    return 'ok';
  }
  if (id === 'summary') return null;
  return state.results[id].status;
}

function overall() {
  const all = CHECKS.map(c => statusOf(c.id)).filter(Boolean);
  if (all.includes('fout')) return 'fout';
  if (all.includes('open')) return 'open';
  return 'ok';
}

const hasProgress = () =>
  Object.values(state.results).some(r => r.status !== 'open') ||
  Object.values(state.visual).some(v => v !== 'open') ||
  state.keys.hit.size > 0;

/* ---------- Navigatie ---------- */

function renderRail() {
  $('#steps').innerHTML = CHECKS.map((c, i) => {
    const st = statusOf(c.id);
    const current = state.current === c.id ? ' aria-current="step"' : '';
    const dot = st ? `<span class="dot dot-${st}" title="${STATUS_LABEL[st]}"></span>` : '<span></span>';
    return `<li><button type="button" data-go="${c.id}"${current}><span class="num">${i + 1}</span><span>${c.title}</span>${dot}</button></li>`;
  }).join('');

  const counted = CHECKS.filter(c => c.id !== 'summary');
  const done = counted.filter(c => statusOf(c.id) !== 'open').length;
  $('#progressFill').style.width = `${(done / counted.length) * 100}%`;
  $('#progressText').textContent = `${done} van ${counted.length} onderdelen afgerond`;

  const { serial, model } = state.info;
  $('#railDevice').textContent = serial || model ? [model, serial].filter(Boolean).join(', ') : 'Nog geen toestel ingevuld';
}

$('#steps').addEventListener('click', e => {
  const b = e.target.closest('[data-go]');
  if (b) go(b.dataset.go);
});

function go(id) {
  if (cleanup) { cleanup(); cleanup = null; }
  state.current = id;
  RENDER[id]();
  renderRail();
  main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

const nextId = id => CHECKS[CHECKS.findIndex(c => c.id === id) + 1]?.id || 'summary';

/* ---------- Oordeel per onderdeel ---------- */

function verdictHTML(id) {
  const r = state.results[id];
  const btn = (v, label) =>
    `<button type="button" class="seg-${v}${r.status === v ? ' on' : ''}" data-v="${v}" aria-pressed="${r.status === v}">${label}</button>`;
  return `<section class="verdict" aria-label="Oordeel">
    <div class="verdict-row"><span class="verdict-q">Oordeel</span><div class="seg" role="group">${btn('ok', 'Werkt')}${btn('fout', 'Defect')}</div></div>
    <label class="note"><span>Opmerking <span class="muted">(optioneel)</span></span><textarea rows="2" placeholder="Bijvoorbeeld: toets E reageert pas na twee keer drukken">${esc(r.note)}</textarea></label>
    <div class="actions"><button type="button" class="btn btn-primary" data-next>Volgende onderdeel</button></div>
  </section>`;
}

function paintVerdict(id) {
  const box = $('.verdict', main);
  if (!box) return;
  box.querySelectorAll('[data-v]').forEach(x => {
    const on = x.dataset.v === state.results[id].status;
    x.classList.toggle('on', on);
    x.setAttribute('aria-pressed', on);
  });
}

function bindVerdict(id) {
  const box = $('.verdict', main);
  box.addEventListener('click', e => {
    const b = e.target.closest('[data-v]');
    if (b) {
      const r = state.results[id];
      r.status = r.status === b.dataset.v ? 'open' : b.dataset.v;
      paintVerdict(id);
      renderRail();
    }
    if (e.target.closest('[data-next]')) go(nextId(id));
  });
  $('textarea', box).addEventListener('input', e => { state.results[id].note = e.target.value; });
}

// Zet een automatisch resultaat alleen als de technicus zelf nog niets koos.
function suggest(id, status) {
  if (state.results[id].status !== 'open') return;
  state.results[id].status = status;
  paintVerdict(id);
  renderRail();
}

/* ---------- Onderdelen ---------- */

const RENDER = {
  info() {
    const i = state.info;
    main.innerHTML = head('Toestelgegevens', 'Vul in welke laptop je controleert. Serienummer en model komen in het rapport.') + `
      <form class="fields" autocomplete="off">
        <label>Serienummer of assetnummer<input name="serial" required value="${esc(i.serial)}"></label>
        <label>Merk en model<input name="model" required placeholder="Bijvoorbeeld: Dell Latitude 5440" value="${esc(i.model)}"></label>
        <label>Gecontroleerd door<input name="tech" value="${esc(i.tech)}"></label>
        <label><span>Bestemd voor <span class="muted">(medewerker of afdeling, optioneel)</span></span><input name="recipient" value="${esc(i.recipient)}"></label>
      </form>
      <div class="actions"><button type="button" class="btn btn-primary" data-next>Start de check</button></div>`;
    const form = $('form', main);
    form.addEventListener('input', e => { state.info[e.target.name] = e.target.value; renderRail(); });
    form.addEventListener('submit', e => { e.preventDefault(); go('screen'); });
    $('[data-next]', main).addEventListener('click', () => go('screen'));
  },

  screen() {
    main.innerHTML = head('Scherm', 'Het scherm wordt volledig wit, zwart, rood, groen en blauw, en daarna een grijsverloop. Let op dode of vastzittende pixels, vlekken, lichtlekken langs de randen en strepen.') + `
      <ul class="swatches" aria-hidden="true">${SCREEN_COLORS.map(([c, n]) => `<li><span style="background:${c}"></span>${n}</li>`).join('')}</ul>
      <p class="muted">Klik, druk op spatie of op het pijltje naar rechts voor de volgende kleur. Esc stopt de test.</p>
      <div class="actions"><button type="button" class="btn btn-primary" id="startScreen">Schermtest starten</button></div>
      ${alsoCheck(['De helderheidstoetsen maken het scherm lichter en donkerder.', 'Het beeld flikkert niet als je het scherm voorzichtig kantelt.', 'Als het een touchscreen is: aanraken werkt over het hele scherm.'])}
      ${verdictHTML('screen')}`;
    $('#startScreen').addEventListener('click', runScreenTest);
    bindVerdict('screen');
  },

  keyboard() {
    main.innerHTML = head('Toetsenbord', 'Druk elke toets één keer in; een toets wordt groen zodra hij reageert. Heeft dit toestel een toets niet, of werkt die alleen met Fn, klik hem dan aan om hem als n.v.t. te markeren.') + `
      <div class="kb-meta"><span id="kbCount"></span><button type="button" class="btn btn-quiet" id="kbReset">Opnieuw beginnen</button></div>
      <div class="kb" id="kb">${KEY_ROWS.map(row => `<div class="kb-row">${row.map(([code, label, w = 1]) =>
        `<button type="button" class="key" data-code="${code}" style="flex:${w} 1 0" tabindex="-1" title="Klik om als n.v.t. te markeren">${esc(label)}</button>`).join('')}</div>`).join('')}</div>
      <p class="muted" id="kbExtra"></p>
      ${alsoCheck(['Fn-combinaties, zoals helderheid, volume en vliegtuigmodus.', 'De aan/uit-knop en de Print Screen-toets.', 'Toetsenbordverlichting, als het toestel die heeft.', 'Geen toetsen die blijven hangen of los zitten.'])}
      ${verdictHTML('keyboard')}`;

    const kb = $('#kb');
    const paint = () => {
      kb.querySelectorAll('.key').forEach(k => {
        k.classList.toggle('hit', state.keys.hit.has(k.dataset.code));
        k.classList.toggle('skip', state.keys.skip.has(k.dataset.code));
      });
      const hit = ALL_KEYS.filter(c => state.keys.hit.has(c)).length;
      const skip = ALL_KEYS.filter(c => state.keys.skip.has(c)).length;
      const left = ALL_KEYS.length - hit - skip;
      $('#kbCount').textContent = left
        ? `${hit} getest, ${skip} n.v.t., nog ${left} te gaan`
        : `Alle toetsen gehad: ${hit} getest, ${skip} n.v.t.`;
      $('#kbExtra').textContent = state.keys.extra.size ? `Ook ontvangen: ${[...state.keys.extra].join(', ')}` : '';
      if (!left && hit) suggest('keyboard', 'ok');
    };

    const inField = e => e.target.closest && e.target.closest('textarea, input');
    const onDown = e => {
      if (inField(e)) return;
      e.preventDefault();
      if (ALL_KEYS.includes(e.code)) {
        state.keys.hit.add(e.code);
        state.keys.skip.delete(e.code);
        kb.querySelector(`[data-code="${e.code}"]`).classList.add('down');
      } else if (e.code) {
        state.keys.extra.add(e.code);
      }
      paint();
    };
    const onUp = e => {
      if (inField(e)) return;
      e.preventDefault();
      kb.querySelector(`[data-code="${e.code}"]`)?.classList.remove('down');
      if (e.code === 'PrintScreen') { state.keys.extra.add('PrintScreen'); paint(); }
    };
    const onBlur = () => kb.querySelectorAll('.down').forEach(k => k.classList.remove('down'));

    kb.addEventListener('click', e => {
      const k = e.target.closest('.key');
      if (!k) return;
      const c = k.dataset.code;
      if (state.keys.hit.has(c)) state.keys.hit.delete(c);
      else if (state.keys.skip.has(c)) state.keys.skip.delete(c);
      else state.keys.skip.add(c);
      k.blur();
      main.focus({ preventScroll: true });
      paint();
    });
    $('#kbReset').addEventListener('click', e => {
      state.keys = { hit: new Set(), skip: new Set(), extra: new Set() };
      e.currentTarget.blur();
      main.focus({ preventScroll: true });
      paint();
    });

    window.addEventListener('keydown', onDown, true);
    window.addEventListener('keyup', onUp, true);
    window.addEventListener('blur', onBlur);
    cleanup = () => {
      window.removeEventListener('keydown', onDown, true);
      window.removeEventListener('keyup', onUp, true);
      window.removeEventListener('blur', onBlur);
    };
    bindVerdict('keyboard');
    paint();
  },

  touchpad() {
    main.innerHTML = head('Touchpad', 'Gebruik alleen het touchpad, geen externe muis. Beweeg binnen het vlak, klik links en rechts (met de knoppen én door te tikken), dubbelklik en scroll met twee vingers in beide richtingen.') + `
      <div class="pad" id="pad"><canvas></canvas><span class="pad-hint">Testvlak</span></div>
      <ul class="indicators" id="touchInd">${TOUCH_ITEMS.map(([id, l]) => `<li data-t="${id}">${l}</li>`).join('')}</ul>
      ${alsoCheck(['De fysieke knoppen klikken voelbaar en veren terug.', 'Het oppervlak is glad, zonder barsten of losse hoeken.', 'De cursor springt niet en loopt niet vanzelf weg.'])}
      ${verdictHTML('touchpad')}`;

    const pad = $('#pad');
    const canvas = $('canvas', pad);
    const ctx = canvas.getContext('2d');
    const trail = getComputedStyle(document.documentElement).getPropertyValue('--ok').trim() || '#1d7a4c';
    const fit = () => {
      const r = pad.getBoundingClientRect();
      const d = window.devicePixelRatio || 1;
      canvas.width = r.width * d;
      canvas.height = r.height * d;
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.strokeStyle = trail;
    };
    fit();

    const paint = () => {
      $('#touchInd').querySelectorAll('li').forEach(li => li.classList.toggle('on', state.touch.has(li.dataset.t)));
      if (TOUCH_ITEMS.every(([t]) => state.touch.has(t))) suggest('touchpad', 'ok');
    };
    const mark = t => { if (!state.touch.has(t)) { state.touch.add(t); paint(); } };

    let last = null;
    let dist = 0;
    let moves = 0;
    pad.addEventListener('pointermove', e => {
      const r = pad.getBoundingClientRect();
      const p = { x: e.clientX - r.left, y: e.clientY - r.top };
      if (last) {
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        dist += Math.hypot(p.x - last.x, p.y - last.y);
      }
      last = p;
      if (++moves % 40 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(0, 0, r.width, r.height);
      }
      if (dist > 600) mark('move');
    });
    pad.addEventListener('pointerleave', () => { last = null; });
    pad.addEventListener('mousedown', e => {
      if (e.button === 0) mark('left');
      if (e.button === 2) mark('right');
    });
    pad.addEventListener('contextmenu', e => { e.preventDefault(); mark('right'); });
    pad.addEventListener('dblclick', () => mark('double'));
    pad.addEventListener('wheel', e => {
      e.preventDefault();
      if (Math.abs(e.deltaY) > 0) mark('vscroll');
      if (Math.abs(e.deltaX) > 0) mark('hscroll');
    }, { passive: false });

    window.addEventListener('resize', fit);
    cleanup = () => window.removeEventListener('resize', fit);
    bindVerdict('touchpad');
    paint();
  },

  camera() {
    main.innerHTML = head('Camera', 'Start de camera en controleer of het beeld scherp is, de kleuren kloppen en het cameralampje brandt (als het toestel dat heeft).') + `
      <div class="media"><video id="camVideo" autoplay playsinline muted></video><p class="media-empty" id="camMsg">De camera staat uit.</p></div>
      <div class="actions">
        <button type="button" class="btn btn-primary" id="camStart">Camera starten</button>
        <label class="inline" id="camPick" hidden>Camera <select id="camSelect"></select></label>
      </div>
      ${alsoCheck(['Een privacyschuifje of cameratoets staat open.', 'De lens is schoon en niet gebarsten.', 'Windows Hello (gezichtsherkenning) werkt, als dat wordt gebruikt.'])}
      ${verdictHTML('camera')}`;

    const video = $('#camVideo');
    const msg = $('#camMsg');
    let stream = null;
    let alive = true;
    const stop = () => { stream?.getTracks().forEach(t => t.stop()); stream = null; };

    async function start(deviceId) {
      stop();
      if (!navigator.mediaDevices?.getUserMedia) { msg.textContent = NO_MEDIA; return; }
      msg.hidden = false;
      msg.textContent = 'Camera wordt gestart…';
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: deviceId ? { deviceId: { exact: deviceId } } : true });
        if (!alive) { s.getTracks().forEach(t => t.stop()); return; }
        stream = s;
        video.srcObject = stream;
        video.classList.add('live');
        msg.hidden = true;
        const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
        const current = stream.getVideoTracks()[0]?.getSettings().deviceId;
        $('#camSelect').innerHTML = cams.map((c, i) =>
          `<option value="${esc(c.deviceId)}"${c.deviceId === current ? ' selected' : ''}>${esc(c.label || `Camera ${i + 1}`)}</option>`).join('');
        $('#camPick').hidden = cams.length < 2;
        $('#camStart').textContent = 'Camera herstarten';
      } catch (err) {
        video.classList.remove('live');
        msg.hidden = false;
        msg.textContent = mediaError(err, 'camera');
      }
    }

    $('#camStart').addEventListener('click', () => start());
    $('#camSelect').addEventListener('change', e => start(e.target.value));
    cleanup = () => { alive = false; stop(); };
    bindVerdict('camera');
  },

  mic() {
    main.innerHTML = head('Microfoon', 'Start de microfoon en praat normaal, op ongeveer een armlengte van de laptop. De meter moet duidelijk uitslaan.') + `
      <div class="meter" aria-hidden="true"><span id="micFill"></span></div>
      <p class="muted" id="micMsg">De microfoon staat uit.</p>
      <div class="actions"><button type="button" class="btn btn-primary" id="micStart">Microfoon starten</button></div>
      ${alsoCheck(['De microfoon-uittoets (als die er is) schakelt de microfoon echt uit.', 'Een headset op de audio-aansluiting wordt herkend, als het toestel die heeft.'])}
      ${verdictHTML('mic')}`;

    const fill = $('#micFill');
    const msg = $('#micMsg');
    let stream = null;
    let actx = null;
    let raf = 0;
    let alive = true;
    const stop = () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach(t => t.stop());
      actx?.close();
      stream = null;
      actx = null;
      fill.style.width = '0';
    };

    $('#micStart').addEventListener('click', async () => {
      stop();
      if (!navigator.mediaDevices?.getUserMedia) { msg.textContent = NO_MEDIA; return; }
      msg.textContent = 'Microfoon wordt gestart…';
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
        if (!alive) { s.getTracks().forEach(t => t.stop()); return; }
        stream = s;
        actx = new AudioContext();
        const analyser = actx.createAnalyser();
        analyser.fftSize = 1024;
        actx.createMediaStreamSource(stream).connect(analyser);
        const buf = new Float32Array(analyser.fftSize);
        let heard = false;
        msg.textContent = `Luistert via: ${stream.getAudioTracks()[0]?.label || 'standaardmicrofoon'}`;
        const tick = () => {
          analyser.getFloatTimeDomainData(buf);
          let sum = 0;
          for (const v of buf) sum += v * v;
          const level = Math.min(1, Math.sqrt(sum / buf.length) * 4);
          fill.style.width = `${level * 100}%`;
          if (!heard && level > 0.25) {
            heard = true;
            msg.textContent = 'Geluid gehoord. Klinkt het niet vervormd of krakerig, dan werkt de microfoon.';
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch (err) {
        msg.textContent = mediaError(err, 'microfoon');
      }
    });

    cleanup = () => { alive = false; stop(); };
    bindVerdict('mic');
  },

  audio() {
    main.innerHTML = head('Speakers', 'Zet het volume op ongeveer de helft. Controleer of links en rechts apart klinken, en of er niets kraakt of rammelt tijdens de toonhoogtesweep.') + `
      <div class="actions" id="tones">
        <button type="button" class="btn" data-pan="-1">Links afspelen</button>
        <button type="button" class="btn" data-pan="1">Rechts afspelen</button>
        <button type="button" class="btn" data-pan="0">Beide afspelen</button>
        <button type="button" class="btn" data-sweep>Toonhoogtesweep afspelen</button>
      </div>
      ${alsoCheck(['De volumetoetsen en de dempknop werken.', 'Een koptelefoon op de audio-aansluiting geeft geluid, als het toestel die heeft.'])}
      ${verdictHTML('audio')}`;

    let actx = null;
    $('#tones').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      actx ??= new AudioContext();
      const t = actx.currentTime;
      const sweep = 'sweep' in b.dataset;
      const dur = sweep ? 4 : 1;
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      const pan = actx.createStereoPanner();
      pan.pan.value = sweep ? 0 : Number(b.dataset.pan);
      osc.frequency.setValueAtTime(sweep ? 80 : 440, t);
      if (sweep) osc.frequency.exponentialRampToValueAtTime(4000, t + dur);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.05);
      gain.gain.setValueAtTime(0.25, t + dur - 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(pan).connect(actx.destination);
      osc.start(t);
      osc.stop(t + dur);
    });
    cleanup = () => { actx?.close(); };
    bindVerdict('audio');
  },

  power() {
    main.innerHTML = head('Accu en netwerk', 'Haal de oplader eruit en steek hem weer in. De app ziet dan of het laden werkt. Controleer ook of de laptop online is.') + `
      <dl class="facts" id="facts"></dl>
      <ul class="indicators" id="powerInd"><li data-p="unplugged">Op accu gezien</li><li data-p="plugged">Opladen gezien</li></ul>
      <p class="muted" id="powerMsg"></p>
      ${alsoCheck(['Het laadlampje gaat aan als de oplader is aangesloten.', 'De accu loopt niet opvallend snel leeg en zit niet bol.'])}
      ${verdictHTML('power')}`;

    let battery = null;
    const minutes = s => (s >= 3600 ? `${Math.floor(s / 3600)} u ${Math.round((s % 3600) / 60)} min` : `${Math.round(s / 60)} min`);
    const render = () => {
      const rows = [];
      if (battery) {
        rows.push(['Accu', `${Math.round(battery.level * 100)}%`]);
        rows.push(['Oplader', battery.charging ? 'Aangesloten' : 'Niet aangesloten']);
        if (battery.charging && Number.isFinite(battery.chargingTime) && battery.chargingTime > 0) rows.push(['Vol over', minutes(battery.chargingTime)]);
        if (!battery.charging && Number.isFinite(battery.dischargingTime)) rows.push(['Leeg over', minutes(battery.dischargingTime)]);
      }
      rows.push(['Netwerk', navigator.onLine ? 'Online' : 'Offline']);
      rows.push(['Schermresolutie', `${Math.round(screen.width * devicePixelRatio)} × ${Math.round(screen.height * devicePixelRatio)}`]);
      if (navigator.hardwareConcurrency) rows.push(['Processorkernen', navigator.hardwareConcurrency]);
      if (navigator.deviceMemory) rows.push(['Werkgeheugen', `circa ${navigator.deviceMemory} GB of meer`]);
      $('#facts').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
      $('#powerInd').querySelectorAll('li').forEach(li => li.classList.toggle('on', state.power[li.dataset.p]));
    };
    const onCharge = () => {
      if (battery.charging) state.power.plugged = true;
      else state.power.unplugged = true;
      if (state.power.plugged && state.power.unplugged) $('#powerMsg').textContent = 'Laden en ontladen allebei gezien. De oplader werkt.';
      render();
    };

    render();
    if (navigator.getBattery) {
      navigator.getBattery().then(b => {
        battery = b;
        onCharge();
        battery.addEventListener('chargingchange', onCharge);
        battery.addEventListener('levelchange', render);
      }).catch(() => { $('#powerMsg').textContent = 'De accu kon niet worden uitgelezen. Controleer het laden met de hand via het accupictogram van Windows.'; });
    } else {
      $('#powerMsg').textContent = 'Deze browser kan de accu niet uitlezen. Gebruik Chrome of Edge, of controleer het laden met de hand via het accupictogram van Windows.';
    }
    window.addEventListener('online', render);
    window.addEventListener('offline', render);
    cleanup = () => {
      battery?.removeEventListener('chargingchange', onCharge);
      battery?.removeEventListener('levelchange', render);
      window.removeEventListener('online', render);
      window.removeEventListener('offline', render);
    };
    bindVerdict('power');
  },

  visual() {
    main.innerHTML = head('Visuele inspectie', 'Loop deze punten met de hand na. Markeer punten die niet van toepassing zijn als n.v.t.') + `
      <ul class="inspect" id="inspect">${VISUAL_ITEMS.map(v => `<li data-item="${v.id}"><span>${v.label}</span><div class="seg" role="group">${
        ['ok', 'fout', 'nvt'].map(s => `<button type="button" data-s="${s}" class="seg-${s}${state.visual[v.id] === s ? ' on' : ''}" aria-pressed="${state.visual[v.id] === s}">${INSPECT_LABEL[s]}</button>`).join('')
      }</div></li>`).join('')}</ul>
      <label class="note spaced"><span>Opmerking <span class="muted">(optioneel)</span></span><textarea rows="2" id="visNote" placeholder="Bijvoorbeeld: kras op de klep, verder in orde">${esc(state.visualNote)}</textarea></label>
      <div class="actions"><button type="button" class="btn btn-primary" data-next>Naar de samenvatting</button></div>`;

    $('#inspect').addEventListener('click', e => {
      const b = e.target.closest('[data-s]');
      if (!b) return;
      const li = b.closest('[data-item]');
      const id = li.dataset.item;
      state.visual[id] = state.visual[id] === b.dataset.s ? 'open' : b.dataset.s;
      li.querySelectorAll('[data-s]').forEach(x => {
        const on = x.dataset.s === state.visual[id];
        x.classList.toggle('on', on);
        x.setAttribute('aria-pressed', on);
      });
      renderRail();
    });
    $('#visNote').addEventListener('input', e => { state.visualNote = e.target.value; });
    $('[data-next]', main).addEventListener('click', () => go('summary'));
  },

  summary() {
    const o = overall();
    const i = state.info;
    const rows = CHECKS.filter(c => c.id !== 'summary').map(c => {
      const st = statusOf(c.id);
      let label = STATUS_LABEL[st];
      let detail = '';
      if (c.id === 'info') label = st === 'ok' ? 'Ingevuld' : 'Niet ingevuld';
      if (c.verdict) detail = esc(state.results[c.id].note);
      if (c.id === 'keyboard' && state.keys.skip.size) detail += `<span class="muted block">N.v.t.: ${esc([...state.keys.skip].join(', '))}</span>`;
      if (c.id === 'visual') {
        const defects = VISUAL_ITEMS.filter(v => state.visual[v.id] === 'fout').map(v => v.label);
        detail = esc(state.visualNote) + (defects.length ? `<span class="block">Defect: ${esc(defects.join('; '))}</span>` : '');
      }
      return `<tr><td>${c.title}</td><td><span class="tag tag-${st}">${label}</span></td><td>${detail}</td></tr>`;
    }).join('');

    main.innerHTML = head('Samenvatting') + `
      <div class="verdict-banner banner-${o}"><strong>${OVERALL_LABEL[o]}</strong>${OVERALL_TEXT[o]}</div>
      <dl class="device">
        <div><dt>Serienummer</dt><dd>${esc(i.serial) || '–'}</dd></div>
        <div><dt>Model</dt><dd>${esc(i.model) || '–'}</dd></div>
        <div><dt>Gecontroleerd door</dt><dd>${esc(i.tech) || '–'}</dd></div>
        <div><dt>Bestemd voor</dt><dd>${esc(i.recipient) || '–'}</dd></div>
        <div><dt>Datum</dt><dd>${new Date().toLocaleDateString('nl-NL', { dateStyle: 'long' })}</dd></div>
      </dl>
      <table class="table"><thead><tr><th>Onderdeel</th><th>Resultaat</th><th>Opmerking</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="actions no-print">
        <button type="button" class="btn btn-primary" id="save">Rapport opslaan</button>
        <button type="button" class="btn" id="print">Afdrukken</button>
        <button type="button" class="btn btn-quiet" id="new">Nieuwe laptop checken</button>
      </div>
      <p class="msg" id="saveMsg" role="status"></p>
      <section class="no-print history"><h2 class="sub">Eerder opgeslagen</h2><div id="history"><p class="muted">Laden…</p></div></section>`;

    $('#save').addEventListener('click', e => saveReport(e.currentTarget, $('#saveMsg')));
    $('#print').addEventListener('click', () => window.print());
    $('#new').addEventListener('click', () => {
      if (!state.saved && hasProgress() && !confirm('Deze check is nog niet opgeslagen. Toch een nieuwe laptop beginnen?')) return;
      state = freshState();
      go('info');
    });
    loadHistory();
  },
};

/* ---------- Schermtest ---------- */

function runScreenTest() {
  const ov = $('#screenTest');
  const hint = $('#screenHint');
  let i = 0;
  let hintTimer = 0;

  const show = () => {
    ov.style.background = SCREEN_COLORS[i][0];
    hint.textContent = `${SCREEN_COLORS[i][1]}, ${i + 1} van ${SCREEN_COLORS.length}`;
    hint.classList.add('visible');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hint.classList.remove('visible'), 1200);
  };
  const next = () => { i += 1; if (i >= SCREEN_COLORS.length) end(); else show(); };
  const onKey = e => {
    if (['Space', 'ArrowRight', 'Enter'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); next(); }
    else if (e.code === 'Escape') end();
  };
  const onFs = () => { if (!document.fullscreenElement) end(); };

  function end() {
    if (ov.hidden) return;
    ov.hidden = true;
    clearTimeout(hintTimer);
    hint.classList.remove('visible');
    ov.removeEventListener('click', next);
    window.removeEventListener('keydown', onKey, true);
    document.removeEventListener('fullscreenchange', onFs);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    $('#startScreen')?.focus();
  }

  ov.hidden = false;
  show();
  ov.addEventListener('click', next);
  window.addEventListener('keydown', onKey, true);
  if (ov.requestFullscreen) {
    ov.requestFullscreen().then(() => document.addEventListener('fullscreenchange', onFs)).catch(() => {});
  }
}

/* ---------- Rapporten ---------- */

function buildReport() {
  return {
    id: state.reportId,
    datum: new Date().toISOString(),
    toestel: { ...state.info },
    uitkomst: { ok: 'goedgekeurd', fout: 'afgekeurd', open: 'niet compleet' }[overall()],
    onderdelen: CHECKS.filter(c => c.verdict).map(c => ({
      onderdeel: c.title,
      status: state.results[c.id].status,
      opmerking: state.results[c.id].note,
    })),
    toetsenbord: {
      getest: ALL_KEYS.filter(k => state.keys.hit.has(k)).length,
      nvt: [...state.keys.skip],
      totaal: ALL_KEYS.length,
      overigeToetsen: [...state.keys.extra],
    },
    touchpad: [...state.touch],
    visueel: VISUAL_ITEMS.map(v => ({ punt: v.label, status: state.visual[v.id] })),
    visueleOpmerking: state.visualNote,
  };
}

async function saveReport(btn, msg) {
  if (!state.info.serial.trim()) {
    msg.textContent = 'Vul eerst het serienummer in bij Toestelgegevens.';
    msg.className = 'msg msg-fout';
    return;
  }
  btn.disabled = true;
  try {
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildReport()),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    state.saved = true;
    msg.textContent = `Rapport opgeslagen als ${data.file}.`;
    msg.className = 'msg msg-ok';
    loadHistory();
  } catch (err) {
    msg.textContent = `Opslaan is mislukt: ${err.message}. Controleer of de server nog draait.`;
    msg.className = 'msg msg-fout';
  } finally {
    btn.disabled = false;
  }
}

async function loadHistory() {
  const box = $('#history');
  if (!box) return;
  const tagFor = u => ({ goedgekeurd: 'ok', afgekeurd: 'fout' }[u] || 'open');
  try {
    const list = await (await fetch('/api/reports')).json();
    box.innerHTML = list.length
      ? `<table class="table"><thead><tr><th>Datum</th><th>Serienummer</th><th>Model</th><th>Uitkomst</th><th>Door</th></tr></thead><tbody>${
        list.map(r => `<tr>
          <td>${r.datum ? new Date(r.datum).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' }) : ''}</td>
          <td>${esc(r.serienummer)}</td><td>${esc(r.model)}</td>
          <td><span class="tag tag-${tagFor(r.uitkomst)}">${esc(r.uitkomst)}</span></td>
          <td>${esc(r.door)}</td></tr>`).join('')
      }</tbody></table>`
      : '<p class="muted">Nog geen opgeslagen rapporten. Na het opslaan verschijnt de check hier.</p>';
  } catch {
    box.innerHTML = '<p class="muted">Eerdere rapporten konden niet worden geladen. Controleer of de server draait.</p>';
  }
}

/* ---------- Start ---------- */

go('info');
