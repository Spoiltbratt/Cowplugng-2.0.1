import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface PwaContextType {
  isInstallable: boolean;
  isNativePromptSupported: boolean;
  isStandalone: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isInstalled: boolean;
  hasUpdate: boolean;
  showInstallModal: boolean;
  openInstallModal: () => void;
  closeInstallModal: () => void;
  promptInstall: () => Promise<void>;
  applyUpdate: () => void;
}

const PwaContext = createContext<PwaContextType | undefined>(undefined);

export const PwaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => (window as any).__pwaPrompt || null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);

  // 1. Detect Standalone / Installed environment & OS
  useEffect(() => {
    // Check if running in standalone display mode
    const checkStandalone = () => {
      const isStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      
      setIsStandalone(isStandaloneMode);
      if (isStandaloneMode) {
        setIsInstalled(true);
      }
    };

    checkStandalone();

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      setIsStandalone(e.matches);
      if (e.matches) {
        setIsInstalled(true);
        setShowInstallModal(false);
      }
    };

    try {
      mediaQuery.addEventListener('change', handleDisplayModeChange);
    } catch (e) {
      mediaQuery.addListener?.(handleDisplayModeChange);
    }

    // Detect User Agent / OS
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua) || 
      (window.navigator.platform === 'MacIntel' && (window.navigator as any).maxTouchPoints > 1);
    const isAndroidDevice = /android/.test(ua);

    setIsIOS(isIosDevice);
    setIsAndroid(isAndroidDevice);

    // Check if user previously marked as installed in localStorage
    if (localStorage.getItem('cowplug_pwa_installed') === 'true') {
      setIsInstalled(true);
    }

    return () => {
      try {
        mediaQuery.removeEventListener('change', handleDisplayModeChange);
      } catch (e) {
        mediaQuery.removeListener?.(handleDisplayModeChange);
      }
    };
  }, []);

  // 2. Register Service Worker & Listen for Updates
  useEffect(() => {
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      const registerSW = async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/'
          });

          console.log('[PWA] Service Worker registered with scope:', registration.scope);

          // Check if there is already a waiting worker
          if (registration.waiting) {
            setWaitingWorker(registration.waiting);
            setHasUpdate(true);
          }

          // Listen for new service worker being installed
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New content is available once old controller is replaced
                  console.log('[PWA] New version ready for update');
                  setWaitingWorker(newWorker);
                  setHasUpdate(true);
                }
              });
            }
          });

          // Check for SW updates every 30 minutes
          const intervalId = setInterval(() => {
            registration.update().catch(err => console.warn('[PWA] SW update check error:', err));
          }, 30 * 60 * 1000);

          return () => clearInterval(intervalId);
        } catch (error) {
          console.warn('[PWA] Service Worker registration failed:', error);
        }
      };

      registerSW();

      // Listen for controller changes (when new SW takes over)
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  }, []);

  // 3. Listen to beforeinstallprompt, pwa-prompt-ready, and appinstalled events
  useEffect(() => {
    const handlePromptReady = () => {
      if ((window as any).__pwaPrompt) {
        setDeferredPrompt((window as any).__pwaPrompt);
      }
    };

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent browser's default automatic mini-infobar
      e.preventDefault();
      console.log('[PWA] beforeinstallprompt captured');
      (window as any).__pwaPrompt = e;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      console.log('[PWA] CowPlug NG installed successfully');
      (window as any).__pwaPrompt = null;
      setDeferredPrompt(null);
      setIsInstalled(true);
      setShowInstallModal(false);
      localStorage.setItem('cowplug_pwa_installed', 'true');
    };

    window.addEventListener('pwa-prompt-ready', handlePromptReady);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('pwa-prompt-ready', handlePromptReady);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // 4. Prompt Install Trigger
  const promptInstall = useCallback(() => {
    // If native prompt is available (e.g. Android Chrome, Desktop Chrome/Edge)
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choice) => {
          console.log('[PWA] User response to install prompt:', choice.outcome);
          if (choice.outcome === 'accepted') {
            setIsInstalled(true);
            localStorage.setItem('cowplug_pwa_installed', 'true');
          }
          setDeferredPrompt((window as any).__pwaPrompt = null);
          setShowInstallModal(false);
        }).catch((err) => {
          console.error('[PWA] Error in userChoice:', err);
          setShowInstallModal(true);
        });
      } catch (err) {
        console.error('[PWA] Error calling install prompt:', err);
        setShowInstallModal(true);
      }
    } else {
      // Otherwise open the install modal / iOS guide
      setShowInstallModal(true);
    }
  }, [deferredPrompt]);

  // 5. Apply Service Worker Update
  const applyUpdate = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  }, [waitingWorker]);

  const openInstallModal = useCallback(() => {
    setShowInstallModal(true);
  }, []);

  const closeInstallModal = useCallback(() => {
    setShowInstallModal(false);
  }, []);

  // User is considered installable if not already standalone and either:
  // - native prompt is available
  // - on iOS Safari (where manual Add to Home Screen is supported)
  // - on standard mobile browser
  const isNativePromptSupported = !!deferredPrompt;
  const isInstallable = !isStandalone && (isNativePromptSupported || isIOS || isAndroid);

  return (
    <PwaContext.Provider
      value={{
        isInstallable,
        isNativePromptSupported,
        isStandalone,
        isIOS,
        isAndroid,
        isInstalled,
        hasUpdate,
        showInstallModal,
        openInstallModal,
        closeInstallModal,
        promptInstall,
        applyUpdate
      }}
    >
      {children}
    </PwaContext.Provider>
  );
};

export const usePwa = () => {
  const context = useContext(PwaContext);
  if (!context) {
    throw new Error('usePwa must be used within a PwaProvider');
  }
  return context;
};
