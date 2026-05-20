import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, X, Zap, Activity, Shield, RefreshCw, 
  Globe, Smartphone, CheckCircle2,
  TrendingUp, Terminal, ArrowUpRight
} from 'lucide-react';
import heroImage from '../assets/homelogo.png';

// --- ANIMATION VARIANTS ---
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

// --- COMPONENTS ---

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Features', id: 'features' },
    { name: 'Workflow', id: 'workflow' },
    { name: 'Security', id: 'security' }
  ];

  const scrollToSection = (id) => {
    const element = document.getElementById(id);

    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/80 backdrop-blur-lg border-b border-slate-200/50 py-4 shadow-sm' : 'bg-transparent py-6'}`}>
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-xl font-bold text-slate-900 tracking-tight">iRecharge</span>
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <button 
              key={link.name} 
              onClick={() => scrollToSection(link.id)} 
              className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors cursor-pointer bg-transparent border-none p-0"
            >
              {link.name}
            </button>
          ))}
        </div>

        {/* Auth Buttons */}
        <div className="hidden md:flex items-center gap-4">
          <Link to="/login" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
            Login
          </Link>
          <Link to="/register" className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-all active:scale-95 shadow-md hover:shadow-xl hover:shadow-slate-900/10">
            Start Recharging
          </Link>
        </div>

        {/* Mobile Toggle */}
        <button className="md:hidden text-slate-600" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-slate-100 overflow-hidden shadow-lg"
          >
            <div className="flex flex-col px-6 py-6 gap-6">
              {navLinks.map((link) => (
                <button 
                  key={link.name} 
                  onClick={() => {
                    setIsOpen(false);
                    scrollToSection(link.id);
                  }} 
                  className="text-sm font-semibold text-slate-600 border-b border-slate-50 pb-2 text-left bg-transparent border-none p-0 cursor-pointer"
                >
                  {link.name}
                </button>
              ))}
              <div className="flex flex-col gap-3 mt-2">
                <Link to="/login" className="w-full text-center py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm">Log in</Link>
                <Link to="/register" className="w-full text-center py-3 rounded-xl bg-slate-900 text-white font-semibold text-sm shadow-md">Get Started</Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const HeroSection = () => (
  <section id="home" className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden bg-white">
    {/* Clean Soft Gradients */}
    <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0 flex justify-center">
      <div className="absolute top-[-10%] left-[-10%] w-[800px] h-[500px] bg-indigo-50/60 rounded-full blur-[100px]"></div>
      <div className="absolute top-[20%] right-[-10%] w-[600px] h-[600px] bg-purple-50/60 rounded-full blur-[120px]"></div>
    </div>

    <div className="max-w-7xl mx-auto px-6 relative z-10">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Left Side: Text Content */}
        <div className="text-left mt-10 lg:mt-0">
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-slate-900 tracking-tight leading-[1.1] mb-6"
          >
            Smart recharge <br className="hidden lg:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-600">
              infrastructure.
            </span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-slate-500 text-lg md:text-xl max-w-xl mb-10 leading-relaxed font-medium"
          >
            Fast, secure and realtime recharge architecture with intelligent queue processing and live transaction tracking. Built for scale and reliability.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="flex flex-col sm:flex-row items-center gap-4"
          >
            <Link to="/register" className="w-full sm:w-auto px-8 py-4 bg-slate-900 text-white rounded-xl font-semibold text-sm hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 active:scale-95">
              Start Recharging <ArrowUpRight className="w-4 h-4 text-slate-400" />
            </Link>
            <Link to="/login" className="w-full sm:w-auto px-8 py-4 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-all flex items-center justify-center shadow-sm active:scale-95">
              Login to Dashboard
            </Link>
          </motion.div>
        </div>

        {/* Right Side: Fintech Image */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="flex justify-center lg:justify-end relative"
        >
          {/* Subtle glow behind image */}
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 rounded-3xl blur-2xl transform scale-90"></div>
          
          <img 
            src={heroImage} 
            alt="Fintech Infrastructure Interface" 
            className="relative z-10 w-full max-w-lg lg:max-w-full h-auto object-contain rounded-3xl shadow-2xl shadow-indigo-900/5 ring-1 ring-slate-200/50 hover:-translate-y-2 transition-transform duration-500"
          />
        </motion.div>
      </div>
    </div>
  </section>
);

const FeaturesSection = () => {
  const features = [
    { icon: Zap, title: "Instant Recharge", desc: "Sub-second processing via direct provider APIs." },
    { icon: RefreshCw, title: "Smart Retry Engine", desc: "Intelligent failover prevents lost transactions." },
    { icon: Activity, title: "Queue Processing", desc: "BullMQ-powered async task management." },
    { icon: Globe, title: "Realtime Updates", desc: "WebSocket driven UI with zero polling." },
    { icon: TrendingUp, title: "Cashback Engine", desc: "Automated reward disbursement upon success." },
    { icon: Shield, title: "Wallet System", desc: "Atomic transactions for foolproof ledgers." },
    { icon: Terminal, title: "Admin Analytics", desc: "Deep insights into node performance & routing." },
    { icon: Smartphone, title: "Live Tracking", desc: "Granular visibility into every API lifecycle." }
  ];

  return (
    <section id="features" className="py-24 relative z-10 bg-slate-50/50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-4">Enterprise-grade capabilities</h2>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto">Everything you need to run a high-volume fintech platform without the operational overhead.</p>
        </div>

        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {features.map((f, i) => (
            <motion.div 
              key={i} 
              variants={fadeUp}
              className="bg-white border border-slate-200/60 p-8 rounded-2xl hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/5 transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 mb-6 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-all">
                <f.icon className="w-5 h-5 text-slate-700 group-hover:text-indigo-600 transition-colors" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 mb-2">{f.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

const HowItWorksSection = () => {
  const steps = [
    { num: "1", title: "Submit Request", desc: "User initiates recharge. Wallet is atomically deducted and transaction marked PENDING safely." },
    { num: "2", title: "Queue Processing", desc: "Worker picks up job, calls provider API resiliently, and logs initial provider response." },
    { num: "3", title: "Live Sync", desc: "Automated verification finalizes status. Instant sync pushes live update to client UI." }
  ];

  return (
    <section id="workflow" className="py-24 relative z-10 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-4">The Lifecycle Flow</h2>
          <p className="text-slate-500 text-lg">Asynchronous by design for ultimate reliability.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <motion.div 
              key={i}
              whileHover={{ y: -4 }}
              className="bg-white border border-slate-200/60 p-8 rounded-2xl relative overflow-hidden shadow-sm hover:shadow-md transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm mb-6">
                {step.num}
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3">{step.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const SecuritySection = () => (
  <section id="security" className="py-24 relative z-10 bg-slate-900 text-white overflow-hidden">
    {/* Subtle dark gradient glow */}
    <div className="absolute top-0 right-0 w-full h-full pointer-events-none flex justify-end opacity-50">
      <div className="w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[100px]"></div>
    </div>
    
    <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
      <Shield className="w-12 h-12 text-indigo-400 mx-auto mb-6" />
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">Uncompromised Security & Trust</h2>
      <p className="text-slate-400 text-lg mb-12 max-w-2xl mx-auto">Built from the ground up to protect financial ledgers and ensure data integrity at every step of the transaction lifecycle.</p>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="p-4 border border-white/10 rounded-2xl bg-white/5 backdrop-blur-sm">
          <p className="font-semibold mb-1 text-sm">Encrypted Transit</p>
          <p className="text-xs text-slate-400">TLS 1.3 everywhere</p>
        </div>
        <div className="p-4 border border-white/10 rounded-2xl bg-white/5 backdrop-blur-sm">
          <p className="font-semibold mb-1 text-sm">Atomic Ledgers</p>
          <p className="text-xs text-slate-400">Zero double-spend</p>
        </div>
        <div className="p-4 border border-white/10 rounded-2xl bg-white/5 backdrop-blur-sm">
          <p className="font-semibold mb-1 text-sm">Idempotent APIs</p>
          <p className="text-xs text-slate-400">Safe retry mechanism</p>
        </div>
        <div className="p-4 border border-white/10 rounded-2xl bg-white/5 backdrop-blur-sm">
          <p className="font-semibold mb-1 text-sm">Instant Sync</p>
          <p className="text-xs text-slate-400">Realtime verification</p>
        </div>
      </div>
    </div>
  </section>
);

const TransactionTicker = () => (
  <div className="w-full bg-slate-50 border-y border-slate-100 py-3 overflow-hidden flex relative z-10">
    <div className="flex animate-[ticker_25s_linear_infinite] whitespace-nowrap">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex gap-8 px-4 items-center">
          <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-widest flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500"/> Airtel Recharge Success • ₹299</span>
          <span className="text-slate-300">|</span>
          <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-widest flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500"/> Jio Completed • ₹719</span>
          <span className="text-slate-300">|</span>
          <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-widest flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500"/> Vi Topup Success • ₹19</span>
          <span className="text-slate-300">|</span>
          <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-widest flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500"/> BSNL Success • ₹199</span>
          <span className="text-slate-300">|</span>
        </div>
      ))}
    </div>
  </div>
);

const Footer = () => (
  <footer className="bg-white border-t border-slate-200 pt-16 pb-12 relative z-10">
    <div className="max-w-7xl mx-auto px-6 flex flex-col items-center justify-center text-center">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded bg-slate-900 flex items-center justify-center">
          <Zap className="w-3 h-3 text-white" />
        </div>
        <span className="text-lg font-bold text-slate-900 tracking-tight">iRecharge</span>
      </div>
      <p className="text-sm text-slate-500 max-w-sm mb-8 font-medium">
        The most reliable asynchronous realtime recharge infrastructure.
      </p>
    </div>
  </footer>
);

export default function HomePage() {
  // Setup SEO / Meta tags
  useEffect(() => {
    document.title = "iRecharge - Smart Recharge Infrastructure";
    
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.name = "description";
      document.head.appendChild(metaDescription);
    }
    metaDescription.content = "Fast, secure and realtime recharge infrastructure platform with smart routing and live transaction tracking.";

    // Clean body background
    document.body.classList.add('bg-white');
    return () => {
      document.body.classList.remove('bg-white');
    }
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-indigo-500/20 selection:text-indigo-900">
      <Navbar />
      <HeroSection />
      <TransactionTicker />
      <FeaturesSection />
      <HowItWorksSection />
      <SecuritySection />
      <Footer />

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}} />
    </div>
  );
}
