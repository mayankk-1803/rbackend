import React, { useState, useRef, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import { Sun, Moon, Monitor, ChevronDown } from "lucide-react";
import gsap from "gsap";

const ThemeSelector = () => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  const toggleDropdown = () => setIsOpen(!isOpen);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (isOpen) {
        gsap.killTweensOf(menuRef.current);
        gsap.set(menuRef.current, { display: "block", opacity: 0, scale: 0.95, y: -10 });
        
        gsap.to(menuRef.current, {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.3,
          ease: "back.out(1.7)",
        });

        gsap.fromTo(
          menuRef.current.querySelectorAll(".theme-option"),
          { opacity: 0, x: -10 },
          { opacity: 1, x: 0, stagger: 0.05, duration: 0.25, ease: "power2.out", delay: 0.05 }
        );
      } else {
        gsap.killTweensOf(menuRef.current);
        gsap.to(menuRef.current, {
          opacity: 0,
          scale: 0.95,
          y: -10,
          duration: 0.2,
          ease: "power2.in",
          onComplete: () => {
            if (menuRef.current) menuRef.current.style.display = "none";
          },
        });
      }
    }, dropdownRef);

    return () => ctx.revert();
  }, [isOpen]);

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    setIsOpen(false);

    const icon = buttonRef.current.querySelector(".theme-icon");
    if (icon) {
      gsap.fromTo(
        icon,
        { rotate: 0, scale: 0.8 },
        { rotate: 360, scale: 1, duration: 0.5, ease: "back.out(1.5)" }
      );
    }
  };

  const getThemeIcon = (t) => {
    switch (t) {
      case "light":
        return <Sun className="w-4 h-4 theme-icon text-amber-500" />;
      case "dark":
        return <Moon className="w-4 h-4 theme-icon text-cyan-400" />;
      default:
        return <Monitor className="w-4 h-4 theme-icon text-purple-400" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        onClick={toggleDropdown}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-button-bg)] hover:bg-[var(--glass-border-hover)] hover:border-[var(--glass-border-hover)] text-[var(--text-color)] transition-all duration-300 shadow-[0_0_15px_rgba(0,0,0,0.05)] hover:shadow-[0_0_20px_var(--color-primary-glow)] cursor-pointer"
      >
        <span className="flex items-center justify-center">
          {getThemeIcon(theme === "system" ? resolvedTheme : theme)}
        </span>
        <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline text-[var(--text-color)]">
          {theme}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-secondary)] transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      <div
        ref={menuRef}
        className="absolute right-0 mt-2 w-40 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-modal-bg)] shadow-[var(--glass-shadow)] backdrop-blur-2xl z-50 py-1.5"
        style={{ display: "none" }}
      >
        {[
          { key: "dark", label: "Dark", icon: <Moon className="w-4 h-4 text-cyan-400" /> },
          { key: "light", label: "Light", icon: <Sun className="w-4 h-4 text-amber-500" /> },
          { key: "system", label: "System", icon: <Monitor className="w-4 h-4 text-purple-400" /> },
        ].map((opt) => {
          const isSelected = theme === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => handleThemeChange(opt.key)}
              className={`theme-option flex items-center justify-between w-[calc(100%-12px)] mx-1.5 my-0.5 px-3 py-2 rounded-lg text-left text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                isSelected
                  ? "bg-[var(--color-primary-glow)] text-[var(--color-primary)] border border-[var(--color-primary)]/20 shadow-[0_0_15px_var(--color-primary-glow)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-color)] hover:bg-[var(--glass-border)]"
              }`}
            >
              <div className="flex items-center gap-2">
                {opt.icon}
                <span>{opt.label}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ThemeSelector;
