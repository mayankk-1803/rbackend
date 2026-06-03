import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, X, Zap, Activity, Shield, RefreshCw, 
  Globe, Smartphone, CheckCircle2,
  TrendingUp, Terminal, ArrowUpRight, Lock, Key, Server,
  Coins, Headphones
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import ThemeSelector from '../components/ThemeSelector';
import { useIsIOS } from '../utils/device';
import { useTheme } from '../context/ThemeContext';

// Register GSAP ScrollTrigger
gsap.registerPlugin(ScrollTrigger);

export default function HomePage() {
  const { resolvedTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const isIOS = useIsIOS();

  const heroRef = useRef(null);
  const tickerContainerRef = useRef(null);
  const tickerTrackRef = useRef(null);
  const bentoGridRef = useRef(null);
  const timelineRef = useRef(null);
  const securityRef = useRef(null);
  const ctaRef = useRef(null);
  const ctaSpotlightRef = useRef(null);
  const mobileToggleRef = useRef(null);
  const drawerRef = useRef(null);

  // Phase 10 & 11: Scroll Lock, Escape Key, Focus Management
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          setIsOpen(false);
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      
      // Focus Close button inside drawer when opened
      const timer = setTimeout(() => {
        const closeBtn = drawerRef.current?.querySelector('.drawer-close-btn');
        closeBtn?.focus();
      }, 50);

      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleKeyDown);
        clearTimeout(timer);
      };
    } else {
      // Return focus to hamburger button when closed
      mobileToggleRef.current?.focus();
    }
  }, [isOpen]);

  const handleTabKey = (e) => {
    if (!drawerRef.current) return;
    const focusableElements = drawerRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements.length === 0) return;
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    }
  };

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
    const handleScroll = () => {
      const isPastThreshold = window.scrollY >= 80;
      setScrolled(prev => {
        if (prev !== isPastThreshold) {
          return isPastThreshold;
        }
        return prev;
      });
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Track active section on scroll for navbar underline highlight
  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY + 120;
      
      const homeEl = document.getElementById('home');
      const featuresEl = document.getElementById('features');
      const workflowEl = document.getElementById('workflow');
      const securityEl = document.getElementById('security');
      
      if (securityEl && scrollPos >= securityEl.offsetTop) {
        setActiveSection('security');
      } else if (workflowEl && scrollPos >= workflowEl.offsetTop) {
        setActiveSection('workflow');
      } else if (featuresEl && scrollPos >= featuresEl.offsetTop) {
        setActiveSection('features');
      } else {
        setActiveSection('home');
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);  // GSAP animations for Hero Rebuild
  useEffect(() => {
    if (!heroRef.current) return undefined;

    // 1. Text reveals in Hero Section
    const heroTitleWords = heroRef.current.querySelectorAll('.hero-title-line');
    const heroSubtitle = heroRef.current.querySelector('.hero-subtitle');
    const heroCtas = heroRef.current.querySelector('.hero-ctas');

    const heroTl = gsap.timeline({ defaults: { ease: "power3.out" } });

    heroTl.fromTo('.landing-nav',
      { opacity: 0, y: -20 },
      { opacity: 1, y: 0, duration: 0.8 }
    )
    .fromTo('.hero-badge',
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.6 },
      "-=0.4"
    )
    .fromTo(heroTitleWords, 
      { y: 30, opacity: 0 }, 
      { y: 0, opacity: 1, duration: 0.8, stagger: 0.1 },
      "-=0.2"
    )
    .fromTo(heroSubtitle, 
      { y: 20, opacity: 0 }, 
      { y: 0, opacity: 1, duration: 0.8 }, 
      0.2
    )
    .fromTo(heroCtas, 
      { y: 20, opacity: 0 }, 
      { y: 0, opacity: 1, duration: 0.8 }, 
      0.3
    )
    .fromTo('.hero-trust-metrics',
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8 },
      0.4
    );

    if (isIOS) {
      gsap.set([".security-shield-pulse"], { clearProps: "animation" });
      gsap.set([".bento-card", ".timeline-step-card", ".security-card"], { opacity: 1, y: 0, x: 0, scale: 1 });
      return () => {
        heroTl.kill();
      };
    }

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
      heroTl.kill();
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
    { icon: Zap, title: "Instant Recharge", desc: "Sub-second processing via direct provider APIs with automated routing pathways.", size: "large", accent: "purple" },
    { icon: RefreshCw, title: "Smart Retry Engine", desc: "Intelligent real-time failover preventing lost or stuck payments.", size: "small", accent: "purple" },
    { icon: Activity, title: "Queue Architecture", desc: "BullMQ-powered background tasks built for enterprise throughput scale.", size: "small", accent: "green" },
    { icon: Globe, title: "Realtime Updates", desc: "Interactive WebSocket driven client dashboard syncing with state streams.", size: "medium", accent: "purple" },
    { icon: TrendingUp, title: "Cashback Incentive", desc: "Algorithmic wallet rebates distributed directly upon success validations.", size: "medium", accent: "green" },
    { icon: Shield, title: "Ledger Security", desc: "Cryptographically safe database balances backing multi-currency accounts.", size: "large", accent: "purple" },
    { icon: Terminal, title: "Developer Gateway", desc: "High-performance REST architecture, detailed analytics logs, and sandbox credentials.", size: "small", accent: "purple" },
    { icon: Smartphone, title: "Global Tracking", desc: "Comprehensive step-by-step transaction logs monitoring all API states.", size: "small", accent: "purple" }
  ];

  const steps = [
    { num: "01", title: "Submit Transaction Request", desc: "User triggers bill recharge. The system processes the wallet ledger atomically and records the pending transaction state." },
    { num: "02", title: "Queue & Gateway Routing", desc: "Asynchronous background workers trigger direct provider integrations, monitoring responses with smart latency retry parameters." },
    { num: "03", title: "Sync Verification & Rebate", desc: "Provider webhook or poll secures state. Realtime WebSockets push status to the client, distributing cached cashback coins." }
  ];

  return (
    <div className="landing-page min-h-screen bg-[#050816] text-slate-100 font-sans selection:bg-purple-500/30 selection:text-white relative overflow-hidden">
      
      {/* Ambient Nebula Light System */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="ambient-blob absolute -top-[10%] -left-[10%] w-[60%] h-[60%] bg-purple-600/10 rounded-full blur-[150px] animate-blob-left"></div>
        <div className="ambient-blob absolute top-[25%] -right-[15%] w-[60%] h-[60%] bg-purple-600/10 rounded-full blur-[160px] animate-blob-right"></div>
        <div className="ambient-blob absolute bottom-[10%] left-[20%] w-[50%] h-[50%] bg-blue-600/8 rounded-full blur-[130px] animate-blob-bottom"></div>
        <div className="absolute inset-0 neural-grid opacity-25"></div>
      </div>

      {/* Cinematic Hero Container */}
      <section 
        ref={heroRef} 
        id="home" 
        className="relative max-w-[1800px] mx-auto overflow-hidden rounded-[40px] flex flex-col justify-between mt-4 md:mt-5 lg:mt-6 min-h-[720px] md:min-h-[800px] lg:min-h-[850px] xl:min-h-[900px]"
        style={{
          background: resolvedTheme === 'light' ? '#F8F7FC' : '#050510',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: resolvedTheme === 'light' 
            ? '0 20px 60px rgba(15, 23, 42, 0.08)' 
            : '0 20px 80px rgba(0, 0, 0, 0.45)',
          zIndex: 1
        }}
      >
        {/* Video Layer */}
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover scale-105 gpu-accelerated pointer-events-none z-0"
          style={{
            filter: 'brightness(1.15) contrast(1.1) saturate(1.1)'
          }}
        >
          <source src="/irechargevid.mp4" type="video/mp4" />
        </video>

        {/* Theme Overlay Layer (Cinematic Overlay) */}
        <div 
          className="absolute inset-0 z-1 transition-all duration-500 pointer-events-none"
          style={{
            background: resolvedTheme === 'light' 
              ? 'rgba(255, 255, 255, 0.20)' 
              : 'rgba(5, 5, 16, 0.35)'
          }}
        />

        {/* Ambient Glow Layer */}
        <div 
          className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full pointer-events-none z-2"
          style={{
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.22), transparent 70%)',
            filter: 'blur(120px)',
            animation: 'floatGlow 12s ease-in-out infinite'
          }}
        />
        <div 
          className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full pointer-events-none z-2"
          style={{
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.22), transparent 70%)',
            filter: 'blur(120px)',
            animation: 'floatGlow 12s ease-in-out infinite',
            animationDelay: '-6s'
          }}
        />

        {/* Purple Radial Glow */}
        <div 
          className="absolute inset-0 pointer-events-none z-2"
          style={{
            background: 'radial-gradient(circle at center, rgba(139, 92, 246, 0.12), transparent 70%)'
          }}
        />

        {/* Left Side Gradient Mask */}
        <div 
          className="absolute inset-y-0 left-0 w-[60%] z-2 pointer-events-none"
          style={{
            background: resolvedTheme === 'light'
              ? 'linear-gradient(90deg, rgba(255, 255, 255, 0.80) 0%, rgba(255, 255, 255, 0.55) 40%, rgba(255, 255, 255, 0.20) 75%, transparent 100%)'
              : 'linear-gradient(90deg, rgba(5, 5, 16, 0.80) 0%, rgba(5, 5, 16, 0.55) 40%, rgba(5, 5, 16, 0.20) 75%, transparent 100%)'
          }}
        />

        {/* Grid Layer */}
        <div 
          className="absolute inset-0 pointer-events-none z-2"
          style={{
            backgroundImage: resolvedTheme === 'light'
              ? 'linear-gradient(rgba(0, 0, 0, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 0, 0.03) 1px, transparent 1px)'
              : 'linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
            opacity: 0.15
          }}
        />

        {/* Integrated Glass Navbar (Row #1) */}
        <nav 
          className="fixed top-5 left-1/2 z-50 landing-nav flex items-center px-8 h-[72px] transition-all duration-300 ease-out"
          style={{
            width: "calc(100% - 64px)",
            maxWidth: "1700px",
            transform: scrolled ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(-8px)',
            opacity: scrolled ? 1 : 0.9,
            background: scrolled ? 'rgba(5, 5, 16, 0.85)' : 'rgba(5, 5, 16, 0.35)',
            backdropFilter: scrolled ? 'blur(24px)' : 'blur(12px)',
            WebkitBackdropFilter: scrolled ? 'blur(24px)' : 'blur(12px)',
            border: scrolled ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(255, 255, 255, 0.05)',
            boxShadow: scrolled ? '0 10px 40px rgba(0, 0, 0, 0.35)' : 'none',
          }}
        >
          <div className="w-full flex items-center justify-between">
            <Link to="/" className="flex items-center gap-1.5 group navbar-logo-container">
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center border transition-all duration-500 bg-white/5 border-white/10"
              >
                <Zap 
                  className="w-4 h-4 animate-pulse text-white fill-white/10" 
                />
              </div>
              <span 
                className="text-xl font-black tracking-tight font-sans lowercase navbar-logo-text text-white"
              >
                irecharge
              </span>
            </Link>
            
            {/* Desktop Links */}
            <div className="hidden md:flex items-center gap-10">
              {navLinks.map((link) => {
                const isActive = activeSection === link.id;
                return (
                  <button 
                    key={link.name} 
                    onClick={() => scrollToSection(link.id)} 
                    className={`text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer relative py-2 transform hover:-translate-y-[2px] ${
                      isActive 
                        ? 'text-[#C084FC] font-bold' 
                        : 'text-white/70 hover:text-white'
                    }`}
                  >
                    {link.name}
                    {isActive && (
                      <motion.div 
                        layoutId="activeNavUnderline" 
                        className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#C084FC]"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Auth Buttons */}
            <div className="hidden md:flex items-center gap-6">
              <ThemeSelector />
              <Link 
                to="/login" 
                className="text-xs font-semibold uppercase tracking-wider transition-all duration-200 text-white/75 hover:text-[#C084FC]"
              >
                Login
              </Link>
              <Link 
                to="/register" 
                className="h-12 px-6 text-white text-xs font-bold uppercase tracking-wider rounded-[14px] flex items-center justify-center transition-all duration-300 hover:scale-[1.02] active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
                  boxShadow: '0 0 25px rgba(139, 92, 246, 0.35)',
                }}
              >
                Start Recharging
              </Link>
            </div>

            {/* Mobile Toggle */}
            <div className="md:hidden flex items-center gap-2">
              <ThemeSelector />
              <button 
                ref={mobileToggleRef}
                className="transition-colors text-white/70 hover:text-white" 
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Open mobile menu"
              >
                {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </nav>

        {/* Content Section (Row #2) */}
        <div className="flex-1 flex flex-col justify-center z-20 w-full relative">
          <div className="max-w-[1100px] mx-auto text-center relative w-full flex flex-col items-center justify-center space-y-8 px-6 pt-2 md:pt-4 lg:pt-6">
            
            {/* Badge */}
            <div 
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full hero-badge"
              style={{
                background: resolvedTheme === 'light' ? 'rgba(124, 58, 237, 0.1)' : 'rgba(15, 10, 30, 0.6)',
                border: resolvedTheme === 'light' ? '1px solid rgba(124, 58, 237, 0.2)' : '1px solid rgba(139, 92, 246, 0.3)',
                boxShadow: resolvedTheme === 'light' ? 'none' : '0 0 20px rgba(139, 92, 246, 0.15)'
              }}
            >
              <div 
                className="w-2 h-2 rounded-full animate-ping"
                style={{
                  background: resolvedTheme === 'light' ? '#7C3AED' : '#c084fc'
                }}
              />
              <span 
                className="text-[9px] font-black uppercase tracking-[0.25em]"
                style={{
                  color: resolvedTheme === 'light' ? '#7C3AED' : '#c084fc'
                }}
              >
                NEXT-GEN RECHARGE INFRASTRUCTURE
              </span>
            </div>
            
            {/* Headline */}
            <h1 
              className="font-black tracking-tighter uppercase italic hero-headline"
              style={{
                fontSize: 'clamp(3rem, 6vw, 6rem)',
                fontWeight: 900,
                lineHeight: '0.92',
                letterSpacing: '-0.04em',
                textShadow: resolvedTheme === 'light' ? 'none' : '0 0 30px rgba(192,132,252,0.18)'
              }}
            >
              <span 
                className={`block hero-title-line pr-4 ${resolvedTheme === 'light' ? 'text-[#1E293B]' : 'text-transparent bg-clip-text'}`}
                style={resolvedTheme === 'light' ? { color: '#1E293B' } : {
                  backgroundImage: 'linear-gradient(90deg, #FFFFFF, #C084FC, #D946EF)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}
              >
                Smart Recharge
              </span>
              <span 
                className={`block hero-title-line pr-4 ${resolvedTheme === 'light' ? 'text-[#1E293B]' : 'text-transparent bg-clip-text'}`}
                style={resolvedTheme === 'light' ? { color: '#1E293B' } : {
                  backgroundImage: 'linear-gradient(90deg, #FFFFFF, #C084FC, #D946EF)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}
              >
                Infrastructure
              </span>
            </h1>

            {/* Description */}
            <p 
              className="hero-subtitle"
              style={{
                maxWidth: '700px',
                margin: '0 auto',
                lineHeight: '1.8',
                fontWeight: '500',
                color: resolvedTheme === 'light' ? '#334155' : 'rgba(255, 255, 255, 0.85)'
              }}
            >
              Recharge, Wallet, Marketplace, Cashback, Utility Payments and Digital Services in one intelligent platform built for modern retailers, distributors and businesses.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mt-12 hero-ctas w-full">
              <Link 
                to="/register" 
                className="w-full sm:w-auto px-8 h-[60px] text-white rounded-[18px] font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95 hover:scale-105 duration-300 cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
                  boxShadow: '0 0 35px rgba(139, 92, 246, 0.55)',
                }}
              >
                START RECHARGING <ArrowUpRight className="w-4 h-4" />
              </Link>
              <button 
                onClick={() => scrollToSection('features')} 
                className="w-full sm:w-auto px-8 h-[60px] border rounded-[18px] font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center active:scale-95 hover:scale-105 duration-300 cursor-pointer hero-secondary-btn"
                style={{
                  background: resolvedTheme === 'light' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  borderColor: resolvedTheme === 'light' ? 'rgba(15, 23, 42, 0.12)' : 'rgba(255, 255, 255, 0.1)',
                  color: resolvedTheme === 'light' ? '#1E293B' : '#ffffff'
                }}
              >
                EXPLORE SERVICES
              </button>
            </div>
          </div>

          {/* Hero Footer: Trust Metrics */}
          <div className="relative w-full px-6 mt-12 lg:mt-14 pb-16 md:pb-20 lg:pb-24">
            <div className="max-w-[1400px] mx-auto w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 hero-trust-metrics">
              {[
                { icon: Zap, label: "Instant Recharge" },
                { icon: Shield, label: "Secure Payments" },
                { icon: Coins, label: "Cashback Rewards" },
                { icon: Headphones, label: "24x7 Support" }
              ].map((item, idx) => (
                <div 
                  key={idx}
                  className="flex items-center gap-4 p-5 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/30 group min-h-[72px]"
                  style={{
                    background: resolvedTheme === 'light' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.08)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: resolvedTheme === 'light' ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(139, 92, 246, 0.20)',
                    boxShadow: resolvedTheme === 'light' ? '0 4px 20px rgba(15, 23, 42, 0.05)' : '0 0 15px rgba(139, 92, 246, 0.15)',
                    color: resolvedTheme === 'light' ? '#1E293B' : '#ffffff'
                  }}
                >
                  <div className="p-3 bg-white/5 rounded-xl group-hover:bg-purple-500/10 group-hover:scale-105 transition-all">
                    <item.icon className="w-5 h-5 text-purple-400 shrink-0 transition-all duration-300" />
                  </div>
                  <span className="text-sm font-bold uppercase tracking-wider">{item.label}</span>
                </div>
              ))}
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
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0"/> Airtel Recharge Success <span className="text-purple-400 font-black">₹299</span>
              </span>
              <span className="text-white/10">•</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0"/> Jio Completed <span className="text-purple-400 font-black">₹719</span>
              </span>
              <span className="text-white/10">•</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0"/> Vi Topup Success <span className="text-purple-400 font-black">₹19</span>
              </span>
              <span className="text-white/10">•</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0"/> BSNL Success <span className="text-purple-400 font-black">₹199</span>
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
              Quantum <span className="text-purple-400 purple-glow">Engine Features</span>
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
                  className={`bento-card glass-card p-8 rounded-3xl border border-white/5 hover:border-purple-500/30 transition-all duration-500 group flex flex-col justify-between overflow-hidden relative ${colSpan}`}
                >
                  {/* Hover Accent spotlight background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                  
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5 mb-8 group-hover:bg-purple-500/10 group-hover:border-purple-500/20 transition-all">
                      <f.icon className="w-6 h-6 text-slate-300 group-hover:text-purple-400 group-hover:scale-105 transition-all" />
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
              Lifecycle <span className="text-purple-400 purple-glow">Processing flow</span>
            </h2>
            <p className="text-slate-400 text-base md:text-lg max-w-xl mx-auto">
              Our automated, asynchronous execution pipeline guarantees zero payment loss.
            </p>
          </div>

          <div className="relative max-w-4xl mx-auto">
            {/* Timeline Progress connector line */}
            <div className="timeline-path absolute left-6 md:left-1/2 top-0 bottom-0 h-full w-[2px]"></div>
            <div className="timeline-progress-bar absolute left-6 md:left-1/2 top-0 h-full w-[2px] bg-gradient-to-b from-purple-400 to-purple-600 origin-top transform scale-y-0 z-10"></div>

            <div className="space-y-16">
              {steps.map((step, i) => (
                <div key={i} className="timeline-step-card flex flex-col md:flex-row items-start md:items-center justify-between relative z-20 group">
                  
                  {/* Left layout wrapper */}
                  <div className="w-full md:w-[45%] flex justify-start md:justify-end md:text-right pr-0 md:pr-12 pl-14 md:pl-0 order-2 md:order-1 mt-4 md:mt-0">
                    <div className="glass-card p-6 md:p-8 rounded-3xl border border-white/5 group-hover:border-purple-500/20 transition-all duration-500 w-full">
                      <h3 className="text-md font-black text-white uppercase tracking-tight mb-3">{step.title}</h3>
                      <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>

                  {/* Bullet center dot */}
                  <div className="absolute left-3.5 md:left-1/2 transform -translate-x-1/2 w-6 h-6 rounded-full bg-slate-950 border-4 border-white/10 flex items-center justify-center text-[10px] font-bold text-slate-400 z-30 group-[.active-step]:border-purple-400 group-[.active-step]:text-purple-400 transition-colors duration-500 order-1 md:order-2">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full group-[.active-step]:bg-purple-400"></span>
                  </div>

                  {/* Right layout blank placeholder / Step Indicator */}
                  <div className="w-full md:w-[45%] pl-14 md:pl-12 order-3">
                    <span className="text-4xl font-black text-white/5 group-hover:text-purple-400/10 transition-colors duration-500 tracking-tighter uppercase italic">{step.num}</span>
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
          <div className="absolute w-[200%] h-[1px] bg-gradient-to-r from-transparent via-purple-400 to-transparent top-1/3 left-[-50%] transform rotate-12 animate-pulse"></div>
          <div className="absolute w-[200%] h-[1px] bg-gradient-to-r from-transparent via-purple-500 to-transparent top-2/3 left-[-50%] transform -rotate-12 animate-pulse"></div>
        </div>

        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-12 gap-16 items-center">
            
            {/* Left side security info */}
            <div className="lg:col-span-7 space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-purple-400/10 border border-purple-400/20 flex items-center justify-center relative">
                <Shield className="w-8 h-8 text-purple-400 animate-pulse" />
                <div className="absolute inset-0 rounded-2xl border-4 border-purple-400/40 security-shield-pulse"></div>
              </div>
              
              <h2 className="text-3xl md:text-5xl font-black text-white tracking-tighter uppercase italic leading-[0.95]">
                Quantum <br /><span className="text-purple-400 purple-glow">Security Layer</span>
              </h2>
              <p className="text-slate-400 text-base md:text-lg max-w-xl leading-relaxed">
                Atomic database state modifications, idempotent payment signatures, and continuous transit encryption trace every credit point securely.
              </p>
            </div>

            {/* Right side interactive cards list */}
            <div className="lg:col-span-5 space-y-4">
              <div className="security-card glass-card p-6 rounded-3xl border border-white/5 flex items-center gap-4 hover:border-purple-500/20 transition-all duration-300">
                <div className="p-3 bg-white/5 rounded-xl"><Lock className="w-5 h-5 text-purple-400" /></div>
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
          className="cta-spotlight absolute w-[400px] h-[400px] rounded-full bg-purple-500/5 blur-[80px] pointer-events-none transform -translate-x-1/2 -translate-y-1/2 z-0"
          style={{ top: '50%', left: '50%' }}
        />

        <div className="max-w-4xl mx-auto px-6 text-center relative z-10 space-y-8">
          <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase italic leading-[1] max-w-2xl mx-auto">
            Start Building Modern <br />
            <span className="inline-block not-italic -skew-x-12 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-purple-600 purple-glow-filter pr-4">Recharge Infrastructure</span>
          </h2>
          <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
            Deploy secure billing modules, configure automated recharge flows, and interface with direct provider API clusters. Set up your mission control vault today.
          </p>
          <div className="pt-6">
            <Link to="/register" className="px-10 py-5 bg-purple-500 hover:bg-purple-400 text-white text-xs font-black uppercase tracking-[0.2em] rounded-xl transition-all shadow-lg shadow-purple-500/30 inline-block active:scale-95 cursor-pointer">
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
      {/* Premium Fullscreen Mobile Drawer */}
      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.div 
            ref={drawerRef}
            onKeyDown={handleTabKey}
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25 }}
            className="md:hidden"
            style={{
              position: 'fixed',
              inset: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 9999,
              background: resolvedTheme === 'light' ? 'rgba(255, 255, 255, 0.92)' : 'rgba(5, 5, 16, 0.92)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)'
            }}
          >
            <div 
              className="flex flex-col h-full w-full justify-between"
              style={{ 
                zIndex: 10000, 
                position: 'relative',
                paddingTop: 'max(20px, env(safe-area-inset-top))',
                paddingBottom: 'max(24px, env(safe-area-inset-bottom))'
              }}
            >
              {/* HEADER ROW */}
              <div 
                className="flex items-center justify-between px-6 w-full shrink-0"
                style={{ height: '72px' }}
              >
                {/* Logo */}
                <Link to="/" onClick={() => setIsOpen(false)} className="flex items-center gap-1.5 group navbar-logo-container">
                  <div 
                    className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all duration-500 ${
                      resolvedTheme === 'light' 
                        ? 'bg-[#0F172A]/5 border-[#0F172A]/10' 
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <Zap 
                      className={`w-4 h-4 animate-pulse ${
                        resolvedTheme === 'light' 
                          ? 'text-[#0F172A] fill-[#0F172A]/10' 
                          : 'text-white fill-white/10'
                      }`} 
                    />
                  </div>
                  <span 
                    className={`text-xl font-black tracking-tight font-sans lowercase navbar-logo-text ${
                      resolvedTheme === 'light' 
                        ? 'text-[#0F172A]' 
                        : 'text-white'
                    }`}
                  >
                    irecharge
                  </span>
                </Link>
                
                {/* Empty Center */}
                <div className="flex-1"></div>
                
                {/* Right Area: Theme Switcher & Close Button */}
                <div className="flex items-center gap-4">
                  <ThemeSelector position="bottom" align="right" />
                  <button 
                    onClick={() => setIsOpen(false)}
                    aria-label="Close mobile menu"
                    className="drawer-close-btn flex items-center justify-center rounded-full border transition-all cursor-pointer hover:scale-105 active:scale-95 animate-none"
                    style={{
                      width: '48px',
                      height: '48px',
                      background: resolvedTheme === 'light' ? 'rgba(15, 23, 42, 0.04)' : 'rgba(255, 255, 255, 0.08)',
                      borderColor: resolvedTheme === 'light' ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.1)',
                      color: resolvedTheme === 'light' ? '#0F172A' : '#FFFFFF',
                      backdropFilter: 'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)'
                    }}
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* NAVIGATION LINKS */}
              <div 
                className="flex-grow flex flex-col items-center justify-center"
                style={{ gap: '32px' }}
              >
                {navLinks.map((link) => (
                  <button 
                    key={link.name} 
                    onClick={() => {
                      setIsOpen(false);
                      scrollToSection(link.id);
                    }} 
                    className="transition-colors cursor-pointer bg-transparent border-none font-bold uppercase tracking-wider"
                    style={{
                      fontSize: '22px',
                      color: resolvedTheme === 'light' ? '#0F172A' : '#FFFFFF'
                    }}
                  >
                    {link.name}
                  </button>
                ))}
              </div>

              {/* ACTION AREA */}
              <div 
                className="flex flex-col px-6 w-full shrink-0"
                style={{ gap: '16px' }}
              >
                <Link 
                  to="/login" 
                  onClick={() => setIsOpen(false)}
                  className="w-full text-xs font-bold uppercase tracking-wider flex items-center justify-center transition-all duration-200 active:scale-95"
                  style={{
                    height: '56px',
                    borderRadius: '18px',
                    background: resolvedTheme === 'light' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.08)',
                    border: resolvedTheme === 'light' ? '1px solid rgba(15, 23, 42, .08)' : 'none',
                    color: resolvedTheme === 'light' ? '#0F172A' : '#FFFFFF'
                  }}
                >
                  Login
                </Link>
                <Link 
                  to="/register" 
                  onClick={() => setIsOpen(false)}
                  className="w-full text-xs font-bold uppercase tracking-wider flex items-center justify-center transition-all duration-300 hover:scale-[1.02] active:scale-95"
                  style={{
                    height: '56px',
                    borderRadius: '18px',
                    color: '#FFFFFF',
                    background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
                    boxShadow: resolvedTheme === 'light' ? '0 10px 25px rgba(139, 92, 246, 0.25)' : '0 10px 30px rgba(139, 92, 246, 0.35)',
                  }}
                >
                  Start Recharging
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
