'use client';

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Html } from '@react-three/drei';
import * as THREE from 'three';

// LeadCRM approved color palette
const COLORS = {
  background: '#080616',
  surface: '#1A1953',
  secondary: '#162E93',
  accent: '#2F2FE4',
};

// Pipeline stages
const STAGES = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won'];

// Deal data
const DEALS = [
  { name: 'Camxian Networks', amount: '₱245,000' },
  { name: 'APX Security', amount: '₱320,000' },
  { name: 'TelePH Corp', amount: '₱1,240,000' },
  { name: 'DataStar Systems', amount: '₱890,000' },
  { name: 'Velox Telecom', amount: '₱167,500' },
];

interface DealCardProps {
  name: string;
  amount: string;
  position: [number, number, number];
  scale: number;
  highlight: boolean;
}

function DealCard({ name, amount, position, scale, highlight }: DealCardProps) {
  return (
    <group position={position} scale={scale}>
      <Html
        transform
        distanceFactor={5}
        style={{
          width: '200px',
          pointerEvents: 'none',
        }}
      >
        <div
          className={`bg-white/95 backdrop-blur-xl rounded-xl p-4 border transition-all duration-300 ${
            highlight
              ? 'border-[#2F2FE4] shadow-lg shadow-[#2F2FE4]/30 scale-105'
              : 'border-gray-200'
          }`}
        >
          <div className="text-xs font-semibold text-slate-900 mb-1">{name}</div>
          <div className="text-lg font-bold text-[#2F2FE4]">{amount}</div>
        </div>
      </Html>
    </group>
  );
}

interface PipelineColumnProps {
  stage: string;
  position: [number, number, number];
}

function PipelineColumn({ stage, position }: PipelineColumnProps) {
  return (
    <group position={position}>
      <Html
        transform
        distanceFactor={5}
        style={{
          width: '180px',
          pointerEvents: 'none',
        }}
      >
        <div className="bg-white/5 backdrop-blur-sm rounded-lg p-3 border border-white/10">
          <div className="text-xs font-bold text-white/90 uppercase tracking-wide mb-2">
            {stage}
          </div>
          <div className="h-40 bg-white/5 rounded border border-dashed border-white/20" />
        </div>
      </Html>
    </group>
  );
}

interface ConfettiParticle {
  id: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;
  rotationSpeed: THREE.Euler;
  color: string;
  shape: 'strip' | 'square';
}

function Confetti({ active }: { active: boolean }) {
  const particlesRef = useRef<THREE.Group>(null);
  const particles = useMemo<ConfettiParticle[]>(() => {
    if (!active) return [];
    
    const confettiColors = ['#2F2FE4', '#162E93', '#1A1953'];
    const particleArray: ConfettiParticle[] = [];
    
    for (let i = 0; i < 30; i++) {
      particleArray.push({
        id: i,
        position: new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          3 + Math.random() * 2,
          (Math.random() - 0.5) * 2
        ),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.1,
          -0.02 - Math.random() * 0.03,
          (Math.random() - 0.5) * 0.1
        ),
        rotation: new THREE.Euler(
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2
        ),
        rotationSpeed: new THREE.Euler(
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1
        ),
        color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
        shape: Math.random() > 0.5 ? 'strip' : 'square',
      });
    }
    
    return particleArray;
  }, [active]);

  useFrame(() => {
    if (!particlesRef.current || !active) return;
    
    particles.forEach((particle, i) => {
      const mesh = particlesRef.current?.children[i];
      if (!mesh) return;
      
      particle.position.add(particle.velocity);
      particle.rotation.x += particle.rotationSpeed.x;
      particle.rotation.y += particle.rotationSpeed.y;
      particle.rotation.z += particle.rotationSpeed.z;
      
      mesh.position.copy(particle.position);
      mesh.rotation.copy(particle.rotation);
      
      // Fade out as it falls
      const opacity = Math.max(0, (particle.position.y + 2) / 5);
      if (mesh instanceof THREE.Mesh && mesh.material instanceof THREE.MeshBasicMaterial) {
        mesh.material.opacity = opacity;
      }
    });
  });

  if (!active) return null;

  return (
    <group ref={particlesRef}>
      {particles.map((particle) => (
        <mesh key={particle.id} position={particle.position} rotation={particle.rotation}>
          {particle.shape === 'strip' ? (
            <planeGeometry args={[0.1, 0.3]} />
          ) : (
            <planeGeometry args={[0.15, 0.15]} />
          )}
          <meshBasicMaterial
            color={particle.color}
            transparent
            opacity={1}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

function Laptop() {
  const laptopRef = useRef<THREE.Group>(null);
  
  useFrame(({ clock }) => {
    if (!laptopRef.current) return;
    
    // Subtle floating animation
    laptopRef.current.position.y = Math.sin(clock.getElapsedTime() * 0.5) * 0.1;
    
    // Subtle rotation
    laptopRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.3) * 0.03;
  });

  return (
    <group ref={laptopRef} position={[0, 0, 0]}>
      {/* Laptop base */}
      <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <boxGeometry args={[4, 3, 0.1]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Laptop screen */}
      <mesh position={[0, 0.8, -1.4]} rotation={[-0.2, 0, 0]}>
        <boxGeometry args={[4, 2.5, 0.05]} />
        <meshStandardMaterial color="#0a0a0a" metalness={0.9} roughness={0.1} />
      </mesh>
      
      {/* Screen bezel */}
      <mesh position={[0, 0.8, -1.37]}>
        <planeGeometry args={[3.8, 2.3]} />
        <meshStandardMaterial color="#080616" emissive={COLORS.background} emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

function PipelineScene() {
  const [animationPhase, setAnimationPhase] = React.useState(0);
  const [dealPosition, setDealPosition] = React.useState<[number, number, number]>([-3, 1, -1]);
  const [showCelebration, setShowCelebration] = React.useState(false);
  const groupRef = useRef<THREE.Group>(null);
  
  // Column positions
  const columnPositions: [number, number, number][] = [
    [-3, 1, -1],    // Lead
    [-1.5, 1, -1],  // Qualified
    [0, 1, -1],     // Proposal
    [1.5, 1, -1],   // Negotiation
    [3, 1, -1],     // Closed Won
  ];

  React.useEffect(() => {
    const totalDuration = 12000; // 12 seconds
    const phaseTimings = [
      { phase: 0, time: 0, duration: 2000 },      // 0-2s: Idle
      { phase: 1, time: 2000, duration: 2000 },   // 2-4s: Lead → Qualified
      { phase: 2, time: 4000, duration: 2000 },   // 4-6s: Qualified → Proposal
      { phase: 3, time: 6000, duration: 2000 },   // 6-8s: Proposal → Negotiation
      { phase: 4, time: 8000, duration: 2000 },   // 8-10s: Negotiation → Closed Won
      { phase: 5, time: 10000, duration: 1000 },  // 10-11s: Celebration
      { phase: 6, time: 11000, duration: 1000 },  // 11-12s: Reset
    ];

    let currentPhaseIndex = 0;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = (Date.now() - startTime) % totalDuration;
      
      // Find current phase
      const newPhaseData = phaseTimings.find(
        (p, i) =>
          elapsed >= p.time &&
          (i === phaseTimings.length - 1 || elapsed < phaseTimings[i + 1].time)
      );

      if (newPhaseData && newPhaseData.phase !== currentPhaseIndex) {
        currentPhaseIndex = newPhaseData.phase;
        setAnimationPhase(currentPhaseIndex);
        
        if (currentPhaseIndex >= 1 && currentPhaseIndex <= 4) {
          // Move card
          setDealPosition(columnPositions[currentPhaseIndex]);
        } else if (currentPhaseIndex === 5) {
          // Show celebration
          setShowCelebration(true);
        } else if (currentPhaseIndex === 6) {
          // Reset
          setShowCelebration(false);
          setDealPosition(columnPositions[0]);
        }
      }

      requestAnimationFrame(animate);
    };

    const animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, []);

  return (
    <group ref={groupRef}>
      {/* Laptop */}
      <Laptop />
      
      {/* Pipeline columns on screen */}
      {STAGES.map((stage, index) => (
        <PipelineColumn
          key={stage}
          stage={stage}
          position={columnPositions[index]}
        />
      ))}
      
      {/* Animated deal card */}
      <DealCard
        name={DEALS[0].name}
        amount={DEALS[0].amount}
        position={dealPosition}
        scale={1}
        highlight={animationPhase >= 1 && animationPhase <= 4}
      />
      
      {/* Celebration confetti */}
      <Confetti active={showCelebration} />
      
      {/* Success badge */}
      {showCelebration && (
        <group position={[0, 2, 0]}>
          <Html
            transform
            distanceFactor={5}
            style={{
              width: '150px',
              pointerEvents: 'none',
            }}
          >
            <div className="bg-emerald-500 text-white px-4 py-2 rounded-full text-xs font-bold text-center shadow-lg animate-pulse">
              🎉 Deal Closed!
            </div>
          </Html>
        </group>
      )}
    </group>
  );
}

function Scene() {
  const { camera } = useThree();
  
  React.useEffect(() => {
    camera.position.set(0, 1.5, 8);
    camera.lookAt(0, 0.5, 0);
  }, [camera]);

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 1.5, 8]} fov={35} />
      
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} castShadow />
      <directionalLight position={[-10, 5, -5]} intensity={0.3} />
      <pointLight position={[0, 3, 2]} intensity={0.5} color={COLORS.accent} />
      
      {/* Pipeline scene */}
      <PipelineScene />
      
      {/* Background */}
      <mesh position={[0, 0, -5]}>
        <planeGeometry args={[50, 50]} />
        <meshBasicMaterial color={COLORS.background} />
      </mesh>
    </>
  );
}

interface Hero3DSceneProps {
  className?: string;
}

export default function Hero3DScene({ className = '' }: Hero3DSceneProps) {
  return (
    <div className={`w-full h-full ${className}`}>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        style={{
          background: 'transparent',
        }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
