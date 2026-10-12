'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Flower, FlowerKind } from '@/lib/types';

// Hình học dùng chung để tiết kiệm bộ nhớ
const PETAL = new THREE.SphereGeometry(1, 14, 10);
const BALL = new THREE.SphereGeometry(1, 16, 12);
const DISC = new THREE.CylinderGeometry(1, 1, 1, 24);
const CALYX_MAT = new THREE.MeshStandardMaterial({ color: '#4f7a3a', roughness: 0.7 });

type Ring = { count: number; length: number; width: number; tilt: number; radius: number; offset?: number; y?: number };
type Spec = {
  size: number;
  rings?: Ring[];
  centre?: { type: 'ball' | 'disc'; r: number; h?: number; flat?: number };
  cluster?: { count: number; r: number; spread: number };
};

/** Mỗi loại hoa = các vòng cánh (elipsoid) + nhụy, hoặc một chùm bông nhỏ. */
export const SPECS: Record<FlowerKind, Spec> = {
  rose: {
    size: 1,
    rings: [
      { count: 5, length: 0.15, width: 0.13, tilt: 1.25, radius: 0.02, y: 0.04 },
      { count: 6, length: 0.19, width: 0.15, tilt: 0.95, radius: 0.04, offset: 0.5 },
      { count: 7, length: 0.23, width: 0.17, tilt: 0.65, radius: 0.06, offset: 0.2, y: -0.02 },
    ],
    centre: { type: 'ball', r: 0.06, flat: 1.2 },
  },
  tulip: {
    size: 1,
    rings: [
      { count: 3, length: 0.3, width: 0.17, tilt: 1.38, radius: 0.03 },
      { count: 3, length: 0.29, width: 0.17, tilt: 1.3, radius: 0.05, offset: Math.PI / 3 },
    ],
  },
  sunflower: {
    size: 1.15,
    rings: [
      { count: 16, length: 0.2, width: 0.07, tilt: 0.12, radius: 0.13 },
      { count: 16, length: 0.18, width: 0.07, tilt: 0.22, radius: 0.12, offset: 0.2, y: -0.01 },
    ],
    centre: { type: 'disc', r: 0.14, h: 0.05 },
  },
  daisy: {
    size: 1,
    rings: [{ count: 16, length: 0.14, width: 0.035, tilt: 0.08, radius: 0.045 }],
    centre: { type: 'ball', r: 0.05, flat: 0.5 },
  },
  carnation: {
    size: 1,
    rings: [
      { count: 9, length: 0.12, width: 0.11, tilt: 1.0, radius: 0.01, y: 0.03 },
      { count: 12, length: 0.16, width: 0.12, tilt: 0.6, radius: 0.03, offset: 0.25 },
      { count: 14, length: 0.19, width: 0.1, tilt: 0.25, radius: 0.05, offset: 0.1, y: -0.02 },
    ],
  },
  hydrangea: { size: 1.2, cluster: { count: 26, r: 0.055, spread: 0.22 } },
  baby: { size: 1, cluster: { count: 18, r: 0.024, spread: 0.2 } },
  orchid: {
    size: 1.1,
    rings: [{ count: 5, length: 0.21, width: 0.15, tilt: 0.12, radius: 0.02 }],
    centre: { type: 'ball', r: 0.05, flat: 0.8 },
  },
  foliage: {
    size: 1.1,
    rings: [
      { count: 4, length: 0.32, width: 0.12, tilt: 0.7, radius: 0.02 },
      { count: 4, length: 0.26, width: 0.13, tilt: 0.95, radius: 0.02, offset: 0.78, y: 0.1 },
    ],
  },
};

function useMaterial(color: string) {
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color, roughness: 0.55, side: THREE.DoubleSide }),
    [color],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return mat;
}

function PetalRing({ ring, material }: { ring: Ring; material: THREE.Material }) {
  const angles = useMemo(
    () => Array.from({ length: ring.count }, (_, i) => (i / ring.count) * Math.PI * 2 + (ring.offset ?? 0)),
    [ring.count, ring.offset],
  );
  return (
    <group position={[0, ring.y ?? 0, 0]}>
      {angles.map((a, i) => (
        <group key={i} rotation={[0, a, 0]}>
          <group position={[ring.radius, 0, 0]} rotation={[0, 0, ring.tilt]}>
            <mesh
              geometry={PETAL}
              material={material}
              position={[ring.length / 2, 0, 0]}
              scale={[ring.length / 2, 0.018, ring.width / 2]}
              castShadow
            />
          </group>
        </group>
      ))}
    </group>
  );
}

function Cluster({ count, r, spread, a, b }: { count: number; r: number; spread: number; a: THREE.Material; b: THREE.Material }) {
  const points = useMemo(() => {
    const golden = Math.PI * (3 - Math.sqrt(5));
    return Array.from({ length: count }, (_, i) => {
      const y = 1 - (i / Math.max(1, count - 1)) * 0.75;
      const rad = Math.sqrt(1 - y * y);
      const t = golden * i;
      return [Math.cos(t) * rad * spread, y * spread * 0.6 - spread * 0.25, Math.sin(t) * rad * spread] as [number, number, number];
    });
  }, [count, spread]);
  return (
    <>
      {points.map((p, i) => (
        <mesh key={i} geometry={BALL} material={i % 3 === 0 ? b : a} position={p} scale={r} castShadow />
      ))}
    </>
  );
}

/** Đầu hoa, hướng mặt hoa theo trục +Y. */
export default function Flower3D({ flower }: { flower: Flower }) {
  const spec = SPECS[flower.kind] ?? SPECS.rose;
  const petal = useMaterial(flower.color);
  const accent = useMaterial(flower.accent_color);

  return (
    <group scale={spec.size * 1.35}>
      {flower.kind !== 'foliage' && <mesh geometry={BALL} material={CALYX_MAT} position={[0, -0.05, 0]} scale={0.04} />}
      {spec.rings?.map((ring, i) => <PetalRing key={i} ring={ring} material={petal} />)}
      {spec.cluster && <Cluster {...spec.cluster} a={petal} b={accent} />}
      {spec.centre?.type === 'ball' && (
        <mesh geometry={BALL} material={accent} position={[0, 0.02, 0]} scale={[spec.centre.r, spec.centre.r * (spec.centre.flat ?? 1), spec.centre.r]} />
      )}
      {spec.centre?.type === 'disc' && (
        <mesh geometry={DISC} material={accent} position={[0, 0.01, 0]} scale={[spec.centre.r, spec.centre.h ?? 0.05, spec.centre.r]} />
      )}
    </group>
  );
}
