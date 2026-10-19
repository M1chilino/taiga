// Cena 3D usada só para GERAR as imagens do site (roda no navegador, via tools/render-3d/render.mjs).
// O site em produção não carrega three.js: ele usa as imagens prontas de src/assets/3d/.
import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  CapsuleGeometry,
  CircleGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshPhysicalMaterial,
  PMREMGenerator,
  PerspectiveCamera,
  PointLight,
  SRGBColorSpace,
  Scene,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const DEEP = '#00543F';
const MID = '#0c7656';
const LIGHT = '#a9cdb1';
const FOV = 30;

const glossy = (color) =>
  new MeshPhysicalMaterial({
    color: new Color(color),
    roughness: 0.26,
    metalness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    envMapIntensity: 0.75,
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

function roundedRect(w, h, r) {
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

function slab(shape, depth, bevel) {
  const geo = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 10,
    curveSegments: 32,
  });
  geo.center();
  return geo;
}

/* ----------------------------- Objetos ----------------------------- */

function buildMark(svgText) {
  const root = new Group();
  const parts = new Group();
  root.add(parts);
  const tones = [DEEP, MID];
  new SVGLoader().parse(svgText).paths.forEach((path, i) => {
    const geo = new ExtrudeGeometry(path.toShapes(), {
      depth: 110,
      bevelEnabled: true,
      bevelThickness: 20,
      bevelSize: 15,
      bevelSegments: 12,
      curveSegments: 48,
    });
    geo.translate(-500, -323, -55);
    const mesh = new Mesh(geo, glossy(tones[i % tones.length]));
    // as duas partes ficam em profundidades levemente diferentes
    mesh.position.z = i ? 38 : -38;
    parts.add(mesh);
  });
  const s = 4.3 / 1000;
  parts.scale.set(s, -s, s);
  return root;
}

function buildSearch() {
  const g = new Group();
  const ring = new Mesh(new TorusGeometry(0.62, 0.14, 48, 120), glossy(DEEP));
  ring.position.set(-0.15, 0.15, 0);
  const lens = new Mesh(new CircleGeometry(0.55, 64), glass());
  lens.position.copy(ring.position);
  const handle = new Mesh(new CapsuleGeometry(0.15, 0.7, 12, 32), glossy(MID));
  handle.position.set(0.64, -0.64, 0);
  handle.rotation.z = (-3 * Math.PI) / 4;
  const head = new Mesh(new SphereGeometry(0.16, 48, 48), glossy(MID));
  head.position.set(-0.15, 0.3, 0.05);
  const body = new Mesh(new SphereGeometry(0.28, 48, 48), glossy(MID));
  body.scale.set(1.2, 0.62, 0.5);
  body.position.set(-0.15, -0.02, 0.04);
  g.add(ring, lens, handle, head, body);
  return g;
}

function buildChart() {
  const g = new Group();
  const heights = [0.85, 1.35, 1.95];
  const xs = [-0.7, 0, 0.7];
  heights.forEach((h, i) => {
    const bar = new Mesh(slab(roundedRect(0.46, h, 0.12), 0.4, 0.06), glossy(i === 2 ? DEEP : MID));
    bar.position.set(xs[i], -1 + h / 2 + 0.05, 0);
    g.add(bar);
  });
  const orb = new Mesh(new SphereGeometry(0.2, 48, 48), glass());
  orb.position.set(0.7, 1.35, 0);
  g.add(orb);
  return g;
}

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
  const dot = new Mesh(new SphereGeometry(0.09, 32, 32), glossy(LIGHT));
  dot.position.set(-0.78, 0.5, 0.26);
  g.add(screen, play, dot);
  return g;
}

const BUILDERS = { search: buildSearch, chart: buildChart, play: buildPlay };

/* ------------------------------ Render ------------------------------ */

function render(canvas, width, height, object, rotation, { point = true, margin = 1.08 } = {}) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.72;
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  scene.environment = new PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04, 0.1, 100, { size: 256 }).texture;
  scene.add(new AmbientLight(0xffffff, 0.35));
  const key = new DirectionalLight(0xffffff, 1.9);
  key.position.set(4, 5, 7);
  scene.add(key);
  const rim = new DirectionalLight(0xa9cdb1, 1.4);
  rim.position.set(-6, 2, -5);
  scene.add(rim);
  if (point) {
    const p = new PointLight(0xffffff, 22, 22, 2);
    p.position.set(3.4, 1.6, 4.2);
    scene.add(p);
  }

  object.rotation.set(rotation.x, rotation.y, rotation.z || 0);
  scene.add(object);

  // enquadra o objeto inteiro com uma pequena margem
  const camera = new PerspectiveCamera(FOV, width / height, 0.1, 100);
  const box = new Box3().setFromObject(object);
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  const t = Math.tan(MathUtils.degToRad(FOV / 2));
  const dist = Math.max(size.y / (2 * t), size.x / (2 * t * camera.aspect)) * margin + size.z / 2;
  camera.position.set(center.x, center.y, center.z + dist);
  camera.lookAt(center);
  camera.updateProjectionMatrix();

  renderer.render(scene, camera);
  const url = canvas.toDataURL('image/png');
  renderer.dispose();
  renderer.forceContextLoss();
  return url;
}

export function renderHero(canvas, svgText, width, height) {
  return render(canvas, width, height, buildMark(svgText), { x: -0.1, y: 0.42, z: 0 }, { margin: 1.1 });
}

export function renderIcon(canvas, kind, size) {
  return render(canvas, size, size, BUILDERS[kind](), { x: -0.12, y: 0.4, z: 0 }, { margin: 1.18 });
}
