import { useEffect, useState } from "react";

export const isIOSDevice = () => {
  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  return /iPad|iPhone|iPod/.test(ua) || (platform === "MacIntel" && maxTouchPoints > 1);
};

export const applyIOSClass = () => {
  if (typeof document === "undefined") return false;

  const isIOS = isIOSDevice();
  document.documentElement.classList.toggle("ios-device", isIOS);
  return isIOS;
};

export const useIsIOS = () => {
  const [isIOS, setIsIOS] = useState(() => isIOSDevice());

  useEffect(() => {
    setIsIOS(applyIOSClass());
  }, []);

  return isIOS;
};
