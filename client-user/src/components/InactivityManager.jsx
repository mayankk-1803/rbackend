import React, { useEffect } from 'react';

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes for client user
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
const THROTTLE_DELAY = 5000; // Only write activity timestamp at most every 5 seconds

export default function InactivityManager() {
  useEffect(() => {
    let lastLoggedTime = Date.now();
    localStorage.setItem('dizipay_last_activity', Date.now().toString());

    const handleActivity = () => {
      const token = sessionStorage.getItem('dizipay_user_token');
      if (!token) return;

      const now = Date.now();
      if (now - lastLoggedTime > THROTTLE_DELAY) {
        localStorage.setItem('dizipay_last_activity', now.toString());
        lastLoggedTime = now;
      }
    };

    // Add activity listeners
    ACTIVITY_EVENTS.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Check inactivity interval (every 10 seconds)
    const interval = setInterval(() => {
      const token = sessionStorage.getItem('dizipay_user_token');
      if (!token) return;

      // If last activity is not set yet, initialize it
      let lastActivity = localStorage.getItem('dizipay_last_activity');
      if (!lastActivity) {
        lastActivity = Date.now().toString();
        localStorage.setItem('dizipay_last_activity', lastActivity);
      }

      const elapsed = Date.now() - parseInt(lastActivity, 10);
      if (elapsed >= TIMEOUT_MS) {
        // Clear all session storage credentials
        sessionStorage.removeItem('dizipay_user_token');
        sessionStorage.removeItem('dizipay_user_data');
        sessionStorage.removeItem('dizipay_developer_token');
        
        for (let k in sessionStorage) {
          if (k.includes('user') || k.includes('developer')) {
            sessionStorage.removeItem(k);
          }
        }

        // Clear local storage activity tracking keys
        localStorage.removeItem('dizipay_last_activity');

        // Trigger sync logout for other tabs
        localStorage.setItem('dizipay_logout_sync', Date.now().toString());
        
        // Save logout reason for the login page
        sessionStorage.setItem('dizipay_logout_reason', 'inactivity');
        
        // Redirect to login page
        window.location.href = '/login';
      }
    }, 10000);
 
    // Sync logout across tabs via storage event listener
    const handleStorageEvent = (e) => {
      if (e.key === 'dizipay_logout_sync' && e.newValue) {
        sessionStorage.removeItem('dizipay_user_token');
        sessionStorage.removeItem('dizipay_user_data');
        sessionStorage.removeItem('dizipay_developer_token');
        
        for (let k in sessionStorage) {
          if (k.includes('user') || k.includes('developer')) {
            sessionStorage.removeItem(k);
          }
        }
        localStorage.removeItem('dizipay_last_activity');
        localStorage.removeItem('dizipay_logout_sync');
        window.location.href = '/login';
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      ACTIVITY_EVENTS.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, []);

  return null;
}
