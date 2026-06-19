import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap } from "lucide-react";

/**
 * Premium Minimalist Fintech Logo Component for iRecharge.
 * Resolves descender clipping issues.
 */
const Logo = ({
  size = "md",
  showText = true,
  collapsed = false,
  showSubtitle = false,
  animated = true,
  className = "",
  onClick
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Monitor screen width and reduced motion preference
  useEffect(() => {
    setHasLoaded(true);

    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);
    const motionListener = (e) => setReducedMotion(e.matches);
    mediaQuery.addEventListener("change", motionListener);

    return () => {
      window.removeEventListener("resize", checkMobile);
      mediaQuery.removeEventListener("change", motionListener);
    };
  }, []);

  const shouldAnimate = animated && !reducedMotion;
  const isTextVisible = showText && !collapsed;

  // Premium Sizes Configurations (Increased 40-50%)
  const sizeMap = {
    sm: {
      iconBox: "w-9 h-9 rounded-full",
      icon: "w-4.5 h-4.5",
      textClass: "text-base font-extrabold tracking-tight leading-tight whitespace-nowrap",
      subtitleClass: "text-[7.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5 whitespace-nowrap",
      ringOffset: "-inset-1"
    },
    md: {
      iconBox: "w-11 h-11 rounded-full",
      icon: "w-5.5 h-5.5",
      textClass: "text-lg md:text-xl font-extrabold tracking-tight leading-tight whitespace-nowrap",
      subtitleClass: "text-[8.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5 whitespace-nowrap",
      ringOffset: "-inset-1.5"
    },
    lg: {
      iconBox: "w-13 h-13 rounded-full",
      icon: "w-6.5 h-6.5",
      textClass: "text-xl md:text-2xl font-extrabold tracking-tight leading-tight whitespace-nowrap",
      subtitleClass: "text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5 whitespace-nowrap",
      ringOffset: "-inset-2"
    }
  };

  const logoSize = collapsed ? "md" : size;
  const currentSize = sizeMap[logoSize] || sizeMap.md;

  // Stagger reveal on mount (once only)
  const letters = "iRecharge".split("");
  const staggerContainer = {
    initial: {},
    animate: {
      transition: {
        staggerChildren: 0.035,
        delayChildren: 0.05
      }
    }
  };

  const letterVariants = {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: { duration: 0.12, ease: "easeOut" }
    }
  };

  // Subtle springy hover animation for icon box
  const hoverVariants = {
    hover: {
      scale: 1.04,
      rotate: 3,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 15
      }
    }
  };

  return (
    <div
      className={`flex items-center gap-3 overflow-visible w-fit whitespace-nowrap pr-4 shrink-0 ${className}`}
      aria-label="iRecharge"
      role="banner"
      onClick={onClick}
    >
      {/* Icon Area */}
      <div className="relative shrink-0 overflow-visible">
        
        {/* Slow Rotating Subtle Energy Ring */}
        {shouldAnimate && (
          <motion.div
            className={`absolute ${currentSize.ringOffset || "-inset-1"} rounded-full border border-dashed border-slate-300/10 dark:border-white/5 pointer-events-none z-0`}
            animate={{ rotate: 360 }}
            transition={{
              duration: 24,
              ease: "linear",
              repeat: Infinity
            }}
          />
        )}

        {/* Float and Breathe Wrapper */}
        <motion.div
          animate={shouldAnimate ? {
            y: [-3, 3, -3]
          } : {}}
          transition={{
            duration: 4,
            ease: "easeInOut",
            repeat: Infinity
          }}
          className="relative z-10 overflow-visible"
        >
          <motion.div
            className={`${currentSize.iconBox} flex items-center justify-center border border-slate-200/10 dark:border-white/5 relative overflow-hidden bg-slate-950 dark:bg-slate-900/90`}
            animate={shouldAnimate ? {
              boxShadow: [
                "0 0 16px rgba(124, 58, 237, 0.14)",
                "0 0 9px rgba(124, 58, 237, 0.07)",
                "0 0 16px rgba(124, 58, 237, 0.14)"
              ]
            } : {
              boxShadow: "0 0 12px rgba(124, 58, 237, 0.1)"
            }}
            transition={{
              duration: 3.5,
              ease: "easeInOut",
              repeat: Infinity
            }}
            variants={shouldAnimate ? hoverVariants : {}}
            whileHover="hover"
          >
            <Zap className={`${currentSize.icon} text-white fill-white/10`} />
          </motion.div>
        </motion.div>
      </div>

      {/* Brand Text Section with smooth Sidebar width transition */}
      <AnimatePresence initial={false}>
        {isTextVisible && (
          <motion.div
            initial={shouldAnimate ? { opacity: 0, width: 0 } : {}}
            animate={{ opacity: 1, width: "auto" }}
            exit={shouldAnimate ? { opacity: 0, width: 0 } : {}}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-visible whitespace-nowrap py-1 pr-4 flex flex-col items-start leading-tight"
          >
            <motion.span
              className={`${currentSize.textClass} text-slate-900 dark:text-white`}
              variants={shouldAnimate && !hasLoaded ? staggerContainer : {}}
              initial="initial"
              animate="animate"
            >
              {letters.map((letter, idx) => (
                <motion.span
                  key={idx}
                  className="inline-block"
                  variants={shouldAnimate && !hasLoaded ? letterVariants : {}}
                >
                  {letter}
                </motion.span>
              ))}
            </motion.span>
            
            {showSubtitle && (
              <motion.span
                initial={shouldAnimate && !hasLoaded ? { opacity: 0 } : {}}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35, duration: 0.2 }}
                className={`${currentSize.subtitleClass} text-slate-500 dark:text-slate-400`}
              >
                Recharge • Bills • Marketplace
              </motion.span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default React.memo(Logo);
