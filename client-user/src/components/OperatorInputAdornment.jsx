import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { operatorMeta } from "../config/operators";
import OperatorLogo from "./OperatorLogo";
import { isIOSDevice } from "../utils/device";

const accentStyles = {
  cyan: {
    border: "border-cyan-400/25",
    ring: "ring-cyan-400/10",
    spinner: "border-cyan-400",
    glow: "0 0 16px rgba(34, 211, 238, 0.28)"
  },
  purple: {
    border: "border-purple-400/25",
    ring: "ring-purple-400/10",
    spinner: "border-purple-400",
    glow: "0 0 16px rgba(192, 132, 252, 0.28)"
  }
};

export default function OperatorInputAdornment({ operator, loading = false, accent = "cyan" }) {
  const iconRef = useRef(null);
  const [visibleOperator, setVisibleOperator] = useState(operator);
  const style = accentStyles[accent] || accentStyles.cyan;
  const currentOperator = visibleOperator || operator;

  useEffect(() => {
    if (loading) return undefined;

    if (!operator) {
      return undefined;
    }

    if (!visibleOperator) {
      const delayedSet = gsap.delayedCall(0, () => setVisibleOperator(operator));
      return () => delayedSet.kill();
    }

    if (operator !== visibleOperator && iconRef.current) {
      const tween = gsap.to(iconRef.current, {
        opacity: 0,
        scale: 0.8,
        duration: 0.18,
        ease: "power2.in",
        onComplete: () => setVisibleOperator(operator)
      });
      return () => tween.kill();
    }

    return undefined;
  }, [operator, loading, visibleOperator]);

  useEffect(() => {
    if (loading || !currentOperator || !iconRef.current) return undefined;
    const isIOS = isIOSDevice();

    const ctx = gsap.context(() => {
      gsap.fromTo(
        iconRef.current,
        { opacity: 0, scale: 0.8 },
        { opacity: 1, scale: 1, duration: isIOS ? 0.18 : 0.34, ease: isIOS ? "power2.out" : "back.out(1.8)" }
      );

      if (!isIOS) {
        gsap.to(iconRef.current, {
          boxShadow: style.glow,
          duration: 1.6,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut"
        });
      }
    }, iconRef);

    return () => ctx.revert();
  }, [currentOperator, loading, style.glow]);

  if (loading) {
    return (
      <div className={`pointer-events-none absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border ${style.border} bg-[var(--glass-modal-bg)]/80 shadow-sm backdrop-blur-xl ring-4 ${style.ring}`}>
        <div className={`h-4 w-4 animate-spin rounded-full border-2 ${style.spinner} border-t-transparent`} />
      </div>
    );
  }

  if (!operator) return null;

  return (
    <div
      ref={iconRef}
      className={`pointer-events-none absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border ${style.border} bg-[var(--glass-modal-bg)]/85 p-1.5 shadow-sm backdrop-blur-xl ring-4 ${style.ring}`}
      aria-hidden="true"
      title={operatorMeta[currentOperator]?.label || currentOperator}
    >
      <OperatorLogo operator={currentOperator} accent={accent} />
    </div>
  );
}
