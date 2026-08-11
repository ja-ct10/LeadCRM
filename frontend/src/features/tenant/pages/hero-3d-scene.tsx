'use client';

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Html } from '@react-three/drei';
import * as THREE from 'three';
import { User, DollarSign, Calendar, Search, Bell, Settings, Plus } from 'lucide-react';

// Pipeline stages matching the actual app
const STAGES = [
  { name: 'Lead', color: '#3b82f6', value: '₱8,000', count: 1 },
  { name: 'Qualified', color: '#8b5cf6', value: '₱12,000', count: 1 },
  { name: 'Proposal', color: '#f59e0b', value: '₱45,000', count: 1 },
  { name: 'Negotiation', color: '#ec4899', value: '₱65,000', count: 1 },
  { name: 'Closed Won', color: '#10b981', value: '₱95,000', count: 1 }
];

// Deal card data
const DEAL = {
  title: 'Camxian Networks',
  contactPerson: 'Roberto Santos',
  companyName: 'Camxian Corp',
  value: 245000,
  priority: 'High',
  date: 'Aug 20',
  initials: 'RS'
};

interface DealCard3DProps {
  position: [number, number, number];
  highlight: boolean;
}

function DealCard3D({ position, highlight }: DealCard3DProps) {
  return (
    <group position={position} rotation={[-0.08, 0, 0]}>
      <Html
        transform
        distanceFactor={2.85}
        center
        style={{
          width: '250px',
          pointerEvents: 'none',
        }}
      >
        <div
          className={`bg-white rounded-xl p-4 border-2 transition-all duration-300 shadow-lg ${
            highlight
              ? 'border-blue-500 shadow-[0_0_25px_rgba(59,130,246,0.5)] scale-105'
              : 'border-gray-200 shadow-md'
          }`}
          style={{ fontSize: '12px' }}
        >
          <div className="flex items-start gap-2 mb-3">
            <div className="flex-1">
              <h4 className={`font-semibold text-sm leading-tight ${highlight ? 'text-blue-600' : 'text-slate-900'}`}>
                {DEAL.title}
              </h4>
              <div className="flex items-center text-[11px] text-slate-500 mt-1.5">
                <User size={11} className="mr-1.5" />
                <span className="truncate">{DEAL.contactPerson}</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded text-[11px] font-semibold">
              <DollarSign size={11} />
              ₱{DEAL.value.toLocaleString()}
            </span>
            <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border bg-red-50 text-red-600 border-red-200">
              {DEAL.priority}
            </span>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
              <Calendar size={11} />
              {DEAL.date}
            </span>
            <div className="w-6 h-6 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-[9px] font-bold text-blue-700">
              {DEAL.initials}
            </div>
          </div>
        </div>
      </Html>
    </group>
  );
}

interface PipelineUIProps {
  currentStage: number;
}

function PipelineUI({ currentStage }: PipelineUIProps) {
  return (
    <group position={[0, 1.2, -1.975]} rotation={[-0.08, 0, 0]}>
      <Html
        transform
        distanceFactor={2.85}
        style={{
          width: '1700px',
          pointerEvents: 'none',
          borderRadius: '16px',
          overflow: 'hidden',
        }}
      >
        <div className="bg-[#F8FAFC] min-h-175 p-6 rounded-2xl" style={{ fontSize: '11px' }}>
          {/* Top Navigation Bar */}
          <div className="bg-white border-b border-gray-200 px-4 py-3 mb-5 rounded-lg flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <img 
                  src="/leadcrm_logo.png" 
                  alt="LeadCRM" 
                  className="w-7 h-7 object-contain"
                />
                <span className="font-bold text-base text-slate-900">LeadCRM</span>
              </div>
              <span className="text-slate-400">|</span>
              <span className="font-semibold text-sm text-slate-700">Pipeline</span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search contacts, deals, campaigns..."
                  className="pl-8 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg w-72"
                  disabled
                />
              </div>
              <button className="p-2 hover:bg-gray-100 rounded-lg">
                <Bell size={16} className="text-slate-600" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg">
                <Settings size={16} className="text-slate-600" />
              </button>
              <div className="w-7 h-7 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-[10px] font-bold text-blue-700">
                CA
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4 mb-5">
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <div className="text-xs text-slate-500 mb-1.5">Active Open Deals</div>
              <div className="text-2xl font-bold text-slate-900">4</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <div className="text-xs text-slate-500 mb-1.5">Total Open Value</div>
              <div className="text-2xl font-bold text-slate-900">₱190,000</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <div className="text-xs text-slate-500 mb-1.5">Weighted Forecast</div>
              <div className="text-2xl font-bold text-emerald-600">₱132,600</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <div className="text-xs text-slate-500 mb-1.5">Closed Won Revenue</div>
              <div className="text-2xl font-bold text-emerald-600">₱95,000</div>
            </div>
          </div>

          {/* Pipeline Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">Sales Pipeline</span>
              <span className="text-sm text-slate-500">6</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm">
                <Plus size={14} />
                New Pipeline
              </button>
            </div>
          </div>

          {/* Pipeline Columns */}
          <div className="flex gap-4 overflow-x-auto pb-2">
            {STAGES.map((stage, index) => (
              <div
                key={stage.name}
                className={`shrink-0 w-68 bg-white rounded-xl border-2 p-4 transition-all shadow-sm ${
                  currentStage === index + 1
                    ? 'border-blue-500 bg-blue-50/30 shadow-blue-200'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                    <span className="text-sm font-semibold text-slate-900">{stage.name}</span>
                  </div>
                  <span className="text-xs font-medium bg-gray-100 text-slate-600 px-2.5 py-1 rounded-full">
                    {stage.count}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mb-4">{stage.value}</div>
                <div className="min-h-70 bg-gray-50/50 rounded-lg border-2 border-dashed border-gray-200" />
              </div>
            ))}
          </div>
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
  scale: number;
}

function Confetti({ active }: { active: boolean }) {
  const particlesRef = useRef<THREE.Group>(null);
  const [startTime] = React.useState(Date.now());
  
  const particles = useMemo<ConfettiParticle[]>(() => {
    const confettiColors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#10b981', '#eab308'];
    const particleArray: ConfettiParticle[] = [];
    
    // Spawn confetti OUTSIDE and ABOVE the laptop in 3D space
    // Positioned to fall around and in front of the laptop screen
    for (let i = 0; i < 100; i++) {
      particleArray.push({
        id: i,
        position: new THREE.Vector3(
          (Math.random() - 0.5) * 6,      // Wider horizontal spread
          3.0 + Math.random() * 2.0,      // Start high above laptop (y: 3-5)
          -1.0 + (Math.random() - 0.5) * 2  // In front of laptop (z: -2 to 0)
        ),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.2,    // Horizontal drift
          -0.02 - Math.random() * 0.03,   // Fall speed (downward)
          (Math.random() - 0.5) * 0.15    // Depth movement
        ),
        rotation: new THREE.Euler(
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2
        ),
        rotationSpeed: new THREE.Euler(
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.2
        ),
        color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
        scale: 1.0 + Math.random() * 0.8
      });
    }
    
    return particleArray;
  }, [active]);

  useFrame(() => {
    if (!particlesRef.current || !active || particles.length === 0) return;
    
    const elapsed = (Date.now() - startTime) / 1000; // Time in seconds
    
    particles.forEach((particle, i) => {
      const mesh = particlesRef.current?.children[i];
      if (!mesh) return;
      
      // Continue falling and rotating
      particle.position.add(particle.velocity);
      particle.rotation.x += particle.rotationSpeed.x;
      particle.rotation.y += particle.rotationSpeed.y;
      particle.rotation.z += particle.rotationSpeed.z;
      
      mesh.position.copy(particle.position);
      mesh.rotation.copy(particle.rotation);
      
      // Fade out based on elapsed time (disappear after 3 seconds)
      let opacity = 1.0;
      if (elapsed > 2.0) {
        opacity = Math.max(0, 1.0 - (elapsed - 2.0)); // Fade over 1 second
      }
      
      // Also fade based on Y position (fade as they fall below laptop)
      const heightOpacity = Math.max(0, Math.min(1, (particle.position.y + 1) / 4));
      opacity = Math.min(opacity, heightOpacity);
      
      if (mesh instanceof THREE.Mesh && mesh.material instanceof THREE.MeshBasicMaterial) {
        mesh.material.opacity = opacity;
      }
    });
  });

  if (!active || particles.length === 0) return null;

  return (
    <group ref={particlesRef}>
      {particles.map((particle) => (
        <mesh key={particle.id} position={particle.position} rotation={particle.rotation} scale={particle.scale}>
          {Math.random() > 0.5 ? (
            <planeGeometry args={[0.2, 0.5]} />
          ) : (
            <planeGeometry args={[0.3, 0.3]} />
          )}
          <meshBasicMaterial 
            color={particle.color} 
            transparent 
            opacity={1} 
            side={THREE.DoubleSide}
            depthWrite={false}
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
    laptopRef.current.position.y = Math.sin(clock.getElapsedTime() * 0.4) * 0.06;
    laptopRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.25) * 0.015;
  });

  return (
    <group ref={laptopRef} position={[0, 0, 0]}>
      {/* Laptop Base/Keyboard */}
      <mesh position={[0, -0.45, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <boxGeometry args={[6.5, 4.5, 0.06]} />
        <meshStandardMaterial color="#2d2d2d" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Screen Back */}
      <mesh position={[0, 1.2, -2.05]} rotation={[-0.08, 0, 0]}>
        <boxGeometry args={[6.5, 3.8, 0.03]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Screen Display Surface with rounded corners - maximized */}
      <mesh position={[0, 1.2, -2.0]} rotation={[-0.08, 0, 0]}>
        <planeGeometry args={[6.45, 3.75]} />
        <meshStandardMaterial color="#F8FAFC" />
      </mesh>
    </group>
  );
}

function PipelineScene() {
  const [animationPhase, setAnimationPhase] = React.useState(0);
  const [dealPosition, setDealPosition] = React.useState<[number, number, number]>([-2.6, 0.35, -1.96]);
  const [showCelebration, setShowCelebration] = React.useState(false);
  
  // Column positions calculated to align with UI overlay columns
  // UI overlay is at [0, 1.2, -1.975] with distanceFactor 2.85
  // Each column is 68px (272px at distanceFactor) + 16px gap = 288px spacing
  // Starting X offset for first column calculated from HTML layout
  // Y = 0.35 positions card in the drop zone area (below headers)
  // Z = -1.96 places card just in front of UI overlay at -1.975
  const columnPositions: [number, number, number][] = [
    [-2.6, 0.35, -1.96],   // Lead column (leftmost)
    [-1.3, 0.35, -1.96],   // Qualified column
    [0.0, 0.35, -1.96],    // Proposal column (center)
    [1.3, 0.35, -1.96],    // Negotiation column
    [2.6, 0.35, -1.96]     // Closed Won column (rightmost)
  ];

  React.useEffect(() => {
    const totalDuration = 12000;
    const phaseTimings = [
      { phase: 0, time: 0 },
      { phase: 1, time: 2000 },
      { phase: 2, time: 4000 },
      { phase: 3, time: 6000 },
      { phase: 4, time: 8000 },
      { phase: 5, time: 10000 },
      { phase: 6, time: 11000 }
    ];

    let currentPhaseIndex = 0;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = (Date.now() - startTime) % totalDuration;
      const newPhaseData = phaseTimings.find(
        (p, i) => elapsed >= p.time && (i === phaseTimings.length - 1 || elapsed < phaseTimings[i + 1].time)
      );

      if (newPhaseData && newPhaseData.phase !== currentPhaseIndex) {
        currentPhaseIndex = newPhaseData.phase;
        setAnimationPhase(currentPhaseIndex);
        
        if (currentPhaseIndex >= 1 && currentPhaseIndex <= 4) {
          setDealPosition(columnPositions[currentPhaseIndex]);
        } else if (currentPhaseIndex === 5) {
          setShowCelebration(true);
        } else if (currentPhaseIndex === 6) {
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
    <group>
      <Laptop />
      <PipelineUI currentStage={animationPhase} />
      <DealCard3D position={dealPosition} highlight={animationPhase >= 1 && animationPhase <= 4} />
      <Confetti active={showCelebration} />
      {showCelebration && (
        <group position={[0, 3.5, 0]}>
          <Html transform distanceFactor={3.5} center style={{ width: '280px', pointerEvents: 'none' }}>
            <div className="bg-linear-to-r from-emerald-500 to-green-500 text-white px-5 py-3 rounded-2xl text-sm font-bold text-center shadow-2xl border-3 border-white animate-bounce">
              🎉 Deal Closed Won! 🎉
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
    // Adjusted camera to focus on the laptop screen and eliminate black spaces
    camera.position.set(0, 1.2, 6.8);
    camera.lookAt(0, 1.2, -1.8);
  }, [camera]);

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 1.2, 6.8]} fov={45} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={1.2} castShadow />
      <directionalLight position={[-10, 5, -5]} intensity={0.5} />
      <pointLight position={[0, 4, 2]} intensity={0.9} color="#ffffff" />
      <spotLight position={[0, 5, 0]} angle={0.6} penumbra={0.5} intensity={0.8} castShadow />
      <PipelineScene />
      <mesh position={[0, 0, -6]}>
        <planeGeometry args={[70, 70]} />
        <meshBasicMaterial color="#030712" />
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
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent' }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
