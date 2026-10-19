import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  DirectionalLight,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  MathUtils,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PMREMGenerator,
  PerspectiveCamera,
  PointLight,
  SRGBColorSpace,
  Scene,
  Shape,
  ShapeGeometry,
  WebGLRenderer,
} from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import markSvg from '../assets/logos/icone-verde.svg?raw';
import { gsap } from 'gsap';
import { isWeakGPU } from './gpu';

/** Estado compartilhado com motion.ts (rolagem e entrada). */
export interface HeroState {
  scroll: number; // 0..1 (progresso do hero saindo da tela)
  intro: number; // 0..1
}

interface Options {
  host: HTMLElement;
  canvas: HTMLCanvasElement;
  state: HeroState;
  animate: boolean;
  /** Chamado se a máquina não der conta: o site volta para a logo estática. */
  onGiveUp?: () => void;
}

const GREENS = ['#00543F', '#0a7a5a', '#0d6b4d', '#3e8d6b', '#8cbf9b'];
const FOV = 30;

/** Cena 3D do hero: símbolo da Taiga em relevo e folhas de árvore caindo. */
export async function initHero3D({ host, canvas, state, animate, onGiveUp }: Options) {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return null;
  }

  if (isWeakGPU(renderer)) {
    renderer.dispose();
    return null;
  }

  const small = matchMedia('(max-width: 899px)').matches;
  // resolução moderada: o custo da GPU cresce com o quadrado do pixel ratio
  let ratio = Math.min(devicePixelRatio, small ? 1.25 : 1.5);
  renderer.setPixelRatio(ratio);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04, 0.1, 100, { size: 128 }).texture;

  const camera = new PerspectiveCamera(FOV, 1, 0.1, 60);

  /* ----------------------------- Luzes ----------------------------- */
  scene.add(new AmbientLight(0xffffff, 0.35));
  const key = new DirectionalLight(0xffffff, 2.3);
  key.position.set(4, 5, 7);
  scene.add(key);
  const rim = new DirectionalLight(0xa9cdb1, 1.8);
  rim.position.set(-6, 2, -5);
  scene.add(rim);
  const orbit = new PointLight(0xffffff, 48, 22, 2);
  scene.add(orbit);

  /* ------------------- Símbolo da Taiga em 3D ---------------------- */
  const mark = new Group();
  const parts = new Group();
  mark.add(parts);

  const paths = new SVGLoader().parse(markSvg).paths;
  const tones = ['#00543F', '#0c7656'];
  const partMeshes: Mesh[] = paths.map((path, i) => {
    const geo = new ExtrudeGeometry(path.toShapes(), {
      depth: 110,
      bevelEnabled: true,
      bevelThickness: 20,
      bevelSize: 15,
      bevelSegments: 8,
      curveSegments: 24,
    });
    geo.translate(-500, -323, -55);
    const mat = new MeshPhysicalMaterial({
      color: new Color(tones[i % tones.length]),
      roughness: 0.26,
      metalness: 0.12,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      envMapIntensity: 1.05,
    });
    const mesh = new Mesh(geo, mat);
    parts.add(mesh);
    return mesh;
  });
  const markScale = 4.3 / 1000;
  parts.scale.set(markScale, -markScale, markScale);
  scene.add(mark);

  /* ------------------- Folhas caindo (instanciadas) ----------------- */
  const leafCount = small ? 12 : 24;
  const leafShape = new Shape();
  leafShape.moveTo(0, -0.9);
  leafShape.bezierCurveTo(0.78, -0.4, 0.72, 0.55, 0, 1.15);
  leafShape.bezierCurveTo(-0.72, 0.55, -0.78, -0.4, 0, -0.9);
  const leafGeo = new ShapeGeometry(leafShape, 14);
  // curva a folha para ela pegar luz de forma diferente em cada ângulo
  const lp = leafGeo.attributes.position;
  for (let i = 0; i < lp.count; i++) {
    const x = lp.getX(i);
    const y = lp.getY(i);
    lp.setZ(i, x * x * 0.55 - y * y * 0.06);
  }
  leafGeo.computeVertexNormals();
  const leafMat = new MeshStandardMaterial({ roughness: 0.5, metalness: 0.05, side: DoubleSide });
  const leaves = new InstancedMesh(leafGeo, leafMat, leafCount);
  const forest = new Group();
  forest.add(leaves);
  scene.add(forest);

  const FALL = 13; // altura total do ciclo de queda
  const leafData = Array.from({ length: leafCount }, (_, i) => ({
    x: (Math.random() - 0.5) * 14,
    z: -3.5 + Math.random() * 6,
    s: 0.34 + Math.random() * 0.4,
    fall: 0.35 + Math.random() * 0.55,
    offset: Math.random() * FALL,
    sway: 0.4 + Math.random() * 0.6,
    swayAmp: 0.5 + Math.random() * 0.9,
    phase: Math.random() * Math.PI * 2,
    spin: 0.6 + Math.random() * 1.1,
    tone: GREENS[i % GREENS.length],
  }));
  leafData.forEach((d, i) => leaves.setColorAt(i, new Color(d.tone)));
  if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;

  /* ---------------------------- Tamanho ---------------------------- */
  const resize = () => {
    const w = Math.max(host.clientWidth, 1);
    const h = Math.max(host.clientHeight, 1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // garante que o símbolo caiba em telas estreitas
    const needW = 5.8;
    const visibleH = Math.max(5.2, needW / camera.aspect);
    camera.position.set(0, 0, visibleH / (2 * Math.tan(MathUtils.degToRad(FOV / 2))));
    camera.updateProjectionMatrix();
    if (!animate) frame(0);
  };

  /* ---------------------------- Animação --------------------------- */
  const dummy = new Object3D();
  let visible = true;
  let time = 0;

  function frame(t: number) {
    const intro = MathUtils.clamp(state.intro, 0, 1);
    const ease = 1 - Math.pow(1 - intro, 3);

    const sc = state.scroll;

    mark.rotation.y = 0.3 + Math.sin(t * 0.5) * 0.3 + sc * 1.3 - (1 - ease) * Math.PI * 1.2;
    mark.rotation.x = -0.08 + Math.sin(t * 0.42) * 0.07 + sc * 0.25;
    mark.position.y = Math.sin(t * 0.8) * 0.14 + sc * 1.1;
    const s = 0.65 + ease * 0.35;
    mark.scale.setScalar(s);

    // as duas partes do símbolo flutuam em profundidades diferentes
    partMeshes.forEach((m, i) => {
      m.position.z = Math.sin(t * 0.9 + i * 2.2) * 60 * (i ? 1 : -1);
      m.position.y = Math.cos(t * 0.7 + i) * 14;
    });

    // luz que passeia pelo símbolo
    orbit.position.set(Math.cos(t * 0.7) * 5.2, Math.sin(t * 0.5) * 3 + 1, 3.5 + Math.sin(t * 0.9) * 1.5);

    // folhas: caem balançando e girando
    forest.position.y = sc * 1.8;
    leafData.forEach((d, i) => {
      const cycle = (((t * d.fall + d.offset) % FALL) + FALL) % FALL;
      const y = FALL / 2 - cycle;
      const x = d.x + Math.sin(t * d.sway + d.phase) * d.swayAmp;
      dummy.position.set(x, y, d.z);
      dummy.rotation.set(
        Math.sin(t * d.spin + d.phase) * 0.9,
        t * d.spin * 0.7 + d.phase,
        Math.cos(t * d.sway + d.phase) * 0.9,
      );
      dummy.scale.setScalar(d.s * (0.3 + ease * 0.7));
      dummy.updateMatrix();
      leaves.setMatrixAt(i, dummy.matrix);
    });
    leaves.instanceMatrix.needsUpdate = true;

    renderer.render(scene, camera);
  }

  // compila os shaders em paralelo, sem travar a página
  await renderer.compileAsync(scene, camera).catch(() => {});

  new ResizeObserver(resize).observe(host);
  resize();

  if (animate) {
    new IntersectionObserver(([en]) => (visible = en.isIntersecting), { threshold: 0 }).observe(host);

    // Controle de qualidade: se a taxa de quadros ficar baixa, reduz a resolução do 3D
    // aos poucos e, em último caso, desiste e volta para a logo estática.
    let frames = 0;
    let acc = 0;
    const tick = (_: number, deltaMs: number) => {
      if (!visible || document.hidden) return;
      const dt = Math.min(deltaMs, 64) / 1000;
      time += dt;
      frame(time);

      if (++frames <= 40) return; // ignora o aquecimento (shaders, entrada)
      acc += deltaMs;
      if (frames < 40 + 45) return;
      const avg = acc / 45;
      frames = 40;
      acc = 0;
      if (avg <= 27) return; // mais de ~37 fps: tudo certo
      if (ratio > 0.9) {
        ratio = Math.max(0.85, ratio - 0.3);
        renderer.setPixelRatio(ratio);
        resize();
      } else {
        gsap.ticker.remove(tick);
        renderer.dispose();
        onGiveUp?.();
      }
    };
    gsap.ticker.add(tick);
  }

  return { renderer };
}
