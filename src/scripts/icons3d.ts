import {
  ACESFilmicToneMapping,
  AmbientLight,
  CapsuleGeometry,
  CircleGeometry,
  DirectionalLight,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshPhysicalMaterial,
  PMREMGenerator,
  PerspectiveCamera,
  SRGBColorSpace,
  Scene,
  Shape,
  SphereGeometry,
  TorusGeometry,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { gsap } from 'gsap';
import { isWeakGPU } from './gpu';

export type IconKind = 'search' | 'chart' | 'play';

export interface IconSlot {
  host: HTMLElement; // área do ícone (observada para pausar fora da tela)
  canvas: HTMLCanvasElement;
  hover: HTMLElement; // elemento cujo mouse inclina o ícone (o card)
  kind: IconKind;
}

const DEEP = '#00543F';
const MID = '#0c7656';
const LIGHT = '#a9cdb1';

const glossy = (color: string) =>
  new MeshPhysicalMaterial({
    color,
    roughness: 0.26,
    metalness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.05,
  });

const glass = () =>
  new MeshPhysicalMaterial({
    color: LIGHT,
    roughness: 0.12,
    metalness: 0,
    clearcoat: 1,
    transparent: true,
    opacity: 0.55,
    side: DoubleSide,
    envMapIntensity: 1.3,
  });

function roundedRect(w: number, h: number, r: number) {
  const s = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function slab(shape: Shape, depth: number, bevel: number) {
  const geo = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 6,
    curveSegments: 16,
  });
  geo.center();
  return geo;
}

/** Lupa: análise de perfil. */
function buildSearch() {
  const g = new Group();
  const ring = new Mesh(new TorusGeometry(0.62, 0.14, 32, 80), glossy(DEEP));
  ring.position.set(-0.15, 0.15, 0);
  const lens = new Mesh(new CircleGeometry(0.55, 48), glass());
  lens.position.copy(ring.position);
  const handle = new Mesh(new CapsuleGeometry(0.15, 0.7, 10, 24), glossy(MID));
  handle.position.set(0.64, -0.64, 0);
  handle.rotation.z = (-3 * Math.PI) / 4;
  // silhueta de perfil dentro da lente
  const head = new Mesh(new SphereGeometry(0.16, 32, 32), glossy(MID));
  head.position.set(-0.15, 0.3, 0.05);
  const body = new Mesh(new SphereGeometry(0.28, 32, 32), glossy(MID));
  body.scale.set(1.2, 0.62, 0.5);
  body.position.set(-0.15, -0.02, 0.04);
  g.add(ring, lens, handle, head, body);
  return g;
}

/** Barras crescentes: gestão de perfil e métricas. */
function buildChart() {
  const g = new Group();
  const heights = [0.85, 1.35, 1.95];
  const xs = [-0.7, 0, 0.7];
  heights.forEach((h, i) => {
    const bar = new Mesh(slab(roundedRect(0.46, h, 0.12), 0.4, 0.06), glossy(i === 2 ? DEEP : MID));
    bar.position.set(xs[i], -1 + h / 2 + 0.05, 0);
    g.add(bar);
  });
  const orb = new Mesh(new SphereGeometry(0.2, 32, 32), glass());
  orb.position.set(0.7, 1.35, 0);
  orb.name = 'orb';
  g.add(orb);
  return g;
}

/** Tela com botão de play: captação de vídeos. */
function buildPlay() {
  const g = new Group();
  const screen = new Mesh(slab(roundedRect(2.15, 1.5, 0.34), 0.34, 0.08), glossy(DEEP));
  const tri = new Shape();
  tri.moveTo(-0.28, -0.42);
  tri.lineTo(0.5, 0);
  tri.lineTo(-0.28, 0.42);
  tri.closePath();
  const play = new Mesh(slab(tri, 0.1, 0.05), glossy('#e8f3ea'));
  play.position.set(0.05, 0, 0.3);
  const dot = new Mesh(new SphereGeometry(0.09, 24, 24), glossy(LIGHT));
  dot.position.set(-0.78, 0.5, 0.26);
  g.add(screen, play, dot);
  return g;
}

const builders: Record<IconKind, () => Group> = {
  search: buildSearch,
  chart: buildChart,
  play: buildPlay,
};

/** Ícones 3D flutuantes dos serviços (um canvas por card, só renderiza quando visível). */
export function initServiceIcons(slots: IconSlot[], animate: boolean) {
  const small = matchMedia('(max-width: 899px)').matches;

  // Cada ícone é montado só quando chega perto da tela e um de cada vez,
  // para não travar a página compilando vários shaders de uma vez.
  const queue: (() => Promise<void> | void)[] = [];
  let busy = false;
  const pump = () => {
    if (busy) return;
    const job = queue.shift();
    if (!job) return;
    busy = true;
    requestAnimationFrame(async () => {
      try {
        await job();
      } catch {
        /* o ícone fica com a versão 2D */
      }
      setTimeout(() => {
        busy = false;
        pump();
      }, 160);
    });
  };

  const setup = async (slot: IconSlot, index: number) => {
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas: slot.canvas, antialias: true, alpha: true });
    } catch {
      return;
    }
    if (isWeakGPU(renderer)) {
      renderer.dispose();
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.setClearColor(0x000000, 0);

    const scene = new Scene();
    scene.environment = new PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04, 0.1, 100, { size: 128 }).texture;
    scene.add(new AmbientLight(0xffffff, 0.35));
    const key = new DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 4, 6);
    scene.add(key);
    const rim = new DirectionalLight(0xa9cdb1, 1.8);
    rim.position.set(-4, 1, -4);
    scene.add(rim);

    const camera = new PerspectiveCamera(30, 1, 0.1, 40);
    camera.position.set(0, 0, 6.3);

    const icon = builders[slot.kind]();
    icon.scale.setScalar(0.001);
    scene.add(icon);
    const orb = icon.getObjectByName('orb');

    const resize = () => {
      const w = Math.max(slot.host.clientWidth, 1);
      const h = Math.max(slot.host.clientHeight, 1);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (!animate) draw(0);
    };

    const target = { x: 0, y: 0 };
    let sx = 0;
    let sy = 0;
    let appear = animate ? 0 : 1;
    let visible = false;
    let t = index * 1.7;

    function draw(dt: number) {
      sx += (target.x - sx) * Math.min(dt * 5, 1);
      sy += (target.y - sy) * Math.min(dt * 5, 1);
      appear = Math.min(appear + dt * 0.9, 1);
      const e = 1 - Math.pow(1 - appear, 3);

      icon.scale.setScalar(0.001 + e * 0.999);
      icon.rotation.y = 0.35 + Math.sin(t * 0.7) * 0.35 + sx * 0.7 + (1 - e) * -2.2;
      icon.rotation.x = -0.12 + Math.sin(t * 0.5) * 0.08 - sy * 0.4;
      icon.position.y = Math.sin(t * 1.1) * 0.12;
      if (orb) orb.position.y = 1.35 + Math.sin(t * 1.6) * 0.14;
      renderer.render(scene, camera);
    }

    await renderer.compileAsync(scene, camera).catch(() => {});

    new ResizeObserver(resize).observe(slot.host);
    resize();
    slot.host.classList.add('is-3d');

    if (!animate) return;

    new IntersectionObserver(([en]) => (visible = en.isIntersecting), { rootMargin: '80px' }).observe(slot.host);
    slot.hover.addEventListener('pointermove', (e) => {
      const r = slot.hover.getBoundingClientRect();
      target.x = MathUtils.clamp(((e.clientX - r.left) / r.width - 0.5) * 2, -1, 1);
      target.y = MathUtils.clamp(((e.clientY - r.top) / r.height - 0.5) * 2, -1, 1);
    });
    slot.hover.addEventListener('pointerleave', () => {
      target.x = 0;
      target.y = 0;
    });

    gsap.ticker.add((_, deltaMs) => {
      if (!visible || document.hidden) return;
      const dt = Math.min(deltaMs, 64) / 1000;
      t += dt;
      draw(dt);
    });
  };

  slots.forEach((slot, index) => {
    const io = new IntersectionObserver(
      ([en]) => {
        if (!en.isIntersecting) return;
        io.disconnect();
        queue.push(() => setup(slot, index));
        pump();
      },
      { rootMargin: '300px 0px' },
    );
    io.observe(slot.host);
  });
}
