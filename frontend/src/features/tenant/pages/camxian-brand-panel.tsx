'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Camera, Fingerprint, Network, Cable, Phone, Server, Pause, Play } from 'lucide-react';

// Verified at https://camxian.com/ and https://camxian.com/product-services/.
// Static presentation: the login page never requests the company website.
const services = [
  { title: 'CCTV Surveillance', description: 'Supply, installation, repair, and maintenance of IP and analog CCTV systems.', icon: Camera },
  { title: 'Biometrics & Access Control', description: 'Biometrics, time attendance, door access, and smart lock installation.', icon: Fingerprint },
  { title: 'Network Infrastructure', description: 'Solutions for network distribution and security.', icon: Network },
  { title: 'Structured Cabling', description: 'Structured cabling for business data and voice communication.', icon: Cable },
  { title: 'IP PBX & IP Phones', description: 'Internet-based phone systems for business communication.', icon: Phone },
  { title: 'IT Infrastructure', description: 'Laptops, servers, and data cabinets tailored to your requirements.', icon: Server },
];

export function CamxianBrandPanel({ onNavigate }: { onNavigate: (path: string) => void }) {
  const reducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    if (reducedMotion !== false || paused || focused || hovered) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex(current => (current + 1) % services.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [reducedMotion, paused, focused, hovered]);
  const service = services[index];
  const Icon = service.icon;
  const entrance = (order: number) => ({
    initial: reducedMotion ? false as const : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reducedMotion ? 0 : 0.45, delay: reducedMotion ? 0 : order * 0.07 },
  });
  return (
    <aside className="relative flex w-full flex-col overflow-hidden bg-linear-to-br from-blue-500 via-blue-600 to-blue-800 text-white lg:w-1/2">
      <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-32 size-96 rounded-full border border-white/10" />
      <div className="relative flex h-full flex-col justify-between gap-6 p-6 sm:p-8 lg:p-8 xl:p-10">
        <motion.button {...entrance(0)} type="button" onClick={() => onNavigate('login')} className="flex w-fit items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          <span className="flex size-10 items-center justify-center rounded-lg bg-white shadow-sm"><img src="/leadcrm_logo.png" alt="" className="size-7 object-contain" /></span>
          <span className="text-xl font-bold">LeadCRM</span>
        </motion.button>
        <div className="max-w-lg space-y-4">
          <motion.p {...entrance(1)} className="text-xs font-semibold tracking-[0.2em] text-blue-100">CAMXIAN TECHNOLOGIES</motion.p>
          <motion.h1 {...entrance(2)} className="font-display text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl xl:text-4xl">Technology that will<br className="hidden lg:block" /> shape your future.</motion.h1>
          <motion.p {...entrance(3)} className="hidden max-w-sm text-base leading-relaxed text-blue-100 lg:block">Empowering innovation and security today for a safer tomorrow!</motion.p>
          <motion.ul {...entrance(4)} className="hidden flex-wrap gap-2 text-xs font-medium lg:flex">
            {['Security', 'Telecom', 'I.T & Business Solutions'].map(label => <li key={label} className="rounded-full border border-white/25 px-3 py-1.5">{label}</li>)}
          </motion.ul>
          <motion.section {...entrance(5)} aria-label="Our solutions" aria-roledescription="carousel" className="hidden rounded-2xl border border-white/20 bg-white/10 p-5 lg:block xl:p-6"
            onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
            onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xs font-semibold tracking-[0.18em] text-blue-100">OUR SOLUTIONS</h2>
              {!reducedMotion && <button type="button" onClick={() => setPaused(value => !value)} aria-label={paused ? 'Play service rotation' : 'Pause service rotation'} className="rounded-md p-2 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white">{paused ? <Play size={14} /> : <Pause size={14} />}</button>}
            </div>
            <div className="mt-3 min-h-32" aria-live={paused || focused || reducedMotion ? 'polite' : 'off'}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={service.title} initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reducedMotion ? 0 : -8 }} transition={{ duration: reducedMotion ? 0 : 0.4 }}>
                  <Icon className="mb-4 size-7 text-blue-100" aria-hidden="true" />
                  <h3 className="text-lg font-semibold">{service.title}</h3>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-blue-100">{service.description}</p>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="mt-3 flex gap-1" aria-label="Choose a service">
              {services.map((item, position) => <button key={item.title} type="button" aria-label={`Show ${item.title}`} aria-pressed={index === position} onClick={() => { setIndex(position); setPaused(true); }} className="grid size-7 place-items-center rounded-md focus-visible:outline-2 focus-visible:outline-white"><span className={`size-1.5 rounded-full ${index === position ? 'bg-white' : 'bg-white/35'}`} /></button>)}
            </div>
          </motion.section>
        </div>
        <motion.div {...entrance(7)} className="hidden max-w-sm border-t border-white/20 pt-5 lg:block">
          <p className="text-sm font-semibold">LeadCRM <span className="font-normal text-blue-100">/ Internal CRM Workspace</span></p>
          <p className="mt-2 text-xs leading-relaxed text-blue-100">Camxian Technologies’ centralized workspace for leads, customers, pipelines, and workflows.</p>
        </motion.div>
      </div>
    </aside>
  );
}
