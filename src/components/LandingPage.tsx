import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  TrendingUp, 
  Users, 
  ChevronRight, 
  ChevronLeft,
  CheckCircle2, 
  Stethoscope, 
  Activity, 
  CreditCard, 
  FileText, 
  BarChart3, 
  Mail, 
  Phone, 
  MapPin, 
  MessageSquare,
  Search,
  UserPlus,
  ArrowRight,
  Menu,
  X,
  Plus,
  Briefcase,
  Calendar,
  Truck,
  Camera,
  Heart,
  ShieldAlert,
  ArrowDown,
  Award,
  Globe,
  Clock,
  Check
} from 'lucide-react';
import { CowIcon as Cow } from './CowIcon';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy, limit, where, addDoc, doc } from 'firebase/firestore';
import { Opportunity, Livestock } from '../types';
import { Button, Input, Card, Badge } from './UI';
import { cn, formatDate } from '../lib/utils';
import { useAuth } from '../lib/AuthContext';
import { LandingSettingsData } from './admin/LandingSettings';
import { BrandLogo } from './BrandLogo';
import { PwaInstallButton } from './pwa/PwaInstallButton';

interface LandingPageProps {
  onLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
  const { profile } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [publicLivestock, setPublicLivestock] = useState<Livestock[]>([]);
  const [activeLivestockIndex, setActiveLivestockIndex] = useState(0);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  useEffect(() => {
    // Fetch all public livestock for the hero showcase
    const q = query(
      collection(db, 'livestock')
    );
    const unsub = onSnapshot(q, (snap) => {
      setPublicLivestock(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Livestock)));
    }, (error) => {
      console.error("Livestock fetch error:", error);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    document.documentElement.classList.add('light');
    document.body.classList.add('light');
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }, []);

  const [landingSettings, setLandingSettings] = useState<LandingSettingsData>({
    heroBadge: "Nigeria's Premier Livestock Investment Platform",
    heroTitleMain: "Own Your Livestock Today.",
    heroTitleHighlight: "We'll Grow It.",
    heroDescription: "Acquire high-quality agricultural assets through CowPlugNG. We provide professional portfolio management, veterinary security, and real-time digital tracking until you're ready for liquidation or delivery.",
    heroPrimaryButtonText: "Start Investing",
    heroSecondaryButtonText: "View Growth Packages",
    heroCustomImageUrl: "",
    selectedLivestockIds: [],
    featuredBadges: [
      'Verified Livestock',
      'Professional Management',
      'Veterinary Care',
      'Secure Ownership'
    ],
    customStats: [
      { label: 'Agricultural Assets Managed', value: '500+' },
      { label: 'Investor Satisfaction', value: '98%' },
      { label: 'Verified Asset Deeds', value: '100%' },
      { label: 'Investment Support', value: '24/7' }
    ],
    showLiveStats: true
  });

  useEffect(() => {
    const unsubLanding = onSnapshot(doc(db, 'settings', 'landing'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as LandingSettingsData;
        setLandingSettings(prev => ({ ...prev, ...data }));
      }
    }, (error) => {
      console.warn("Firestore error reading landing settings:", error);
    });

    return () => unsubLanding();
  }, []);

  // Compute effective livestock showcase list based on admin selection in Landing Settings
  const effectiveLivestock = React.useMemo(() => {
    if (landingSettings.selectedLivestockIds && landingSettings.selectedLivestockIds.length > 0) {
      const selectedMap = new Map(publicLivestock.map(ls => [ls.id, ls]));
      const selected = landingSettings.selectedLivestockIds
        .map(id => selectedMap.get(id))
        .filter((ls): ls is Livestock => !!ls);
      return selected;
    }
    return [];
  }, [publicLivestock, landingSettings.selectedLivestockIds]);
  const [platformSettings, setPlatformSettings] = useState({
    companyName: 'CowPlugNG',
    contactEmail: 'cowplug.ng@gmail.com',
    contactPhone: '+234 808 271 9421',
    address: 'Badagry expressway, Pure water bustop, Lagos'
  });

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setPlatformSettings({
          companyName: data.companyName || 'CowPlugNG',
          contactEmail: data.contactEmail || 'cowplug.ng@gmail.com',
          contactPhone: data.contactPhone || '+234 808 271 9421',
          address: data.address || 'Badagry expressway, Pure water bustop, Lagos'
        });
      }
    }, (error) => {
      console.warn("Firestore error reading settings:", error);
    });

    const unsubOpp = onSnapshot(query(collection(db, 'opportunities'), where('status', '==', 'OPEN'), limit(3)), (snapshot) => {
      setOpportunities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Opportunity));
    }, (error) => {
      console.warn("Firestore error reading opportunities:", error);
    });

    return () => {
      unsubSettings();
      unsubOpp();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const scrollTo = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
    setIsMenuOpen(false);
  };

  const navLinks = [
    { name: 'Home', id: 'hero' },
    { name: 'How It Works', id: 'how-it-works' },
    { name: 'Packages', id: 'packages' },
    { name: 'Why Us', id: 'why-us' },
    { name: 'FAQs', id: 'faqs' },
  ];

  const stats = [
    { label: 'Agricultural Assets Managed', value: '500+', icon: Cow },
    { label: 'Investor Satisfaction', value: '98%', icon: Heart },
    { label: 'Verified Asset Deeds', value: '100%', icon: ShieldCheck },
    { label: 'Investment Support', value: '24/7', icon: MessageSquare },
  ];

  const steps = [
    { 
      title: 'Choose your livestock', 
      desc: 'Select the cattle, ram or goat you want.',
      icon: Search,
      color: 'bg-green-100 text-green-800'
    },
    { 
      title: 'Make your payment', 
      desc: 'Complete your purchase and receive confirmation.',
      icon: CreditCard,
      color: 'bg-yellow-100 text-yellow-800'
    },
    { 
      title: 'We manage it', 
      desc: 'CowPlugNG handles feeding, health and day-to-day care.',
      icon: Stethoscope,
      color: 'bg-blue-100 text-blue-800'
    },
    { 
      title: 'Track your livestock', 
      desc: 'See your animal\'s current status and management updates.',
      icon: Activity,
      color: 'bg-emerald-100 text-emerald-800'
    },
    { 
      title: 'Sell or collect', 
      desc: 'When you\'re ready, arrange collection or sale.',
      icon: Truck,
      color: 'bg-purple-100 text-purple-800'
    },
  ];

  const packages = [
    {
      name: 'Pasture Package',
      fee: '₦15,000',
      period: '/month',
      features: [
        'Natural Grazing',
        'Clean Water',
        'Daily Care',
        'Veterinary Monitoring',
        'Monthly Progress Updates',
      ],
      featured: false,
      buttonText: 'Choose Package'
    },
    {
      name: 'Fattening Package',
      fee: '₦15,000',
      period: '/month',
      extra: '+ ₦1,000/day daily feed',
      features: [
        'Everything in Pasture Package',
        'Daily Supplementary Feed',
        'Faster Weight Gain',
        'Premium Feeding Plan',
      ],
      featured: true,
      tag: 'Most Popular',
      buttonText: 'Choose Package'
    }
  ];

  const reasons = [
    { title: 'Asset Management Expertise', desc: 'Professional livestock handlers and portfolio managers dedicated to asset health and value appreciation.', icon: Users },
    { title: 'Veterinary Oversight', desc: 'Rigorous health monitoring, vaccinations, and preventive care to protect your agricultural investment.', icon: Stethoscope },
    { title: 'Performance Reporting', desc: 'Detailed growth metrics, high-quality visual updates, and real-time valuation reports on your dashboard.', icon: Camera },
    { title: 'Optimized Environments', desc: 'Access to nutrient-rich grazing fields and clean water sources designed for maximum weight gain.', icon: Globe },
    { title: 'Verified Asset Ownership', desc: 'Every animal is assigned a unique digital ID and backed by a legal ownership deed and registry.', icon: ShieldCheck },
    { title: 'Secure & Transparent', desc: 'Audited digital records, secure payment processing, and dedicated investor support channels.', icon: Award },
  ];

  const timeline = [
    { title: 'Asset Acquisition', icon: CreditCard },
    { title: 'Portfolio Setup', icon: Briefcase },
    { title: 'Growth Monitoring', icon: Camera },
    { title: 'Value Analysis', icon: TrendingUp },
    { title: 'Liquidation', icon: Truck },
  ];

  const faqs = [
    { q: 'What is CowPlugNG?', a: 'CowPlugNG is a premium livestock investment and professional agricultural asset management platform. We enable investors to acquire livestock and grow their portfolios through expert management and transparent digital tracking.' },
    { q: 'Do I own the livestock assets?', a: 'Yes, 100%. Upon acquisition, you receive a unique digital identification profile and a verified ownership deed. The livestock is legally your asset; we act as professional custodians on your behalf.' },
    { q: 'How is the ROI generated?', a: 'Returns are primarily driven by the biological appreciation of the livestock (weight gain) and market value increases over time. Our management packages are designed to maximize these growth indices.' },
    { q: 'What are the available management packages?', a: 'We offer two tiers: the Pasture Package (natural grazing) and the Fattening Package (supplementary nutrient-rich feeding for accelerated weight gain and faster ROI).' },
    { q: 'How can I monitor my portfolio performance?', a: 'Investors have access to a real-time dashboard featuring high-quality photos, veterinary logs, weight reports, and current valuation analytics.' },
    { q: 'Can I visit the farm locations?', a: 'Absolutely. We maintain an open-door policy for our investment partners. Please schedule a visit through the dashboard with at least 48 hours notice.' },
    { q: 'What happens if an asset is lost?', a: 'While our veterinary and security measures are industry-leading, we maintain contingency protocols. Detailed risk management disclosures are available within the investor agreement.' },
    { q: 'How do I liquidate my investment?', a: 'You can choose to have your livestock delivered physically for personal use or festive purposes, or you can opt to sell your asset through our network once it reaches optimal market weight.' },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-brand-green/10 selection:text-brand-green" style={{ fontFamily: "'Manrope', sans-serif" }}>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 h-20 flex items-center">
        <div className="max-w-7xl mx-auto px-6 w-full flex items-center justify-between">
          <BrandLogo variant="header" onClick={() => scrollTo('hero')} />

          <div className="flex items-center gap-3">
            <Button onClick={onLogin} variant="primary" className="hidden sm:flex h-10 sm:h-11 px-5 sm:px-8 rounded-full font-bold shadow-xl shadow-brand-green/20 text-xs sm:text-sm">
              Get Started
            </Button>
            <button 
              className="text-slate-900 p-2 ml-1 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer" 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              {isMenuOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
            </button>
          </div>
        </div>

        {/* Collapsible Navigation Menu (All Devices) */}
        <AnimatePresence>
          {isMenuOpen && (
            <>
              {/* Blurred Backdrop - tap to close */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setIsMenuOpen(false)}
                className="fixed inset-0 top-20 z-40 bg-slate-900/40 backdrop-blur-md cursor-pointer"
              />
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-20 left-0 right-0 z-50 bg-white border-b border-slate-100 shadow-2xl p-6 sm:p-8 flex flex-col gap-4 max-w-xl mx-auto sm:rounded-b-3xl"
              >
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-2">Navigation Menu</div>
                
                {/* Get Started (Mobile Only) */}
                <div className="sm:hidden mb-2">
                  <Button onClick={onLogin} variant="primary" className="w-full h-11 rounded-full font-bold shadow-xl shadow-brand-green/20">
                    Get Started
                  </Button>
                </div>

                {navLinks.map((link) => (
                  <button 
                    key={link.id} 
                    onClick={() => {
                      scrollTo(link.id);
                      setIsMenuOpen(false);
                    }}
                    className="text-lg font-bold text-slate-700 hover:text-brand-green hover:bg-slate-50 p-3 rounded-xl text-left transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span>{link.name}</span>
                    <span className="text-slate-300 text-sm font-normal">→</span>
                  </button>
                ))}
                <div className="pt-4 border-t border-slate-100 flex flex-col gap-3">
                  <PwaInstallButton 
                    variant="sidebar" 
                    className="w-full"
                    onClickCustom={() => {
                      setIsMenuOpen(false);
                    }}
                  />
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </nav>
      {/* Spacer to fix fixed navbar overlap */}
      <div className="h-20" />

      {/* Hero Section */}
      <section id="hero" className="pt-24 pb-12 px-6 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-brand-green/[0.02] -z-10" />
        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-12 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="lg:col-span-7 space-y-4"
          >
            <div className="space-y-0">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight text-slate-900">
                {landingSettings.heroTitleMain} <br />
                <span className="text-brand-green italic font-serif">{landingSettings.heroTitleHighlight}</span>
              </h1>
              <p className="text-slate-500 text-xl leading-relaxed max-w-xl font-medium">
                {landingSettings.heroDescription}
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-5 pt-4">
              <Button size="lg" className="h-16 px-10 rounded-2xl text-lg font-bold shadow-2xl shadow-brand-green/30" onClick={onLogin}>
                {landingSettings.heroPrimaryButtonText}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button variant="outline" size="lg" className="h-16 px-10 rounded-2xl text-lg font-bold border-2 border-slate-200 hover:border-brand-green hover:bg-brand-green/5" onClick={() => scrollTo('packages')}>
                {landingSettings.heroSecondaryButtonText}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4 pt-4">
              {(landingSettings.featuredBadges || []).map((badge) => (
                <div key={badge} className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-brand-green/10 flex items-center justify-center">
                    <Check className="w-4 h-4 text-brand-green" />
                  </div>
                  <span className="text-sm font-bold text-slate-700 tracking-tight">{badge}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="lg:col-span-5 relative"
          >
            <div className="absolute -inset-4 bg-brand-gold/5 blur-3xl rounded-[3rem] -rotate-3" />
            <div 
              className={cn(
                "relative rounded-[3rem] overflow-hidden border-8 border-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.15)] aspect-[4/5] sm:aspect-square transition-all duration-500",
                "animate-in fade-in zoom-in-95 duration-500"
              )}
              key={effectiveLivestock[activeLivestockIndex % effectiveLivestock.length]?.id}
            >

              {effectiveLivestock.length > 0 && effectiveLivestock[activeLivestockIndex % effectiveLivestock.length] ? (
                <>
                  <img 
                    key={effectiveLivestock[activeLivestockIndex % effectiveLivestock.length].id}
                    src={effectiveLivestock[activeLivestockIndex % effectiveLivestock.length].photos?.[0] || effectiveLivestock[activeLivestockIndex % effectiveLivestock.length].livestockImageUrl || landingSettings.heroCustomImageUrl || "/src/assets/images/brahman_cow_pasture_1785745135569.jpg"} 
                    alt={effectiveLivestock[activeLivestockIndex % effectiveLivestock.length].breed} 
                    className="w-full h-full object-cover scale-105 hover:scale-100 transition-transform duration-[1s]"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                  
                  {/* Next / Previous Carousel Arrow Controls */}
                  {effectiveLivestock.length > 1 && (
                    <>
                      <button 
                        type="button" 
                        onClick={() => setActiveLivestockIndex(prev => (prev - 1 + effectiveLivestock.length) % effectiveLivestock.length)}
                        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-slate-900/60 hover:bg-slate-900/90 backdrop-blur-md text-white border border-white/20 flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95"
                        title="Previous Livestock"
                      >
                        <ChevronLeft className="w-6 h-6" />
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setActiveLivestockIndex(prev => (prev + 1) % effectiveLivestock.length)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-slate-900/60 hover:bg-slate-900/90 backdrop-blur-md text-white border border-white/20 flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95"
                        title="Next Livestock"
                      >
                        <ChevronRight className="w-6 h-6" />
                      </button>
                    </>
                  )}

                  <div className="absolute top-6 right-6 z-10">
                    <select
                      className="bg-white/95 backdrop-blur-md text-slate-900 text-sm font-bold rounded-2xl px-4 py-3 border border-white/40 shadow-2xl cursor-pointer outline-none appearance-none pr-10 relative z-20 max-w-[220px] truncate focus:ring-4 focus:ring-brand-green/20 transition-all duration-300 hover:bg-white"
                      value={activeLivestockIndex % effectiveLivestock.length}
                      onChange={(e) => setActiveLivestockIndex(Number(e.target.value))}
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%230f172a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center' }}
                    >
                      {profile && effectiveLivestock.some(ls => ls.ownerId === profile.uid) && (
                        <optgroup label="Already Owned">
                          {effectiveLivestock.map((ls, idx) => (
                            ls.ownerId === profile.uid && (
                              <option key={ls.id} value={idx}>
                                {ls.tagNumber || ls.id.slice(0,6)} - {ls.breed}
                              </option>
                            )
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Featured Showcase">
                        {effectiveLivestock.map((ls, idx) => (
                          (!ls.ownerId || ls.ownerId !== profile?.uid) && (
                            <option key={ls.id} value={idx}>
                              {ls.tagNumber || ls.id.slice(0,6)} - {ls.breed} ({ls.status || 'Active'})
                            </option>
                          )
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <div className="absolute bottom-6 left-6 right-6 sm:bottom-10 sm:left-10 sm:right-10 flex items-end justify-between">
                    <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-4 sm:p-5 rounded-2xl flex items-center gap-4 max-w-[70%]">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-brand-green rounded-xl flex items-center justify-center shrink-0">
                        <Cow className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-bold text-base sm:text-lg leading-none truncate">{effectiveLivestock[activeLivestockIndex % effectiveLivestock.length].tagNumber || 'Unknown Tag'}</p>
                        <p className="text-white/70 text-[10px] sm:text-xs font-medium mt-1 uppercase tracking-widest truncate">
                          {effectiveLivestock[activeLivestockIndex % effectiveLivestock.length].weight}kg • Health: {effectiveLivestock[activeLivestockIndex % effectiveLivestock.length].healthStatus || 'Good'} • {effectiveLivestock[activeLivestockIndex % effectiveLivestock.length].ownerId ? 'Owned Asset' : 'Available'}
                        </p>
                      </div>
                    </div>
                    <div className="h-10 sm:h-12 px-4 sm:px-6 rounded-full bg-brand-gold flex items-center text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shrink-0">
                      {effectiveLivestock[activeLivestockIndex % effectiveLivestock.length].status || 'Verified'}
                    </div>
                  </div>
                </>
              ) : (
                /* EMPTY BOX PLACEHOLDER WHEN NO LIVESTOCK SELECTED BY ADMIN */
                <div className="w-full h-full bg-slate-900 border-2 border-dashed border-slate-700/80 rounded-[3rem] p-8 flex flex-col items-center justify-center text-center relative overflow-hidden group shadow-inner">
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-green/10 via-transparent to-brand-gold/5 opacity-50" />
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-20 h-20 rounded-3xl bg-slate-800/90 border border-slate-700 flex items-center justify-center mb-5 shadow-2xl group-hover:scale-105 transition-transform duration-500">
                      <Cow className="w-10 h-10 text-brand-green/70" />
                    </div>
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-black uppercase tracking-widest mb-3">
                      Empty Showcase Slot
                    </div>
                    <h3 className="text-xl font-black text-white max-w-xs mb-2">No Featured Livestock Selected</h3>
                    <p className="text-slate-400 text-xs font-medium max-w-sm leading-relaxed">
                      Select livestock assets in Admin &gt; Land Settings to feature them in this showcase slot.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* SCROLLABLE HORIZONTAL THUMBNAIL CHIPS WHEN LIVESTOCK ARE SELECTED */}
            {effectiveLivestock.length > 0 && (
              <div className="mt-4 flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
                {effectiveLivestock.map((ls, idx) => {
                  const isActive = (activeLivestockIndex % effectiveLivestock.length) === idx;
                  return (
                    <button
                      key={ls.id}
                      type="button"
                      onClick={() => setActiveLivestockIndex(idx)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-2xl border text-left transition-all shrink-0 cursor-pointer",
                        isActive 
                          ? "bg-brand-green/10 border-brand-green text-slate-900 shadow-md ring-2 ring-brand-green/30 scale-105" 
                          : "bg-white/80 border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300"
                      )}
                    >
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                        <img 
                          src={ls.photos?.[0] || ls.livestockImageUrl || "/src/assets/images/brahman_cow_pasture_1785745135569.jpg"} 
                          alt={ls.tagNumber} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="pr-1">
                        <p className="text-xs font-black leading-tight text-slate-900">{ls.tagNumber || ls.id.slice(0,6)}</p>
                        <p className="text-[10px] font-bold text-slate-400">{ls.breed} • {ls.weight}kg</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Trust Statistics */}
      {landingSettings.showLiveStats !== false && (
        <section className="py-12 px-6 border-y border-slate-100 bg-slate-50/50">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {(landingSettings.customStats || stats).map((stat, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="text-center space-y-4"
                >
                  <div className="w-14 h-14 bg-white shadow-xl shadow-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Cow className="w-7 h-7 text-brand-green" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tighter">{stat.value}</p>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section id="how-it-works" className="py-16 px-6 bg-white">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">How It Works</h2>
            <p className="text-slate-500 text-base font-medium leading-relaxed">
              Our streamlined process ensures your livestock ownership experience is seamless, transparent, and rewarding.
            </p>
          </div>

          <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
            {steps.map((step, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 group"
              >
                <div className={cn("w-12 h-12 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-300", step.color)}>
                  <step.icon className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-black text-brand-gold uppercase tracking-[0.2em]">Step 0{idx + 1}</div>
                  <h3 className="text-lg font-extrabold text-slate-900 leading-tight">{step.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed font-medium">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Asset Packages */}
      <section id="packages" className="py-16 px-6 bg-slate-50 border-y border-slate-100 relative overflow-hidden">
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-brand-gold/[0.03] blur-[150px] rounded-full translate-x-1/2 translate-y-1/2" />
        <div className="max-w-7xl mx-auto space-y-8 relative z-10">
          <div className="text-center space-y-6 max-w-2xl mx-auto">
            <h2 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
              {landingSettings.packagesTitle || "Portfolio Management Packages"}
            </h2>
            <p className="text-slate-500 text-lg font-medium leading-relaxed">
              {landingSettings.packagesSubtitle || "Choose the tier that aligns with your capital growth goals. Professional asset care for superior returns."}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {(landingSettings.customPackages && landingSettings.customPackages.length > 0 ? landingSettings.customPackages : packages).map((pkg, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className={cn(
                  "relative p-8 border bg-white flex flex-col justify-between transition-all duration-300",
                  pkg.featured ? "border-brand-green shadow-lg ring-1 ring-brand-green" : "border-slate-200 shadow-sm"
                )}
              >
                {pkg.featured && pkg.tag && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-brand-gold text-white px-4 py-1 text-[10px] font-black uppercase tracking-widest">
                    {pkg.tag}
                  </div>
                )}
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-slate-900">{pkg.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-slate-900 tracking-tighter">{pkg.fee}</span>
                      <span className="text-slate-400 font-bold text-sm">{pkg.period}</span>
                    </div>
                    {pkg.extra && (
                      <p className="text-brand-green font-bold text-xs bg-brand-green/5 px-3 py-1 inline-block mt-2">
                        {pkg.extra}
                      </p>
                    )}
                  </div>

                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Included Services</p>
                    <div className="space-y-2">
                      {pkg.features.map((feature) => (
                        <div key={feature} className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-brand-green/10 flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3 text-brand-green" />
                          </div>
                          <span className="text-slate-600 font-bold text-xs tracking-tight">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <Button 
                    onClick={onLogin}
                    variant={pkg.featured ? 'primary' : 'outline'} 
                    className={cn(
                      "w-full h-12 font-bold transition-all duration-300",
                      pkg.featured ? "shadow-lg shadow-brand-green/20" : "border-2 border-slate-200 hover:border-brand-green hover:bg-brand-green/5"
                    )}
                  >
                    {pkg.buttonText || 'Choose Package'}
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Invest with CowPlugNG */}
      <section id="why-us" className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-6 max-w-2xl mx-auto">
            <h2 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">Why Invest with CowPlugNG</h2>
            <p className="text-slate-500 text-lg font-medium leading-relaxed">
              We've built an ecosystem centered around trust, biological appreciation, and transparency for modern livestock investors.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
            {reasons.map((reason, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
                className="group p-10 rounded-[2.5rem] border border-slate-100 hover:border-brand-green/20 hover:bg-slate-50 transition-all duration-500"
              >
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-brand-green group-hover:scale-110 transition-all duration-500">
                  <reason.icon className="w-7 h-7 text-slate-400 group-hover:text-white" />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-4 tracking-tight group-hover:text-brand-green transition-colors">{reason.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed font-medium">{reason.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Customer Journey Timeline */}
      <section className="py-20 px-6 bg-brand-green relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />
        <div className="max-w-7xl mx-auto text-center space-y-12 relative z-10">
          <h2 className="text-4xl lg:text-5xl font-black text-white tracking-tight">Your Journey with CowPlugNG</h2>
          
          <div className="flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-0">
            {timeline.map((step, idx) => (
              <React.Fragment key={idx}>
                <motion.div 
                  initial={{ opacity: 0, scale: 0.5 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex flex-col items-center gap-4 w-40"
                >
                  <div className="w-20 h-20 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center shadow-2xl">
                    <step.icon className="w-8 h-8 text-white" />
                  </div>
                  <span className="text-white font-black text-sm uppercase tracking-widest">{step.title}</span>
                </motion.div>
                {idx < timeline.length - 1 && (
                  <div className="hidden lg:block w-32 h-0.5 bg-white/20" />
                )}
                {idx < timeline.length - 1 && (
                  <div className="lg:hidden h-12 w-0.5 bg-white/20" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section id="faqs" className="py-20 px-6 bg-slate-50 border-y border-slate-100">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Frequently Asked Questions</h2>
            <p className="text-slate-500 font-bold">Clear answers to your most common questions.</p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <motion.div 
                key={idx}
                className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.02)]"
              >
                <button 
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  className="w-full px-8 py-6 flex items-center justify-between text-left hover:bg-slate-50 transition-colors group"
                >
                  <span className="font-extrabold text-slate-800 text-lg group-hover:text-brand-green transition-colors">{faq.q}</span>
                  <div className={cn(
                    "w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center transition-all duration-300",
                    activeFaq === idx ? "bg-brand-green border-brand-green rotate-180" : "bg-white"
                  )}>
                    <ArrowDown className={cn("w-4 h-4 transition-colors", activeFaq === idx ? "text-white" : "text-slate-400")} />
                  </div>
                </button>
                <AnimatePresence>
                  {activeFaq === idx && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                    >
                      <div className="px-8 pb-8 text-slate-500 font-medium leading-relaxed border-t border-slate-50 pt-6">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-brand-green rounded-[4rem] p-16 lg:p-24 text-center space-y-12 relative overflow-hidden shadow-[0_50px_100px_-20px_rgba(22,101,52,0.3)]"
          >
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none" />
            <div className="space-y-6 relative z-10">
              <h2 className="text-4xl lg:text-6xl font-black text-white leading-tight tracking-tight">Ready to Build Your Portfolio?</h2>
              <p className="text-white/80 text-xl font-medium max-w-2xl mx-auto leading-relaxed">
                Join CowPlugNG today and let our experienced team professionally manage your agricultural assets while you enjoy transparent capital growth.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 relative z-10">
              <Button size="lg" className="h-16 px-12 rounded-2xl bg-white text-brand-green hover:bg-slate-50 text-xl font-black shadow-2xl" onClick={onLogin}>
                Start Acquisition
              </Button>
              <Button variant="outline" size="lg" className="h-16 px-12 rounded-2xl border-2 border-white/30 text-white hover:bg-white/10 text-xl font-black" onClick={() => scrollTo('contact')}>
                Contact Us
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="py-16 px-6 bg-slate-50 border-t border-slate-100">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-4 gap-16 pb-20 border-b border-slate-200">
            <div className="space-y-8 lg:col-span-1">
              <BrandLogo variant="header" onClick={() => scrollTo('hero')} />
              <p className="text-slate-500 font-medium leading-relaxed">
                {landingSettings.footerDescription || "Premium livestock ownership and management platform. Securing your agricultural assets with professional care and digital transparency."}
              </p>
              {landingSettings.companyAddress && (
                <p className="text-xs font-bold text-slate-700 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-brand-green shrink-0" />
                  {landingSettings.companyAddress}
                </p>
              )}
              <div className="flex items-center gap-4">
                {['Twitter', 'Instagram', 'Facebook', 'LinkedIn'].map((social) => (
                  <button key={social} className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:text-brand-green hover:border-brand-green transition-all">
                    <Globe className="w-5 h-5" />
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-2 lg:col-span-2 gap-12">
              <div className="space-y-8">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Platform</h4>
                <ul className="space-y-4">
                  {['About', 'Farm Packages', 'FAQs', 'Privacy Policy', 'Terms'].map((item) => (
                    <li key={item}>
                      <button className="text-slate-500 font-bold text-sm hover:text-brand-green transition-colors">{item}</button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-8">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Connect</h4>
                <ul className="space-y-6">
                  <li className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-brand-green flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-tighter mb-1">Phone</p>
                      <p className="text-slate-700 font-bold text-sm">{landingSettings.contactPhone || platformSettings.contactPhone}</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-brand-green flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-tighter mb-1">Email</p>
                      <p className="text-slate-700 font-bold text-sm">{landingSettings.contactEmail || platformSettings.contactEmail}</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <MessageSquare className="w-5 h-5 text-brand-green flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-tighter mb-1">WhatsApp</p>
                      <p className="text-slate-700 font-bold text-sm">{landingSettings.whatsappPhone || "+234 808 271 9421"}</p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>

            <div className="space-y-8">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">{landingSettings.newsletterTitle || "Newsletter"}</h4>
              <p className="text-slate-500 font-bold text-sm leading-relaxed">
                {landingSettings.newsletterText || "Get the latest farm reports and new investment opportunities delivered to your inbox."}
              </p>
              <div className="relative group">
                <input 
                  type="email" 
                  placeholder="Enter email"
                  className="w-full h-14 bg-white border border-slate-200 rounded-2xl px-6 text-sm font-bold focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none transition-all"
                />
                <button className="absolute right-2 top-2 bottom-2 px-5 bg-brand-green text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-brand-green/20">
                  Join
                </button>
              </div>
            </div>
          </div>

          <div className="pt-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-slate-400 font-bold text-xs tracking-tighter uppercase">
              © {new Date().getFullYear()} {landingSettings.copyrightText || `${platformSettings.companyName}. All rights reserved.`}
            </p>
            <div className="flex items-center gap-6">
              <button className="text-slate-400 font-bold text-xs uppercase tracking-tighter hover:text-slate-600 transition-colors">Privacy</button>
              <button className="text-slate-400 font-bold text-xs uppercase tracking-tighter hover:text-slate-600 transition-colors">Terms</button>
              <button className="text-slate-400 font-bold text-xs uppercase tracking-tighter hover:text-slate-600 transition-colors">Cookies</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
