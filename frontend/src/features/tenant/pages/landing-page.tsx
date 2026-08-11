'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { motion, useReducedMotion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, CheckCircle2, BarChart3, Users, Zap, 
  Briefcase, ShieldCheck, Globe, Play, Wrench, Settings,
  Phone, MapPin, Shield, ArrowUpRight, Mail, Clock,
  Target, TrendingUp, Smartphone, ChevronDown,
  Lock, MessageSquare, Database, Megaphone, LayoutDashboard
} from 'lucide-react';
import { FeatureCard, ColoredBorderCard, PricingCard } from '../../../shared/components/ui/card';
import { CookieBanner } from '../../../shared/components/cookie-banner';

// Dynamic import for 3D scene (no SSR)
const Hero3DScene = dynamic(
  () => import('./hero-3d-scene'),
  { ssr: false }
);

export default function LandingPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [billingCycle, setBillingCycle] = React.useState<'monthly' | 'quarterly' | 'annually'>('monthly');
  const [scrolled, setScrolled] = React.useState(false);
  const [language, setLanguage] = React.useState<'en' | 'tl'>('en');
  const [showLangMenu, setShowLangMenu] = React.useState(false);
  const [activeSection, setActiveSection] = React.useState<string>('');
  const shouldReduceMotion = useReducedMotion();

  // Translation dictionary
  const translations = {
    en: {
      nav: {
        solutions: 'Solutions',
        why: 'Why LeadCRM',
        pricing: 'Pricing',
        contact: 'Contact',
        login: 'Log in',
        getStarted: 'Get started'
      },
      hero: {
        badge: 'CRM FOR IT, TELECOM & SECURITY',
        title1: 'Manage Leads Smarter,',
        title2: 'Close Deals Faster',
        subtitle: 'The all-in-one CRM platform that helps sales teams organize leads, automate workflows, and accelerate revenue growth.',
        startTrial: 'Start free trial',
        exploreSolutions: 'Explore solutions',
        freeTrial: '14-DAY FREE TRIAL — NO CREDIT CARD REQUIRED'
      },
      solutions: {
        badge: 'OUR SOLUTIONS',
        title: 'Your priorities,',
        title2: 'one platform.',
        subtitle: 'Purpose-built modules for infrastructure providers — not a generic sales tool bent into shape.',
        items: [
          { title: 'Lead Management', desc: 'Organize and track all your leads in one centralized platform with smart segmentation.' },
          { title: 'Pipeline Tracking', desc: 'Visualize your sales pipeline with drag-and-drop stages and real-time progress updates.' },
          { title: 'Automation', desc: 'Automate repetitive tasks, follow-ups, and workflows to save time and boost productivity.' },
          { title: 'Reporting & Analytics', desc: 'Get actionable insights with comprehensive reports and customizable dashboards.' },
          { title: 'Contact Management', desc: 'Organize your contact history in one place. Maintain a complete record of every contact and profile of your customers.' },
          { title: 'Remote Access', desc: 'Not at the office? No problem! LeadCRM can be accessed anywhere and everywhere.' },
          { title: 'Batch Emailing', desc: 'Send multiple emails to multiple receivers at once with batch emailing.' },
          { title: 'Batch SMS Messaging', desc: 'Need a more reliable way to contact your customers? Use Batch SMS messaging to ensure everyone receives the message.' },
          { title: 'Centralized Customer Data Storage', desc: 'Ensure everyone can access and see the same data and history by centralizing your customer data into one source.' }
        ]
      },
      why: {
        badge: 'WHY LEADCRM',
        title: 'Designed with your',
        title2: 'business in mind.',
        subtitle: 'Purpose-built features to help you manage leads, close deals, and grow your business efficiently.',
        benefits: [
          { title: 'Save Time with Automation', desc: 'Automate repetitive tasks and workflows to focus on what matters most—building relationships and closing deals.' },
          { title: 'Improve Team Collaboration', desc: 'Keep your team aligned with shared pipelines, task assignments, and real-time updates.' },
          { title: 'Increase Conversion Rates', desc: 'Track every lead through the pipeline with insights that help you convert more prospects into customers.' },
          { title: 'Access it Anywhere at Any Time', desc: 'Work from anywhere with cloud-based access on desktop and mobile devices.' },
          { title: 'Maximize Your Reach', desc: 'Reach more contacts with batch email and SMS campaigns, all from one platform.' },
          { title: 'Manage the Full Customer Journey', desc: 'From first contact to closed deal, maintain a complete view of every customer interaction and history.' }
        ]
      },
      pricing: {
        badge: 'PRICING',
        title: 'Simple, scalable pricing',
        subtitle: 'Choose the plan that matches your business stage. Switch or cancel anytime.',
        monthly: 'Monthly',
        quarterly: 'Quarterly',
        annually: 'Annually',
        save15: 'Save 15%',
        save25: 'Save 25%',
        perMonth: 'per month',
        perQuarter: 'per quarter',
        perYear: 'per year',
        bestValue: 'Best value',
        getStarted: 'Get started',
        plans: {
          starter: {
            name: 'Starter',
            features: [
              'Up to 1,000 contacts',
              'Basic pipeline stages',
              'Email & SMS campaigns',
              'Mobile app access',
              'Standard reports'
            ]
          },
          professional: {
            name: 'Professional',
            features: [
              'Unlimited contacts',
              'Workflow automation',
              'Batch messaging',
              'Priority support',
              'Custom dashboards',
              'Asset tracking'
            ]
          },
          enterprise: {
            name: 'Enterprise',
            features: [
              'Custom integrations',
              'Dedicated account manager',
              'SLA guarantee',
              'Advanced audit trails',
              'White-label option',
              'Multi-branch access'
            ]
          }
        }
      },
      contact: {
        badge: 'CONTACT',
        title: 'Let\'s talk about',
        title2: 'your operations.',
        subtitle: 'Questions about LeadCRM? Our team of IT specialists is here to help you streamline and scale.',
        phone: '+63 (02) 8888 8888',
        phoneLabel: 'Monday to Friday',
        location: 'Manila, Philippines',
        locationLabel: 'Service across PH',
        security: 'security@leadcrm.com',
        securityLabel: 'Report an incident',
        form: {
          firstName: 'First name',
          lastName: 'Last name',
          company: 'Company',
          email: 'Work email',
          message: 'Message',
          messagePlaceholder: 'Tell us about your team size, service types, and scaling goals.',
          send: 'Send message'
        }
      },
      footer: {
        tagline: 'The premier CRM platform for IT solutions providers, security firms, and telecom agencies.',
        product: 'Product',
        company: 'Company',
        resources: 'Resources',
        copyright: '© 2026 LeadCRM. All rights reserved.'
      }
    },
    tl: {
      nav: {
        solutions: 'Solusyon',
        why: 'Bakit LeadCRM',
        pricing: 'Presyo',
        contact: 'Kontakin Kami',
        login: 'Mag-login',
        getStarted: 'Magsimula Ngayon'
      },
      hero: {
        badge: 'CRM PARA SA IT, TELECOM AT SECURITY',
        title1: 'Mas Matalinong Pamamahala ng Leads,',
        title2: 'Mas Mabilis na Pagbebenta',
        subtitle: 'Ang kompletong CRM platform na tumutulong sa sales teams na mag-organize ng leads, mag-automate ng proseso, at pabilisin ang paglaki ng negosyo.',
        startTrial: 'Subukan nang libre',
        exploreSolutions: 'Alamin ang solusyon',
        freeTrial: 'LIBRENG 14-ARAW NA TRIAL — WALANG CREDIT CARD'
      },
      solutions: {
        badge: 'ANG AMING SOLUSYON',
        title: 'Lahat ng kailangan mo,',
        title2: 'isang platform lang.',
        subtitle: 'Dinisenyo para sa infrastructure providers — hindi generic na sales tool na pinilit lang.',
        items: [
          { title: 'Lead Management', desc: 'I-organize at subaybayan ang lahat ng iyong leads sa isang platform na may matalinong segmentation.' },
          { title: 'Pipeline Tracking', desc: 'Visualize ang sales pipeline gamit ang drag-and-drop stages at real-time na updates.' },
          { title: 'Automation', desc: 'I-automate ang paulit-ulit na gawain at workflows para makatipid ng oras at tumaas ang productivity.' },
          { title: 'Reporting at Analytics', desc: 'Makakuha ng actionable insights gamit ang detalyadong reports at customizable dashboards.' },
          { title: 'Contact Management', desc: 'Isang lugar lang para sa lahat ng contact history. Kumpleto at organized ang bawat customer profile at interaksyon.' },
          { title: 'Remote Access', desc: 'Wala sa opisina? Walang problema! I-access ang LeadCRM kahit saan ka naroroon.' },
          { title: 'Batch Emailing', desc: 'Magpadala ng maraming email sa maraming tao nang sabay-sabay gamit ang batch emailing.' },
          { title: 'Batch SMS Messaging', desc: 'Mas siguradong paraan ng komunikasyon? Gumamit ng Batch SMS para siguradong makukuha ng lahat ang mensahe.' },
          { title: 'Centralized Customer Data', desc: 'Siguruhing lahat ay may access sa parehong data at history sa pamamagitan ng centralized customer database.' }
        ]
      },
      why: {
        badge: 'BAKIT LEADCRM',
        title: 'Ginawa para sa iyong',
        title2: 'negosyo.',
        subtitle: 'Mga feature na dinisenyo para tulungan kang mag-manage ng leads, makakuha ng deals, at palakasin ang negosyo nang epektibo.',
        benefits: [
          { title: 'Makatipid ng Oras sa Automation', desc: 'I-automate ang repetitive tasks at workflows para makapag-focus ka sa mas importante—pagbuo ng relasyon at pagsasara ng deals.' },
          { title: 'Mas Magandang Teamwork', desc: 'I-align ang buong team gamit ang shared pipelines, task assignments, at real-time updates.' },
          { title: 'Mas Mataas na Conversion Rate', desc: 'Subaybayan ang bawat lead gamit ang insights na tumutulong sa conversion ng mas maraming prospects.' },
          { title: 'Access Kahit Nasaan Ka', desc: 'Magtrabaho kahit saan gamit ang cloud-based access sa desktop at mobile.' },
          { title: 'Mas Malawak na Reach', desc: 'Maabot ang mas maraming contacts gamit ang batch email at SMS campaigns sa isang platform.' },
          { title: 'Buong Customer Journey', desc: 'Mula unang contact hanggang deal closure, makikita ang kumpletong customer interaction at history.' }
        ]
      },
      pricing: {
        badge: 'PRESYO',
        title: 'Simple at scalable na pricing',
        subtitle: 'Pumili ng plan na swak sa iyong negosyo. Pwedeng magpalit o mag-cancel anumang oras.',
        monthly: 'Buwanan',
        quarterly: 'Quarterly',
        annually: 'Tahunan',
        save15: 'Tipid 15%',
        save25: 'Tipid 25%',
        perMonth: 'kada buwan',
        perQuarter: 'kada quarter',
        perYear: 'kada taon',
        bestValue: 'Best value',
        getStarted: 'Magsimula',
        plans: {
          starter: {
            name: 'Starter',
            features: [
              'Hanggang 1,000 contacts',
              'Basic pipeline stages',
              'Email at SMS campaigns',
              'Mobile app access',
              'Standard reports'
            ]
          },
          professional: {
            name: 'Professional',
            features: [
              'Unlimited contacts',
              'Workflow automation',
              'Batch messaging',
              'Priority support',
              'Custom dashboards',
              'Asset tracking'
            ]
          },
          enterprise: {
            name: 'Enterprise',
            features: [
              'Custom integrations',
              'Dedicated account manager',
              'SLA guarantee',
              'Advanced audit trails',
              'White-label option',
              'Multi-branch access'
            ]
          }
        }
      },
      contact: {
        badge: 'KONTAKIN KAMI',
        title: 'Pag-usapan natin ang',
        title2: 'iyong operations.',
        subtitle: 'May tanong tungkol sa LeadCRM? Ang aming team ng IT specialists ay handang tumulong sa streamlining at scaling ng iyong negosyo.',
        phone: '+63 (02) 8888 8888',
        phoneLabel: 'Lunes hanggang Biyernes',
        location: 'Maynila, Pilipinas',
        locationLabel: 'Serbisyo sa buong Pilipinas',
        security: 'security@leadcrm.com',
        securityLabel: 'Mag-report ng incident',
        form: {
          firstName: 'Pangalan',
          lastName: 'Apelyido',
          company: 'Kumpanya',
          email: 'Work email',
          message: 'Mensahe',
          messagePlaceholder: 'Sabihin sa amin ang tungkol sa laki ng team, uri ng serbisyo, at growth goals.',
          send: 'Ipadala'
        }
      },
      footer: {
        tagline: 'Ang pangunahing CRM platform para sa IT solutions providers, security firms, at telecom agencies.',
        product: 'Produkto',
        company: 'Kumpanya',
        resources: 'Resources',
        copyright: '© 2026 LeadCRM. Lahat ng karapatan ay nakalaan.'
      }
    }
  };

  const t = translations[language];

  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.language-selector')) {
        setShowLangMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Track active section based on scroll position
  React.useEffect(() => {
    const handleScrollSpy = () => {
      const sections = ['solutions', 'why', 'pricing', 'contact'];
      const scrollPosition = window.scrollY + 200;

      // Check if we're in hero section (top of page)
      const solutionsElement = document.getElementById('solutions');
      if (solutionsElement && scrollPosition < solutionsElement.offsetTop) {
        setActiveSection('');
        return;
      }

      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const offsetTop = element.offsetTop;
          const offsetBottom = offsetTop + element.offsetHeight;
          
          if (scrollPosition >= offsetTop && scrollPosition < offsetBottom) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScrollSpy);
    handleScrollSpy(); // Initial check
    return () => window.removeEventListener('scroll', handleScrollSpy);
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-slate-800 antialiased overflow-x-hidden font-body">
      {/* Navbar */}
<nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 transition-all duration-300">
        <div className={`max-w-7xl mx-auto transition-all duration-300 ${
          scrolled 
            ? 'bg-white/95 backdrop-blur-xl border border-gray-200 rounded-2xl shadow-lg px-6 py-3' 
            : 'px-6 py-3'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="/leadcrm_logo.png" 
                alt="LeadCRM Logo" 
                className="w-10 h-10"
              />
              <span className="text-xl font-bold text-gray-900">Lead<span className="text-[#4A9EFF]">CRM</span></span>
            </div>
            
            <div className="hidden md:flex items-center gap-8 text-sm font-medium relative">
              <motion.a 
                href="#solutions" 
                onClick={() => setActiveSection('solutions')}
                whileTap={{ scale: 0.95 }}
                className={`relative transition-colors ${activeSection === 'solutions' ? 'text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
              >
                {t.nav.solutions}
                {activeSection === 'solutions' && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute -bottom-1 left-0 right-0 h-0.5 bg-blue-600 rounded-full"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                {activeSection === 'solutions' && (
                  <motion.div
                    className="absolute -bottom-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.6 }}
                    transition={{ duration: 0.3 }}
                  />
                )}
              </motion.a>
              <motion.a 
                href="#why" 
                onClick={() => setActiveSection('why')}
                whileTap={{ scale: 0.95 }}
                className={`relative transition-colors ${activeSection === 'why' ? 'text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
              >
                {t.nav.why}
                {activeSection === 'why' && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute -bottom-1 left-0 right-0 h-0.5 bg-blue-600 rounded-full"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                {activeSection === 'why' && (
                  <motion.div
                    className="absolute -bottom-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.6 }}
                    transition={{ duration: 0.3 }}
                  />
                )}
              </motion.a>
              <motion.a 
                href="#pricing" 
                onClick={() => setActiveSection('pricing')}
                whileTap={{ scale: 0.95 }}
                className={`relative transition-colors ${activeSection === 'pricing' ? 'text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
              >
                {t.nav.pricing}
                {activeSection === 'pricing' && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute -bottom-1 left-0 right-0 h-0.5 bg-blue-600 rounded-full"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                {activeSection === 'pricing' && (
                  <motion.div
                    className="absolute -bottom-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.6 }}
                    transition={{ duration: 0.3 }}
                  />
                )}
              </motion.a>
              <motion.a 
                href="#contact" 
                onClick={() => setActiveSection('contact')}
                whileTap={{ scale: 0.95 }}
                className={`relative transition-colors ${activeSection === 'contact' ? 'text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
              >
                {t.nav.contact}
                {activeSection === 'contact' && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute -bottom-1 left-0 right-0 h-0.5 bg-blue-600 rounded-full"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                {activeSection === 'contact' && (
                  <motion.div
                    className="absolute -bottom-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.6 }}
                    transition={{ duration: 0.3 }}
                  />
                )}
              </motion.a>
            </div>

            <div className="flex items-center gap-3">
              {/* Language Selector */}
              <div className="relative language-selector">
                <button
                  onClick={() => setShowLangMenu(!showLangMenu)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 transition-all text-sm font-medium"
                >
                  <Globe size={16} className="text-gray-600" />
                  <span className="font-semibold">{language.toUpperCase()}</span>
                  <ChevronDown size={14} className={`transition-transform ${showLangMenu ? 'rotate-180' : ''}`} />
                </button>
                
                {showLangMenu && (
                  <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-50">
                    <button
                      onClick={() => {
                        setLanguage('en');
                        setShowLangMenu(false);
                      }}
                      className={`w-full px-4 py-3 text-left text-sm font-medium transition-colors flex items-center gap-3 ${
                        language === 'en' 
                          ? 'bg-blue-600 text-white' 
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold">English</span>
                        <span className="text-xs opacity-75">United States</span>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setLanguage('tl');
                        setShowLangMenu(false);
                      }}
                      className={`w-full px-4 py-3 text-left text-sm font-medium transition-colors flex items-center gap-3 ${
                        language === 'tl' 
                          ? 'bg-blue-600 text-white' 
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold">Filipino</span>
                        <span className="text-xs opacity-75">Philippines</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              <button 
                onClick={() => onNavigate('login')}
                className="px-5 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                {t.nav.login}
              </button>
              <button 
                onClick={() => onNavigate('register')}
                className="px-5 py-2.5 text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all active:scale-95 shadow-lg shadow-blue-600/30"
              >
                {t.nav.getStarted}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-blue-950/20 pointer-events-none" />
        <div className="absolute top-40 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/10 rounded-full blur-[150px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="max-w-4xl">
            <motion.h1 
              initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.5, delay: shouldReduceMotion ? 0 : 0.1 }}
              className="text-6xl md:text-7xl lg:text-8xl font-heading text-gray-900 mb-8 tracking-tight leading-[1.05]"
            >
              {t.hero.title1}<br />
              <span className="text-blue-600 relative inline-block">
                {t.hero.title2}
                <motion.div
                  className="absolute -bottom-2 left-0 right-0 h-1 bg-blue-600 rounded-full"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.8, duration: 0.6 }}
                />
              </span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.5, delay: shouldReduceMotion ? 0 : 0.2 }}
              className="text-xl text-gray-600 mb-12 max-w-2xl leading-relaxed font-subtitle"
            >
              {t.hero.subtitle}
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.5, delay: shouldReduceMotion ? 0 : 0.3 }}
              className="flex flex-col sm:flex-row gap-4 mb-6"
            >
              <motion.button 
                onClick={() => onNavigate('register')}
                whileHover={shouldReduceMotion ? {} : { scale: 1.02 }}
                whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
                className="group min-h-[44px] min-w-[44px] px-10 py-5 bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold rounded-xl transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 hover:shadow-blue-600/50"
                aria-label="Start free trial"
              >
                {t.hero.startTrial}
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </motion.button>
              <motion.button 
                onClick={() => window.location.href = '#solutions'}
                whileHover={shouldReduceMotion ? {} : { scale: 1.02 }}
                whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
                className="min-h-[44px] min-w-[44px] px-10 py-5 bg-white border-2 border-gray-200 text-gray-900 text-lg font-bold rounded-xl transition-all flex items-center justify-center gap-2 hover:bg-gray-50 hover:border-blue-600 shadow-sm"
                aria-label="Explore solutions"
              >
                {t.hero.exploreSolutions}
              </motion.button>
            </motion.div>

            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.5, delay: shouldReduceMotion ? 0 : 0.4 }}
              className="text-xs text-gray-500 uppercase tracking-widest font-semibold"
            >
              {t.hero.freeTrial}
            </motion.p>
          </div>

          {/* 3D Hero - Pipeline Animation */}
          <motion.div 
            className="mt-32 relative"
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
          >
            {/* Top intro text */}
            <div className="text-center mb-12 max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold mb-6">
                <Play size={14} />
                WATCH IT IN ACTION
              </div>
              <h2 className="text-5xl font-heading font-bold text-slate-900 mb-4">
                Your pipeline, visualized
              </h2>
              <p className="text-xl text-slate-600">
                Experience the smooth flow of deals moving through stages, 
                from first contact to celebration.
              </p>
            </div>
            
            {/* 3D Scene with enhanced backdrop */}
            <div className="relative max-w-6xl mx-auto">
              {/* Gradient orbs */}
              <div className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] animate-pulse" />
              <div className="absolute top-1/2 right-1/4 translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
              
              {/* Main container */}
              <div className="relative">
                <div className="absolute -inset-6 bg-blue-600/30 rounded-3xl blur-2xl" />
                <div className="relative h-[650px] rounded-3xl overflow-hidden border-2 border-white/20 bg-[#080616] shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
                  <Hero3DScene className="w-full h-full" />
                </div>
              </div>
            </div>
            
            {/* Bottom feature pills */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="mt-12 flex flex-wrap items-center justify-center gap-4"
            >
              <div className="px-4 py-2 bg-white rounded-full border border-gray-200 text-sm font-medium text-slate-700 flex items-center gap-2">
                <Zap size={16} className="text-blue-600" />
                60 FPS Animation
              </div>
              <div className="px-4 py-2 bg-white rounded-full border border-gray-200 text-sm font-medium text-slate-700 flex items-center gap-2">
                3D Visualization
              </div>
              <div className="px-4 py-2 bg-white rounded-full border border-gray-200 text-sm font-medium text-slate-700 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                Real-time Updates
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Solutions Section */}
      <section id="solutions" className="py-32 px-6 relative bg-[#F8F9FB] dark:bg-[#0A0B14]">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.6 }}
            className="mb-20 text-center"
          >
            <motion.p 
              className="text-blue-500 text-xs font-bold uppercase tracking-widest mb-4"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
            >
              {t.solutions.badge}
            </motion.p>
            <h2 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 font-heading leading-tight">
              {t.solutions.title}<br />{t.solutions.title2}
            </h2>
            <p className="text-lg text-gray-500 dark:text-slate-400 max-w-2xl mx-auto">
              {t.solutions.subtitle}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {t.solutions.items.map((solution, i) => {
              const icons = [Users, BarChart3, Zap, Target, Users, Globe, Mail, MessageSquare, Database];
              const Icon = icons[i];
              const numbers = ['01', '02', '03', '04', '05', '06', '07', '08', '09'];
              
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ 
                    delay: shouldReduceMotion ? 0 : i * 0.05, 
                    duration: shouldReduceMotion ? 0 : 0.5,
                    type: 'spring',
                    stiffness: 120,
                    damping: 20
                  }}
                  className="group"
                >
                  <div 
                    className="relative h-full border-l-4 border-l-transparent bg-white/60 dark:bg-[#1A1B26] p-8 transition-all duration-300 group-hover:border-l-blue-500 group-hover:bg-blue-50/50 dark:group-hover:bg-blue-950/20"
                    style={{
                      backgroundImage: `
                        linear-gradient(to right, rgba(203, 213, 225, 0.12) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(203, 213, 225, 0.12) 1px, transparent 1px)
                      `,
                      backgroundSize: '24px 24px',
                      borderTop: '1px solid rgba(203, 213, 225, 0.3)',
                      borderRight: '1px solid rgba(203, 213, 225, 0.3)',
                      borderBottom: '1px solid rgba(203, 213, 225, 0.3)'
                    }}
                  >
                    {/* Number badge in top-right */}
                    <div className="absolute top-6 right-6 text-gray-300 dark:text-white/[0.15] text-2xl font-semibold">
                      {numbers[i]}
                    </div>

                    {/* Icon - changes to blue on hover */}
                    <div className="mb-6">
                      <Icon className="w-11 h-11 text-gray-600 dark:text-slate-300 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors duration-300" strokeWidth={1.5} />
                    </div>

                    {/* Title */}
                    <h3 className="text-[17px] font-semibold text-gray-900 dark:text-white mb-3 tracking-tight leading-tight">
                      {solution.title}
                    </h3>

                    {/* Description */}
                    <p className="text-[14px] text-gray-500 dark:text-slate-400 leading-relaxed">
                      {solution.desc}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why LeadCRM Section */}
      <section id="why" className="py-32 px-6 relative bg-[#0B0F19] dark:bg-[#0B0F19] overflow-hidden">
        {/* Grid background overlay - matches card grid size */}
        <div 
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(148, 163, 184, 0.5) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(148, 163, 184, 0.5) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />

        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div 
            className="text-center mb-20"
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.6 }}
          >
            <motion.p 
              className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-4"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
            >
              {t.why.badge}
            </motion.p>
            <h2 className="text-5xl md:text-6xl font-bold text-white mb-6 font-heading leading-tight">
              {t.why.title}<br />{t.why.title2}
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              {t.why.subtitle}
            </p>
          </motion.div>

          {/* One unified grid container */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border border-white/[0.08] rounded-2xl overflow-hidden bg-[#13141F]/40 backdrop-blur-sm">
            {t.why.benefits.map((benefit, i) => {
              const icons = [Clock, Users, TrendingUp, Globe, Megaphone, LayoutDashboard];
              const Icon = icons[i];
              const numbers = ['01', '02', '03', '04', '05', '06'];
              
              // Determine border classes for grid lines
              const isRightColumn = (i + 1) % 3 !== 0;
              const isBottomRow = i < 3;
              
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ 
                    delay: shouldReduceMotion ? 0 : i * 0.08,
                    duration: shouldReduceMotion ? 0 : 0.5,
                    type: 'spring',
                    stiffness: 120,
                    damping: 20
                  }}
                  className="group relative"
                >
                  <div 
                    className={`relative h-full p-8 transition-all duration-300 group-hover:bg-[#2A2D3E]/80 group-hover:z-10
                      ${isRightColumn ? 'border-r border-white/[0.08]' : ''}
                      ${isBottomRow ? 'border-b border-white/[0.08]' : ''}
                    `}
                  >
                    {/* Grid overlay that appears on hover - aligned with background */}
                    <div 
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                      style={{
                        backgroundImage: `
                          linear-gradient(to right, rgba(148, 163, 184, 0.15) 1px, transparent 1px),
                          linear-gradient(to bottom, rgba(148, 163, 184, 0.15) 1px, transparent 1px)
                        `,
                        backgroundSize: '40px 40px',
                        backgroundPosition: '0 0'
                      }}
                    />

                    {/* Icon with filled circular background - animates on hover */}
                    <motion.div 
                      className="mb-6 relative z-10"
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    >
                      <div className="w-12 h-12 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-all duration-300 group-hover:bg-white/[0.12] group-hover:border-white/[0.15]">
                        <Icon className="w-6 h-6 text-gray-300 transition-colors duration-300 group-hover:text-white" strokeWidth={1.5} />
                      </div>
                    </motion.div>

                    {/* Title - slides up slightly on hover */}
                    <motion.h3 
                      className="text-[17px] font-semibold text-white mb-3 tracking-tight leading-tight relative z-10 transition-all duration-300"
                      whileHover={{ y: -2 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    >
                      {benefit.title}
                    </motion.h3>

                    {/* Description - fades in more on hover */}
                    <p className="text-[14px] text-gray-400 leading-relaxed mb-4 relative z-10 transition-all duration-300 group-hover:text-gray-300">
                      {benefit.desc}
                    </p>

                    {/* Animated glowing progress line */}
                    <div className="relative z-10 h-[2px] w-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        whileHover={{ width: '120px', opacity: 1 }}
                        transition={{ 
                          duration: 0.6,
                          ease: 'easeOut'
                        }}
                        className="h-full bg-gray-400 rounded-full relative"
                        style={{
                          boxShadow: '0 0 10px rgba(156, 163, 175, 0.8), 0 0 20px rgba(156, 163, 175, 0.4)'
                        }}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-blue-600 text-xs font-bold uppercase tracking-widest mb-4">{t.pricing.badge}</p>
            <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 font-heading">{t.pricing.title}</h2>
            <p className="text-xl text-gray-600 mb-10 font-subtitle">
              {t.pricing.subtitle}
            </p>

            <div className="inline-flex items-center p-1 bg-gray-100 rounded-xl border border-gray-200">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                  billingCycle === 'monthly' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {t.pricing.monthly}
              </button>
              <button
                onClick={() => setBillingCycle('quarterly')}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                  billingCycle === 'quarterly' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span>{t.pricing.quarterly}</span>
                <span className={`ml-2 text-xs font-bold ${
                  billingCycle === 'quarterly' ? 'text-white' : 'text-green-700'
                }`}>{t.pricing.save15}</span>
              </button>
              <button
                onClick={() => setBillingCycle('annually')}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                  billingCycle === 'annually' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span>{t.pricing.annually}</span>
                <span className={`ml-2 text-xs font-bold ${
                  billingCycle === 'annually' ? 'text-white' : 'text-green-700'
                }`}>{t.pricing.save25}</span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                name: t.pricing.plans.starter.name,
                price: billingCycle === 'monthly' ? '₱999' : billingCycle === 'quarterly' ? '₱2,547' : '₱8,999',
                period: billingCycle === 'monthly' ? t.pricing.perMonth : billingCycle === 'quarterly' ? t.pricing.perQuarter : t.pricing.perYear,
                features: t.pricing.plans.starter.features
              },
              {
                name: t.pricing.plans.professional.name,
                price: billingCycle === 'monthly' ? '₱2,499' : billingCycle === 'quarterly' ? '₱6,372' : '₱22,499',
                period: billingCycle === 'monthly' ? t.pricing.perMonth : billingCycle === 'quarterly' ? t.pricing.perQuarter : t.pricing.perYear,
                badge: t.pricing.bestValue,
                popular: true,
                features: t.pricing.plans.professional.features
              },
              {
                name: t.pricing.plans.enterprise.name,
                price: billingCycle === 'monthly' ? '₱9,999' : billingCycle === 'quarterly' ? '₱25,497' : '₱89,999',
                period: billingCycle === 'monthly' ? t.pricing.perMonth : billingCycle === 'quarterly' ? t.pricing.perQuarter : t.pricing.perYear,
                features: t.pricing.plans.enterprise.features
              }
            ].map((plan, i) => (
              <motion.div
                key={`${plan.name}-${billingCycle}`}
                initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ 
                  delay: shouldReduceMotion ? 0 : i * 0.1, 
                  duration: shouldReduceMotion ? 0 : 0.5,
                  type: 'spring',
                  stiffness: 100,
                  damping: 15
                }}
                whileHover={shouldReduceMotion ? {} : { 
                  y: plan.popular ? -12 : -8,
                  scale: plan.popular ? 1.03 : 1.02,
                  transition: { duration: 0.2 }
                }}
                className={`relative rounded-3xl p-10 transition-all cursor-pointer min-h-[44px] ${
                  plan.popular
                    ? 'bg-blue-50 dark:bg-blue-950/10 border-2 border-blue-600 shadow-2xl ring-4 ring-blue-500/20 scale-105'
                    : 'bg-white dark:bg-slate-900 border-2 border-gray-200 dark:border-white/8 hover:border-blue-300 shadow-lg hover:shadow-xl'
                }`}
                aria-label={`${plan.name} plan`}
              >
                {plan.badge && (
                  <motion.div 
                    className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-2 bg-blue-600 text-white text-xs font-bold rounded-full uppercase tracking-wider shadow-lg"
                    initial={{ scale: 0, rotate: -12 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.3 }}
                  >
                    {plan.badge}
                  </motion.div>
                )}
                
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 font-heading">{plan.name}</h3>
                <AnimatePresence mode="wait">
                  <motion.div 
                    key={`price-${plan.name}-${billingCycle}`}
                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: -20 }}
                    transition={{ 
                      type: 'spring', 
                      stiffness: 300, 
                      damping: 20 
                    }}
                    className="mb-8"
                  >
                    <div className={`text-5xl font-black mb-1 ${plan.popular ? 'text-blue-600' : 'text-gray-900 dark:text-white'}`}>
                      {plan.price}
                    </div>
                    {plan.period && (
                      <div className="text-gray-600 dark:text-gray-400 text-sm font-medium">
                        {plan.period}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                <ul className="space-y-4 mb-10">
                  {plan.features.map((feature, j) => (
                    <motion.li 
                      key={j} 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + (j * 0.05) }}
                      className="flex items-start gap-3 text-gray-700 dark:text-gray-300"
                    >
                      <motion.div 
                        className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          plan.popular ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-700'
                        }`}
                        whileHover={{ scale: 1.2, rotate: 360 }}
                        transition={{ duration: 0.3 }}
                      >
                        <CheckCircle2 size={14} className={plan.popular ? 'text-white' : 'text-gray-600 dark:text-gray-400'} />
                      </motion.div>
                      <span className="text-sm leading-relaxed">{feature}</span>
                    </motion.li>
                  ))}
                </ul>

                <motion.button
                  onClick={() => onNavigate('register')}
                  whileHover={shouldReduceMotion ? {} : { scale: 1.02 }}
                  whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
                  className={`w-full min-h-[44px] py-4 rounded-xl font-bold transition-all ${
                    plan.popular
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30'
                      : 'bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-2 border-gray-200 dark:border-white/8 hover:border-blue-600 text-gray-900 dark:text-white'
                  }`}
                  aria-label={`Get started with ${plan.name} plan`}
                >
                  {t.pricing.getStarted}
                </motion.button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-32 px-6 relative bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="max-w-5xl mx-auto bg-white/80 backdrop-blur-xl border-2 border-gray-200 rounded-3xl overflow-hidden shadow-2xl"
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.6 }}
          >
            <div className="grid md:grid-cols-2">
              <motion.div 
                className="p-12 md:p-16 relative overflow-hidden"
                initial={{ opacity: 0, x: shouldReduceMotion ? 0 : -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2, duration: 0.6 }}
              >
                {/* Background decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-100/50 rounded-full blur-3xl" />
                
                <div className="relative z-10">
                  <motion.p 
                    className="text-blue-600 text-xs font-bold uppercase tracking-widest mb-4"
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4 }}
                  >
                    {t.contact.badge}
                  </motion.p>
                  <h2 className="text-4xl font-bold text-gray-900 mb-6 font-heading">{t.contact.title}<br />{t.contact.title2}</h2>
                  <p className="text-gray-600 mb-12 leading-relaxed font-subtitle">
                    {t.contact.subtitle}
                  </p>

                  <div className="space-y-6">
                    {[
                      { icon: <Phone size={20} />, title: t.contact.phone, subtitle: t.contact.phoneLabel, color: 'blue' },
                      { icon: <MapPin size={20} />, title: t.contact.location, subtitle: t.contact.locationLabel, color: 'purple' },
                      { icon: <Shield size={20} />, title: t.contact.security, subtitle: t.contact.securityLabel, color: 'green' }
                    ].map((item, i) => (
                      <motion.div 
                        key={i}
                        className="flex items-center gap-4 group cursor-pointer"
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.3 + (i * 0.1) }}
                        whileHover={shouldReduceMotion ? {} : { x: 8, transition: { duration: 0.2 } }}
                      >
                        <motion.div 
                          className={`w-14 h-14 rounded-2xl bg-${item.color}-500/10 flex items-center justify-center text-${item.color}-600 border border-${item.color}-500/20 group-hover:shadow-lg group-hover:shadow-${item.color}-500/20 transition-all`}
                          whileHover={shouldReduceMotion ? {} : { scale: 1.1, rotate: 5 }}
                        >
                          {item.icon}
                        </motion.div>
                        <div>
                          <div className="text-gray-900 font-semibold group-hover:text-blue-600 transition-colors">{item.title}</div>
                          <div className="text-gray-500 text-sm">{item.subtitle}</div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>

              <motion.div 
                className="p-12 md:p-16 bg-gray-50"
                initial={{ opacity: 0, x: shouldReduceMotion ? 0 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3, duration: 0.6 }}
              >
                <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                  <div className="grid grid-cols-2 gap-4">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.4 }}
                    >
                      <label className="block text-sm font-semibold text-gray-700 mb-2">{t.contact.form.firstName}</label>
                      <input
                        type="text"
                        placeholder="John"
                        className="w-full min-h-[44px] bg-white border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                        aria-label="First name"
                      />
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.45 }}
                    >
                      <label className="block text-sm font-semibold text-gray-700 mb-2">{t.contact.form.lastName}</label>
                      <input
                        type="text"
                        placeholder="Doe"
                        className="w-full min-h-[44px] bg-white border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                        aria-label="Last name"
                      />
                    </motion.div>
                  </div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 }}
                  >
                    <label className="block text-sm font-semibold text-gray-700 mb-2">{t.contact.form.company}</label>
                    <input
                      type="text"
                      placeholder="e.g. Camxian Technologies, Inc."
                      className="w-full min-h-[44px] bg-white border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                      aria-label="Company name"
                    />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.55 }}
                  >
                    <label className="block text-sm font-semibold text-gray-700 mb-2">{t.contact.form.email}</label>
                    <input
                      type="email"
                      placeholder="john@company.com"
                      className="w-full min-h-[44px] bg-white border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                      aria-label="Work email"
                    />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.6 }}
                  >
                    <label className="block text-sm font-semibold text-gray-700 mb-2">{t.contact.form.message}</label>
                    <textarea
                      rows={4}
                      placeholder={t.contact.form.messagePlaceholder}
                      className="w-full bg-white border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
                      aria-label="Message"
                    />
                  </motion.div>
                  <motion.button
                    type="submit"
                    whileHover={shouldReduceMotion ? {} : { scale: 1.02 }}
                    whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
                    className="w-full min-h-[44px] py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50"
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.65 }}
                    aria-label="Send message"
                  >
                    {t.contact.form.send}
                  </motion.button>
                </form>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-20 px-6 bg-gray-50 dark:bg-[#0B0F19] border-t border-gray-200 dark:border-white/[0.08] overflow-hidden">
        {/* Creative background pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, rgba(59, 130, 246, 0.3) 1px, transparent 0)`,
            backgroundSize: '48px 48px'
          }}
        />
        
        {/* Gradient orbs for visual interest */}
        <div className="absolute top-20 right-20 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid md:grid-cols-12 gap-12 mb-16">
            {/* Brand section - spans 4 columns */}
            <motion.div 
              className="md:col-span-4"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center gap-3 mb-6">
                {/* Use actual logo */}
                <img 
                  src="/leadcrm_logo.png" 
                  alt="LeadCRM Logo" 
                  className="w-12 h-12"
                />
                <span className="text-xl font-bold text-gray-900 dark:text-white">Lead<span className="text-[#4A9EFF]">CRM</span></span>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                {t.footer.tagline}
              </p>
            </motion.div>

            {/* Links sections - span 8 columns */}
            <div className="md:col-span-8 grid grid-cols-2 md:grid-cols-3 gap-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <h4 className="text-gray-900 dark:text-white font-bold mb-4 font-heading">{t.footer.product}</h4>
                <ul className="space-y-3 text-sm">
                  {[
                    { name: 'Solutions', href: '#solutions' },
                    { name: 'Why LeadCRM', href: '#why' },
                    { name: 'Pricing', href: '#pricing' }
                  ].map((item, i) => (
                    <motion.li 
                      key={i}
                      whileHover={{ x: 4 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    >
                      <a href={item.href} className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2 group">
                        <span className="w-0 h-[2px] bg-blue-600 group-hover:w-4 transition-all duration-300" />
                        {item.name}
                      </a>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <h4 className="text-gray-900 dark:text-white font-bold mb-4 font-heading">{t.footer.company}</h4>
                <ul className="space-y-3 text-sm">
                  {[
                    { name: 'About Us', href: '#', onClick: undefined },
                    { name: 'Contact', href: '#contact', onClick: undefined },
                    { name: 'Privacy Policy', href: '#', onClick: () => onNavigate('privacy-policy') },
                    { name: 'Terms', href: '#', onClick: () => onNavigate('terms-of-service') }
                  ].map((item, i) => (
                    <motion.li 
                      key={i}
                      whileHover={{ x: 4 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    >
                      <a 
                        href={item.href} 
                        onClick={(e) => {
                          if (item.onClick) {
                            e.preventDefault();
                            item.onClick();
                          }
                        }}
                        className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2 group cursor-pointer"
                      >
                        <span className="w-0 h-[2px] bg-blue-600 group-hover:w-4 transition-all duration-300" />
                        {item.name}
                      </a>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <h4 className="text-gray-900 dark:text-white font-bold mb-4 font-heading">{t.footer.resources}</h4>
                <ul className="space-y-3 text-sm">
                  {['Documentation', 'Support', 'Status', 'Security'].map((item, i) => (
                    <motion.li 
                      key={i}
                      whileHover={{ x: 4 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    >
                      <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2 group">
                        <span className="w-0 h-[2px] bg-blue-600 group-hover:w-4 transition-all duration-300" />
                        {item}
                      </a>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            </div>
          </div>

          {/* Bottom section */}
          <motion.div 
            className="pt-8 border-t border-gray-200 dark:border-white/[0.08]"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {t.footer.copyright}
              </p>
              
              <div className="flex gap-6">
                <motion.button
                  onClick={() => window.open('https://status.leadcrm.com', '_blank')}
                  className="text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 uppercase tracking-wider transition-colors"
                  whileHover={{ y: -2 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  Status
                </motion.button>
                <motion.a
                  href="mailto:security@leadcrm.com"
                  className="text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 uppercase tracking-wider transition-colors"
                  whileHover={{ y: -2 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  Security
                </motion.a>
                <motion.button
                  onClick={() => onNavigate('privacy-policy')}
                  className="text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 uppercase tracking-wider transition-colors"
                  whileHover={{ y: -2 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  Privacy
                </motion.button>
                <motion.button
                  onClick={() => onNavigate('terms-of-service')}
                  className="text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 uppercase tracking-wider transition-colors"
                  whileHover={{ y: -2 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  Terms
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      </footer>

      {/* Cookie Banner */}
      <CookieBanner onNavigate={onNavigate} />
    </div>
  );
}
