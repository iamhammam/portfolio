(() => {
  const $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, touch = matchMedia('(pointer: coarse)').matches;
  gsap.registerPlugin(ScrollTrigger);

  let lenis = null;
  if (!reduce) {
    lenis = new Lenis({ lerp: 0.085 });
    lenis.on('scroll', ScrollTrigger.update); gsap.ticker.add((t) => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0);
    lenis.on('scroll', ({ direction, scroll }) => $('.nav').classList.toggle('is-hidden', direction === 1 && scroll > 300)); lenis.stop();
  }
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const t = $(a.getAttribute('href')); if (!t) return; e.preventDefault();
    lenis ? lenis.scrollTo(t, { duration: 1.8, easing: (x) => 1 - Math.pow(1 - x, 4) }) : t.scrollIntoView();
  }));

  /* ---- The face: hover = the photo turns into live binary (brightness-mapped 0/1 grid, masked to the cutout) ---- */
  const face = $('#face'), img = $('#faceImg'), cv = $('#bin'), cx = cv.getContext('2d');
  let W = 0, H = 0, cell = 10, cols = 0, rows = 0, lum, ch, mx = 0, my = 0, rad = 0, target = 0, lock = false, hot = false;
  // If the photo can't be loaded (blocked host / CORS), retry without CORS, then fall back to a built-in bust silhouette
  const SIL = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500"><defs><radialGradient id="g" cx=".5" cy=".38" r=".6"><stop offset="0" stop-color="#cfd6e4"/><stop offset=".6" stop-color="#7c879c"/><stop offset="1" stop-color="#2a3347"/></radialGradient></defs><path d="M20 500c4-110 60-150 130-170l50 26 50-26c70 20 126 60 130 170z" fill="url(#g)"/><rect x="170" y="270" width="60" height="80" rx="24" fill="url(#g)"/><ellipse cx="200" cy="190" rx="86" ry="108" fill="url(#g)"/></svg>');
  let errs = 0;
  const onErr = () => { errs++; const alt = img.dataset.alt;
    if (errs === 1 && alt) { img.crossOrigin = 'anonymous'; img.src = alt; }
    else if (errs === 2 && alt) { img.removeAttribute('crossorigin'); img.src = alt; }
    else if (img.src !== SIL) { img.removeAttribute('crossorigin'); img.src = SIL; } };
  img.addEventListener('error', onErr); if (img.complete && !img.naturalWidth) onErr();
  function setup() {
    face.style.blockSize = ''; // never let the face be wider than the screen (phones)
    if (img.naturalWidth && img.getBoundingClientRect().width > innerWidth) face.style.blockSize = (img.naturalHeight / img.naturalWidth) * innerWidth + 'px';
    const r = img.getBoundingClientRect(); W = r.width; H = r.height; if (!W || !H) return;
    const dpr = Math.min(devicePixelRatio, 2); cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cell = Math.max(8, Math.round(W / 44)); cols = Math.ceil(W / cell); rows = Math.ceil(H / cell);
    lum = new Float32Array(cols * rows).fill(0.7); ch = new Uint8Array(cols * rows).map(() => (Math.random() * 2) | 0);
    // brightness map. Local files are "tainted" on file://, so if pixels can't be read we sample the online copy of the photo
    const sample = (src) => { const o = document.createElement('canvas'); o.width = cols; o.height = rows; const oc = o.getContext('2d'); oc.drawImage(src, 0, 0, cols, rows);
      const d = oc.getImageData(0, 0, cols, rows).data;
      for (let i = 0; i < cols * rows; i++) lum[i] = d[i * 4 + 3] < 80 ? 0 : (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255 + 0.08; };
    try { sample(img); } catch (e) { const alt = img.dataset.alt; if (alt) { const r2 = new Image(); r2.crossOrigin = 'anonymous'; r2.onload = () => { try { sample(r2); } catch (e2) {} }; r2.src = alt; } }
  }
  img.addEventListener('load', setup); if (img.complete && img.naturalWidth) setup(); addEventListener('resize', setup);
  const pos = (e) => { const r = cv.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; };
  face.addEventListener('pointerenter', (e) => { hot = true; pos(e); });
  face.addEventListener('pointermove', pos);
  face.addEventListener('pointerleave', () => { hot = false; });
  const hint = $('#hint'), say = () => (hint.textContent = lock ? (touch ? 'Tap to unlock' : 'Locked · click to unlock') : touch ? 'Tap the face' : 'Hover the face · Click to lock');
  face.addEventListener('click', () => { lock = !lock; say(); }); say();
  let was = false;
  gsap.ticker.add(() => {
    if (!W) return;
    target = lock ? Math.hypot(W, H) : hot ? Math.max(W, H) * 0.2 : 0; rad += (target - rad) * 0.12;
    if (rad < 1 && !was) return; was = rad >= 1;
    cx.globalCompositeOperation = 'source-over'; cx.clearRect(0, 0, W, H);
    if (rad >= 1) {
      const g = cx.createRadialGradient(mx, my, 0, mx, my, rad); g.addColorStop(0, 'rgba(7,11,20,.93)'); g.addColorStop(0.85, 'rgba(7,11,20,.9)'); g.addColorStop(1, 'rgba(7,11,20,0)');
      cx.fillStyle = g; cx.fillRect(0, 0, W, H);
      cx.font = `${cell * 1.05}px "JetBrains Mono",monospace`; cx.textAlign = 'center'; cx.textBaseline = 'middle';
      const c0 = Math.max(0, ((mx - rad) / cell) | 0), c1 = Math.min(cols - 1, ((mx + rad) / cell) | 0), r0 = Math.max(0, ((my - rad) / cell) | 0), r1 = Math.min(rows - 1, ((my + rad) / cell) | 0);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const i = r * cols + c, x = (c + 0.5) * cell, y = (r + 0.5) * cell, d = Math.hypot(x - mx, y - my);
        if (d > rad || lum[i] <= 0) continue;
        if (Math.random() < 0.025) ch[i] ^= 1;
        cx.globalAlpha = Math.min(1, (rad - d) / (rad * 0.3)) * Math.min(1, 0.22 + 0.9 * lum[i]);
        cx.fillStyle = lum[i] > 0.55 ? '#6CFFE0' : '#2b9e8a'; cx.fillText(ch[i], x, y);
      }
      cx.globalAlpha = 1;
    }
    cx.globalCompositeOperation = 'destination-in'; cx.drawImage(img, 0, 0, W, H);
  });

  /* ---- Intro: terminal boot -> hero ---- */
  const log = ['> initializing hammam.dev', '> loading modules: c# · asp.net core · flutter · python', '> compiling portfolio ........ ok', '> ready_'];
  const open = () => { document.body.classList.remove('is-loading'); lenis && lenis.start(); init(); };
  document.fonts.ready.then(() => {
    if (reduce) { $('.boot').remove(); return open(); }
    gsap.set('.name b', { yPercent: 105 }); gsap.set('.face', { yPercent: 8, autoAlpha: 0 });
    const pre = $('#bootlog'), n = $('.boot__n'), o = { v: 0 }, tl = gsap.timeline();
    tl.to(o, { v: 100, duration: 2.1, ease: 'power1.inOut', onUpdate: () => {
      n.textContent = Math.round(o.v) + '%'; pre.textContent = log.slice(0, Math.min(log.length, 1 + Math.floor(o.v / 26))).join('\n'); } })
      .to('.boot', { yPercent: -100, duration: 1.1, ease: 'expo.inOut' }, '+=.2').add(open, '-=.5')
      .to('.name b', { yPercent: 0, duration: 1.5, ease: 'expo.out', stagger: 0.12 }, '-=.6')
      .to('.face', { yPercent: 0, autoAlpha: 1, duration: 1.6, ease: 'expo.out' }, '<.1').set('.boot', { display: 'none' });
  });

  function init() {
    // nav colour follows the band underneath
    $$('[data-theme]').forEach((s) => ScrollTrigger.create({ trigger: s, start: 'top 50px', end: 'bottom 50px',
      onToggle: (st) => st.isActive && (document.body.dataset.nav = ['light', 'accent'].includes(s.dataset.theme) ? 'light' : 'dark') }));
    $$('[data-count]').forEach((el) => {
      const end = +el.dataset.count, f = (v) => Math.round(v) + (el.dataset.suf || ''), o = { v: 0 }; el.textContent = f(reduce ? end : 0); if (reduce) return;
      ScrollTrigger.create({ trigger: el, start: 'top 92%', once: true, onEnter: () => gsap.to(o, { v: end, duration: 2, ease: 'power3.out', onUpdate: () => (el.textContent = f(o.v)) }) });
    });
    if (reduce) return;
    // hero parallax: face and name drift in opposite directions
    if (!touch) {
      const fx = gsap.quickTo('.face', 'x', { duration: 0.9, ease: 'power3' }), nx = gsap.quickTo('.name', 'x', { duration: 1.1, ease: 'power3' });
      addEventListener('pointermove', (e) => { const k = e.clientX / innerWidth - 0.5; fx(k * -26); nx(k * 40); });
    }
    const st = $('#statement'); st.innerHTML = st.textContent.trim().split(/\s+/).map((w) => `<span class="w">${w}</span>`).join(' ');
    gsap.fromTo($$('.w', st), { opacity: 0.14 }, { opacity: 1, stagger: 0.04, ease: 'none', scrollTrigger: { trigger: st, start: 'top 82%', end: 'bottom 50%', scrub: true } });
    gsap.set('[data-r]', { y: 50, autoAlpha: 0 });
    ScrollTrigger.batch('[data-r]', { start: 'top 92%', once: true, onEnter: (b) => gsap.to(b, { y: 0, autoAlpha: 1, duration: 1.2, ease: 'expo.out', stagger: 0.08 }) });
    gsap.from('.contact .line > span', { yPercent: 110, duration: 1.5, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger: '.contact', start: 'top 60%' } });
    // pinned horizontal project strip (desktop)
    gsap.matchMedia().add('(min-width: 821px)', () => {
      const track = $('.track'), bar = $('.work__bar i');
      gsap.to(track, { x: () => -(track.scrollWidth - innerWidth), ease: 'none', scrollTrigger: { trigger: '.work', start: 'top top', end: () => '+=' + track.scrollWidth, pin: true, scrub: 1, invalidateOnRefresh: true, onUpdate: (s) => (bar.style.transform = `scaleX(${s.progress})`) } });
    });
  }

  // project images: if one can't load, show a styled placeholder instead of a broken icon
  $$('.card__img img').forEach((i) => {
    const box = i.parentElement, card = i.closest('.card'), ok = () => box.style.setProperty('--img', `url("${i.currentSrc || i.src}")`);
    const bad = () => { if (i.dataset.alt && i.getAttribute('src') !== i.dataset.alt) i.src = i.dataset.alt; else { box.classList.add('noimg'); box.dataset.ph = $('h3', card).textContent; } };
    i.addEventListener('load', ok); i.addEventListener('error', bad); if (i.complete) i.naturalWidth ? ok() : bad();
  });

  // certificates: click a row -> viewer (image / PDF if data-cert has a link, otherwise a designed certificate card)
  const certs = $$('.hall li'), cert = $('#cert'), cBody = $('#certBody'); let ci = 0, lastFocus = null;
  const ext = (u) => (u.split('?')[0].split('.').pop() || '').toLowerCase();
  function fill(i) {
    ci = (i + certs.length) % certs.length; const li = certs[ci], t = li.dataset.t, iss = $('p', li).textContent, u = li.dataset.cert || '';
    $('#certN').textContent = String(ci + 1).padStart(2, '0') + ' / ' + String(certs.length).padStart(2, '0');
    const paper = `<div class="paper"><i class="seal">HM</i><p class="tag">Qualification</p><p class="to">Hammam Malabeh</p><h3>${t}</h3><p class="iss">${iss}</p></div>`;
    cBody.innerHTML = /^(png|jpe?g|webp|gif)$/.test(ext(u)) ? `<img class="cert__file" src="${u}" alt="${t}">`
      : ext(u) === 'pdf' ? `<object class="cert__file" data="${u}" type="application/pdf">${paper}</object>` : paper;
    const im = $('img.cert__file', cBody); im && im.addEventListener('error', () => { cBody.innerHTML = paper; });
    const a = $('#certOpen'); a.hidden = !u; a.href = u || '#';
  }
  function openCert(i) {
    lastFocus = document.activeElement; fill(i); cert.hidden = false; lenis ? lenis.stop() : (document.body.style.overflow = 'hidden');
    if (!reduce) { gsap.fromTo('.cert__bg', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }); gsap.fromTo('.cert__sheet', { y: 40, autoAlpha: 0, scale: 0.97 }, { y: 0, autoAlpha: 1, scale: 1, duration: 0.7, ease: 'expo.out' }); }
    $('#certClose').focus();
  }
  function closeCert() { cert.hidden = true; lenis ? lenis.start() : (document.body.style.overflow = ''); lastFocus && lastFocus.focus(); }
  certs.forEach((li, i) => { li.tabIndex = 0; li.setAttribute('role', 'button'); li.addEventListener('click', () => openCert(i));
    li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCert(i); } }); });
  $('#certClose').addEventListener('click', closeCert); $('[data-close]', cert).addEventListener('click', closeCert);
  $('#certPrev').addEventListener('click', () => fill(ci - 1)); $('#certNext').addEventListener('click', () => fill(ci + 1));
  addEventListener('keydown', (e) => { if (cert.hidden) return; if (e.key === 'Escape') closeCert(); if (e.key === 'ArrowRight') fill(ci + 1); if (e.key === 'ArrowLeft') fill(ci - 1); });

  // qualifications: title decodes from binary on hover
  $$('.hall li').forEach((li) => {
    const h = $('h3', li), t = h.textContent; let iv; li.dataset.t = t;
    li.addEventListener('pointerenter', () => { let i = 0; clearInterval(iv); iv = setInterval(() => {
      h.textContent = [...t].map((c, k) => (c === ' ' ? ' ' : k < i ? c : Math.random() < 0.5 ? '0' : '1')).join('');
      if ((i += 1.3) > t.length + 1) { clearInterval(iv); h.textContent = t; } }, 28); });
  });
})();
