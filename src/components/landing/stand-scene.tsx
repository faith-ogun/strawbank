"use client";

// The 3D farm stand behind the landing page's story: a lit diorama built from
// primitives in one material language, the way the 3D explainer kit builds its
// worlds. It follows the active moment: the camera moves, the light runs from
// morning to dusk, goods leave the shelf, and a payment shows as a ring from
// the QR card. Like the product, it never shows a person.

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { MOMENTS } from "./moments";

type V3 = [number, number, number];

type Light = {
  skyTop: string;
  skyLow: string;
  sun: string;
  sunIntensity: number;
  sunPos: V3;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  lantern: number;
  exposure: number;
};

const MORNING: Light = {
  skyTop: "#9fd1ef",
  skyLow: "#f6efdc",
  sun: "#fff0d6",
  sunIntensity: 2.6,
  sunPos: [-4, 7, 5],
  hemiSky: "#dcebff",
  hemiGround: "#b7cf8c",
  hemiIntensity: 0.95,
  lantern: 0,
  exposure: 1,
};

const MIDDAY: Light = {
  skyTop: "#7fc0ec",
  skyLow: "#e8f4f6",
  sun: "#ffffff",
  sunIntensity: 3,
  sunPos: [-1, 9, 4],
  hemiSky: "#e6f2ff",
  hemiGround: "#b7cf8c",
  hemiIntensity: 1.05,
  lantern: 0,
  exposure: 1,
};

const DUSK: Light = {
  skyTop: "#2c3266",
  skyLow: "#f09a62",
  sun: "#ff9150",
  sunIntensity: 1.9,
  sunPos: [5, 2.4, 3],
  hemiSky: "#7d74b8",
  hemiGround: "#3e4a33",
  hemiIntensity: 0.6,
  lantern: 1,
  exposure: 0.95,
};

/** Camera and light per moment, in MOMENTS order. */
const STATES: { cam: V3; look: V3; light: Light }[] = [
  { cam: [3.1, 1.8, 4.3], look: [0.4, 0.95, 0], light: MORNING }, // the stand opens
  { cam: [0.45, 1.3, 1.95], look: [0.95, 0.92, 0.28], light: MORNING }, // the old tin
  { cam: [-1.0, 1.45, 2.3], look: [-0.6, 1.0, -0.15], light: MORNING }, // price card and shelf
  { cam: [2.0, 1.55, 3.3], look: [0.35, 0.55, 0.75], light: MIDDAY }, // a customer's basket
  { cam: [2.7, 1.45, 2.4], look: [1.3, 0.85, 0.45], light: MIDDAY }, // something's wrong
  { cam: [1.0, 1.85, 5.4], look: [0.45, 0.95, 0], light: DUSK }, // dusk
];

const STEP = Object.fromEntries(MOMENTS.map((m, i) => [m.id, i])) as Record<(typeof MOMENTS)[number]["id"], number>;

const C = {
  navy: "#0a1643",
  straw: "#f0bb57",
  straw2: "#e5a73c",
  straw3: "#d4952c",
  mint: "#4aeb94",
  coin: "#eba620",
  white: "#f9f9f9",
  wood: "#c68a54",
  woodDark: "#9c6a3d",
  woodMid: "#b07a47",
  plankA: "#dcae7a",
  plankB: "#cc9a64",
  grass: "#9cc47e",
  soil: "#8a6a48",
  gravel: "#e3d6b8",
  bush: "#5f9a5a",
  bush2: "#4c874b",
  kraft: "#d8c09a",
  eggCream: "#f3eadb",
  eggBrown: "#d6a676",
  onion: "#c98a3e",
  onion2: "#b5622c",
  potato: "#c9a066",
  bag: "#cfae7d",
  jam: "#9e1f3a",
  label: "#f6efe0",
  wicker: "#c9a46a",
};

/** Small seeded random, so the stand looks the same on every load. */
function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mat(color: string, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });
}

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], pos?: V3, rot?: V3) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = true;
  m.receiveShadow = true;
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  return m;
}

const box = (w: number, h: number, d: number, r = 0.012) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2));

type Painted = { texture: THREE.CanvasTexture; redraw: () => void };

/** A texture drawn on a canvas, redrawn once the page's fonts have loaded. */
function painted(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): Painted {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const redraw = () => {
    ctx.clearRect(0, 0, w, h);
    draw(ctx, w, h);
    texture.needsUpdate = true;
  };
  redraw();
  return { texture, redraw };
}

type Fonts = { hand: string; display: string };

function priceCard(fonts: Fonts) {
  return painted(512, 420, (ctx, w, h) => {
    const rand = seeded(7);
    ctx.fillStyle = C.wood;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#232b27";
    ctx.fillRect(20, 20, w - 40, h - 40);
    for (let i = 0; i < 46; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.015 + rand() * 0.035})`;
      ctx.beginPath();
      ctx.ellipse(30 + rand() * (w - 60), 30 + rand() * (h - 60), 20 + rand() * 60, 6 + rand() * 18, rand() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#f2efe6";
    ctx.strokeStyle = "#f2efe6";
    ctx.font = `700 58px ${fonts.hand}`;
    ctx.fillText("Today", 48, 96);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(48, 110);
    ctx.bezierCurveTo(110, 104, 160, 116, 206, 106);
    ctx.stroke();
    const lines = [
      ["Eggs, each", "€0.60"],
      ["Onions, bag", "€2"],
      ["Potatoes, bag", "€3"],
      ["Jam", "€4.50"],
    ];
    ctx.font = `400 40px ${fonts.hand}`;
    lines.forEach(([item, price], i) => {
      const y = 172 + i * 62;
      ctx.textAlign = "left";
      ctx.fillText(item, 48, y);
      ctx.textAlign = "right";
      ctx.fillText(price, w - 48, y);
    });
    ctx.textAlign = "left";
  });
}

function sign(fonts: Fonts) {
  return painted(512, 128, (ctx, w, h) => {
    ctx.fillStyle = "#efdcb4";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#b98552";
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = C.navy;
    ctx.textAlign = "center";
    ctx.font = `800 58px ${fonts.display}`;
    ctx.fillText("HONESTY BOX", w / 2, 74);
    ctx.font = `400 28px ${fonts.hand}`;
    ctx.fillStyle = "#8a5a0b";
    ctx.fillText("pay by phone", w / 2, 108);
  });
}

function tinLabel(fonts: Fonts) {
  return painted(256, 96, (ctx, w, h) => {
    ctx.fillStyle = "#efe3c8";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#3a2c1c";
    ctx.textAlign = "center";
    ctx.font = `700 40px ${fonts.hand}`;
    ctx.fillText("honesty box", w / 2, 60);
  });
}

function face() {
  return painted(256, 128, (ctx) => {
    ctx.strokeStyle = C.navy;
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    for (const x of [82, 174]) {
      ctx.beginPath();
      ctx.arc(x, 58, 17, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(128, 66, 28, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
  });
}

/** A QR-like pattern for the card on the stand. Decoration only: it is not a real code. */
function qr() {
  return painted(168, 168, (ctx) => {
    const rand = seeded(42);
    const n = 21;
    const s = 6;
    const o = 21;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 168, 168);
    ctx.fillStyle = C.navy;
    const finder = (fx: number, fy: number) => fx < 8 && fy < 8;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const inFinder = finder(x, y) || finder(n - 1 - x, y) || finder(x, n - 1 - y);
        if (!inFinder && rand() > 0.52) ctx.fillRect(o + x * s, o + y * s, s, s);
      }
    }
    for (const [fx, fy] of [
      [0, 0],
      [n - 7, 0],
      [0, n - 7],
    ]) {
      ctx.fillRect(o + fx * s, o + fy * s, 7 * s, 7 * s);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(o + (fx + 1) * s, o + (fy + 1) * s, 5 * s, 5 * s);
      ctx.fillStyle = C.navy;
      ctx.fillRect(o + (fx + 2) * s, o + (fy + 2) * s, 3 * s, 3 * s);
    }
  });
}

function wicker() {
  const p = painted(256, 64, (ctx, w, h) => {
    ctx.fillStyle = C.wicker;
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) {
      for (let x = (y / 8) % 2 ? 0 : 8; x < w; x += 16) {
        ctx.fillStyle = "rgba(90,60,25,0.28)";
        ctx.fillRect(x, y, 8, 8);
      }
    }
  });
  p.texture.wrapS = THREE.RepeatWrapping;
  p.texture.repeat.set(3, 1);
  return p;
}

type Item = { obj: THREE.Object3D; baseY: number; shown: (step: number) => boolean; s: number };

function buildWorld(fonts: Fonts) {
  const world = new THREE.Group();
  const items: Item[] = [];
  const paints: Painted[] = [];
  const rand = seeded(2026);
  const T = 0.83; // the table's top surface

  const track = (obj: THREE.Object3D, shown: (step: number) => boolean) => {
    items.push({ obj, baseY: obj.position.y, shown, s: 1 });
    return obj;
  };
  const until = (step: number) => (s: number) => s < step;

  // Ground: a round island of grass on a slab of soil, with a gravel lay-by.
  const ground = mesh(new THREE.CylinderGeometry(3.4, 3.5, 0.3, 72), [mat(C.soil), mat(C.grass, { roughness: 1 }), mat(C.soil)], [0, -0.15, 0]);
  ground.castShadow = false;
  world.add(ground);
  const gravel = mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.02, 48), mat(C.gravel, { roughness: 1 }), [0.35, 0.01, 1.3]);
  gravel.scale.z = 0.7;
  world.add(gravel);
  for (const [x, z, r, c] of [
    [-2.3, -1.5, 0.42, C.bush],
    [-1.7, -2.1, 0.3, C.bush2],
    [2.35, -1.45, 0.38, C.bush2],
    [2.75, -0.55, 0.26, C.bush],
    [-2.8, 0.4, 0.22, C.bush2],
  ] as [number, number, number, string][]) {
    world.add(mesh(new THREE.IcosahedronGeometry(r, 1), mat(c, { flatShading: true }), [x, r * 0.7, z]));
  }

  // The stand: table, skirt, legs, back posts, plank back, thatched roof.
  const wood = mat(C.wood);
  const woodDark = mat(C.woodDark);
  const woodMid = mat(C.woodMid);
  world.add(mesh(box(2.3, 0.1, 0.95, 0.03), wood, [0, 0.78, 0]));
  world.add(mesh(box(2.3, 0.22, 0.04), woodMid, [0, 0.63, 0.47]));
  for (const x of [-1.05, 1.05]) for (const z of [0.38, -0.38]) world.add(mesh(box(0.08, 0.74, 0.08), woodDark, [x, 0.37, z]));
  for (const x of [-1.12, 1.12]) world.add(mesh(box(0.09, 2.3, 0.09), woodDark, [x, 1.15, -0.44]));
  for (let i = 0; i < 5; i++) {
    world.add(mesh(box(2.2, 0.16, 0.03, 0.008), mat(i % 2 ? C.plankA : C.plankB), [0, 0.93 + i * 0.175, -0.46]));
  }
  const roofTilt = 0.245;
  [C.straw3, C.straw2, C.straw].forEach((c, i) => {
    world.add(mesh(box(2.72 - i * 0.06, 0.06, 1.42 - i * 0.12, 0.025), mat(c, { roughness: 0.95 }), [0, 2.16 + i * 0.045, 0.06 - i * 0.03], [roofTilt, 0, 0]));
  });
  world.add(mesh(box(2.74, 0.1, 0.05), mat(C.straw3, { roughness: 1 }), [0, 1.99, 0.74], [roofTilt, 0, 0]));

  const signPaint = sign(fonts);
  paints.push(signPaint);
  const signMats = [woodMid, woodMid, woodMid, woodMid, new THREE.MeshStandardMaterial({ map: signPaint.texture, roughness: 0.8 }), woodMid];
  world.add(mesh(new THREE.BoxGeometry(1.1, 0.275, 0.03), signMats, [0, 1.83, -0.43]));

  // The grower's chalk price card, leaning on the back.
  const cardPaint = priceCard(fonts);
  paints.push(cardPaint);
  const cardMats = [wood, wood, wood, wood, new THREE.MeshStandardMaterial({ map: cardPaint.texture, roughness: 0.9 }), wood];
  world.add(mesh(new THREE.BoxGeometry(0.6, 0.49, 0.025), cardMats, [-0.62, 1.1, -0.37], [-0.1, 0, 0]));

  // Eggs: closed boxes, and one open box on show.
  const eggBox = (pos: V3) => {
    const g = new THREE.Group();
    g.add(mesh(box(0.32, 0.09, 0.15, 0.018), mat(C.kraft, { roughness: 0.95 })));
    g.add(mesh(box(0.12, 0.004, 0.08, 0.002), mat(C.label), [0, 0.046, 0]));
    g.position.set(...pos);
    return g;
  };
  world.add(track(eggBox([-0.85, T + 0.045, 0.2]), until(STEP.dusk)));
  world.add(track(eggBox([-0.85, T + 0.137, 0.2]), until(STEP.customer)));
  world.add(track(eggBox([-0.5, T + 0.045, 0.24]), until(STEP.dusk)));
  // Eggs are sold one by one, so a box on show, or in a basket, stands open.
  const openEggBox = () => {
    const g = new THREE.Group();
    g.add(mesh(box(0.3, 0.05, 0.14, 0.012), mat(C.kraft, { roughness: 0.95 }), [0, 0.025, 0]));
    g.add(mesh(box(0.3, 0.012, 0.14, 0.005), mat(C.kraft, { roughness: 0.95 }), [0, 0.1, -0.1], [-1.25, 0, 0]));
    for (let i = 0; i < 6; i++) {
      const egg = mesh(new THREE.SphereGeometry(0.03, 20, 14), mat(i % 3 === 1 ? C.eggBrown : C.eggCream, { roughness: 0.6 }), [-0.09 + (i % 3) * 0.09, 0.07, i < 3 ? -0.032 : 0.032]);
      egg.scale.y = 1.28;
      g.add(egg);
    }
    return g;
  };
  const open = openEggBox();
  open.position.set(-0.6, T, -0.02);
  world.add(open);

  // Onions, tied in bundles of three, in a slatted crate.
  const crate = (pos: V3, w: number, d: number) => {
    const g = new THREE.Group();
    g.add(mesh(box(w, 0.02, d, 0.006), woodMid, [0, 0.01, 0]));
    for (const y of [0.04, 0.1]) {
      g.add(mesh(box(w, 0.045, 0.018, 0.006), woodMid, [0, y, d / 2]));
      g.add(mesh(box(w, 0.045, 0.018, 0.006), woodMid, [0, y, -d / 2]));
      g.add(mesh(box(0.018, 0.045, d, 0.006), woodMid, [w / 2, y, 0]));
      g.add(mesh(box(0.018, 0.045, d, 0.006), woodMid, [-w / 2, y, 0]));
    }
    g.position.set(...pos);
    return g;
  };
  world.add(crate([0, T, 0.1], 0.46, 0.32));
  const onionBundle = (pos: V3) => {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      const onion = mesh(new THREE.SphereGeometry(0.04, 18, 14), mat(rand() > 0.5 ? C.onion : C.onion2, { roughness: 0.55 }), [Math.cos(a) * 0.036, 0, Math.sin(a) * 0.036]);
      onion.scale.y = 0.88;
      onion.add(mesh(new THREE.ConeGeometry(0.012, 0.03, 8), mat(C.onion2), [0, 0.045, 0]));
      g.add(onion);
    }
    g.add(mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.05, 8), mat(C.straw3), [0, 0.05, 0]));
    g.position.set(...pos);
    return g;
  };
  const bundles: [number, number, number][] = [
    [-0.13, -0.07, 99],
    [0, -0.07, 99],
    [0.13, -0.07, STEP.dusk],
    [-0.07, 0.07, STEP.dusk],
    [0.08, 0.07, STEP.customer],
  ];
  for (const [x, z, gone] of bundles) world.add(track(onionBundle([x, T + 0.06, 0.1 + z]), until(gone)));

  // Potatoes in paper bags.
  const potatoBag = (pos: V3) => {
    const g = new THREE.Group();
    g.add(mesh(box(0.14, 0.17, 0.1, 0.01), mat(C.bag, { roughness: 1 }), [0, 0.085, 0]));
    g.add(mesh(box(0.146, 0.025, 0.106, 0.008), mat(C.kraft, { roughness: 1 }), [0, 0.16, 0]));
    for (let i = 0; i < 3; i++) {
      const p = mesh(new THREE.SphereGeometry(0.035, 14, 10), mat(C.potato, { roughness: 0.95 }), [-0.035 + i * 0.035, 0.18, (rand() - 0.5) * 0.03]);
      p.scale.set(1.2, 0.8, 0.95);
      p.rotation.y = rand() * 3;
      g.add(p);
    }
    g.position.set(...pos);
    return g;
  };
  world.add(track(potatoBag([0.36, T, 0.25]), () => true));
  world.add(track(potatoBag([0.53, T, 0.27]), until(STEP.dusk)));

  // Jam jars with cloth caps.
  const capPaint = painted(64, 64, (ctx) => {
    ctx.fillStyle = "#fbf4e4";
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "rgba(196,70,43,0.55)";
    for (let i = 0; i < 64; i += 16) {
      ctx.fillRect(i, 0, 8, 64);
      ctx.fillRect(0, i, 64, 8);
    }
  });
  paints.push(capPaint);
  const jar = (pos: V3) => {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.11, 24), new THREE.MeshPhysicalMaterial({ color: C.jam, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 }), [0, 0.055, 0]));
    g.add(mesh(new THREE.CylinderGeometry(0.0556, 0.0556, 0.045, 24, 1, true), mat(C.label), [0, 0.05, 0]));
    g.add(mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.018, 24), mat(C.coin, { metalness: 0.5, roughness: 0.35 }), [0, 0.12, 0]));
    g.add(mesh(new THREE.CylinderGeometry(0.068, 0.074, 0.014, 24), mat("#ffffff", { map: capPaint.texture, roughness: 0.95 }), [0, 0.133, 0]));
    g.position.set(...pos);
    return g;
  };
  [0.3, 0.44, 0.58, 0.72, 0.86].forEach((x, i) => world.add(track(jar([x, T, -0.22]), i === 1 || i === 3 ? until(STEP.dusk) : () => true)));

  // The old honesty tin, and the QR card that replaces it.
  const tinPaint = tinLabel(fonts);
  paints.push(tinPaint);
  const tin = new THREE.Group();
  tin.add(mesh(box(0.2, 0.15, 0.15, 0.02), mat(C.navy, { metalness: 0.4, roughness: 0.45 }), [0, 0.075, 0]));
  tin.add(mesh(new THREE.BoxGeometry(0.09, 0.006, 0.014), mat("#02061a"), [0, 0.152, 0]));
  tin.add(mesh(new THREE.PlaneGeometry(0.16, 0.06), new THREE.MeshStandardMaterial({ map: tinPaint.texture, roughness: 0.9 }), [0, 0.075, 0.0765], [0, 0, 0.04]));
  tin.position.set(0.97, T, 0.3);
  world.add(tin);

  const qrPaint = qr();
  paints.push(qrPaint);
  const white = mat("#ffffff", { roughness: 0.6 });
  const card = mesh(new THREE.BoxGeometry(0.15, 0.19, 0.01), [white, white, white, white, new THREE.MeshStandardMaterial({ map: qrPaint.texture, roughness: 0.6 }), white], [0.75, T + 0.1, 0.33], [-0.15, -0.15, 0]);
  world.add(card);
  world.add(mesh(box(0.03, 0.08, 0.06, 0.006), woodDark, [0.75, T + 0.02, 0.29]));

  // The lantern, lit at dusk.
  world.add(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.16, 6), mat(C.navy), [1.05, 1.98, 0.5]));
  const lanternCore = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.07), new THREE.MeshStandardMaterial({ color: "#f6e6c4", emissive: "#ffc46b", emissiveIntensity: 0, roughness: 0.3 }));
  lanternCore.position.set(1.05, 1.85, 0.5);
  world.add(lanternCore);
  world.add(mesh(new THREE.ConeGeometry(0.065, 0.05, 4), mat(C.navy), [1.05, 1.925, 0.5], [0, Math.PI / 4, 0]));
  world.add(mesh(new THREE.BoxGeometry(0.085, 0.015, 0.085), mat(C.navy), [1.05, 1.795, 0.5]));
  const lanternLight = new THREE.PointLight("#ffc46b", 0, 3.5, 2);
  lanternLight.position.set(1.05, 1.84, 0.55);
  world.add(lanternLight);

  // The customer's basket on the gravel, there only while they shop.
  const wickerPaint = wicker();
  paints.push(wickerPaint);
  const basket = new THREE.Group();
  const weave = mat("#ffffff", { map: wickerPaint.texture, roughness: 1, side: THREE.DoubleSide });
  basket.add(mesh(new THREE.CylinderGeometry(0.21, 0.17, 0.17, 32, 1, true), weave, [0, 0.085, 0]));
  basket.add(mesh(new THREE.CircleGeometry(0.17, 32), mat(C.wicker), [0, 0.003, 0], [-Math.PI / 2, 0, 0]));
  basket.add(mesh(new THREE.TorusGeometry(0.21, 0.014, 8, 40), mat(C.woodMid), [0, 0.17, 0], [Math.PI / 2, 0, 0]));
  basket.add(mesh(new THREE.TorusGeometry(0.2, 0.012, 8, 32, Math.PI), mat(C.woodMid), [0, 0.17, 0]));
  const inBasket = openEggBox();
  inBasket.position.set(-0.05, 0.085, 0.02);
  inBasket.rotation.y = 0.5;
  inBasket.scale.setScalar(0.85);
  basket.add(inBasket);
  basket.add(onionBundle([0.09, 0.15, -0.04]));
  basket.position.set(0.45, 0, 1.15);
  basket.rotation.y = -0.4;
  world.add(track(basket, (s) => s === STEP.customer || s === STEP.wrong));

  // Strawbank itself: the scarecrow jar on a post, keeping the stall.
  world.add(mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.62, 10), woodDark, [1.66, 0.31, 0.55]));
  const keeper = new THREE.Group();
  const profile: [number, number][] = [
    [0, 0],
    [0.15, 0],
    [0.185, 0.012],
    [0.2, 0.045],
    [0.2, 0.33],
    [0.19, 0.375],
    [0.165, 0.405],
    [0.15, 0.42],
    [0.15, 0.47],
    [0.156, 0.48],
    [0.156, 0.5],
    [0, 0.5],
  ];
  keeper.add(mesh(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 48), new THREE.MeshPhysicalMaterial({ color: C.white, roughness: 0.35, clearcoat: 0.6 })));
  const navy = mat(C.navy, { roughness: 0.7 });
  keeper.add(mesh(new THREE.CylinderGeometry(0.203, 0.19, 0.17, 48), navy, [0, 0.1, 0]));
  keeper.add(mesh(new THREE.CylinderGeometry(0.204, 0.204, 0.09, 48, 1, true, -0.7, 1.4), navy, [0, 0.225, 0]));
  for (const side of [-1, 1]) keeper.add(mesh(new THREE.SphereGeometry(0.014, 10, 8), mat(C.white), [side * 0.11, 0.25, 0.172]));
  keeper.add(mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.016, 32), mat(C.coin, { metalness: 0.55, roughness: 0.3 }), [0, 0.11, 0.205], [Math.PI / 2, 0, 0]));
  const facePaint = face();
  paints.push(facePaint);
  keeper.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2025, 0.2025, 0.13, 32, 1, true, -0.6, 1.2), new THREE.MeshStandardMaterial({ map: facePaint.texture, transparent: true, roughness: 0.5 })).translateY(0.29));

  const hat = new THREE.Group();
  const straw = mat(C.straw, { roughness: 0.9 });
  hat.add(mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.022, 48), straw, [0, 0.02, 0]));
  hat.add(mesh(new THREE.CylinderGeometry(0.115, 0.15, 0.15, 40), straw, [0, 0.1, 0]));
  hat.add(mesh(new THREE.CylinderGeometry(0.152, 0.152, 0.035, 40), navy, [0, 0.045, 0]));
  hat.position.y = 0.5;
  hat.rotation.set(-0.05, 0, 0.12);
  keeper.add(hat);

  const arm = (side: 1 | -1) => {
    const g = new THREE.Group();
    for (const a of [-0.45, 0, 0.45]) {
      const pivot = new THREE.Group();
      pivot.rotation.z = side * -(Math.PI / 2 + a);
      pivot.add(mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.17, 8), mat(C.mint, { roughness: 0.6 }), [0, 0.085, 0]));
      g.add(pivot);
    }
    g.position.set(side * 0.19, 0.24, 0);
    keeper.add(g);
    return g;
  };
  const arms = { left: arm(-1), right: arm(1) };
  keeper.position.set(1.66, 0.6, 0.55);
  keeper.scale.setScalar(1.2);
  keeper.rotation.y = 0.35;
  world.add(keeper);

  // Payment and refund pulses, from the QR card.
  const rings = [0, 1].map(() => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.007, 8, 48), new THREE.MeshBasicMaterial({ color: C.mint, transparent: true, opacity: 0 }));
    ring.position.copy(card.position);
    ring.rotation.copy(card.rotation);
    world.add(ring);
    return ring;
  });

  return { world, items, paints, keeper, arms, lanternCore, lanternLight, rings };
}

export default function StandScene({ step }: { step: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stepRef = useRef(step);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      return; // No WebGL: the poster under the canvas stays.
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    scene.environment = pmrem.fromScene(room, 0.04).texture;
    scene.environmentIntensity = 0.35;
    room.dispose();

    const css = getComputedStyle(document.documentElement);
    const fonts: Fonts = {
      hand: css.getPropertyValue("--font-kalam").trim() || "cursive",
      display: css.getPropertyValue("--font-outfit").trim() || "sans-serif",
    };
    const built = buildWorld(fonts);
    scene.add(built.world);
    let disposed = false;
    Promise.all([document.fonts.load(`700 40px ${fonts.hand}`), document.fonts.load(`800 40px ${fonts.display}`)])
      .then(() => !disposed && built.paints.forEach((p) => p.redraw()))
      .catch(() => {});

    const sun = new THREE.DirectionalLight("#ffffff", 2.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    Object.assign(sun.shadow.camera, { left: -3.4, right: 3.4, top: 3.4, bottom: -3.4, near: 0.5, far: 25 });
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);
    const hemi = new THREE.HemisphereLight("#ffffff", "#888888", 1);
    scene.add(hemi);

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);

    // Where everything is now; each frame eases it towards the active moment.
    const start = STATES[Math.min(stepRef.current, STATES.length - 1)];
    const now = {
      cam: new THREE.Vector3(...start.cam),
      look: new THREE.Vector3(...start.look),
      sunPos: new THREE.Vector3(...start.light.sunPos),
      skyTop: new THREE.Color(start.light.skyTop),
      skyLow: new THREE.Color(start.light.skyLow),
      sun: new THREE.Color(start.light.sun),
      hemiSky: new THREE.Color(start.light.hemiSky),
      hemiGround: new THREE.Color(start.light.hemiGround),
      sunIntensity: start.light.sunIntensity,
      hemiIntensity: start.light.hemiIntensity,
      lantern: start.light.lantern,
      exposure: start.light.exposure,
    };
    for (const item of built.items) item.s = item.shown(stepRef.current) ? 1 : 0;

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const resizer = new ResizeObserver(resize);
    resizer.observe(host);

    const target = { cam: new THREE.Vector3(), look: new THREE.Vector3(), sunPos: new THREE.Vector3(), color: new THREE.Color() };
    let shownStep = stepRef.current;
    let pulseAt = -10;
    let pulseColour = C.mint;
    let elapsed = 0;
    let last = performance.now();
    let raf = 0;
    let running = false;

    const render = (time: number) => {
      const dt = Math.min(0.05, (time - last) / 1000);
      last = time;
      elapsed += dt;
      const step = Math.min(stepRef.current, STATES.length - 1);
      if (step !== shownStep) {
        if (step === STEP.customer) [pulseAt, pulseColour] = [elapsed, C.mint];
        if (step === STEP.wrong) [pulseAt, pulseColour] = [elapsed, C.straw];
        shownStep = step;
      }
      const state = STATES[step];
      const k = reduced ? 1 : 1 - Math.exp(-dt * 2.2);

      now.cam.lerp(target.cam.set(...state.cam), k);
      now.look.lerp(target.look.set(...state.look), k);
      now.sunPos.lerp(target.sunPos.set(...state.light.sunPos), k);
      now.skyTop.lerp(target.color.set(state.light.skyTop), k);
      now.skyLow.lerp(target.color.set(state.light.skyLow), k);
      now.sun.lerp(target.color.set(state.light.sun), k);
      now.hemiSky.lerp(target.color.set(state.light.hemiSky), k);
      now.hemiGround.lerp(target.color.set(state.light.hemiGround), k);
      now.sunIntensity += (state.light.sunIntensity - now.sunIntensity) * k;
      now.hemiIntensity += (state.light.hemiIntensity - now.hemiIntensity) * k;
      now.lantern += (state.light.lantern - now.lantern) * k;
      now.exposure += (state.light.exposure - now.exposure) * k;

      host.style.background = `linear-gradient(180deg, #${now.skyTop.getHexString()} 0%, #${now.skyLow.getHexString()} 78%)`;
      renderer.toneMappingExposure = now.exposure;
      sun.color.copy(now.sun);
      sun.intensity = now.sunIntensity;
      sun.position.copy(now.sunPos);
      sun.target.position.set(0, 0.6, 0);
      hemi.color.copy(now.hemiSky);
      hemi.groundColor.copy(now.hemiGround);
      hemi.intensity = now.hemiIntensity;
      built.lanternLight.intensity = now.lantern * 4;
      (built.lanternCore.material as THREE.MeshStandardMaterial).emissiveIntensity = now.lantern * 3;

      // Goods taken from the shelf lift a little and shrink away.
      const kItems = reduced ? 1 : 1 - Math.exp(-dt * 3.2);
      for (const item of built.items) {
        item.s += ((item.shown(step) ? 1 : 0) - item.s) * kItems;
        item.obj.visible = item.s > 0.01;
        item.obj.scale.setScalar(Math.max(item.s, 0.001));
        item.obj.position.y = item.baseY + (1 - item.s) * 0.14;
      }

      if (!reduced) {
        built.keeper.position.y = 0.6 + Math.sin(elapsed * 1.8) * 0.008;
        const wave = step === STEP.customer ? Math.sin(elapsed * 6) * 0.35 : Math.sin(elapsed * 1.3) * 0.06;
        built.arms.right.rotation.z = wave;
        built.arms.left.rotation.z = -Math.sin(elapsed * 1.3 + 1) * 0.06;
        const tilt = step === STEP.wrong ? 0.12 : 0;
        built.keeper.rotation.z += (tilt - built.keeper.rotation.z) * k;
      }

      built.rings.forEach((ring, i) => {
        const t = elapsed - pulseAt - i * 0.35;
        const m = ring.material as THREE.MeshBasicMaterial;
        if (reduced || t < 0 || t > 1.4) {
          m.opacity = 0;
          return;
        }
        m.color.set(pulseColour);
        m.opacity = 1 - t / 1.4;
        ring.scale.setScalar(1 + t * 3);
      });

      // Narrow frames step the camera back so the stand still fits across.
      const fit = Math.min(1.5, Math.max(1, 1.05 / camera.aspect));
      const drift = reduced ? 0 : 1;
      camera.position.copy(now.cam).sub(now.look).multiplyScalar(fit).add(now.look);
      camera.position.x += Math.sin(elapsed * 0.25) * 0.12 * drift;
      camera.position.y += Math.sin(elapsed * 0.2) * 0.05 * drift;
      camera.lookAt(now.look);

      renderer.render(scene, camera);
      host.dataset.ready = "true";
      if (running) raf = requestAnimationFrame(render);
    };

    const play = () => {
      if (running || document.hidden) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(render);
    };
    const pause = () => {
      running = false;
      cancelAnimationFrame(raf);
    };
    let onScreen = false;
    const seen = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) play();
      else pause();
    });
    seen.observe(host);
    const onVisibility = () => (document.hidden ? pause() : onScreen && play());
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      pause();
      seen.disconnect();
      resizer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          for (const m of Array.isArray(obj.material) ? obj.material : [obj.material]) m.dispose();
        }
      });
      built.paints.forEach((p) => p.texture.dispose());
      scene.environment?.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className="absolute inset-0" />;
}
