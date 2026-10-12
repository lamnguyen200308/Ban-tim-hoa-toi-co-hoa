'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { WrapShape } from '@/lib/types';

/** Mặt cắt (bán kính, cao độ) của giấy gói, xoay quanh trục Y bằng LatheGeometry. */
export const PROFILES: Record<WrapShape, [number, number][]> = {
  cone: [[0.1, -1.75], [0.18, -1.35], [0.42, -0.8], [0.8, -0.15], [1.15, 0.4], [1.3, 0.6]],
  round: [[0.1, -1.75], [0.22, -1.3], [0.6, -0.75], [1.15, -0.15], [1.55, 0.25], [1.75, 0.45]],
  handtied: [[0.13, -1.3], [0.15, -1.0], [0.2, -0.55]],
};

/** Cao độ thắt ruy băng cho từng kiểu gói. */
export const RIBBON_Y: Record<WrapShape, number> = { cone: -1.0, round: -1.05, handtied: -0.75 };

/** Bán kính giấy gói tại cao độ y (nội suy tuyến tính). */
export function radiusAt(profile: [number, number][], y: number) {
  for (let i = 0; i < profile.length - 1; i++) {
    const [r1, y1] = profile[i];
    const [r2, y2] = profile[i + 1];
    if (y >= y1 && y <= y2) return r1 + ((y - y1) / (y2 - y1)) * (r2 - r1);
  }
  return profile[profile.length - 1][0];
}

function PaperLayer({
  points,
  color,
  opacity,
  segments,
  phiStart = 0,
  phiLength = Math.PI * 2,
  scale = 1,
}: {
  points: [number, number][];
  color: string;
  opacity: number;
  segments: number;
  phiStart?: number;
  phiLength?: number;
  scale?: number;
}) {
  const geo = useMemo(
    () => new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments, phiStart, phiLength),
    [points, segments, phiStart, phiLength],
  );
  useEffect(() => () => geo.dispose(), [geo]);
  const transparent = opacity < 1;
  return (
    <mesh geometry={geo} scale={[scale, 1, scale]} castShadow receiveShadow>
      <meshStandardMaterial
        color={color}
        side={THREE.DoubleSide}
        flatShading
        roughness={0.85}
        transparent={transparent}
        opacity={opacity}
        depthWrite={!transparent}
      />
    </mesh>
  );
}

/** Giấy gói nhiều lớp; ít phân đoạn + flatShading tạo cảm giác nếp gấp. */
export function Wrapper3D({ shape, color, opacity, spread }: { shape: WrapShape; color: string; opacity: number; spread: number }) {
  const pts = PROFILES[shape];
  const light = useMemo(
    () => '#' + new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.18).getHexString(),
    [color],
  );
  return (
    <group scale={[spread, 1, spread]}>
      {shape === 'handtied' ? (
        <PaperLayer points={pts} color={color} opacity={opacity} segments={10} />
      ) : (
        <>
          <PaperLayer points={pts} color={color} opacity={opacity} segments={7} phiStart={0.3} phiLength={Math.PI * 1.82} />
          <PaperLayer points={pts} color={light} opacity={opacity} segments={9} phiStart={2.2} phiLength={Math.PI * 1.6} scale={1.05} />
          {shape === 'round' && (
            <PaperLayer points={pts} color="#ffffff" opacity={Math.min(1, opacity + 0.2)} segments={11} phiStart={1.2} phiLength={Math.PI * 1.9} scale={0.93} />
          )}
        </>
      )}
    </group>
  );
}

/** Ruy băng quấn quanh + nơ phía trước. */
export function Ribbon({ y, radius, color }: { y: number; radius: number; color: string }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.1 }), [color]);
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <group position={[0, y, 0]}>
      <mesh material={mat} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, 0.035, 10, 48]} />
      </mesh>
      <group position={[0, 0, radius + 0.02]}>
        <mesh material={mat} position={[-0.12, 0.02, 0]} rotation={[0, 0, 0.5]} scale={[1.6, 0.8, 0.5]}>
          <torusGeometry args={[0.07, 0.025, 8, 24]} />
        </mesh>
        <mesh material={mat} position={[0.12, 0.02, 0]} rotation={[0, 0, -0.5]} scale={[1.6, 0.8, 0.5]}>
          <torusGeometry args={[0.07, 0.025, 8, 24]} />
        </mesh>
        <mesh material={mat} scale={0.045}>
          <sphereGeometry args={[1, 12, 12]} />
        </mesh>
        <mesh material={mat} position={[-0.06, -0.16, 0]} rotation={[0, 0, 0.25]}>
          <boxGeometry args={[0.06, 0.28, 0.01]} />
        </mesh>
        <mesh material={mat} position={[0.06, -0.16, 0]} rotation={[0, 0, -0.25]}>
          <boxGeometry args={[0.06, 0.28, 0.01]} />
        </mesh>
      </group>
    </group>
  );
}
