import React, { useState, useEffect } from 'react';
import { 
  Settings, Building2, Landmark, Mail, 
  Phone, MapPin, Hash, Palette, Bell, 
  Save, RefreshCcw, ShieldCheck, Globe,
  ShieldAlert, Lock, UserPlus, Eye, Sparkles, Sliders,
  DatabaseBackup, CircleCheck
} from 'lucide-react';
import { db, handleFirestoreError, OperationType, logActivity, sanitizeFirestoreData } from '../../lib/firebase';
import { doc, getDoc, setDoc, addDoc, collection } from 'firebase/firestore';
import { PlatformSettings as SettingsType } from '../../types';
import { Card, Button, Input } from '../UI';
import { cn } from '../../lib/utils';
import { useAuth } from '../../lib/AuthContext';
import { AppBrandingSettings } from './AppBrandingSettings';
import { TestingResetManager } from './TestingResetManager';

export const PlatformSettings: React.FC<{ initialTab?: 'general' | 'branding' | 'testing-reset' }> = ({ initialTab = 'general' }) => {
  const { profile } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'general' | 'branding' | 'testing-reset'>(initialTab);
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const defaultSettings: SettingsType = {
        id: 'global',
        companyName: 'CowPlugNG',
        contactEmail: 'cowplug.ng@gmail.com',
        contactPhone: '+234 808 271 9421',
        address: 'Badagry expressway, Pure water bustop, Lagos',
        bankDetails: {
          bankName: 'CowPlug Bank',
          accountName: 'CowPlugNG Operations',
          accountNumber: '0123456789'
        },
        invoicePrefix: 'INV-',
        tagPrefix: 'CPG-',
        notificationTemplates: {},
        branding: {
          primaryColor: '#059669',
          fontFamily: 'Manrope'
        },
        siteControls: {
          maintenanceMode: false,
          maintenanceMessage: 'Our ecosystem is currently undergoing scheduled technical improvements to enhance your investment security and platform performance. We will be back online shortly.',
          disableNewSignups: false,
          requireEmailVerification: true,
          maxUploadSizeMB: 5,
          showLiveStatsOnLanding: true
        }
      };

      try {
        const docRef = doc(db, 'settings', 'global');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as Partial<SettingsType>;
          setSettings({
            ...defaultSettings,
            ...data,
            bankDetails: { ...defaultSettings.bankDetails, ...(data.bankDetails || {}) },
            branding: { ...defaultSettings.branding, ...(data.branding || {}) },
            siteControls: { ...defaultSettings.siteControls, ...(data.siteControls || {}) }
          });
        } else {
          setSettings(defaultSettings);
        }
      } catch (error) {
        console.error("Firestore Error fetching settings:", error);
        setSettings(defaultSettings);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const cleanSettings = sanitizeFirestoreData(settings);
      await setDoc(doc(db, 'settings', 'global'), cleanSettings, { merge: true });
      
      // Log activity
      await logActivity(
        profile?.uid || 'system',
        profile?.displayName || 'Administrator',
        'UPDATE_SETTINGS',
        'SETTING',
        'global',
        `Updated platform configuration and site controls`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/global');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) return <div className="p-8 text-center font-bold text-slate-500">Loading platform settings...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Sub-Tab Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-600" />
            Platform & Global Settings
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure system parameters, corporate contacts, bank escrow, and official application branding.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex p-1 bg-slate-100 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setActiveSubTab('general')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer",
              activeSubTab === 'general' 
                ? "bg-white text-emerald-800 shadow-xs" 
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Sliders className="w-3.5 h-3.5" />
            General Settings
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('branding')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer",
              activeSubTab === 'branding' 
                ? "bg-white text-emerald-800 shadow-xs" 
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Palette className="w-3.5 h-3.5" />
            App Branding
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('testing-reset')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer",
              activeSubTab === 'testing-reset' 
                ? "bg-white text-amber-900 shadow-xs" 
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <DatabaseBackup className="w-3.5 h-3.5" />
            Reset Manager
          </button>
        </div>
      </div>

      {/* Subtab Contents */}
      {activeSubTab === 'testing-reset' ? (
        <TestingResetManager />
      ) : activeSubTab === 'branding' ? (
        <AppBrandingSettings />
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div>
              <p className="text-xs font-bold text-slate-800">Platform Core Parameters</p>
              <p className="text-[11px] text-slate-500">Changes apply to invoices, site alerts, and investor documents.</p>
            </div>
            <Button type="submit" isLoading={saving} className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs">
              <Save className="w-4 h-4 mr-2" />
              Save Configuration
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card 
              title="Company Profile" 
              icon={Building2}
              className="border-emerald-600/20 shadow-sm bg-white"
            >
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-[10px] font-bold uppercase tracking-widest mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                  Connected to Live Homepage Contacts
                </div>
                <div>
                  <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Company Name</label>
                  <Input 
                    value={settings.companyName}
                    onChange={(e) => setSettings({...settings, companyName: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Contact Email</label>
                  <Input 
                    value={settings.contactEmail}
                    onChange={(e) => setSettings({...settings, contactEmail: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Contact Phone</label>
                  <Input 
                    value={settings.contactPhone}
                    onChange={(e) => setSettings({...settings, contactPhone: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Office Address</label>
                  <Input 
                    value={settings.address}
                    onChange={(e) => setSettings({...settings, address: e.target.value})}
                  />
                </div>
              </div>
            </Card>

            <Card title="Bank Account Details" icon={Landmark}>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Bank Name</label>
                  <Input 
                    value={settings.bankDetails.bankName}
                    onChange={(e) => setSettings({
                      ...settings, 
                      bankDetails: {...settings.bankDetails, bankName: e.target.value}
                    })}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Account Name</label>
                  <Input 
                    value={settings.bankDetails.accountName}
                    onChange={(e) => setSettings({
                      ...settings, 
                      bankDetails: {...settings.bankDetails, accountName: e.target.value}
                    })}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Account Number</label>
                  <Input 
                    value={settings.bankDetails.accountNumber}
                    onChange={(e) => setSettings({
                      ...settings, 
                      bankDetails: {...settings.bankDetails, accountNumber: e.target.value}
                    })}
                  />
                </div>
              </div>
            </Card>

            <Card title="Numbering Formats" icon={Hash}>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Invoice Prefix</label>
                  <Input 
                    value={settings.invoicePrefix}
                    onChange={(e) => setSettings({...settings, invoicePrefix: e.target.value})}
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Example: {settings.invoicePrefix}0001</p>
                </div>
                <div>
                  <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Livestock Tag Prefix</label>
                  <Input 
                    value={settings.tagPrefix}
                    onChange={(e) => setSettings({...settings, tagPrefix: e.target.value})}
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Example: {settings.tagPrefix}CW-0001</p>
                </div>
              </div>
            </Card>

            <Card title="Security & Branding" icon={ShieldCheck}>
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50/70 rounded-xl border border-emerald-100 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-black text-emerald-950 block">Official Application Logo</span>
                    <span className="text-[10px] text-emerald-700 font-medium">Upload custom PNG/SVG logo and customize brand styling</span>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setActiveSubTab('branding')}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shrink-0 shadow-sm"
                  >
                    Manage Logo →
                  </Button>
                </div>

                <div>
                  <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Primary Brand Color</label>
                  <div className="flex gap-3 items-center">
                    <input 
                      type="color" 
                      value={settings.branding?.primaryColor || '#059669'}
                      onChange={(e) => setSettings({
                        ...settings,
                        branding: {...settings.branding, primaryColor: e.target.value}
                      })}
                      className="w-10 h-10 rounded border border-brand-border bg-transparent cursor-pointer"
                    />
                    <Input value={settings.branding?.primaryColor || '#059669'} readOnly className="flex-1" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Default System Font</label>
                  <Input 
                    value={settings.branding?.fontFamily || 'Manrope'}
                    onChange={(e) => setSettings({
                      ...settings,
                      branding: {...settings.branding, fontFamily: e.target.value}
                    })}
                  />
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3 mb-2">
                    <Bell className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-800">Notification Channels</span>
                  </div>
                  <p className="text-[10px] text-slate-500">System is currently configured for in-app and email notifications.</p>
                </div>
              </div>
            </Card>

            <Card title="Site Controls" icon={Globe}>
              <div className="space-y-6">
                <div className="p-4 bg-rose-50/50 border border-rose-100 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-xl border",
                        settings.siteControls.maintenanceMode ? "bg-rose-100 text-rose-700 border-rose-200" : "bg-slate-100 text-slate-400 border-slate-200"
                      )}>
                        <Lock className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 tracking-tight">Maintenance Mode</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Locks public access & shows notice to visitors</p>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setSettings({
                        ...settings,
                        siteControls: {...settings.siteControls, maintenanceMode: !settings.siteControls.maintenanceMode}
                      })}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        settings.siteControls.maintenanceMode ? "bg-rose-500" : "bg-slate-200"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                        settings.siteControls.maintenanceMode ? "left-7" : "left-1"
                      )} />
                    </button>
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold uppercase text-slate-600 block mb-1">
                      Public Maintenance Notice Broadcast Message
                    </label>
                    <textarea 
                      rows={3}
                      value={settings.siteControls.maintenanceMessage || ''}
                      onChange={(e) => setSettings({
                        ...settings,
                        siteControls: {
                          ...settings.siteControls,
                          maintenanceMessage: e.target.value
                        }
                      })}
                      placeholder="Enter custom maintenance update message shown to users..."
                      className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white font-medium text-slate-800"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      This message will be prominently displayed on the locked maintenance screen for all visitors while system updates are active.
                    </p>
                  </div>
                </div>

                <div className={cn(
                  "p-4 border rounded-2xl transition-all space-y-3",
                  settings.siteControls.disableNewSignups ? "bg-amber-50/50 border-amber-200" : "bg-emerald-50/30 border-emerald-100"
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-xl border",
                        settings.siteControls.disableNewSignups ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-emerald-100 text-emerald-700 border-emerald-200"
                      )}>
                        <UserPlus className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-black text-slate-900 tracking-tight">New Investor Registrations</p>
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                            settings.siteControls.disableNewSignups 
                              ? "bg-amber-100 text-amber-800 border-amber-300" 
                              : "bg-emerald-100 text-emerald-800 border-emerald-300"
                          )}>
                            {settings.siteControls.disableNewSignups ? "Closed (Slots Filled)" : "Open (Accepting Signups)"}
                          </span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          {settings.siteControls.disableNewSignups 
                            ? "Public signups blocked — Investment capacity reached" 
                            : "Public signups enabled — Open for new account registration"}
                        </p>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setSettings({
                        ...settings,
                        siteControls: {...settings.siteControls, disableNewSignups: !settings.siteControls.disableNewSignups}
                      })}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative shrink-0",
                        settings.siteControls.disableNewSignups ? "bg-amber-500" : "bg-emerald-500"
                      )}
                      title={settings.siteControls.disableNewSignups ? "Click to OPEN registrations" : "Click to CLOSE registrations (Slots Filled)"}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                        settings.siteControls.disableNewSignups ? "left-7" : "left-1"
                      )} />
                    </button>
                  </div>

                  <div className="flex items-start gap-2 text-xs text-slate-500 font-medium leading-relaxed pl-1">
                    {settings.siteControls.disableNewSignups ? (
                      <Lock className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                    ) : (
                      <CircleCheck className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                    )}
                    <span>
                      {settings.siteControls.disableNewSignups
                        ? "Investor registrations are currently turned OFF. Anyone attempting to create a new account will see a notice that investor slots are filled."
                        : "Investor registrations are currently OPEN. Toggle this switch when livestock investment slots are fully subscribed to prevent new signups."}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl">
                      <Eye className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 tracking-tight">Landing Page Stats</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Show live ecosystem counters</p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setSettings({
                      ...settings,
                      siteControls: {...settings.siteControls, showLiveStatsOnLanding: !settings.siteControls.showLiveStatsOnLanding}
                    })}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      settings.siteControls.showLiveStatsOnLanding ? "bg-emerald-500" : "bg-slate-200"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                      settings.siteControls.showLiveStatsOnLanding ? "left-7" : "left-1"
                    )} />
                  </button>
                </div>

                <div className="space-y-4 pt-2">
                   <div>
                    <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Max Upload Size (MB)</label>
                    <Input 
                      type="number"
                      value={settings.siteControls.maxUploadSizeMB}
                      onChange={(e) => setSettings({
                        ...settings,
                        siteControls: {...settings.siteControls, maxUploadSizeMB: parseInt(e.target.value)}
                      })}
                    />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </form>
      )}
    </div>
  );
};
