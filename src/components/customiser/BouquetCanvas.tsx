'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import { useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import Flower3D from './Flower3D';
import { PROFILES, RIBBON_Y, Ribbon, Wrapper3D, radiusAt } from './Wrapper3D';
import type { BouquetItem, Catalogue, Flower, WrapStyle, Wrapper } from '@/lib/types';

const UP = new THREE.Vector3(0, 1, 0);
const BIND = new THREE.Vector3(0, -0.75, 0); // điểm thắt cuống
const STEM_GEO = new THREE.CylinderGeometry(1, 1, 1, 6);
const STEM_MAT = new THREE.MeshStandardMaterial({ color: '#4f7a3a', roughness: 0.8 });
const FILLERS = new Set(['baby', 'foliage']);

type Placed = { key: string; flower: Flower; head: THREE.Vector3; quaternion: THREE.Quaternion; foot: THREE.Vector3 };

export function bouquetRadius(n: number) {
  return Math.min(1.35, 0.2 + 0.2 * Math.sqrt(n));
}

/** Xếp hoa theo xoắn ốc vàng (phyllotaxis) trên một mái vòm; hoa phụ (baby, lá) ra vòng ngoài. */
function layoutBouquet(items: BouquetItem[], flowers: Flower[]): Placed[] {
  const instances: { key: string; flower: Flower }[] = [];
  for (const it of items) {
    const flower = flowers.find((f) => f.id === it.flowerId);
    if (!flower) continue;
    for (let k = 0; k < it.qty; k++) instances.push({ key: `${flower.id}#${k}`, flower });
  }
  instances.sort((a, b) => Number(FILLERS.has(a.flower.kind)) - Number(FILLERS.has(b.flower.kind)));

  const n = instances.length;
  const R = bouquetRadius(n);
  const golden = Math.PI * (3 - Math.sqrt(5));
  return instances.map((inst, i) => {
    const t = n === 1 ? 0 : Math.sqrt((i + 0.5) / n);
    const r = R * t;
    const a = i * golden;
    const x = r * Math.cos(a);
    const z = r * Math.sin(a);
    const y = 0.68 + 0.4 * (1 - t * t) + (inst.flower.kind === 'foliage' ? -0.08 : 0);
    const dir = new THREE.Vector3(x * 1.2, 1, z * 1.2).normalize();
    return {
      ...inst,
      head: new THREE.Vector3(x, y, z),
      quaternion: new THREE.Quaternion().setFromUnitVectors(UP, dir),
      foot: new THREE.Vector3(x * 0.12, -1.75, z * 0.12),
    };
  });
}

function Stem({ from, to }: { from: THREE.Vector3; to: THREE.Vector3 }) {
  const { position, quaternion, length } = useMemo(() => {
    const dir = new THREE.Vector3().subVectors(to, from);
    return {
      position: from.clone().add(to).multiplyScalar(0.5),
      quaternion: new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()),
      length: dir.length(),
    };
  }, [from, to]);
  return <mesh geometry={STEM_GEO} material={STEM_MAT} position={position} quaternion={quaternion} scale={[0.018, length, 0.018]} />;
}

/** Hiệu ứng "nảy" khi thêm hoa mới. */
function PopIn({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (g && g.scale.x < 1) g.scale.setScalar(Math.min(1, g.scale.x + 0.08));
  });
  return (
    <group ref={ref} scale={0.01}>
      {children}
    </group>
  );
}

type Props = {
  catalogue: Catalogue;
  items: BouquetItem[];
  wrapper?: Wrapper;
  style?: WrapStyle;
  ribbon: string;
  autoRotate: boolean;
  onCanvas: (el: HTMLCanvasElement) => void;
};

export default function BouquetCanvas({ catalogue, items, wrapper, style, ribbon, autoRotate, onCanvas }: Props) {
  const placed = useMemo(() => layoutBouquet(items, catalogue.flowers), [items, catalogue.flowers]);
  const R = bouquetRadius(placed.length);
  const shape = style?.shape ?? 'cone';
  const spread = Math.max(0.6, Math.min(1.1, (R + 0.3) / 1.5));
  const ribY = RIBBON_Y[shape];
  const ribR = radiusAt(PROFILES[shape], ribY) * spread + 0.01;

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 1.2, 5.6], fov: 40 }}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      onCreated={({ gl }) => onCanvas(gl.domElement)}
    >
      <color attach="background" args={['#fffaf6']} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#ffffff', '#f2d4c9', 0.7]} />
      <directionalLight position={[3, 6, 4]} intensity={1.3} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-4, 2, -3]} intensity={0.4} />

      <group position={[0, 0.25, 0]}>
        {wrapper && <Wrapper3D shape={shape} color={wrapper.color} opacity={wrapper.opacity} spread={spread} />}
        {placed.map((p) => (
          <group key={p.key}>
            <Stem from={p.head} to={BIND} />
            <Stem from={BIND} to={p.foot} />
            <group position={p.head} quaternion={p.quaternion}>
              <PopIn>
                <Flower3D flower={p.flower} />
              </PopIn>
            </group>
          </group>
        ))}
        <Ribbon y={ribY} radius={ribR} color={ribbon} />
      </group>

      <ContactShadows position={[0, -1.55, 0]} opacity={0.35} scale={6} blur={2.5} far={3} />
      <OrbitControls
        enablePan={false}
        minDistance={2.6}
        maxDistance={8}
        target={[0, 0.3, 0]}
        autoRotate={autoRotate}
        autoRotateSpeed={1.4}
        maxPolarAngle={Math.PI * 0.85}
      />
    </Canvas>
  );
}
