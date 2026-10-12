'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ElementRef, type ReactNode } from 'react';
import * as THREE from 'three';
import Flower3D from './Flower3D';
import { PROFILES, RIBBON_Y, Ribbon, Wrapper3D, radiusAt } from './Wrapper3D';
import type { BouquetItem, Catalogue, Flower, FlowerPositions, HeadPos, WrapStyle, Wrapper } from '@/lib/types';

const UP = new THREE.Vector3(0, 1, 0);
const BIND = new THREE.Vector3(0, -0.75, 0); // điểm thắt cuống
const STEM_GEO = new THREE.CylinderGeometry(1, 1, 1, 6);
const STEM_MAT = new THREE.MeshStandardMaterial({ color: '#4f7a3a', roughness: 0.8 });
const FILLERS = new Set(['baby', 'foliage']);
const GROUP_Y = 0.25; // bó hoa được đặt cao hơn gốc toạ độ một chút
const HEAD_MIN_Y = 0.3;
const HEAD_MAX_Y = 1.45;
const HALO_GEO = new THREE.TorusGeometry(0.27, 0.014, 8, 40);
const HALO_MAT = new THREE.MeshBasicMaterial({ color: '#2563eb', transparent: true, opacity: 0.9, depthTest: false });
const HIT_GEO = new THREE.SphereGeometry(0.22, 10, 8);
const HIT_MAT = new THREE.MeshBasicMaterial({ visible: false });

type Placed = {
  key: string;
  flower: Flower;
  head: THREE.Vector3;
  quaternion: THREE.Quaternion;
  foot: THREE.Vector3;
  custom: boolean;
};

export function bouquetRadius(n: number) {
  return Math.min(1.35, 0.2 + 0.2 * Math.sqrt(n));
}

/** Giữ bông hoa trong vòng bó (không bay ra ngoài giấy gói). */
export function clampHead([x, y, z]: HeadPos, stems: number): HeadPos {
  const maxR = bouquetRadius(stems) * 1.1 + 0.1;
  const r = Math.hypot(x, z);
  const k = r > maxR ? maxR / r : 1;
  return [x * k, Math.min(HEAD_MAX_Y, Math.max(HEAD_MIN_Y, y)), z * k];
}

function placeAt(head: THREE.Vector3) {
  const dir = new THREE.Vector3(head.x * 1.2, 1, head.z * 1.2).normalize();
  return {
    head,
    quaternion: new THREE.Quaternion().setFromUnitVectors(UP, dir),
    foot: new THREE.Vector3(head.x * 0.12, -1.75, head.z * 0.12),
  };
}

/**
 * Xếp hoa theo xoắn ốc vàng (phyllotaxis) trên một mái vòm; hoa phụ (baby, lá) ra vòng ngoài.
 * Bông nào khách đã tự đặt vị trí thì dùng vị trí đó.
 */
function layoutBouquet(items: BouquetItem[], flowers: Flower[], positions: FlowerPositions): Placed[] {
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
    const own = positions[inst.key];
    const head = own ? new THREE.Vector3(...clampHead(own, n)) : new THREE.Vector3(x, y, z);
    return { ...inst, ...placeAt(head), custom: Boolean(own) };
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
  positions: FlowerPositions;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onMove: (key: string, pos: HeadPos) => void;
  /** Cho giao diện bên ngoài đọc vị trí hiện tại của một bông (kể cả bông chưa được tự đặt). */
  headOf?: (fn: (key: string) => HeadPos | undefined) => void;
};

type Drag = { key: string; pointerId: number; plane: THREE.Plane; offset: THREE.Vector3 };

export default function BouquetCanvas({
  catalogue,
  items,
  wrapper,
  style,
  ribbon,
  autoRotate,
  onCanvas,
  positions,
  selectedKey,
  onSelect,
  onMove,
  headOf,
}: Props) {
  const placed = useMemo(() => layoutBouquet(items, catalogue.flowers, positions), [items, catalogue.flowers, positions]);
  const controls = useRef<ElementRef<typeof OrbitControls>>(null);
  const drag = useRef<Drag | null>(null);
  const hit = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    headOf?.((key) => {
      const p = placed.find((q) => q.key === key);
      return p ? [p.head.x, p.head.y, p.head.z] : undefined;
    });
  }, [placed, headOf]);

  // Kéo bông hoa trên mặt phẳng hướng về camera: kéo ngang = dịch trái/phải, kéo dọc = nâng/hạ.
  // Xoay bó hoa sang góc khác để dịch theo hướng còn lại.
  const startDrag = (e: ThreeEvent<PointerEvent>, p: Placed) => {
    e.stopPropagation();
    onSelect(p.key);
    const world = p.head.clone().add(new THREE.Vector3(0, GROUP_Y, 0));
    const normal = e.camera.getWorldDirection(new THREE.Vector3());
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, world);
    if (!e.ray.intersectPlane(plane, hit)) return;
    drag.current = { key: p.key, pointerId: e.pointerId, plane, offset: world.clone().sub(hit) };
    if (controls.current) controls.current.enabled = false;
    (e.target as unknown as Element).setPointerCapture?.(e.pointerId);
    document.body.style.cursor = 'grabbing';
  };

  const moveDrag = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    e.stopPropagation();
    if (!e.ray.intersectPlane(d.plane, hit)) return;
    const w = hit.clone().add(d.offset);
    onMove(d.key, clampHead([w.x, w.y - GROUP_Y, w.z], placed.length));
  };

  const endDrag = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    if (controls.current) controls.current.enabled = true;
    (e.target as unknown as Element).releasePointerCapture?.(e.pointerId);
    document.body.style.cursor = 'grab';
  };
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
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={['#eef3f9']} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#ffffff', '#cfdcea', 0.7]} />
      <directionalLight position={[3, 6, 4]} intensity={1.3} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-4, 2, -3]} intensity={0.4} />

      <group position={[0, GROUP_Y, 0]}>
        {wrapper && <Wrapper3D shape={shape} color={wrapper.color} opacity={wrapper.opacity} spread={spread} />}
        {placed.map((p) => (
          <group key={p.key}>
            <Stem from={p.head} to={BIND} />
            <Stem from={BIND} to={p.foot} />
            <group
              position={p.head}
              quaternion={p.quaternion}
              onPointerDown={(e) => startDrag(e, p)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onPointerOver={(e) => {
                e.stopPropagation();
                if (!drag.current) document.body.style.cursor = 'grab';
              }}
              onPointerOut={() => {
                if (!drag.current) document.body.style.cursor = '';
              }}
            >
              <PopIn>
                <Flower3D flower={p.flower} />
              </PopIn>
              {/* vùng bấm rộng hơn bông hoa một chút để dễ chạm trên điện thoại */}
              <mesh geometry={HIT_GEO} material={HIT_MAT} position={[0, 0.03, 0]} />
              {selectedKey === p.key && (
                <mesh geometry={HALO_GEO} material={HALO_MAT} rotation={[Math.PI / 2, 0, 0]} renderOrder={10} />
              )}
            </group>
          </group>
        ))}
        <Ribbon y={ribY} radius={ribR} color={ribbon} />
      </group>

      <ContactShadows position={[0, -1.55, 0]} opacity={0.35} scale={6} blur={2.5} far={3} />
      <OrbitControls
        ref={controls}
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
