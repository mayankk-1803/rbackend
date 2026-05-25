import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, X, Zap, Activity, Shield, RefreshCw, 
  Globe, Smartphone, CheckCircle2,
  TrendingUp, Terminal, ArrowUpRight, Lock, Key, Server
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import heroImage from '../assets/homelogo.png';
import ThemeSelector from '../components/ThemeSelector';
import { useIsIOS } from '../utils/device';

// Register GSAP ScrollTrigger
gsap.registerPlugin(ScrollTrigger);

export default function HomePage() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isIOS = useIsIOS();

  const heroRef = useRef(null);
  const tickerContainerRef = useRef(null);
  const tickerTrackRef = useRef(null);
  const bentoGridRef = useRef(null);
  const timelineRef = useRef(null);
  const securityRef = useRef(null);
  const ctaRef = useRef(null);
  const ctaSpotlightRef = useRef(null);

  // Setup SEO and Global styles
  useEffect(() => {
    document.title = "iRecharge - Smart Recharge Infrastructure";
    
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.name = "description";
      document.head.appendChild(metaDescription);
    }
    metaDescription.content = "Fast, secure and realtime recharge infrastructure platform with smart routing and live transaction tracking.";

    // Set body background dark class
    document.body.classList.add('bg-[#050816]');
    return () => {
      document.body.classList.remove('bg-[#050816]');
    }
  }, []);

  // Scrolling navbar state
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // GSAP animations
  useEffect(() => {
    if (!heroRef.current) return undefined;

    // 1. Text reveals in Hero Section
    const heroTitleWords = heroRef.current.querySelectorAll('.hero-title-line');
    const heroSubtitle = heroRef.current.querySelector('.hero-subtitle');
    const heroCtas = heroRef.current.querySelector('.hero-ctas');
    const heroMockup = heroRef.current.querySelector('.hero-mockup-wrapper');

    const heroTl = gsap.timeline({ defaults: { ease: "power4.out" } });

    heroTl.fromTo(heroTitleWords, 
      { y: 60, opacity: 0 }, 
      { y: 0, opacity: 1, stagger: isIOS ? 0.06 : 0.15, duration: isIOS ? 0.55 : 1.2 }
    )
    .fromTo(heroSubtitle, 
      { y: 30, opacity: 0 }, 
      { y: 0, opacity: 1, duration: isIOS ? 0.45 : 1 }, 
      "-=0.6"
    )
    .fromTo(heroCtas, 
      { y: 20, opacity: 0 }, 
      { y: 0, opacity: 1, duration: isIOS ? 0.35 : 0.8 }, 
      "-=0.5"
    )
    .fromTo(heroMockup, 
      { opacity: 0, scale: 0.9, y: 40 }, 
      { opacity: 1, scale: 1, y: 0, duration: isIOS ? 0.55 : 1.5, ease: isIOS ? "power2.out" : "elastic.out(1, 0.75)" }, 
      "-=0.8"
    );

    if (isIOS) {
      gsap.set([".floating-card-1", ".floating-card-2", ".floating-card-3", ".security-shield-pulse"], { clearProps: "animation" });
      gsap.set([".bento-card", ".timeline-step-card", ".security-card"], { opacity: 1, y: 0, x: 0, scale: 1 });
      return () => {
        heroTl.kill();
        ScrollTrigger.getAll().forEach(t => t.kill());
      };
    }

    // Continuous floating animation for right-side layers
    gsap.to(".floating-card-1", {
      y: -15,
      rotationZ: 1.5,
      repeat: -1,
      yoyo: true,
      duration: 5,
      ease: "sine.inOut"
    });
    gsap.to(".floating-card-2", {
      y: 12,
      rotationZ: -1.5,
      repeat: -1,
      yoyo: true,
      duration: 6,
      ease: "sine.inOut"
    });
    gsap.to(".floating-card-3", {
      y: -8,
      rotationZ: 0.8,
      repeat: -1,
      yoyo: true,
      duration: 4.5,
      ease: "sine.inOut"
    });

    // 2. Infinite Marquee Ticker with GSAP
    const tickerTrack = tickerTrackRef.current;
    const scrollWidth = tickerTrack.scrollWidth / 2;
    
    const tickerAnim = gsap.to(tickerTrack, {
      x: -scrollWidth,
      duration: 25,
      ease: "none",
      repeat: -1
    });

    // Pause on hover
    const handleMouseEnter = () => tickerAnim.pause();
    const handleMouseLeave = () => tickerAnim.play();

    const tickerContainer = tickerContainerRef.current;
    tickerContainer.addEventListener('mouseenter', handleMouseEnter);
    tickerContainer.addEventListener('mouseleave', handleMouseLeave);

    // 3. Bento Grid Entrance Animation (ScrollTrigger)
    const bentoCards = bentoGridRef.current.querySelectorAll('.bento-card');
    gsap.fromTo(bentoCards, 
      { opacity: 0, y: 50, scale: 0.95 },
      {
        scrollTrigger: {
          trigger: bentoGridRef.current,
          start: "top 80%",
          toggleActions: "play none none none"
        },
        opacity: 1,
        y: 0,
        scale: 1,
        stagger: 0.08,
        duration: 1,
        ease: "power3.out"
      }
    );

    // 4. Timeline Progress Line Animation (ScrollTrigger)
    const timelineProgress = timelineRef.current.querySelector('.timeline-progress-bar');
    const timelineSteps = timelineRef.current.querySelectorAll('.timeline-step-card');

    gsap.fromTo(timelineProgress, 
      { scaleY: 0 },
      {
        scrollTrigger: {
          trigger: timelineRef.current,
          start: "top 40%",
          end: "bottom 70%",
          scrub: true
        },
        scaleY: 1,
        ease: "none"
      }
    );

    // Highlight timeline cards on scroll
    timelineSteps.forEach((step, index) => {
      gsap.fromTo(step, 
        { opacity: 0.4, y: 30 },
        {
          scrollTrigger: {
            trigger: step,
            start: "top 75%",
            end: "bottom 70%",
            toggleActions: "play reverse play reverse",
            onEnter: () => step.classList.add('active-step'),
            onLeaveBack: () => step.classList.remove('active-step')
          },
          opacity: 1,
          y: 0,
          duration: 0.6
        }
      );
    });

    // 5. Security Section Particle Animations
    const securityCards = securityRef.current.querySelectorAll('.security-card');
    gsap.fromTo(securityCards, 
      { opacity: 0, x: (i) => i % 2 === 0 ? -40 : 40 },
      {
        scrollTrigger: {
          trigger: securityRef.current,
          start: "top 75%"
        },
        opacity: 1,
        x: 0,
        stagger: 0.1,
        duration: 1,
        ease: "power4.out"
      }
    );

    // Pulse animation on the center security shield
    gsap.to(".security-shield-pulse", {
      scale: 1.15,
      opacity: 0.6,
      repeat: -1,
      yoyo: true,
      duration: 3,
      ease: "sine.inOut"
    });

    // Cleanups
    return () => {
      tickerAnim.kill();
      if (tickerContainer) {
        tickerContainer.removeEventListener('mouseenter', handleMouseEnter);
        tickerContainer.removeEventListener('mouseleave', handleMouseLeave);
      }
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, [isIOS]);

  // CTA Section mouse tracking spotlight
  const handleCtaMouseMove = (e) => {
    if (isIOS || !ctaRef.current || !ctaSpotlightRef.current) return;
    const rect = ctaRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    gsap.to(ctaSpotlightRef.current, {
      left: x,
      top: y,
      duration: 0.4,
      ease: "power2.out"
    });
  };

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

  const features = [
    { icon: Zap, title: "Instant Recharge", desc: "Sub-second processing via direct provider APIs with automated routing pathways.", size: "large", accent: "cyan" },
    { icon: RefreshCw, title: "Smart Retry Engine", desc: "Intelligent real-time failover preventing lost or stuck payments.", size: "small", accent: "purple" },
    { icon: Activity, title: "Queue Architecture", desc: "BullMQ-powered background tasks built for enterprise throughput scale.", size: "small", accent: "green" },
    { icon: Globe, title: "Realtime Updates", desc: "Interactive WebSocket driven client dashboard syncing with state streams.", size: "medium", accent: "cyan" },
    { icon: TrendingUp, title: "Cashback Incentive", desc: "Algorithmic wallet rebates distributed directly upon success validations.", size: "medium", accent: "green" },
    { icon: Shield, title: "Ledger Security", desc: "Cryptographically safe database balances backing multi-currency accounts.", size: "large", accent: "purple" },
    { icon: Terminal, title: "Developer Gateway", desc: "High-performance REST architecture, detailed analytics logs, and sandbox credentials.", size: "small", accent: "cyan" },
    { icon: Smartphone, title: "Global Tracking", desc: "Comprehensive step-by-step transaction logs monitoring all API states.", size: "small", accent: "purple" }
  ];

  const steps = [
    { num: "01", title: "Submit Transaction Request", desc: "User triggers bill recharge. The system processes the wallet ledger atomically and records the pending transaction state." },
    { num: "02", title: "Queue & Gateway Routing", desc: "Asynchronous background workers trigger direct provider integrations, monitoring responses with smart latency retry parameters." },
    { num: "03", title: "Sync Verification & Rebate", desc: "Provider webhook or poll secures state. Realtime WebSockets push status to the client, distributing cached cashback coins." }
  ];

  return (
    <div className="landing-page min-h-screen bg-[#050816] text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-white relative overflow-hidden">
      
      {/* Ambient Nebula Light System */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="ambient-blob absolute -top-[10%] -left-[10%] w-[60%] h-[60%] bg-cyan-600/10 rounded-full blur-[150px] animate-blob-left"></div>
        <div className="ambient-blob absolute top-[25%] -right-[15%] w-[60%] h-[60%] bg-purple-600/10 rounded-full blur-[160px] animate-blob-right"></div>
        <div className="ambient-blob absolute bottom-[10%] left-[20%] w-[50%] h-[50%] bg-blue-600/8 rounded-full blur-[130px] animate-blob-bottom"></div>
        <div className="absolute inset-0 neural-grid opacity-25"></div>
      </div>

      {/* Floating Translucent Glass Navbar */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${scrolled ? 'bg-slate-950/60 backdrop-blur-xl border-b border-white/5 py-4 shadow-2xl' : 'bg-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group navbar-logo-container">
            <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center border border-white/10 group-hover:border-white/30 transition-all duration-500">
              <Zap className="w-4 h-4 text-white fill-white/10 animate-pulse" />
            </div>
            <span className="text-xl font-black text-white tracking-tight font-sans lowercase navbar-logo-text">irecharge</span>
          </Link>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-10">
            {navLinks.map((link) => (
              <button 
                key={link.name} 
                onClick={() => scrollToSection(link.id)} 
                className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors cursor-pointer relative py-1 hover:cyan-glow"
              >
                {link.name}
              </button>
            ))}
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center gap-6">
            <ThemeSelector />
            <Link to="/login" className="text-xs font-black uppercase tracking-widest text-slate-300 hover:text-white transition-all">
              Login
            </Link>
            <Link to="/register" className="px-6 py-3 bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-cyan-400/25 active:scale-95">
              Start Recharging
            </Link>
          </div>

          {/* Mobile Toggle */}
          <div className="md:hidden flex items-center gap-2">
            <ThemeSelector />
            <button className="text-slate-400 hover:text-white" onClick={() => setIsOpen(!isOpen)}>
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isOpen && (
            <motion.div 
              initial={isIOS ? { opacity: 0, y: -8 } : { opacity: 0, height: 0 }}
              animate={isIOS ? { opacity: 1, y: 0 } : { opacity: 1, height: 'auto' }}
              exit={isIOS ? { opacity: 0, y: -8 } : { opacity: 0, height: 0 }}
              className="md:hidden bg-slate-950/95 backdrop-blur-2xl border-b border-white/5 overflow-hidden shadow-2xl"
            >
              <div className="flex flex-col px-6 py-8 gap-6">
                {navLinks.map((link) => (
                  <button 
                    key={link.name} 
                    onClick={() => {
                      setIsOpen(false);
                      scrollToSection(link.id);
                    }} 
                    className="text-xs font-black uppercase tracking-widest text-left text-slate-400 border-b border-white/5 pb-3 bg-transparent cursor-pointer"
                  >
                    {link.name}
                  </button>
                ))}
                <div className="flex flex-col gap-4 mt-2">
                  <Link to="/login" className="w-full text-center py-4 rounded-xl border border-white/10 text-slate-300 font-black uppercase tracking-widest text-xs">Log in</Link>
                  <Link to="/register" className="w-full text-center py-4 rounded-xl bg-cyan-400 text-slate-950 font-black uppercase tracking-widest text-xs shadow-lg shadow-cyan-400/25">Get Started</Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Cinematic Hero Section */}
      <section ref={heroRef} id="home" className="relative pt-36 pb-20 md:pt-48 md:pb-36 overflow-hidden flex items-center min-h-[90vh]">
        <div className="max-w-7xl mx-auto px-6 relative z-10 w-full">
          <div className="grid lg:grid-cols-12 gap-16 items-center">
            
            {/* Left Side Text Content */}
            <div className="text-left lg:col-span-6 space-y-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-cyan-950/40 border border-cyan-500/30 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.15)]">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping"></div>
                <span className="text-[9px] font-black text-cyan-400 uppercase tracking-[0.25em] cyan-glow">Next-Gen Recharge Infrastructure</span>
              </div>
              
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white tracking-tighter leading-[0.95] uppercase italic">
                <span className="block hero-title-line">Smart Recharge</span>
                <span className="block hero-title-line text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-indigo-500 cyan-glow">
                  Infrastructure
                </span>
              </h1>

              <p className="text-slate-400 text-base md:text-lg max-w-xl leading-relaxed hero-subtitle font-medium">
                High-performance transactional gateway with resilient queue distribution, real-time feedback loops, and sub-second payment settlement channels. Built for enterprise scale.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-5 pt-4 hero-ctas">
                <Link to="/register" className="w-full sm:w-auto px-8 py-5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-400/25 active:scale-95 cursor-pointer">
                  Start Recharging <ArrowUpRight className="w-4 h-4" />
                </Link>
                <Link to="/login" className="w-full sm:w-auto px-8 py-5 bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center shadow-md active:scale-95 cursor-pointer">
                  Open Mission Control
                </Link>
              </div>
            </div>

            {/* Right Side: Futuristic Floating Mockup Panel */}
            <div className="lg:col-span-6 flex justify-center lg:justify-end relative hero-mockup-wrapper">
              <div className="relative w-full max-w-md md:max-w-lg aspect-square flex items-center justify-center">
                
                {/* Glowing Core Orbit */}
                <div className="absolute w-80 h-80 rounded-full bg-gradient-to-tr from-cyan-500/10 to-purple-600/10 blur-[60px] animate-pulse"></div>

                {/* Layer 1: Simulated Main Terminal Panel */}
                <div className="absolute w-[90%] aspect-[4/3] bg-slate-950/70 border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-md floating-card-1 z-10">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500/60"></span>
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60"></span>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60"></span>
                    </div>
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">ledger_stream_v2.log</span>
                  </div>
                  <div className="space-y-3">
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-cyan-400/10 rounded-lg"><Zap className="w-4 h-4 text-cyan-400" /></div>
                        <div>
                          <p className="text-[10px] font-black text-white uppercase">RECHARGE SECURED</p>
                          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tight">JIO MOBILE • 9876543210</p>
                        </div>
                      </div>
                      <span className="text-xs font-black text-cyan-400">+₹299.00</span>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-400/10 rounded-lg"><Server className="w-4 h-4 text-purple-400" /></div>
                        <div>
                          <p className="text-[10px] font-black text-white uppercase">QUEUE QUEUED</p>
                          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tight">worker_node_4a • ACTIVE</p>
                        </div>
                      </div>
                      <span className="text-[8px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 font-bold border border-purple-500/20">PENDING</span>
                    </div>
                  </div>
                </div>

                {/* Layer 2: Glowing Chart Mockup Overlay */}
                <div className="absolute w-[60%] aspect-square bg-slate-900/80 border border-white/10 rounded-3xl p-5 shadow-2xl backdrop-blur-md floating-card-2 right-0 bottom-4 z-20">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2">TELEMETRY DATA</p>
                  <p className="text-xl font-black text-white tracking-tighter uppercase italic">99.98% <span className="text-[8px] text-emerald-400 tracking-widest font-black uppercase">UPTIME</span></p>
                  
                  {/* Decorative Neon Graph Grid */}
                  <div className="mt-4 h-24 w-full relative flex items-end">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <path d="M 0 80 Q 20 20, 40 50 T 80 10 T 100 40" fill="none" stroke="url(#cyanGrad)" strokeWidth="3" />
                      <defs>
                        <linearGradient id="cyanGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#7B61FF" />
                          <stop offset="100%" stopColor="#00D9FF" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute bottom-2 right-2 w-3 h-3 bg-cyan-400 rounded-full animate-ping"></div>
                  </div>
                </div>

                {/* Layer 3: Cyber Security Badge Overlay */}
                <div className="absolute w-[45%] bg-slate-950/90 border border-white/15 rounded-2xl p-4 shadow-xl floating-card-3 left-4 bottom-8 z-30">
                  <div className="flex items-center gap-3">
                    <Shield className="w-6 h-6 text-emerald-400 fill-current/10" />
                    <div>
                      <p className="text-[8px] font-black text-white uppercase tracking-widest">SECURITY STATUS</p>
                      <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-tight">ACTIVE SHIELD</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Live Transaction Ticker using GSAP */}
      <div ref={tickerContainerRef} className="w-full bg-slate-950/60 border-y border-white/5 py-4 overflow-hidden relative z-10 backdrop-blur-md cursor-pointer">
        <div ref={tickerTrackRef} className="flex gap-12 whitespace-nowrap will-change-transform">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex gap-12 items-center flex-shrink-0">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0"/> Airtel Recharge Success <span className="text-cyan-400 font-black">₹299</span>
              </span>
              <span className="text-white/10">•</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0"/> Jio Completed <span className="text-cyan-400 font-black">₹719</span>
              </span>
              <span className="text-white/10">•</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0"/> Vi Topup Success <span className="text-cyan-400 font-black">₹19</span>
              </span>
              <span className="text-white/10">•</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0"/> BSNL Success <span className="text-cyan-400 font-black">₹199</span>
              </span>
              <span className="text-white/10">•</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bento Grid Features Section */}
      <section id="features" className="py-28 relative z-10 bg-slate-950/20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20 space-y-4">
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tighter uppercase italic">
              Quantum <span className="text-cyan-400 cyan-glow">Engine Features</span>
            </h2>
            <p className="text-slate-400 text-base md:text-lg max-w-2xl mx-auto">
              Engineered with modern architectural standards, ensuring absolute ledger safety and high throughput processing.
            </p>
          </div>

          {/* Bento Grid Container */}
          <div ref={bentoGridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => {
              const colSpan = f.size === 'large' ? 'lg:col-span-2' : f.size === 'medium' ? 'lg:col-span-2' : '';
              return (
                <div 
                  key={i} 
                  className={`bento-card glass-card p-8 rounded-3xl border border-white/5 hover:border-cyan-500/30 transition-all duration-500 group flex flex-col justify-between overflow-hidden relative ${colSpan}`}
                >
                  {/* Hover Accent spotlight background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                  
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5 mb-8 group-hover:bg-cyan-500/10 group-hover:border-cyan-500/20 transition-all">
                      <f.icon className="w-6 h-6 text-slate-300 group-hover:text-cyan-400 group-hover:scale-105 transition-all" />
                    </div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight mb-3">{f.title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed max-w-md">{f.desc}</p>
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section ref={timelineRef} id="workflow" className="py-28 relative z-10 bg-slate-950/40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-24 space-y-4">
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tighter uppercase italic">
              Lifecycle <span className="text-cyan-400 cyan-glow">Processing flow</span>
            </h2>
            <p className="text-slate-400 text-base md:text-lg max-w-xl mx-auto">
              Our automated, asynchronous execution pipeline guarantees zero payment loss.
            </p>
          </div>

          <div className="relative max-w-4xl mx-auto">
            {/* Timeline Progress connector line */}
            <div className="timeline-path absolute left-6 md:left-1/2 top-0 bottom-0 h-full w-[2px]"></div>
            <div className="timeline-progress-bar absolute left-6 md:left-1/2 top-0 h-full w-[2px] bg-gradient-to-b from-cyan-400 to-purple-600 origin-top transform scale-y-0 z-10"></div>

            <div className="space-y-16">
              {steps.map((step, i) => (
                <div key={i} className="timeline-step-card flex flex-col md:flex-row items-start md:items-center justify-between relative z-20 group">
                  
                  {/* Left layout wrapper */}
                  <div className="w-full md:w-[45%] flex justify-start md:justify-end md:text-right pr-0 md:pr-12 pl-14 md:pl-0 order-2 md:order-1 mt-4 md:mt-0">
                    <div className="glass-card p-6 md:p-8 rounded-3xl border border-white/5 group-hover:border-cyan-500/20 transition-all duration-500 w-full">
                      <h3 className="text-md font-black text-white uppercase tracking-tight mb-3">{step.title}</h3>
                      <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>

                  {/* Bullet center dot */}
                  <div className="absolute left-3.5 md:left-1/2 transform -translate-x-1/2 w-6 h-6 rounded-full bg-slate-950 border-4 border-white/10 flex items-center justify-center text-[10px] font-bold text-slate-400 z-30 group-[.active-step]:border-cyan-400 group-[.active-step]:text-cyan-400 transition-colors duration-500 order-1 md:order-2">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full group-[.active-step]:bg-cyan-400"></span>
                  </div>

                  {/* Right layout blank placeholder / Step Indicator */}
                  <div className="w-full md:w-[45%] pl-14 md:pl-12 order-3">
                    <span className="text-4xl font-black text-white/5 group-hover:text-cyan-400/10 transition-colors duration-500 tracking-tighter uppercase italic">{step.num}</span>
                  </div>

                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Quantum Security Layer */}
      <section ref={securityRef} id="security" className="py-28 relative z-10 bg-slate-950/20 overflow-hidden">
        
        {/* Glowing Network Line visuals */}
        <div className="absolute inset-0 pointer-events-none opacity-20 z-0">
          <div className="absolute w-[200%] h-[1px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent top-1/3 left-[-50%] transform rotate-12 animate-pulse"></div>
          <div className="absolute w-[200%] h-[1px] bg-gradient-to-r from-transparent via-purple-500 to-transparent top-2/3 left-[-50%] transform -rotate-12 animate-pulse"></div>
        </div>

        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-12 gap-16 items-center">
            
            {/* Left side security info */}
            <div className="lg:col-span-7 space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center relative">
                <Shield className="w-8 h-8 text-cyan-400 animate-pulse" />
                <div className="absolute inset-0 rounded-2xl border-4 border-cyan-400/40 security-shield-pulse"></div>
              </div>
              
              <h2 className="text-3xl md:text-5xl font-black text-white tracking-tighter uppercase italic leading-[0.95]">
                Quantum <br /><span className="text-cyan-400 cyan-glow">Security Layer</span>
              </h2>
              <p className="text-slate-400 text-base md:text-lg max-w-xl leading-relaxed">
                Atomic database state modifications, idempotent payment signatures, and continuous transit encryption trace every credit point securely.
              </p>
            </div>

            {/* Right side interactive cards list */}
            <div className="lg:col-span-5 space-y-4">
              <div className="security-card glass-card p-6 rounded-3xl border border-white/5 flex items-center gap-4 hover:border-cyan-500/20 transition-all duration-300">
                <div className="p-3 bg-white/5 rounded-xl"><Lock className="w-5 h-5 text-cyan-400" /></div>
                <div>
                  <h4 className="text-sm font-black text-white uppercase tracking-wide">Encrypted Transit</h4>
                  <p className="text-xs text-slate-400 mt-0.5">TLS 1.3 cryptographic layers everywhere</p>
                </div>
              </div>
              <div className="security-card glass-card p-6 rounded-3xl border border-white/5 flex items-center gap-4 hover:border-purple-500/20 transition-all duration-300">
                <div className="p-3 bg-white/5 rounded-xl"><Server className="w-5 h-5 text-purple-400" /></div>
                <div>
                  <h4 className="text-sm font-black text-white uppercase tracking-wide">Atomic Ledgers</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Strict database transaction concurrency bounds</p>
                </div>
              </div>
              <div className="security-card glass-card p-6 rounded-3xl border border-white/5 flex items-center gap-4 hover:border-green-500/20 transition-all duration-300">
                <div className="p-3 bg-white/5 rounded-xl"><Key className="w-5 h-5 text-emerald-400" /></div>
                <div>
                  <h4 className="text-sm font-black text-white uppercase tracking-wide">Idempotent Signatures</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Automated request duplication prevention</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Spotlight CTA Section */}
      <section ref={ctaRef} onMouseMove={handleCtaMouseMove} className="py-32 relative z-10 overflow-hidden border-t border-white/5 bg-[#050816] cursor-crosshair">
        
        {/* Dynamic tracking cursor spotlight */}
        <div 
          ref={ctaSpotlightRef} 
          className="cta-spotlight absolute w-[400px] h-[400px] rounded-full bg-cyan-500/5 blur-[80px] pointer-events-none transform -translate-x-1/2 -translate-y-1/2 z-0"
          style={{ top: '50%', left: '50%' }}
        />

        <div className="max-w-4xl mx-auto px-6 text-center relative z-10 space-y-8">
          <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase italic leading-[1] max-w-2xl mx-auto">
            Start Building Modern <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 cyan-glow">Recharge Infrastructure</span>
          </h2>
          <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
            Deploy secure billing modules, configure automated recharge flows, and interface with direct provider API clusters. Set up your mission control vault today.
          </p>
          <div className="pt-6">
            <Link to="/register" className="px-10 py-5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black uppercase tracking-[0.2em] rounded-xl transition-all shadow-lg shadow-cyan-400/30 inline-block active:scale-95 cursor-pointer">
              Launch Wallet Portal
            </Link>
          </div>
        </div>
      </section>

      {/* Cinematic Footer */}
      <footer className="bg-slate-950/80 border-t border-white/5 pt-16 pb-12 relative z-10 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center justify-center text-center space-y-6">
          <div className="flex items-center gap-2 group navbar-logo-container">
            <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center border border-white/10 group-hover:border-white/30 transition-all duration-500">
              <Zap className="w-4 h-4 text-white fill-white/10" />
            </div>
            <span className="text-xl font-black text-white tracking-tight font-sans lowercase navbar-logo-text">irecharge</span>
          </div>
          <p className="text-xs text-slate-500 max-w-sm font-medium tracking-wide">
            The most reliable asynchronous realtime recharge infrastructure platform.
          </p>
          <div className="pt-4 text-[10px] text-slate-600 font-bold uppercase tracking-widest">
            © {new Date().getFullYear()} DiziPay Inc. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
