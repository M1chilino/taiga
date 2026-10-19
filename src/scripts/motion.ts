import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import type { HeroState } from './hero3d';
import type { IconKind } from './icons3d';

gsap.registerPlugin(ScrollTrigger, SplitText);

const root = document.documentElement;
const reduced = root.classList.contains('reduced');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
// ?no3d desliga todo o 3D (útil para diagnosticar desempenho)
const no3d = new URLSearchParams(location.search).has('no3d');

const $ = <T extends HTMLElement = HTMLElement>(sel: string, ctx: ParentNode = document) =>
  ctx.querySelector<T>(sel);
const $$ = <T extends HTMLElement = HTMLElement>(sel: string, ctx: ParentNode = document) =>
  Array.from(ctx.querySelectorAll<T>(sel));
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Executa quando o navegador está ocioso (com limite de espera). */
const idle = (fn: () => void, timeout = 600) =>
  'requestIdleCallback' in window ? requestIdleCallback(fn, { timeout }) : setTimeout(fn, 50);

/* ------------------------------------------------------------------ */
/* Links de âncora (rolagem nativa: fica no thread do compositor e não */
/* trava quando a página está ocupada)                                 */
/* ------------------------------------------------------------------ */
function initScroll() {
  $$<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href')!.slice(1);
      const target = id === 'inicio' ? null : document.getElementById(id);
      if (id !== 'inicio' && !target) return;
      e.preventDefault();
      const behavior = reduced ? 'auto' : 'smooth';
      if (target) target.scrollIntoView({ behavior });
      else scrollTo({ top: 0, behavior });
      history.replaceState(null, '', id === 'inicio' ? location.pathname : `#${id}`);
    });
  });
}

/* ------------------------------------------------------------------ */
/* Header: some ao descer, volta ao subir                              */
/* ------------------------------------------------------------------ */
function initHeader() {
  const bar = $('[data-header] .header__bar');
  if (!bar || reduced) return;
  const show = gsap.quickTo(bar, 'yPercent', { duration: 0.5, ease: 'power3.out' });
  let hidden = false;
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      const shouldHide = self.direction === 1 && self.scroll() > 320;
      if (shouldHide !== hidden) {
        hidden = shouldHide;
        show(hidden ? -160 : 0);
      }
    },
  });
}

/* ------------------------------------------------------------------ */
/* Hero: entrada orquestrada + movimento constante + parallax          */
/* ------------------------------------------------------------------ */
const heroState: HeroState = { scroll: 0, intro: 0 };

function initHeroIntro() {
  const title = $('[data-hero-title]');
  if (!title) return;
  if (reduced) {
    title.classList.add('is-gradient');
    return;
  }

  const bar = $('[data-header] .header__bar');
  const split = SplitText.create(title, { type: 'lines,words', mask: 'lines' });
  gsap.set(title, { autoAlpha: 1 });

  const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
  if (bar) tl.from(bar, { yPercent: -180, duration: 1 }, 0);
  tl.from(split.words, { yPercent: 115, duration: 1.2, stagger: 0.08 }, 0.1);

  const lead = $$('[data-hero-intro]').filter((el) => !el.matches('[data-hero-stage]'));
  tl.fromTo(
    lead,
    { autoAlpha: 0, y: 28 },
    { autoAlpha: 1, y: 0, duration: 1, stagger: 0.12 },
    0.65,
  );

  const stage = $('[data-hero-stage]');
  if (stage) {
    tl.fromTo(
      stage,
      { autoAlpha: 0, scale: 0.88 },
      { autoAlpha: 1, scale: 1, duration: 1.8, ease: 'expo.out', clearProps: 'transform' },
      0.3,
    );
  }
  tl.call(() => {
    split.revert();
    title.classList.add('is-gradient');
  });
}

function initHeroAmbient() {
  const hero = $('[data-hero]');
  if (!hero || reduced) return;

  // Fora da tela, pausa as animações CSS do hero
  new IntersectionObserver(([en]) => hero.classList.toggle('is-paused', !en.isIntersecting)).observe(hero);

  // Rolagem: texto sobe mais rápido e o símbolo 3D gira/sobe (via heroState.scroll)
  ScrollTrigger.create({
    trigger: hero,
    start: 'top top',
    end: 'bottom top',
    onUpdate: (self) => (heroState.scroll = self.progress),
  });
  gsap.to('[data-hero-content]', {
    y: -70,
    ease: 'none',
    scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
  });
}

/** Cena 3D (three.js), carregada sob demanda depois que a página ficou pronta. */
function initHero3DScene() {
  const stage = $('[data-hero-stage]');
  const canvas = $<HTMLCanvasElement>('[data-hero-canvas]');
  if (!stage || !canvas || no3d) return;
  if (reduced) heroState.intro = 1;

  const start = () =>
    import('./hero3d')
      .then(async ({ initHero3D }) => {
        const api = await initHero3D({
          host: stage,
          canvas,
          state: heroState,
          animate: !reduced,
          onGiveUp: () => stage.classList.remove('is-3d'),
        });
        if (!api) return;
        requestAnimationFrame(() => stage.classList.add('is-3d'));
        if (!reduced) gsap.to(heroState, { intro: 1, duration: 2.8, ease: 'none', delay: 0.15 });
      })
      .catch(() => {});

  // espera a animação de entrada terminar para não competir com ela
  setTimeout(() => idle(start, 1500), reduced ? 300 : 2300);
}

/* ------------------------------------------------------------------ */
/* Ícones 3D dos serviços (carregados quando a seção está perto)       */
/* ------------------------------------------------------------------ */
function initServiceIcons3D() {
  const hosts = $$('[data-service-icon]');
  const section = $('[data-services]');
  if (!hosts.length || !section || no3d) return;

  const load = () =>
    import('./icons3d')
      .then(({ initServiceIcons }) =>
        initServiceIcons(
          hosts.map((host) => ({
            host,
            canvas: $<HTMLCanvasElement>('[data-service-canvas]', host)!,
            hover: host.closest<HTMLElement>('[data-service]')!,
            kind: host.dataset.icon as IconKind,
          })),
          !reduced,
        ),
      )
      .catch(() => {});

  const io = new IntersectionObserver(
    ([en]) => {
      if (!en.isIntersecting) return;
      io.disconnect();
      load();
    },
    { rootMargin: '700px 0px' },
  );
  io.observe(section);
}

/* ------------------------------------------------------------------ */
/* Inclinação 3D ao passar o mouse (feedbacks)                         */
/* ------------------------------------------------------------------ */
function initTilt() {
  if (reduced || !finePointer) return;
  $$('[data-tilt]').forEach((el) => {
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3.out' });
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3.out' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      ry(((e.clientX - r.left) / r.width - 0.5) * 16);
      rx(((e.clientY - r.top) / r.height - 0.5) * -16);
    });
    el.addEventListener('pointerleave', () => {
      rx(0);
      ry(0);
    });
  });
}

/* ------------------------------------------------------------------ */
/* Carrossel automático (imagens e vídeos em loop contínuo)            */
/* ------------------------------------------------------------------ */
function initReel() {
  const section = $('[data-showcase]');
  const reel = $('[data-reel]');
  const track = $('[data-reel-track]');
  if (!section || !reel || !track || reduced) return;

  const originals = Array.from(track.children) as HTMLElement[];
  if (!originals.length) return;

  let cards: HTMLElement[] = [];
  let medias: (HTMLElement | null)[] = [];
  let step = 0;
  let cardW = 0;
  let padLeft = 0;
  let setW = 0;
  let vw = 0;
  let x = 0;

  const state = { hover: 1, fling: 0, dragging: false };
  let boost = 0;
  let active = true;

  // Vídeos só tocam quando estão na tela
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        const v = en.target as HTMLVideoElement;
        if (en.isIntersecting) v.play().catch(() => {});
        else v.pause();
      });
    },
    { threshold: 0.1 },
  );
  const observeVideos = () => {
    io.disconnect();
    $$<HTMLVideoElement>('[data-work-video]', track).forEach((v) => io.observe(v));
  };

  const build = () => {
    track.querySelectorAll('[data-clone]').forEach((n) => n.remove());
    vw = reel.clientWidth;
    cardW = originals[0].offsetWidth;
    const gap = parseFloat(getComputedStyle(originals[0]).marginRight) || 0;
    step = cardW + gap;
    padLeft = parseFloat(getComputedStyle(track).paddingLeft) || 0;
    setW = step * originals.length;

    const needed = Math.ceil((vw + setW + padLeft) / step) + 1;
    for (let i = originals.length; i < needed; i++) {
      const clone = originals[i % originals.length].cloneNode(true) as HTMLElement;
      clone.dataset.clone = '';
      clone.setAttribute('aria-hidden', 'true');
      clone.querySelectorAll('video').forEach((v) => v.removeAttribute('aria-label'));
      track.appendChild(clone);
    }
    cards = Array.from(track.children) as HTMLElement[];
    medias = cards.map((c) => c.querySelector<HTMLElement>('[data-card-media]'));
    observeVideos();
  };

  build();

  gsap.from(reel, {
    autoAlpha: 0,
    xPercent: 10,
    duration: 1.6,
    ease: 'expo.out',
    clearProps: 'transform,visibility,opacity',
    scrollTrigger: { trigger: reel, start: 'top 90%', once: true },
  });

  const scrollSt = ScrollTrigger.create({ start: 0, end: 'max' });
  // Pausa o carrossel quando a seção sai totalmente da tela
  ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => (active = self.isActive),
  });

  const base = () => (vw < 700 ? 52 : 70);

  gsap.ticker.add((_, deltaMs) => {
    if (!active) return;
    const dt = Math.min(deltaMs, 64) / 1000;

    if (!state.dragging) {
      const targetBoost = Math.min(Math.abs(scrollSt.getVelocity()) * 0.12, 420);
      boost += (targetBoost - boost) * 0.08;
      x += (-(base() * state.hover + boost) + state.fling) * dt;
      state.fling *= 0.94;
    }
    if (x <= -setW) x += setW;
    if (x > 0) x -= setW;

    track.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;

    // parallax da mídia dentro de cada card (só os que estão na tela)
    for (let i = 0; i < cards.length; i++) {
      const pos = padLeft + i * step + x;
      if (pos > vw + step || pos + cardW < -step) continue;
      const p = (pos + cardW / 2 - vw / 2) / (vw / 2 + cardW / 2);
      const m = medias[i];
      if (m) m.style.transform = `translate3d(${(-p * cardW * 0.1).toFixed(1)}px,0,0)`;
    }
  });

  // Arrastar com mouse/dedo
  let lastX = 0;
  let lastT = 0;
  let vel = 0;
  reel.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    state.dragging = true;
    state.fling = 0;
    lastX = e.clientX;
    lastT = performance.now();
    vel = 0;
    reel.setPointerCapture(e.pointerId);
  });
  reel.addEventListener('pointermove', (e) => {
    if (!state.dragging) return;
    const now = performance.now();
    const dx = e.clientX - lastX;
    x += dx;
    vel = (dx / Math.max(now - lastT, 1)) * 1000;
    lastX = e.clientX;
    lastT = now;
  });
  const endDrag = () => {
    if (!state.dragging) return;
    state.dragging = false;
    state.fling = clamp(vel, -1600, 1600);
  };
  reel.addEventListener('pointerup', endDrag);
  reel.addEventListener('pointercancel', endDrag);
  reel.addEventListener('dragstart', (e) => e.preventDefault());

  // Desacelera no hover (desktop)
  if (finePointer) {
    reel.addEventListener('pointerenter', () => gsap.to(state, { hover: 0.15, duration: 0.7 }));
    reel.addEventListener('pointerleave', () => gsap.to(state, { hover: 1, duration: 0.7 }));
  }

  let lastW = vw;
  new ResizeObserver(() => {
    if (reel.clientWidth === lastW) return;
    lastW = reel.clientWidth;
    build();
  }).observe(reel);
}

/* ------------------------------------------------------------------ */
/* Números                                                             */
/* ------------------------------------------------------------------ */
function initStats() {
  if (reduced) return;
  $$('[data-count]').forEach((el) => {
    const target = Number(el.dataset.count);
    const obj = { v: 0 };
    el.textContent = '0';
    gsap.to(obj, {
      v: target,
      duration: 2.2,
      ease: 'power3.out',
      onUpdate: () => (el.textContent = String(Math.round(obj.v))),
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    });
  });
}

/* ------------------------------------------------------------------ */
/* Títulos de seção e serviços                                         */
/* ------------------------------------------------------------------ */
function initSections() {
  if (reduced) return;

  $$('[data-split-title]').forEach((el) => {
    SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.lines, {
          yPercent: 110,
          duration: 1.2,
          stagger: 0.1,
          ease: 'power4.out',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        }),
    });
  });

  $$('[data-service]').forEach((el) => {
    const line = $('[data-service-line]', el);
    const items = $$('[data-service-item]', el);

    if (line) {
      gsap.from(line, {
        scaleX: 0,
        duration: 1.4,
        ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      });
    }
    gsap.from(items, {
      autoAlpha: 0,
      y: 16,
      duration: 0.8,
      stagger: 0.07,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 75%', once: true },
    });
    ScrollTrigger.create({
      trigger: el,
      start: 'top 62%',
      end: 'bottom 62%',
      toggleClass: { targets: el, className: 'is-active' },
    });
  });
}

/* ------------------------------------------------------------------ */
/* Feedbacks: parallax em desktop                                      */
/* ------------------------------------------------------------------ */
function initFeedback() {
  if (reduced) return;
  const grid = $('[data-feedback-grid]');
  if (!grid) return;
  gsap.matchMedia().add('(min-width: 900px)', () => {
    $$('[data-fb]').forEach((el) => {
      const speed = Number(el.dataset.speed) || 0.4;
      gsap.fromTo(
        el,
        { y: speed * 90 },
        {
          y: speed * -90,
          ease: 'none',
          scrollTrigger: { trigger: grid, start: 'top bottom', end: 'bottom top', scrub: true },
        },
      );
    });
  });
}

/* ------------------------------------------------------------------ */
/* CTA final                                                           */
/* ------------------------------------------------------------------ */
function initScrubText() {
  if (reduced) return;
  $$('[data-scrub-text]').forEach((text) => {
    const split = SplitText.create(text, { type: 'words' });
    gsap.fromTo(
      split.words,
      { opacity: 0.2 },
      {
        opacity: 1,
        stagger: 0.12,
        ease: 'none',
        scrollTrigger: { trigger: text, start: 'top 82%', end: 'bottom 58%', scrub: true },
      },
    );
  });
}

function initProblem() {
  if (reduced) return;
  $$('[data-pain]').forEach((el) => {
    gsap.from(el, {
      autoAlpha: 0,
      y: 36,
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });
}

function initCta() {
  if (reduced) return;

  const mark = $('[data-cta-mark]');
  if (mark) {
    gsap.fromTo(
      mark,
      { yPercent: -14, rotation: -8 },
      {
        yPercent: 14,
        rotation: 8,
        ease: 'none',
        scrollTrigger: { trigger: '[data-cta]', start: 'top bottom', end: 'bottom top', scrub: true },
      },
    );
  }

  const btn = $('[data-cta-button]');
  if (btn) {
    gsap.from(btn, {
      autoAlpha: 0,
      y: 30,
      scale: 0.92,
      duration: 1,
      ease: 'expo.out',
      scrollTrigger: { trigger: btn, start: 'top 95%', once: true },
    });
  }
}

/* ------------------------------------------------------------------ */
/* Botões magnéticos (desktop) e botão flutuante do WhatsApp           */
/* ------------------------------------------------------------------ */
function initMagnetic() {
  if (reduced || !finePointer) return;
  $$('[data-magnetic]').forEach((btn) => {
    const xTo = gsap.quickTo(btn, 'x', { duration: 0.6, ease: 'power3.out' });
    const yTo = gsap.quickTo(btn, 'y', { duration: 0.6, ease: 'power3.out' });
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.28);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.4);
    });
    btn.addEventListener('pointerleave', () => {
      xTo(0);
      yTo(0);
    });
  });
}

function initFloat() {
  const el = $('[data-wa-float]');
  if (!el) return;
  ScrollTrigger.create({
    trigger: '[data-hero]',
    start: 'bottom 40%',
    endTrigger: '[data-cta]',
    end: 'top 70%',
    toggleClass: { targets: el, className: 'is-visible' },
  });
}

function boot() {
  // só o essencial da primeira tela roda de imediato
  initScroll();
  initHeader();
  initHeroIntro();
  initHeroAmbient();
  initHero3DScene();

  // o resto (seções abaixo da dobra) é montado em fatias, quando o navegador está ocioso,
  // para não criar uma travada única logo na entrada
  const later = [
    initReel,
    initStats,
    initSections,
    initScrubText,
    initProblem,
    initFeedback,
    initCta,
    initMagnetic,
    initTilt,
    initFloat,
    initServiceIcons3D,
  ];
  const next = () => {
    const task = later.shift();
    if (!task) {
      // uma única recalculada no fim, depois de fontes e imagens
      document.fonts?.ready.then(() => ScrollTrigger.refresh());
      return;
    }
    idle(() => {
      task();
      next();
    });
  };
  if (document.readyState === 'complete') next();
  else addEventListener('load', next, { once: true });
}

boot();
