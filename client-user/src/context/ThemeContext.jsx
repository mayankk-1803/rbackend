import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import gsap from "gsap";
import { isIOSDevice } from "../utils/device";

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem("theme") || "system";
  });

  const [resolvedTheme, setResolvedTheme] = useState("dark");
  const overlayRef = useRef(null);
  const isFirstRender = useRef(true);

  const setTheme = (newTheme) => {
    if (newTheme !== "light" && newTheme !== "dark" && newTheme !== "system") return;

    const root = window.document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    let nextResolved = newTheme;
    if (newTheme === "system") {
      nextResolved = mediaQuery.matches ? "dark" : "light";
    }

    const applyResolvedTheme = () => {
      localStorage.setItem("theme", newTheme);
      setThemeState(newTheme);
      setResolvedTheme(nextResolved);

      if (nextResolved === "dark") {
        root.classList.add("dark");
        root.classList.remove("light");
      } else {
        root.classList.add("light");
        root.classList.remove("dark");
      }
      root.style.colorScheme = nextResolved;
    };

    // If it's the same resolved theme, don't play animation, just update
    if (nextResolved === resolvedTheme || !overlayRef.current) {
      localStorage.setItem("theme", newTheme);
      setThemeState(newTheme);
      return;
    }

    if (isIOSDevice()) {
      applyResolvedTheme();
      return;
    }

    // Dynamic color determination for the circular transition overlay
    const overlayColor = nextResolved === "dark" ? "#030012" : "#ffffff";
    gsap.set(overlayRef.current, {
      backgroundColor: overlayColor,
      opacity: 1,
      clipPath: "circle(0% at 50% 50%)"
    });

    const tl = gsap.timeline();

    tl.to(overlayRef.current, {
      clipPath: "circle(150% at 50% 50%)",
      duration: 0.6,
      ease: "power3.inOut",
      onComplete: () => {
        applyResolvedTheme();
      }
    });

    tl.to(overlayRef.current, {
      opacity: 0,
      duration: 0.4,
      ease: "power2.out",
      onComplete: () => {
        gsap.set(overlayRef.current, { clipPath: "circle(0% at 50% 50%)", opacity: 1 });
      }
    });
  };

  useEffect(() => {
    const root = window.document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const updateTheme = () => {
      let resolved = "dark";
      if (theme === "system") {
        resolved = mediaQuery.matches ? "dark" : "light";
      } else {
        resolved = theme;
      }

      setResolvedTheme(resolved);

      if (resolved === "dark") {
        root.classList.add("dark");
        root.classList.remove("light");
      } else {
        root.classList.add("light");
        root.classList.remove("dark");
      }
      root.style.colorScheme = resolved;
    };

    if (isFirstRender.current) {
      isFirstRender.current = false;
      updateTheme();
    } else {
      updateTheme();
    }

    const listener = () => {
      if (theme === "system") {
        updateTheme();
      }
    };

    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
      <div
        ref={overlayRef}
        className="fixed inset-0 pointer-events-none z-[99999]"
        style={{
          clipPath: "circle(0% at 50% 50%)",
          backgroundColor: "#030012"
        }}
      />
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
