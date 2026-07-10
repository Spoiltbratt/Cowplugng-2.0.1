import React, { useState, useEffect } from 'react';
import { 
  Settings, Building2, Landmark, Mail, 
  Phone, MapPin, Hash, Palette, Bell, 
  Save, RefreshCcw, ShieldCheck
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { doc, getDoc, setDoc, addDoc, collection } from 'firebase/firestore';
import { PlatformSettings as SettingsType } from '../../types';
import { Card, Button, Input } from '../UI';
import { cn } from '../../lib/utils';
import { useAuth } from '../../lib/AuthContext';

export const PlatformSettings: React.FC = () => {
  const { profile } = useAuth();
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
          primaryColor: '#22c55e'
        }
      };

      try {
        const docRef = doc(db, 'settings', 'global');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(docSnap.data() as SettingsType);
        } else {
          setSettings(defaultSettings);
        }
      } catch (error) {
        console.error("Firestore Error fetching settings:", error);
        // Fallback to default settings on error (e.g. offline)
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
      await setDoc(doc(db, 'settings', 'global'), settings);
      
      // Log activity
      await addDoc(collection(db, 'activityLogs'), {
        userId: profile?.uid || 'system',
        userName: profile?.displayName || 'Administrator',
        action: 'UPDATE_SETTINGS',
        details: `Updated platform company profile for ${settings.companyName}`,
        timestamp: Date.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/global');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) return <div className="p-8 text-center">Loading settings...</div>;

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Settings className="w-5 h-5 text-brand-green" />
          Platform Settings
        </h2>
        <Button type="submit" isLoading={saving}>
          <Save className="w-4 h-4 mr-2" />
          Save Configuration
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card 
          title="Company Profile" 
          icon={Building2}
          className="border-brand-green/30 shadow-lg shadow-brand-green/5 ring-1 ring-brand-green/10 bg-gradient-to-b from-brand-card to-brand-dark/40"
        >
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 px-3 py-2 bg-brand-green/5 border border-brand-green/20 rounded-lg text-brand-green text-[10px] font-bold uppercase tracking-widest mb-2 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-green shrink-0 animate-ping" />
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
            <div>
              <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Primary Brand Color</label>
              <div className="flex gap-3 items-center">
                <input 
                  type="color" 
                  value={settings.branding.primaryColor}
                  onChange={(e) => setSettings({
                    ...settings,
                    branding: {...settings.branding, primaryColor: e.target.value}
                  })}
                  className="w-10 h-10 rounded border border-brand-border bg-transparent cursor-pointer"
                />
                <Input value={settings.branding.primaryColor} readOnly className="flex-1" />
              </div>
            </div>
            <div className="p-4 bg-brand-muted/30 rounded-xl border border-brand-border">
              <div className="flex items-center gap-3 mb-2">
                <Bell className="w-4 h-4 text-brand-green" />
                <span className="text-xs font-bold uppercase tracking-widest">Notification Channels</span>
              </div>
              <p className="text-[10px] text-gray-500">System is currently configured for in-app and email notifications. Push notifications are available in Enterprise version.</p>
            </div>
          </div>
        </Card>
      </div>
    </form>
  );
};
