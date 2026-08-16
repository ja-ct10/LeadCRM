'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import * as THREE from 'three';

/**
 * LeadCRM 3D Hero Animation
 * 
 * A premium 3D floating laptop showing an animated pipeline workflow.
 * Deal cards move through stages: Lead → Qualified → Proposal → Negotiation → Closed Won
 * 
 * Timeline: 12-second seamless loop
 * - 0-2s: Idle state with gentle floating
 * - 2-4s: Lead → Qualified
 * - 4-6s: Qualified → Proposal
 * - 6-8s: Proposal → Negotiation
 * - 8-10s: Negotiation → Closed Won
 * - 10-11s: Mini celebration (confetti)
 * - 11-12s: Reset to loop
 */

// ============================================================================
// TYPES & DATA
// ============================================================================

interface DealCard {
  id: string;
  company: string;
  amount: string;
  stage: 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won';
}

const STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won'] as const;

const STAGE_LABELS = {
  lead: 'Lead',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Closed Won',
};

const DEALS: DealCard[] = [
  { id: '1', company: 'Camxian Networks', amount: '₱245,000', stage: 'lead' },
  { id: '2', company: 'APX Security', amount: '₱320,000', stage: 'qualified' },
  { id: '3', company: 'TelePH Corp', amount: '₱1,240,000', stage: 'proposal' },
  { id: '4', company: 'DataStar Systems', amount: '₱890,000', stage: 'negotiation' },
  { id: '5', company: 'Velox Telecom', amount: '₱167,500', stage: 'lead' },
];

// LeadCRM Dark Theme Colors
const COLORS = {
  background: '#080616',
  surface: '#1A1953',
  secondary: '#162E93',
  accent: '#2F2FE4',
  text: '#FFFFFF',
  textSecondary: '#94A3B8',
};

// ============================================================================
// 3D LAPTOP MODEL
// ============================================================================

function Laptop({ children }: { children: React.ReactNode }) {
  const laptopRef = useRef<THREE.Group>(null);
  const [time, setTime] = useState(0);

  useFrame((state, delta) => {
    setTime((t) => t + delta);
    
    if (laptopRef.current) {
      // Gentle floating motion (0-2s idle state behavior)
      laptopRef.current.position.y = Math.sin(time * 0.5) * 0.02;
      
      // Subtle rotation ±2°
      laptopRef.current.rotation.y = Math.sin(time * 0.3) * 0.035; // ~2 degrees
      laptopRef.current.rotation.x = Math.cos(time * 0.4) * 0.017; // ~1 degree
    }
  });

  return (
    <group ref={laptopRef} position={[0.5, 0, 0]}>
      {/* Laptop Base (dark aluminum) */}
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[3.2, 0.1, 2.2]} />
        <meshStandardMaterial 
          color="#2a2a2a" 
          metalness={0.8} 
          roughness={0.3}
        />
      </mesh>

      {/* Laptop Screen Frame */}
      <mesh position={[0, 0.9, -1.05]}>
        <boxGeometry args={[3.2, 2, 0.05]} />
        <meshStandardMaterial 
          color="#1a1a1a" 
          metalness={0.7} 
          roughness={0.4}
        />
      </mesh>

      {/* Screen Bezel (thin) */}
      <mesh position={[0, 0.9, -1.02]}>
        <boxGeometry args={[3.1, 1.9, 0.01]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>

      {/* Screen Content (UI will be rendered here as HTML overlay) */}
      <mesh position={[0, 0.9, -1]}>
        <planeGeometry args={[2.9, 1.75]} />
        <meshBasicMaterial color={COLORS.background} />
      </mesh>

      {/* Children (UI overlay) */}
      {children}
    </group>
  );
}

// ============================================================================
// CONFETTI PARTICLES (for celebration)
// ============================================================================

interface ConfettiParticle {
  id: number;
  x: number;
  y: number;
  rotation: number;
  color: string;
  type: 'strip' | 'square';
}

function Confetti({ active }: { active: boolean }) {
  const [particles, setParticles] = useState<ConfettiParticle[]>([]);

  useEffect(() => {
    if (active) {
      // Generate confetti particles
      const newParticles: ConfettiParticle[] = [];
      for (let i = 0; i < 30; i++) {
        newParticles.push({
          id: i,
          x: (Math.random() - 0.5) * 4,
          y: Math.random() * 2 + 1,
          rotation: Math.random() * 360,
          color: COLORS.accent,
          type: Math.random() > 0.5 ? 'strip' : 'square',
        });
      }
      setParticles(newParticles);

      // Clear after animation
      const timeout = setTimeout(() => setParticles([]), 1000);
      return () => clearTimeout(timeout);
    }
  }, [active]);

  return (
    <group>
      {particles.map((particle) => (
        <mesh
          key={particle.id}
          position={[particle.x, particle.y, -0.9]}
          rotation={[0, 0, particle.rotation * (Math.PI / 180)]}
        >
          {particle.type === 'strip' ? (
            <planeGeometry args={[0.05, 0.15]} />
          ) : (
            <planeGeometry args={[0.08, 0.08]} />
          )}
          <meshBasicMaterial color={particle.color} transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// ============================================================================
// PIPELINE UI OVERLAY (2D HTML on top of 3D)
// ============================================================================

interface PipelineUIProps {
  currentTime: number;
  animatedDeal: DealCard;
}

function PipelineUI({ currentTime, animatedDeal }: PipelineUIProps) {
  const shouldReduceMotion = useReducedMotion();

  // Calculate which stage the animated card should be in based on time
  const getStageFromTime = (time: number): typeof STAGES[number] => {
    const cycle = time % 12; // 12-second loop
    if (cycle < 2) return 'lead';
    if (cycle < 4) return 'qualified';
    if (cycle < 6) return 'proposal';
    if (cycle < 8) return 'negotiation';
    if (cycle < 10) return 'won';
    return 'lead'; // Reset phase
  };

  const currentStage = getStageFromTime(currentTime);
  const showCelebration = currentTime % 12 >= 10 && currentTime % 12 < 11;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="relative w-[580px] h-[350px]" style={{ transform: 'scale(0.85)' }}>
        {/* Pipeline Columns */}
        <div className="flex gap-3 h-full p-4">
          {STAGES.map((stage, idx) => (
            <div
              key={stage}
              className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 backdrop-blur-sm"
              style={{
                backgroundColor: currentStage === stage ? 'rgba(47, 47, 228, 0.1)' : 'rgba(26, 25, 83, 0.3)',
                borderColor: currentStage === stage ? COLORS.accent : 'rgba(255, 255, 255, 0.08)',
              }}
            >
              {/* Column Header */}
              <div className="text-xs font-bold text-white/90 mb-3 uppercase tracking-wider">
                {STAGE_LABELS[stage]}
              </div>

              {/* Deal Cards */}
              <div className="space-y-2">
                {DEALS.filter(d => d.stage === stage).map((deal) => (
                  <motion.div
                    key={deal.id}
                    initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`p-3 rounded-lg border ${
                      deal.id === animatedDeal.id && currentStage === stage
                        ? 'bg-white/[0.12] border-white/[0.2] shadow-lg'
                        : 'bg-white/[0.05] border-white/[0.08]'
                    }`}
                  >
                    <div className="text-xs font-semibold text-white/95 mb-1">
                      {deal.company}
                    </div>
                    <div className="text-xs text-white/70">{deal.amount}</div>
                  </motion.div>
                ))}

                {/* Animated Moving Card */}
                {currentStage === stage && (
                  <motion.div
                    layoutId="moving-card"
                    transition={shouldReduceMotion ? {} : { 
                      type: 'spring', 
                      damping: 20, 
                      stiffness: 100 
                    }}
                    className="p-3 rounded-lg bg-white/[0.15] border-2 border-blue-500 shadow-xl"
                    style={{ boxShadow: `0 0 20px rgba(47, 47, 228, 0.3)` }}
                  >
                    <div className="text-xs font-bold text-white mb-1">
                      {animatedDeal.company}
                    </div>
                    <div className="text-xs text-blue-300">{animatedDeal.amount}</div>
                  </motion.div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Celebration Overlay */}
        <AnimatePresence>
          {showCelebration && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-2xl"
            >
              <div className="bg-white/[0.12] border-2 border-blue-500 rounded-2xl p-6 text-center shadow-2xl">
                <div className="text-4xl mb-2">🎉</div>
                <div className="text-xl font-bold text-white mb-1">Deal Closed!</div>
                <div className="text-sm text-white/70">{animatedDeal.company}</div>
                <div className="text-lg font-bold text-emerald-400 mt-2">{animatedDeal.amount}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ============================================================================
// CAMERA CONTROLLER
// ============================================================================

function CameraController() {
  const { camera } = useThree();

  useEffect(() => {
    // Set camera position for cinematic three-quarter angle
    camera.position.set(1.5, 1.2, 3);
    camera.lookAt(0.5, 0.5, -1);
  }, [camera]);

  return null;
}

// ============================================================================
// SCENE LIGHTING
// ============================================================================

function SceneLighting() {
  return (
    <>
      {/* Ambient light for overall illumination */}
      <ambientLight intensity={0.4} />
      
      {/* Key light (main light source) */}
      <directionalLight
        position={[5, 8, 5]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      
      {/* Fill light (softer, from opposite side) */}
      <directionalLight
        position={[-3, 4, -2]}
        intensity={0.3}
      />
      
      {/* Rim light (highlights edges) */}
      <spotLight
        position={[0, 5, -5]}
        intensity={0.5}
        angle={0.3}
        penumbra={1}
      />

      {/* Environment for reflections */}
      <Environment preset="studio" />
    </>
  );
}

// ============================================================================
// MAIN 3D HERO COMPONENT
// ============================================================================

export default function Hero3DAnimation() {
  const [currentTime, setCurrentTime] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  // Animated deal (the one moving through stages)
  const animatedDeal = DEALS[0];

  // Update time for animation loop
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime((t) => {
        const newTime = t + 0.05; // 50ms intervals
        const cycle = newTime % 12;
        
        // Trigger confetti at 10s mark
        if (cycle >= 10 && cycle < 10.1) {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 1000);
        }
        
        return newTime;
      });
    }, 50);

    return () => clearInterval(interval);
  }, []);

  if (shouldReduceMotion) {
    // Static fallback for reduced motion
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-gradient-to-b from-transparent to-slate-900/20">
        <div className="text-center">
          <div className="text-2xl font-bold text-white mb-2">LeadCRM Pipeline</div>
          <div className="text-sm text-white/70">Enterprise CRM Platform</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[600px]">
      {/* 3D Canvas */}
      <Canvas
        shadows
        className="w-full h-full"
        gl={{ antialias: true, alpha: true }}
      >
        <CameraController />
        <SceneLighting />
        
        <Laptop>
          <Confetti active={showConfetti} />
        </Laptop>

        {/* Optional: Add subtle camera orbit for extra polish */}
        {/* <OrbitControls enableZoom={false} enablePan={false} /> */}
      </Canvas>

      {/* 2D UI Overlay */}
      <PipelineUI currentTime={currentTime} animatedDeal={animatedDeal} />

      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none -z-10">
        {/* Radial vignette */}
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-black/60" />
        
        {/* Technical grid (very subtle) */}
        <div 
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `
              linear-gradient(${COLORS.accent} 1px, transparent 1px),
              linear-gradient(90deg, ${COLORS.accent} 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
      </div>
    </div>
  );
}
