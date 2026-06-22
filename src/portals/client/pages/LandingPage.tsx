import React from 'react';
import { motion } from 'motion/react';
import { 
  ArrowRight, CheckCircle2, BarChart3, Users, Zap, 
  Briefcase, ShieldCheck, Globe, Play, Star, 
  Quote, ExternalLink, ChevronRight, Package,
  Mail, Phone
} from 'lucide-react';

export default function LandingPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [billingCycle, setBillingCycle] = React.useState<'monthly' | 'quarterly' | 'annual'>('monthly');

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#030712] text-slate-800 dark:text-slate-200 font-sans selection:bg-[#0A6EFF] selection:text-white overflow-x-hidden">
      {/* Grid Background */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.03]" 
        style={{ backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px)`, backgroundSize: '40px 40px' }} 
      />
      
      {/* Navbar */}
      <nav className="container mx-auto px-6 py-6 flex justify-between items-center relative z-50">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <div className="w-10 h-10 bg-white ring-1 ring-blue-500/10 rounded-xl overflow-hidden flex items-center justify-center shadow-[0_0_15px_rgba(10,110,255,0.15)] shrink-0">
            <img 
              src="/leadcrm_logo.png" 
              alt="LeadCRM Logo" 
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-display">LeadCRM</span>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex gap-4 items-center"
        >
          <button 
            onClick={() => onNavigate('login')}
            className="px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Login
          </button>
          <button 
            onClick={() => onNavigate('register')}
            className="px-5 py-2.5 text-sm font-medium bg-[#0A6EFF] text-white rounded-lg hover:bg-blue-600 transition-all hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(10,110,255,0.2)]"
          >
            Get Started
          </button>
        </motion.div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        
        <div className="container mx-auto px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              Next-Gen CRM for IT Solutions
            </div>
            <h1 className="text-5xl md:text-8xl font-extrabold text-slate-900 dark:text-white mb-8 tracking-tight leading-[1.1] max-w-5xl mx-auto font-display">
              Scale your <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0A6EFF] via-blue-400 to-purple-400">IT Business</span> <br />
              with precision.
            </h1>
            <p className="text-xl text-slate-500 dark:text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed">
              The only all-in-one CRM built specifically for security, telecom, and IT infrastructure providers. Manage contacts, assets, and workflows in one place.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-20">
              <button 
                onClick={() => onNavigate('register')}
                className="px-8 py-4 text-lg font-semibold bg-[#0A6EFF] text-white rounded-xl hover:bg-blue-600 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(10,110,255,0.3)]"
              >
                Start Free Trial <ArrowRight size={20} />
              </button>
              <button 
                className="px-8 py-4 text-lg font-semibold bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition-all flex items-center justify-center gap-2 backdrop-blur-sm"
              >
                <Play size={20} className="fill-current" /> Watch Demo
              </button>
            </div>
          </motion.div>

          {/* Dashboard Preview */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative mx-auto max-w-6xl group"
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-[#0A6EFF] to-purple-500 rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0B1120]/80 backdrop-blur-xl p-2 shadow-2xl overflow-hidden">
              <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-[#030712] aspect-[16/10] flex items-center justify-center relative">
                {/* Mock UI */}
                <div className="absolute inset-0 flex">
                  <div className="w-64 border-r border-gray-200 dark:border-white/5 p-6 space-y-6 hidden md:block">
                    <div className="h-4 bg-white/10 rounded w-3/4"></div>
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-3 bg-gray-100 dark:bg-white/5 rounded w-full"></div>)}
                    </div>
                  </div>
                  <div className="flex-1 p-8">
                    <div className="flex justify-between mb-10">
                      <div className="h-8 bg-white/10 rounded w-48"></div>
                      <div className="h-8 bg-white/10 rounded w-32"></div>
                    </div>
                    <div className="grid grid-cols-3 gap-6 mb-10">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-32 bg-gray-100 dark:bg-white/[0.03] rounded-2xl border border-gray-200 dark:border-white/5 p-4">
                          <div className="h-3 bg-white/10 rounded w-1/2 mb-4"></div>
                          <div className="h-6 bg-white/20 rounded w-3/4"></div>
                        </div>
                      ))}
                    </div>
                    <div className="h-64 bg-white dark:bg-white/[0.02] rounded-2xl border border-gray-200 dark:border-white/5 p-6">
                      <div className="flex gap-2 mb-6">
                        {[1, 2, 3, 4, 5, 6, 7].map(i => <div key={i} className="flex-1 h-32 bg-blue-500/20 rounded-lg self-end" style={{ height: `${Math.random() * 100 + 20}%` }}></div>)}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Floating Badge */}
                <div className="absolute bottom-10 right-10 bg-[#0A6EFF] text-slate-900 dark:text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
                  <Zap size={20} />
                  <span className="font-bold">Automation Active</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="py-20 border-y border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.01]">
        <div className="container mx-auto px-6">
          <p className="text-center text-slate-500 text-sm font-medium uppercase tracking-widest mb-10">Trusted by innovative IT teams worldwide</p>
          <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
            {['TechFlow', 'SecureNet', 'CloudScale', 'DataGuard', 'NetOps'].map(name => (
              <span key={name} className="text-2xl font-bold text-slate-700 dark:text-slate-300 font-display">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section className="py-32 relative">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6 font-display">Engineered for Growth</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto text-lg">Stop juggling spreadsheets. LeadCRM brings your entire sales and operations cycle into a single, high-performance interface.</p>
          </div>

          <motion.div 
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {/* ... existing cards ... */}
          </motion.div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-32 relative overflow-hidden">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6 font-display">Why Choose LeadCRM?</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto text-lg">Built by IT professionals for IT professionals. We understand your unique challenges.</p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              { title: 'Increased Efficiency', desc: 'Automate repetitive tasks and focus on closing deals and delivering services.', icon: Zap, color: 'text-blue-400' },
              { title: 'Better Visibility', desc: 'Get a 360-degree view of your sales pipeline, assets, and technician schedules.', icon: BarChart3, color: 'text-purple-400' },
              { title: 'Enhanced Security', desc: 'Enterprise-grade security to protect your sensitive client data and business docs.', icon: ShieldCheck, color: 'text-green-400' },
              { title: 'Scalable Platform', desc: 'From startup to enterprise, our multi-tenant SaaS architecture grows with you.', icon: Globe, color: 'text-orange-400' },
            ].map((benefit, i) => (
              <motion.div 
                key={i}
                whileHover={{ y: -5 }}
                className="p-8 rounded-3xl bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 hover:border-gray-200 dark:border-white/10 transition-all"
              >
                <div className={`w-12 h-12 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-6 ${benefit.color}`}>
                  <benefit.icon size={24} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3 font-display">{benefit.title}</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{benefit.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-32 bg-gray-50 dark:bg-white/[0.01] border-y border-gray-200 dark:border-white/5">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-[#0A6EFF] font-bold uppercase tracking-widest text-sm mb-6">
                <Star size={16} className="fill-current" /> Success Stories
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-8 font-display leading-tight">
                "LeadCRM transformed how we handle our IT projects."
              </h2>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 p-0.5">
                  <div className="w-full h-full rounded-full bg-gray-50 dark:bg-[#030712] flex items-center justify-center text-xl font-bold">CT</div>
                </div>
                <div>
                  <div className="text-slate-900 dark:text-white font-bold text-lg">Camxian Technologies</div>
                  <div className="text-slate-500">Security & IT Solutions Provider</div>
                </div>
              </div>
            </div>
            <div className="relative">
              <Quote size={120} className="absolute -top-10 -left-10 text-slate-900 dark:text-white/[0.03] pointer-events-none" />
              <div className="bg-white dark:bg-[#0B1120] p-10 rounded-[2.5rem] border border-gray-200 dark:border-white/5 relative z-10">
                <p className="text-xl text-slate-700 dark:text-slate-300 italic leading-relaxed mb-8">
                  "Before LeadCRM, we were losing track of site surveys and hardware warranties. Now, everything is automated. Our technicians are more efficient, and our sales conversion has increased by 40%."
                </p>
                <div className="flex gap-1 text-yellow-500">
                  {[1, 2, 3, 4, 5].map(i => <Star key={i} size={20} className="fill-current" />)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-32">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6 font-display">Simple, Scaleable Pricing</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto text-lg mb-10">Choose the perfect plan for your business stage.</p>
            
            <div className="inline-flex items-center p-1 bg-gray-100 dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10">
              <button 
                onClick={() => setBillingCycle('monthly')}
                className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${billingCycle === 'monthly' ? 'bg-[#0A6EFF] text-slate-900 dark:text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
              >
                Monthly
              </button>
              <button 
                onClick={() => setBillingCycle('quarterly')}
                className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${billingCycle === 'quarterly' ? 'bg-[#0A6EFF] text-slate-900 dark:text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
              >
                Quarterly
              </button>
              <button 
                onClick={() => setBillingCycle('annual')}
                className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${billingCycle === 'annual' ? 'bg-[#0A6EFF] text-slate-900 dark:text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
              >
                Annual
              </button>
            </div>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              { 
                name: 'Starter', 
                prices: { monthly: '₱999', quarterly: '₱2,699', annual: '₱9,999' }, 
                desc: 'For small IT teams.', 
                features: ['Up to 1,000 Contacts', 'Basic Pipeline', 'Email Support', 'Mobile App Access'] 
              },
              { 
                name: 'Professional', 
                prices: { monthly: '₱2,499', quarterly: '₱6,749', annual: '₱24,999' }, 
                desc: 'Our most popular plan.', 
                features: ['Unlimited Contacts', 'Workflow Automation', 'Batch Messaging', 'Priority Support', 'Custom Dashboards'], 
                popular: true 
              },
              { 
                name: 'Enterprise', 
                prices: { monthly: 'Custom', quarterly: 'Custom', annual: 'Custom' }, 
                desc: 'For large organizations.', 
                features: ['Custom Integrations', 'Dedicated Manager', 'SLA Guarantee', 'Advanced Security', 'White-label Option'] 
              },
            ].map((plan, i) => (
              <motion.div 
                key={i}
                whileHover={{ y: -10 }}
                className={`p-10 rounded-[2.5rem] border flex flex-col ${plan.popular ? 'bg-gradient-to-b from-[#0B1120] to-[#030712] border-[#0A6EFF] shadow-[0_0_50px_rgba(10,110,255,0.15)] relative' : 'bg-white dark:bg-[#0B1120] border-gray-200 dark:border-white/5'}`}
              >
                {plan.popular && <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0A6EFF] text-slate-900 dark:text-white px-6 py-1.5 text-xs font-bold rounded-full uppercase tracking-widest shadow-xl">Best Value</span>}
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 font-display">{plan.name}</h3>
                <p className="text-slate-500 text-sm mb-8 h-10">{plan.desc}</p>
                <div className="text-5xl font-extrabold text-slate-900 dark:text-white mb-10 font-display">
                  {plan.prices[billingCycle]}
                  {plan.prices[billingCycle] !== 'Custom' && <span className="text-lg text-slate-500 font-normal">/{billingCycle === 'monthly' ? 'mo' : billingCycle === 'quarterly' ? 'qtr' : 'yr'}</span>}
                </div>
                <ul className="space-y-5 mb-12 flex-1">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                      <CheckCircle2 size={20} className="text-[#0A6EFF] shrink-0" /> 
                      <span className="text-sm">{f}</span>
                    </li>
                  ))}
                </ul>
                <button 
                  onClick={() => onNavigate('register')}
                  className={`w-full py-4 rounded-xl font-bold transition-all hover:scale-105 active:scale-95 ${plan.popular ? 'bg-[#0A6EFF] text-slate-900 dark:text-white shadow-[0_0_20px_rgba(10,110,255,0.3)]' : 'bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-slate-900 dark:text-white hover:bg-gray-200 dark:hover:bg-white/10'}`}
                >
                  Get Started
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Us Section */}
      <section className="py-32 relative">
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 rounded-[3rem] overflow-hidden grid md:grid-cols-2">
            <div className="p-12 md:p-16 border-r border-gray-200 dark:border-white/5">
              <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-6 font-display">Get in Touch</h2>
              <p className="text-slate-500 dark:text-slate-400 mb-10">Have questions about LeadCRM? Our team of IT experts is here to help you scale your business.</p>
              
              <div className="space-y-6">
                <div className="flex items-center gap-4 text-slate-700 dark:text-slate-300">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                    <Mail size={20} />
                  </div>
                  <span>support@leadcrm.com</span>
                </div>
                <div className="flex items-center gap-4 text-slate-700 dark:text-slate-300">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                    <Phone size={20} />
                  </div>
                  <span>+63 (02) 8888-8888</span>
                </div>
                <div className="flex items-center gap-4 text-slate-700 dark:text-slate-300">
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400">
                    <Globe size={20} />
                  </div>
                  <span>Manila, Philippines</span>
                </div>
              </div>
            </div>
            
            <div className="p-12 md:p-16 bg-gray-50 dark:bg-white/[0.01]">
              <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">First Name</label>
                    <input type="text" className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Last Name</label>
                    <input type="text" className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Email Address</label>
                  <input type="email" className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Message</label>
                  <textarea rows={4} className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-[#0A6EFF] transition-all resize-none"></textarea>
                </div>
                <button className="w-full py-4 bg-[#0A6EFF] text-white rounded-xl font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20">
                  Send Message
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-[#0A6EFF]/5 pointer-events-none"></div>
        <div className="container mx-auto px-6 relative z-10">
          <div className="bg-gradient-to-br from-[#0A6EFF] to-blue-700 rounded-[3rem] p-12 md:p-24 text-center relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none" style={{ backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px)`, backgroundSize: '30px 30px' }}></div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl md:text-6xl font-extrabold text-slate-900 dark:text-white mb-8 font-display">Ready to modernize your <br /> IT sales process?</h2>
              <p className="text-blue-100 text-xl mb-12 max-w-2xl mx-auto">Join hundreds of IT solution providers who are scaling faster with LeadCRM. No credit card required.</p>
              <div className="flex flex-col sm:flex-row justify-center gap-6">
                <button 
                  onClick={() => onNavigate('register')}
                  className="px-10 py-5 text-xl font-bold bg-white text-[#0A6EFF] rounded-2xl hover:bg-blue-50 transition-all hover:scale-105 active:scale-95 shadow-2xl"
                >
                  Start Your 14-Day Free Trial
                </button>
                <button className="px-10 py-5 text-xl font-bold bg-transparent border-2 border-white/30 text-slate-900 dark:text-white rounded-2xl hover:bg-gray-200 dark:hover:bg-white/10 transition-all">
                  Contact Sales
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-[#030712] border-t border-gray-200 dark:border-white/5 py-20">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-20">
            <div className="col-span-2">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-white ring-1 ring-blue-500/10 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                  <img 
                    src="/leadcrm_logo.png" 
                    alt="LeadCRM Logo" 
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-display">LeadCRM</span>
              </div>
              <p className="text-slate-500 max-w-xs leading-relaxed mb-8">
                The premier CRM platform for IT solutions providers, security firms, and telecom agencies.
              </p>
              <div className="flex gap-4">
                {/* Social placeholders */}
                {[1, 2, 3, 4].map(i => <div key={i} className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center hover:bg-[#0A6EFF] hover:border-[#0A6EFF] transition-all cursor-pointer"><Globe size={18} /></div>)}
              </div>
            </div>
            <div>
              <h4 className="text-slate-900 dark:text-white font-bold mb-6 font-display">Product</h4>
              <ul className="space-y-4 text-slate-500 text-sm">
                <li><a href="#" className="hover:text-[#0A6EFF] transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-[#0A6EFF] transition-colors">Workflows</a></li>
                <li><a href="#" className="hover:text-[#0A6EFF] transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-[#0A6EFF] transition-colors">API Docs</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-slate-900 dark:text-white font-bold mb-6 font-display">Company</h4>
              <ul className="space-y-4 text-slate-500 text-sm">
                <li><a href="#" className="hover:text-[#0A6EFF] transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-[#0A6EFF] transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-[#0A6EFF] transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-[#0A6EFF] transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-12 border-t border-gray-200 dark:border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-slate-600 text-sm">© 2026 LeadCRM. All rights reserved.</p>
            <div className="flex gap-8 text-xs font-bold text-slate-600 uppercase tracking-widest">
              <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">Status</a>
              <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">Security</a>
              <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">Cookies</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
