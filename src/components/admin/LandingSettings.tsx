import React, { useState, useEffect } from 'react';
import { 
  Globe, Save, Layout, Sparkles, Check, 
  Plus, Trash2, Eye, RefreshCcw, Image as ImageIcon, 
  Award, CheckCircle2, Sliders, ShieldCheck,
  Tag, ArrowRight, Phone, Mail, MessageSquare, MapPin, Briefcase, X
} from 'lucide-react';
import { CowIcon as Cow } from '../CowIcon';
import { db, handleFirestoreError, OperationType, logActivity } from '../../lib/firebase';
import { doc, getDoc, setDoc, collection, onSnapshot } from 'firebase/firestore';
import { Livestock } from '../../types';
import { Card, Button, Input, Badge } from '../UI';
import { cn } from '../../lib/utils';
import { useAuth } from '../../lib/AuthContext';

export interface PackageSettingItem {
  id?: string;
  name: string;
  fee: string;
  period: string;
  extra?: string;
  features: string[];
  featured?: boolean;
  tag?: string;
  buttonText: string;
}

export interface LandingSettingsData {
  heroBadge: string;
  heroTitleMain: string;
  heroTitleHighlight: string;
  heroDescription: string;
  heroPrimaryButtonText: string;
  heroSecondaryButtonText: string;
  heroCustomImageUrl: string;
  selectedLivestockIds: string[];
  featuredBadges: string[];
  customStats: { label: string; value: string }[];
  showLiveStats: boolean;
  // Packages Section
  packagesTitle?: string;
  packagesSubtitle?: string;
  customPackages?: PackageSettingItem[];
  // Footer & Contact Settings
  footerDescription: string;
  contactPhone: string;
  contactEmail: string;
  whatsappPhone: string;
  companyAddress: string;
  newsletterTitle: string;
  newsletterText: string;
  copyrightText: string;
  updatedAt?: number;
}

const DEFAULT_LANDING_SETTINGS: LandingSettingsData = {
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
  showLiveStats: true,
  packagesTitle: "Portfolio Management Packages",
  packagesSubtitle: "Choose the tier that aligns with your capital growth goals. Professional asset care for superior returns.",
  customPackages: [
    {
      id: 'pkg-1',
      name: 'Pasture Package',
      fee: '₦15,000',
      period: '/month',
      extra: '',
      features: [
        'Natural Grazing',
        'Clean Water',
        'Daily Care',
        'Veterinary Monitoring',
        'Monthly Progress Updates',
      ],
      featured: false,
      tag: '',
      buttonText: 'Choose Package'
    },
    {
      id: 'pkg-2',
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
  ],
  footerDescription: "Premium livestock ownership and management platform. Securing your agricultural assets with professional care and digital transparency.",
  contactPhone: "+234 808 271 9421",
  contactEmail: "cowplug.ng@gmail.com",
  whatsappPhone: "+234 808 271 9421",
  companyAddress: "Lagos, Nigeria",
  newsletterTitle: "Newsletter",
  newsletterText: "Get the latest farm reports and new investment opportunities delivered to your inbox.",
  copyrightText: "CowPlugNG. All rights reserved."
};

export const LandingSettings: React.FC = () => {
  const { profile } = useAuth();
  const [landingSettings, setLandingSettings] = useState<LandingSettingsData>(DEFAULT_LANDING_SETTINGS);
  const [allLivestock, setAllLivestock] = useState<Livestock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [newBadge, setNewBadge] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  const firstSelectedLivestock = React.useMemo(() => {
    if (landingSettings.selectedLivestockIds.length > 0) {
      return allLivestock.find(ls => ls.id === landingSettings.selectedLivestockIds[0]);
    }
    return null;
  }, [allLivestock, landingSettings.selectedLivestockIds]);

  const previewImage = firstSelectedLivestock?.photos?.[0] || firstSelectedLivestock?.livestockImageUrl || landingSettings.heroCustomImageUrl || "/src/assets/images/brahman_cow_pasture_1785745135569.jpg";

  // Realtime fetch landing settings
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'landing'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as LandingSettingsData;
        setLandingSettings({
          ...DEFAULT_LANDING_SETTINGS,
          ...data,
          featuredBadges: data.featuredBadges || DEFAULT_LANDING_SETTINGS.featuredBadges,
          customStats: data.customStats || DEFAULT_LANDING_SETTINGS.customStats,
          selectedLivestockIds: data.selectedLivestockIds || []
        });
      } else {
        setLandingSettings(DEFAULT_LANDING_SETTINGS);
      }
      setLoading(false);
    }, (error) => {
      console.warn("Error fetching landing settings:", error);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Realtime fetch all livestock to allow selection
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'livestock'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Livestock));
      setAllLivestock(list);
    }, (error) => {
      console.warn("Error fetching livestock for landing page selection:", error);
    });

    return () => unsub();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      const payload: LandingSettingsData = {
        ...landingSettings,
        updatedAt: Date.now()
      };

      await setDoc(doc(db, 'settings', 'landing'), payload);

      await logActivity(
        profile?.uid || 'system',
        profile?.displayName || 'Administrator',
        'UPDATE_LANDING_SETTINGS',
        'SETTING',
        'landing',
        `Updated landing page configuration and featured livestock selection (${landingSettings.selectedLivestockIds.length} items selected)`
      );

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/landing');
    } finally {
      setSaving(false);
    }
  };

  const toggleLivestockSelection = (id: string) => {
    setLandingSettings(prev => {
      const exists = prev.selectedLivestockIds.includes(id);
      const updated = exists 
        ? prev.selectedLivestockIds.filter(item => item !== id)
        : [...prev.selectedLivestockIds, id];
      return { ...prev, selectedLivestockIds: updated };
    });
  };

  const handleAddBadge = () => {
    if (!newBadge.trim()) return;
    if (landingSettings.featuredBadges.includes(newBadge.trim())) return;
    setLandingSettings(prev => ({
      ...prev,
      featuredBadges: [...prev.featuredBadges, newBadge.trim()]
    }));
    setNewBadge('');
  };

  const handleRemoveBadge = (badgeToRemove: string) => {
    setLandingSettings(prev => ({
      ...prev,
      featuredBadges: prev.featuredBadges.filter(b => b !== badgeToRemove)
    }));
  };

  const handleUpdateStat = (index: number, field: 'label' | 'value', val: string) => {
    setLandingSettings(prev => {
      const updatedStats = [...prev.customStats];
      updatedStats[index] = { ...updatedStats[index], [field]: val };
      return { ...prev, customStats: updatedStats };
    });
  };

  const handleAddPackage = () => {
    const newPkg: PackageSettingItem = {
      id: `pkg-${Date.now()}`,
      name: 'Custom Package Tier',
      fee: '₦20,000',
      period: '/month',
      extra: '',
      features: ['Veterinary Care', 'Monthly Farm Audit', 'Digital Tracking'],
      featured: false,
      tag: 'Special',
      buttonText: 'Choose Package'
    };
    setLandingSettings(prev => ({
      ...prev,
      customPackages: [...(prev.customPackages || []), newPkg]
    }));
  };

  const handleUpdatePackage = (index: number, field: keyof PackageSettingItem, value: any) => {
    setLandingSettings(prev => {
      const updated = [...(prev.customPackages || [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, customPackages: updated };
    });
  };

  const handleRemovePackage = (index: number) => {
    setLandingSettings(prev => ({
      ...prev,
      customPackages: (prev.customPackages || []).filter((_, i) => i !== index)
    }));
  };

  const handleAddPackageFeature = (pkgIndex: number, featureText: string) => {
    if (!featureText.trim()) return;
    setLandingSettings(prev => {
      const updated = [...(prev.customPackages || [])];
      const target = updated[pkgIndex];
      updated[pkgIndex] = {
        ...target,
        features: [...target.features, featureText.trim()]
      };
      return { ...prev, customPackages: updated };
    });
  };

  const handleRemovePackageFeature = (pkgIndex: number, featureIndex: number) => {
    setLandingSettings(prev => {
      const updated = [...(prev.customPackages || [])];
      const target = updated[pkgIndex];
      updated[pkgIndex] = {
        ...target,
        features: target.features.filter((_, fi) => fi !== featureIndex)
      };
      return { ...prev, customPackages: updated };
    });
  };

  const filteredLivestockList = allLivestock.filter(ls => 
    (ls.tagNumber || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
    (ls.breed || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
    (ls.investmentPackage || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
    (ls.status || '').toLowerCase().includes(searchFilter.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 font-medium">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        Loading Landing Page Settings...
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-700/10 rounded-2xl flex items-center justify-center text-emerald-700">
            <Layout className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Landing Page Settings</h1>
            <p className="text-xs text-slate-500 font-medium">Customize hero banner, featured livestock showcase, badges & trust statistics on the public landing page</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {savedSuccess && (
            <span className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200 animate-in fade-in">
              <Check className="w-4 h-4" />
              Settings Saved!
            </span>
          )}
          <Button type="button" onClick={handleSave} isLoading={saving} className="h-12 px-6 rounded-2xl font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-lg shadow-emerald-700/20">
            <Save className="w-4 h-4 mr-2" />
            Publish Changes
          </Button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* SECTION 1: Featured Livestock Showcase Picker */}
        <Card title="Featured Livestock Selection for Hero Showcase" icon={Cow} className="border-slate-100 shadow-sm">
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100">
              <div>
                <p className="text-sm font-black text-slate-900">Select Livestock to Display</p>
                <p className="text-xs text-slate-600 font-medium mt-0.5">
                  Check the livestock items below to feature them in the interactive dropdown selector on the Landing Page Hero section.
                </p>
              </div>
              <div className="px-4 py-2 bg-emerald-700 text-white font-black text-xs rounded-xl shrink-0 text-center shadow-sm">
                {landingSettings.selectedLivestockIds.length} Selected
              </div>
            </div>

            {/* Filter Input */}
            <div className="flex items-center gap-3">
              <Input 
                placeholder="Search livestock by tag, breed, or package..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="max-w-md"
              />
              {landingSettings.selectedLivestockIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setLandingSettings(prev => ({ ...prev, selectedLivestockIds: [] }))}
                  className="text-xs text-rose-600 font-bold hover:underline cursor-pointer"
                >
                  Clear Selection
                </button>
              )}
            </div>

            {/* Livestock Selection Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[420px] overflow-y-auto p-1 border border-slate-100 rounded-2xl">
              {filteredLivestockList.length === 0 ? (
                <div className="col-span-full p-8 text-center text-slate-400 text-xs font-medium">
                  No livestock found matching filter.
                </div>
              ) : (
                filteredLivestockList.map((ls) => {
                  const isSelected = landingSettings.selectedLivestockIds.includes(ls.id);
                  const img = ls.photos?.[0] || ls.livestockImageUrl || "/src/assets/images/brahman_cow_pasture_1785745135569.jpg";

                  return (
                    <div
                      key={ls.id}
                      onClick={() => toggleLivestockSelection(ls.id)}
                      className={cn(
                        "p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center gap-4 relative group",
                        isSelected 
                          ? "bg-emerald-50/90 border-emerald-500 shadow-md ring-2 ring-emerald-500/20" 
                          : "bg-white border-slate-200 hover:border-emerald-300 hover:bg-slate-50"
                      )}
                    >
                      <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-slate-200 relative bg-slate-100">
                        <img 
                          src={img} 
                          alt={ls.breed} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          referrerPolicy="no-referrer"
                        />
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-black text-slate-900 truncate">{ls.tagNumber || ls.id.slice(0, 8)}</span>
                          <span className={cn(
                            "text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase",
                            isSelected ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600"
                          )}>
                            {ls.status || 'Active'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 font-bold truncate">{ls.breed} ({ls.investmentPackage || 'Livestock'})</p>
                        <p className="text-[10px] text-slate-400 font-medium">{ls.weight}kg • Health: {ls.healthStatus || 'Good'}</p>
                      </div>

                      <div className={cn(
                        "w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors border",
                        isSelected ? "bg-emerald-700 border-emerald-700 text-white" : "border-slate-300 text-transparent bg-white group-hover:border-emerald-400"
                      )}>
                        <Check className="w-4 h-4" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </Card>

        {/* SECTION 2: Hero Header & Copy Settings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card title="Hero Content & Copy" icon={Sliders} className="border-slate-100 shadow-sm">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1 block">Hero Badge Text</label>
                <Input 
                  value={landingSettings.heroBadge}
                  onChange={(e) => setLandingSettings({ ...landingSettings, heroBadge: e.target.value })}
                  placeholder="e.g. Nigeria's Premier Livestock Platform"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1 block">Main Title</label>
                <Input 
                  value={landingSettings.heroTitleMain}
                  onChange={(e) => setLandingSettings({ ...landingSettings, heroTitleMain: e.target.value })}
                  placeholder="e.g. Own Your Livestock Today."
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1 block">Title Highlight (Serif / Italic)</label>
                <Input 
                  value={landingSettings.heroTitleHighlight}
                  onChange={(e) => setLandingSettings({ ...landingSettings, heroTitleHighlight: e.target.value })}
                  placeholder="e.g. We'll Grow It."
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1 block">Hero Subtitle / Description</label>
                <textarea 
                  rows={3}
                  value={landingSettings.heroDescription}
                  onChange={(e) => setLandingSettings({ ...landingSettings, heroDescription: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 p-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1 block">Primary Button Text</label>
                  <Input 
                    value={landingSettings.heroPrimaryButtonText}
                    onChange={(e) => setLandingSettings({ ...landingSettings, heroPrimaryButtonText: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1 block">Secondary Button Text</label>
                  <Input 
                    value={landingSettings.heroSecondaryButtonText}
                    onChange={(e) => setLandingSettings({ ...landingSettings, heroSecondaryButtonText: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1 block">Fallback / Custom Hero Image URL</label>
                <Input 
                  value={landingSettings.heroCustomImageUrl}
                  onChange={(e) => setLandingSettings({ ...landingSettings, heroCustomImageUrl: e.target.value })}
                  placeholder="Leave empty to use default image asset"
                />
              </div>
            </div>
          </Card>

          {/* SECTION 3: Featured Highlights & Trust Badges */}
          <Card title="Feature Badges & Highlights" icon={Award} className="border-slate-100 shadow-sm">
            <div className="space-y-6">
              <div>
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2 block">Hero Feature Badges</label>
                <div className="flex items-center gap-2 mb-4">
                  <Input 
                    placeholder="Add new highlight badge (e.g. 24/7 Vet Security)..."
                    value={newBadge}
                    onChange={(e) => setNewBadge(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddBadge())}
                  />
                  <Button type="button" onClick={handleAddBadge} className="shrink-0 rounded-xl font-bold bg-emerald-700 text-white">
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {landingSettings.featuredBadges.map((badge) => (
                    <span 
                      key={badge}
                      className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 text-slate-800 rounded-xl text-xs font-bold border border-slate-200"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      {badge}
                      <button
                        type="button"
                        onClick={() => handleRemoveBadge(badge)}
                        className="text-slate-400 hover:text-rose-600 ml-1 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-3 block">Landing Page Statistics Bar</label>
                <div className="space-y-3">
                  {landingSettings.customStats.map((stat, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <Input 
                        value={stat.value}
                        onChange={(e) => handleUpdateStat(idx, 'value', e.target.value)}
                        placeholder="Value (e.g. 500+)"
                        className="w-1/3"
                      />
                      <Input 
                        value={stat.label}
                        onChange={(e) => handleUpdateStat(idx, 'label', e.target.value)}
                        placeholder="Label (e.g. Assets Managed)"
                        className="w-2/3"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* SECTION 4: Investment & Ownership Packages Section */}
          <Card title="Investment & Ownership Packages Section" icon={Briefcase} className="border-slate-100 shadow-sm">
            <div className="space-y-6">
              <div>
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1 block">Section Headline Title</label>
                <Input 
                  value={landingSettings.packagesTitle || ''}
                  onChange={(e) => setLandingSettings({ ...landingSettings, packagesTitle: e.target.value })}
                  placeholder="e.g. Portfolio Management Packages"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1 block">Section Subtitle / Description</label>
                <textarea 
                  rows={2}
                  value={landingSettings.packagesSubtitle || ''}
                  onChange={(e) => setLandingSettings({ ...landingSettings, packagesSubtitle: e.target.value })}
                  placeholder="e.g. Choose the tier that aligns with your capital growth goals..."
                  className="w-full rounded-2xl border border-slate-200 p-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm">Custom Management Tiers</h4>
                    <p className="text-xs text-slate-500">Configure pricing, featured highlights, and included service bullets shown on the landing page</p>
                  </div>
                  <Button 
                    type="button" 
                    onClick={handleAddPackage}
                    variant="outline"
                    className="rounded-xl text-xs font-bold gap-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                  >
                    <Plus className="w-4 h-4" /> Add Package Tier
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {(landingSettings.customPackages || []).map((pkg, pIdx) => (
                    <div key={pkg.id || pIdx} className={cn("p-5 rounded-3xl border space-y-4 relative bg-white transition-all shadow-sm", pkg.featured ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-slate-200")}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase text-slate-400">Tier #{pIdx + 1}</span>
                        <button 
                          type="button" 
                          onClick={() => handleRemovePackage(pIdx)}
                          className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                          title="Remove Package Tier"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase block mb-1">Package Name</label>
                          <Input 
                            value={pkg.name}
                            onChange={(e) => handleUpdatePackage(pIdx, 'name', e.target.value)}
                            placeholder="Package Name"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase block mb-1">Fee / Price Display</label>
                          <Input 
                            value={pkg.fee}
                            onChange={(e) => handleUpdatePackage(pIdx, 'fee', e.target.value)}
                            placeholder="e.g. ₦15,000"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase block mb-1">Billing Period</label>
                          <Input 
                            value={pkg.period}
                            onChange={(e) => handleUpdatePackage(pIdx, 'period', e.target.value)}
                            placeholder="e.g. /month"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase block mb-1">Button Text</label>
                          <Input 
                            value={pkg.buttonText}
                            onChange={(e) => handleUpdatePackage(pIdx, 'buttonText', e.target.value)}
                            placeholder="e.g. Choose Package"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase block mb-1">Extra Notes / Feed Addon</label>
                          <Input 
                            value={pkg.extra || ''}
                            onChange={(e) => handleUpdatePackage(pIdx, 'extra', e.target.value)}
                            placeholder="e.g. + ₦1,000/day daily feed"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-extrabold text-slate-500 uppercase block mb-1">Highlight Badge Tag</label>
                          <Input 
                            value={pkg.tag || ''}
                            onChange={(e) => handleUpdatePackage(pIdx, 'tag', e.target.value)}
                            placeholder="e.g. Most Popular"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <input 
                          type="checkbox"
                          id={`featured-${pIdx}`}
                          checked={!!pkg.featured}
                          onChange={(e) => handleUpdatePackage(pIdx, 'featured', e.target.checked)}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <label htmlFor={`featured-${pIdx}`} className="text-xs font-bold text-slate-700 cursor-pointer">
                          Highlight as Featured Tier (Green Border & Badge)
                        </label>
                      </div>

                      {/* Features list */}
                      <div className="pt-2 border-t border-slate-100 space-y-2">
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase block">Included Feature Items</label>
                        <div className="space-y-1.5">
                          {pkg.features.map((feat, fIdx) => (
                            <div key={fIdx} className="flex items-center justify-between text-xs bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                              <span className="font-semibold text-slate-700 truncate">{feat}</span>
                              <button 
                                type="button" 
                                onClick={() => handleRemovePackageFeature(pIdx, fIdx)}
                                className="text-slate-400 hover:text-rose-500 transition-colors ml-2"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Add feature input */}
                        <div className="flex gap-2 pt-1">
                          <input 
                            type="text" 
                            id={`add-feat-input-${pIdx}`}
                            placeholder="New bullet feature..."
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const val = (e.currentTarget as HTMLInputElement).value;
                                handleAddPackageFeature(pIdx, val);
                                (e.currentTarget as HTMLInputElement).value = '';
                              }
                            }}
                            className="flex-1 text-xs px-3 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          <button 
                            type="button"
                            onClick={() => {
                              const inputEl = document.getElementById(`add-feat-input-${pIdx}`) as HTMLInputElement;
                              if (inputEl && inputEl.value) {
                                handleAddPackageFeature(pIdx, inputEl.value);
                                inputEl.value = '';
                              }
                            }}
                            className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* SECTION 5: Footer & Contact Section Settings */}
        <Card title="Footer & Contact Section Settings" icon={Phone} className="border-slate-100 shadow-sm">
          <div className="space-y-6">
            <div>
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1 block">Footer Platform Description</label>
              <textarea 
                rows={2}
                value={landingSettings.footerDescription}
                onChange={(e) => setLandingSettings({ ...landingSettings, footerDescription: e.target.value })}
                placeholder="e.g. Premium livestock ownership and management platform..."
                className="w-full rounded-2xl border border-slate-200 p-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1 block">Contact Phone Number</label>
                <Input 
                  value={landingSettings.contactPhone}
                  onChange={(e) => setLandingSettings({ ...landingSettings, contactPhone: e.target.value })}
                  placeholder="e.g. +234 808 271 9421"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1 block">Contact Support Email</label>
                <Input 
                  value={landingSettings.contactEmail}
                  onChange={(e) => setLandingSettings({ ...landingSettings, contactEmail: e.target.value })}
                  placeholder="e.g. cowplug.ng@gmail.com"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1 block">WhatsApp Support Number</label>
                <Input 
                  value={landingSettings.whatsappPhone}
                  onChange={(e) => setLandingSettings({ ...landingSettings, whatsappPhone: e.target.value })}
                  placeholder="e.g. +234 808 271 9421"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1 block">Company / Office Address</label>
                <Input 
                  value={landingSettings.companyAddress}
                  onChange={(e) => setLandingSettings({ ...landingSettings, companyAddress: e.target.value })}
                  placeholder="e.g. Lagos, Nigeria"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1 block">Copyright Notice</label>
                <Input 
                  value={landingSettings.copyrightText}
                  onChange={(e) => setLandingSettings({ ...landingSettings, copyrightText: e.target.value })}
                  placeholder="e.g. CowPlugNG. All rights reserved."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1 block">Newsletter Heading</label>
                <Input 
                  value={landingSettings.newsletterTitle}
                  onChange={(e) => setLandingSettings({ ...landingSettings, newsletterTitle: e.target.value })}
                  placeholder="e.g. Newsletter"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1 block">Newsletter Description</label>
                <Input 
                  value={landingSettings.newsletterText}
                  onChange={(e) => setLandingSettings({ ...landingSettings, newsletterText: e.target.value })}
                  placeholder="e.g. Get the latest farm reports..."
                />
              </div>
            </div>
          </div>
        </Card>

        {/* SECTION 5: Live Hero & Footer Preview Card */}
        <Card title="Live Hero Section Preview" icon={Eye} className="border-emerald-200 bg-emerald-50/30">
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xl overflow-hidden relative">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black uppercase tracking-widest">
                  <Award className="w-4 h-4 text-emerald-700" />
                  {landingSettings.heroBadge}
                </div>
                <h1 className="text-3xl font-black leading-tight text-slate-900">
                  {landingSettings.heroTitleMain} <br />
                  <span className="text-emerald-700 italic font-serif">{landingSettings.heroTitleHighlight}</span>
                </h1>
                <p className="text-slate-600 text-sm leading-relaxed font-medium">
                  {landingSettings.heroDescription}
                </p>
                <div className="flex gap-3 pt-2">
                  <button type="button" className="h-10 px-6 rounded-xl bg-emerald-700 text-white font-bold text-xs shadow-md">
                    {landingSettings.heroPrimaryButtonText}
                  </button>
                  <button type="button" className="h-10 px-6 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs">
                    {landingSettings.heroSecondaryButtonText}
                  </button>
                </div>
              </div>

              {/* Preview Card */}
              <div className="relative aspect-square rounded-2xl overflow-hidden border-4 border-white shadow-lg bg-slate-900 flex flex-col items-center justify-center text-center p-4">
                {firstSelectedLivestock ? (
                  <>
                    <img 
                      src={firstSelectedLivestock.photos?.[0] || firstSelectedLivestock.livestockImageUrl || landingSettings.heroCustomImageUrl || "/src/assets/images/brahman_cow_pasture_1785745135569.jpg"} 
                      alt="Preview Hero"
                      className="w-full h-full object-cover absolute inset-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4 text-left text-white bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/20">
                      <p className="font-bold text-sm">
                        {firstSelectedLivestock.tagNumber || firstSelectedLivestock.breed}
                      </p>
                      <p className="text-[10px] text-white/80">
                        {landingSettings.selectedLivestockIds.length} Livestock Selected for Landing Page
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="relative z-10 flex flex-col items-center p-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-3">
                      <Cow className="w-6 h-6 text-emerald-500" />
                    </div>
                    <p className="text-amber-400 font-extrabold text-[10px] uppercase tracking-wider mb-1">Empty Showcase Slot</p>
                    <p className="text-white font-bold text-xs mb-1">No Livestock Selected</p>
                    <p className="text-slate-400 text-[10px] max-w-[180px]">Select livestock above to feature them on the hero showcase.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* SECTION 6: Live Footer Preview */}
        <Card title="Live Footer / Contact Section Preview" icon={Globe} className="border-slate-200 bg-slate-900 text-white">
          <div className="p-6 rounded-2xl bg-slate-900 text-slate-300 space-y-6 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-b border-slate-800 pb-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  <span className="font-black text-lg text-white">CowPlug<span className="text-emerald-500">NG</span></span>
                </div>
                <p className="text-slate-400 font-medium leading-relaxed">{landingSettings.footerDescription}</p>
                {landingSettings.companyAddress && (
                  <p className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    {landingSettings.companyAddress}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="font-black text-white uppercase tracking-widest text-[10px] mb-2">Connect Channels</h4>
                <p className="flex items-center gap-2 text-slate-300"><Phone className="w-3.5 h-3.5 text-emerald-500" /> Phone: {landingSettings.contactPhone}</p>
                <p className="flex items-center gap-2 text-slate-300"><Mail className="w-3.5 h-3.5 text-emerald-500" /> Email: {landingSettings.contactEmail}</p>
                <p className="flex items-center gap-2 text-slate-300"><MessageSquare className="w-3.5 h-3.5 text-emerald-500" /> WhatsApp: {landingSettings.whatsappPhone}</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-black text-white uppercase tracking-widest text-[10px] mb-2">{landingSettings.newsletterTitle}</h4>
                <p className="text-slate-400">{landingSettings.newsletterText}</p>
              </div>
            </div>

            <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              <p>© {new Date().getFullYear()} {landingSettings.copyrightText}</p>
              <span>Powered by CowPlugNG</span>
            </div>
          </div>
        </Card>

        {/* Submit */}
        <div className="flex justify-end pt-4">
          <Button type="submit" isLoading={saving} className="h-14 px-10 rounded-2xl text-base font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xl shadow-emerald-700/20">
            <Save className="w-5 h-5 mr-2" />
            Publish Landing Page Configuration
          </Button>
        </div>
      </form>
    </div>
  );
};
