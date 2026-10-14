import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, Search, Plus, Trash2, Edit, 
  TrendingUp, Calendar, Users, DollarSign, Percent,
  PlusCircle, CheckCircle, ArrowUpRight, Scale, Clock, 
  Briefcase, Activity, AlertCircle, Heart, ShieldAlert
} from 'lucide-react';
import { db, logActivity } from '../../lib/firebase';
import { 
  collection, query, onSnapshot, doc, updateDoc, addDoc, deleteDoc, orderBy, getDocs, where 
} from 'firebase/firestore';
import { InvestmentPackage, Livestock, UserProfile } from '../../types';
import { Card, Button, Badge, Input } from '../UI';
import { cn, formatDate, formatCurrency } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../lib/AuthContext';

export const InvestmentManager: React.FC = () => {
  const { profile } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'active' | 'packages'>('active');
  const [packages, setPackages] = useState<InvestmentPackage[]>([]);
  const [activeInvestments, setActiveInvestments] = useState<Livestock[]>([]);
  const [investorProfiles, setInvestorProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Package form state
  const [isAddingPackage, setIsAddingPackage] = useState(false);
  const [editingPackage, setEditingPackage] = useState<InvestmentPackage | null>(null);
  const [packageName, setPackageName] = useState('');
  const [packageType, setPackageType] = useState('Cattle');
  const [packagePeriod, setPackagePeriod] = useState('6 months');
  const [packageDescription, setPackageDescription] = useState('');
  const [packagePrice, setPackagePrice] = useState('');
  const [packageRoi, setPackageRoi] = useState('');
  const [packageStatus, setPackageStatus] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');

  // Search filter states
  const [packageSearch, setPackageSearch] = useState('');
  const [investmentSearch, setInvestmentSearch] = useState('');

  useEffect(() => {
    // 1. Listen to Investment Packages
    const qPackages = query(collection(db, 'investmentPackages'), orderBy('createdAt', 'desc'));
    const unsubPackages = onSnapshot(qPackages, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as InvestmentPackage);
      setPackages(list);
    }, (error) => {
      console.error("Error listening to investment packages:", error);
    });

    // 2. Listen to Livestock which represents active investments (where ownerId != null or empty)
    const qLivestock = query(collection(db, 'livestock'));
    const unsubLivestock = onSnapshot(qLivestock, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Livestock);
      // Filter for livestock with owners
      const owned = list.filter(item => item.ownerId && item.ownerId.trim() !== '');
      setActiveInvestments(owned);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to active livestock investments:", error);
    });

    // 3. Fetch Investor Profiles for mapping names
    const fetchInvestors = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'investor')));
        const list = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() }) as UserProfile);
        setInvestorProfiles(list);
      } catch (err) {
        console.error("Error fetching investor profiles:", err);
      }
    };
    fetchInvestors();

    return () => {
      unsubPackages();
      unsubLivestock();
    };
  }, []);

  // Handle Save (Add/Edit) Package
  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!packageName || !packagePeriod || !packagePrice || !packageRoi) return;

    try {
      setLoading(true);
      const pkgData = {
        name: packageName,
        livestockType: packageType,
        managementPeriod: packagePeriod,
        description: packageDescription,
        price: Number(packagePrice),
        expectedRoi: packageRoi,
        status: packageStatus,
        createdAt: editingPackage?.createdAt || Date.now(),
        updatedAt: Date.now()
      };

      if (editingPackage) {
        // Edit Mode
        const pkgRef = doc(db, 'investmentPackages', editingPackage.id);
        await updateDoc(pkgRef, pkgData);
        
        if (profile) {
          await logActivity(
            profile.uid,
            profile.displayName || profile.email,
            'INVESTMENT_PACKAGE_UPDATE',
            'PACKAGE',
            editingPackage.id,
            `Updated investment package: ${packageName}`
          );
        }
        setEditingPackage(null);
      } else {
        // Add Mode
        const pkgRef = await addDoc(collection(db, 'investmentPackages'), pkgData);
        
        if (profile) {
          await logActivity(
            profile.uid,
            profile.displayName || profile.email,
            'INVESTMENT_PACKAGE_CREATE',
            'PACKAGE',
            pkgRef.id,
            `Created new investment package: ${packageName}`
          );
        }
        setIsAddingPackage(false);
      }

      // Reset Form fields
      resetForm();
    } catch (err) {
      console.error("Error saving investment package:", err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPackageName('');
    setPackageType('Cattle');
    setPackagePeriod('6 months');
    setPackageDescription('');
    setPackagePrice('');
    setPackageRoi('');
    setPackageStatus('ACTIVE');
    setEditingPackage(null);
    setIsAddingPackage(false);
  };

  const startEdit = (pkg: any) => {
    setEditingPackage(pkg);
    setPackageName(pkg.name);
    setPackageType(pkg.livestockType || 'Cattle');
    setPackagePeriod(pkg.managementPeriod);
    setPackageDescription(pkg.description || '');
    setPackagePrice(pkg.price?.toString() || '');
    setPackageRoi(pkg.expectedRoi || '');
    setPackageStatus(pkg.status || 'ACTIVE');
    setIsAddingPackage(true);
  };

  const handleDeletePackage = async (pkgId: string) => {
    if (!window.confirm("Are you sure you want to delete this investment package?")) return;
    try {
      await deleteDoc(doc(db, 'investmentPackages', pkgId));
      
      if (profile) {
        await logActivity(
          profile.uid,
          profile.displayName || profile.email,
          'INVESTMENT_PACKAGE_DELETE',
          'PACKAGE',
          pkgId,
          `Deleted investment package (ID: ${pkgId})`
        );
      }
    } catch (err) {
      console.error("Error deleting investment package:", err);
    }
  };

  const getInvestorName = (ownerId: string) => {
    const found = investorProfiles.find(profile => profile.uid === ownerId);
    return found?.displayName || found?.email || 'Unknown Investor';
  };

  const getInvestorEmail = (ownerId: string) => {
    const found = investorProfiles.find(profile => profile.uid === ownerId);
    return found?.email || '';
  };

  // Seeding default packages if empty
  const handleSeedPackages = async () => {
    const defaults = [
      {
        name: "Premium Cattle Breeding Circle",
        livestockType: "Cattle",
        managementPeriod: "12 months",
        description: "Focuses on high-yield rotational grazing of premium heifers, yielding compound gains with experienced herdsmen.",
        price: 450000,
        expectedRoi: "22% - 28%",
        status: "ACTIVE",
        createdAt: Date.now()
      },
      {
        name: "Standard Ram Fattening Initiative",
        livestockType: "Ram",
        managementPeriod: "6 months",
        description: "Optimized for quick-turnaround fattening and high-demand festive seasonal markets in major metropolitan terminals.",
        price: 120000,
        expectedRoi: "15% - 20%",
        status: "ACTIVE",
        createdAt: Date.now()
      },
      {
        name: "Cooperative Goat Partnership",
        livestockType: "Goat",
        managementPeriod: "18 months",
        description: "Longer term breeding cycle with high reproduction rates, creating sustainable organic herd compounding.",
        price: 85000,
        expectedRoi: "25% - 32%",
        status: "ACTIVE",
        createdAt: Date.now()
      }
    ];

    setLoading(true);
    for (const pkg of defaults) {
      await addDoc(collection(db, 'investmentPackages'), pkg);
    }
    setLoading(false);
  };

  // Filter lists
  const filteredPackages = packages.filter(pkg => 
    (pkg.name || '').toLowerCase().includes(packageSearch.toLowerCase()) || 
    (pkg.livestockType || '').toLowerCase().includes(packageSearch.toLowerCase())
  );

  const filteredInvestments = activeInvestments.filter(inv => {
    const investorName = getInvestorName(inv.ownerId).toLowerCase();
    const investorEmail = getInvestorEmail(inv.ownerId).toLowerCase();
    const tagNum = (inv.tagNumber || '').toLowerCase();
    const breed = (inv.breed || '').toLowerCase();
    const pkg = (inv.investmentPackage || '').toLowerCase();
    
    const search = investmentSearch.toLowerCase();
    return investorName.includes(search) || 
           investorEmail.includes(search) || 
           tagNum.includes(search) || 
           breed.includes(search) || 
           pkg.includes(search);
  });

  const totalActiveValue = activeInvestments.reduce((sum, item) => sum + (Number(item.purchasePrice) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-brand-card p-6 rounded-2xl border border-brand-border">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-brand-green animate-pulse" />
            Investment Management
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Track customer capital allocations, manage investment products, and monitor asset performance.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button 
            variant={activeSubTab === 'active' ? 'primary' : 'outline'}
            onClick={() => { setActiveSubTab('active'); resetForm(); }}
            size="sm"
          >
            Active Portfolio ({activeInvestments.length})
          </Button>
          <Button 
            variant={activeSubTab === 'packages' ? 'primary' : 'outline'}
            onClick={() => setActiveSubTab('packages')}
            size="sm"
          >
            Product Packages ({packages.length})
          </Button>
        </div>
      </div>

      {/* Quick stats section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-brand-card p-4 rounded-xl border border-brand-border flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center text-brand-green shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Active Investment Value</p>
            <p className="text-lg font-extrabold text-slate-900">{formatCurrency(totalActiveValue)}</p>
          </div>
        </div>

        <div className="bg-brand-card p-4 rounded-xl border border-brand-border flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Active Investors</p>
            <p className="text-lg font-extrabold text-slate-900">
              {new Set(activeInvestments.map(item => item.ownerId)).size} Profiles
            </p>
          </div>
        </div>

        <div className="bg-brand-card p-4 rounded-xl border border-brand-border flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-brand-orange/10 flex items-center justify-center text-brand-orange shrink-0">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Total Assets Active</p>
            <p className="text-lg font-extrabold text-slate-900">{activeInvestments.length} Animals</p>
          </div>
        </div>

        <div className="bg-brand-card p-4 rounded-xl border border-brand-border flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 shrink-0">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Average Expected Return</p>
            <p className="text-lg font-extrabold text-slate-900">18.5% - 24%</p>
          </div>
        </div>
      </div>

      {activeSubTab === 'active' ? (
        /* Active Investments view */
        <Card title="Active Investor Portfolios" icon={Briefcase}>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search by investor name, email, tag, breed, or package..."
                  value={investmentSearch}
                  onChange={e => setInvestmentSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-xs bg-brand-surface border border-brand-border rounded-xl focus:ring-1 focus:ring-brand-green/30 focus:border-brand-green transition-all"
                />
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-16 bg-slate-200/50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : filteredInvestments.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-brand-border rounded-2xl bg-brand-surface">
                <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <h4 className="text-sm font-bold text-gray-800">No active investments found</h4>
                <p className="text-xs text-gray-500 mt-1">Adjust search parameters or assign livestock to investors in the Livestock tab.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-brand-border">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-brand-muted text-gray-600 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-4">Investor Profile</th>
                      <th className="p-4">Livestock Details</th>
                      <th className="p-4">Investment Package</th>
                      <th className="p-4">Acquisition Cost</th>
                      <th className="p-4">Health Status</th>
                      <th className="p-4">Progress State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border bg-brand-card">
                    {filteredInvestments.map((inv) => (
                      <tr key={inv.id} className="hover:bg-brand-muted/20 transition-all">
                        <td className="p-4">
                          <div>
                            <p className="font-bold text-slate-800">{getInvestorName(inv.ownerId)}</p>
                            <p className="text-[10px] text-gray-500 font-mono mt-0.5 select-all">{getInvestorEmail(inv.ownerId)}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <div>
                            <div className="flex items-center gap-1.5 font-bold text-brand-green">
                              <span>{inv.tagNumber}</span>
                              <Badge variant="default" className="text-[8px] py-0 px-1 font-normal select-none">
                                {inv.gender}
                              </Badge>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-0.5">{inv.breed} • {inv.age}</p>
                          </div>
                        </td>
                        <td className="p-4 font-semibold text-slate-700">
                          {inv.investmentPackage || 'Standard Fattening'}
                        </td>
                        <td className="p-4">
                          <div>
                            <span className="font-bold text-slate-800">
                              {inv.purchasePrice ? formatCurrency(inv.purchasePrice) : 'N/A'}
                            </span>
                            <p className="text-[9px] text-gray-500 mt-0.5 font-mono">{formatDate(inv.purchaseDate)}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge variant={
                            inv.healthStatus === 'EXCELLENT' ? 'success' : 
                            inv.healthStatus === 'GOOD' ? 'success' : 
                            inv.healthStatus === 'FAIR' ? 'warning' : 'error'
                          }>
                            {inv.healthStatus}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <div className="space-y-1">
                            <span className="font-semibold text-[11px] text-slate-700 uppercase tracking-wide">
                              {inv.status}
                            </span>
                            {inv.growthProgress && (
                              <p className="text-[9px] text-gray-500 italic truncate max-w-[150px]">
                                {inv.growthProgress}
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      ) : (
        /* Investment Packages view */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-brand-card p-4 rounded-xl border border-brand-border">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search package campaigns..."
                  value={packageSearch}
                  onChange={e => setPackageSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-xs bg-brand-surface border border-brand-border rounded-xl focus:ring-1 focus:ring-brand-green/30 focus:border-brand-green transition-all"
                />
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                {packages.length === 0 && (
                  <Button variant="outline" size="sm" onClick={handleSeedPackages} className="flex-1 sm:flex-none">
                    Seed Templates
                  </Button>
                )}
                <Button 
                  variant="primary" 
                  size="sm" 
                  onClick={() => { resetForm(); setIsAddingPackage(true); }}
                  className="flex-1 sm:flex-none"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  New Package
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-48 bg-slate-200/50 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : filteredPackages.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-brand-border rounded-2xl bg-brand-surface">
                <PlusCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <h4 className="text-sm font-bold text-gray-800">No investment packages configured</h4>
                <p className="text-xs text-gray-500 mt-1">Add details of standard, premium, or group campaigns that investors can join.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredPackages.map((pkg) => (
                  <div 
                    key={pkg.id} 
                    className="bg-brand-card border border-brand-border rounded-2xl p-6 relative flex flex-col justify-between hover:border-brand-green/30 transition-all duration-300 group"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <Badge variant={pkg.status === 'ACTIVE' ? 'success' : 'default'}>
                          {pkg.status || 'ACTIVE'}
                        </Badge>
                        <span className="text-[10px] text-gray-400 font-mono">{pkg.livestockType}</span>
                      </div>
                      
                      <h3 className="font-extrabold text-slate-900 text-base mb-2 group-hover:text-brand-green transition-colors">
                        {pkg.name}
                      </h3>
                      
                      <p className="text-slate-600 text-xs leading-relaxed mb-4 line-clamp-3">
                        {pkg.description || 'No campaign description provided.'}
                      </p>

                      <div className="grid grid-cols-2 gap-3 bg-brand-surface p-3 rounded-xl mb-4 border border-brand-border/40">
                        <div>
                          <p className="text-[9px] uppercase tracking-wider font-semibold text-gray-400">Unit Price</p>
                          <p className="text-sm font-bold text-slate-800">
                            {pkg.price ? formatCurrency(pkg.price) : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase tracking-wider font-semibold text-gray-400">Term ROI</p>
                          <p className="text-sm font-bold text-brand-green flex items-center gap-0.5">
                            <TrendingUp className="w-3.5 h-3.5" />
                            {(pkg as any).expectedRoi}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-brand-border/60 mt-2">
                      <span className="text-[10px] text-slate-500 flex items-center gap-1 font-semibold">
                        <Clock className="w-3.5 h-3.5" />
                        {pkg.managementPeriod || '12 months'}
                      </span>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => startEdit(pkg)}
                          className="p-1.5 text-gray-500 hover:text-brand-green hover:bg-brand-green/10 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeletePackage(pkg.id)}
                          className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form Side Drawer/Card */}
          <div>
            {isAddingPackage ? (
              <Card title={editingPackage ? "Edit Package" : "Add Product Package"} icon={PlusCircle}>
                <form onSubmit={handleSavePackage} className="space-y-4">
                  <Input 
                    label="Package Name"
                    value={packageName}
                    onChange={e => setPackageName(e.target.value)}
                    placeholder="e.g. Premium Cattle Fattening"
                    required
                  />

                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Livestock Type</label>
                    <select 
                      value={packageType}
                      onChange={e => setPackageType(e.target.value)}
                      className="w-full bg-brand-surface border border-brand-border rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-brand-green/30 focus:border-brand-green"
                    >
                      <option value="Cattle">Cattle</option>
                      <option value="Ram">Ram</option>
                      <option value="Goat">Goat</option>
                      <option value="Poultry">Poultry</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Input 
                      label="Unit Price (₦)"
                      value={packagePrice}
                      onChange={e => setPackagePrice(e.target.value)}
                      placeholder="450000"
                      type="number"
                      required
                    />
                    <Input 
                      label="Target ROI"
                      value={packageRoi}
                      onChange={e => setPackageRoi(e.target.value)}
                      placeholder="e.g. 20% - 25%"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Input 
                      label="Management Period"
                      value={packagePeriod}
                      onChange={e => setPackagePeriod(e.target.value)}
                      placeholder="e.g. 12 months"
                      required
                    />
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Campaign Status</label>
                      <select 
                        value={packageStatus}
                        onChange={e => setPackageStatus(e.target.value as any)}
                        className="w-full bg-brand-surface border border-brand-border rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-brand-green/30 focus:border-brand-green"
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="ARCHIVED">Archived</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Description</label>
                    <textarea 
                      value={packageDescription}
                      onChange={e => setPackageDescription(e.target.value)}
                      placeholder="Provide campaign guidelines and logistics overview for target investors."
                      className="w-full bg-brand-surface border border-brand-border rounded-xl p-3 text-xs focus:ring-1 focus:ring-brand-green/30 focus:border-brand-green h-24 resize-none"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button type="button" variant="outline" size="sm" onClick={resetForm} className="flex-1">
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary" size="sm" className="flex-1">
                      Save Product
                    </Button>
                  </div>
                </form>
              </Card>
            ) : (
              <div className="border border-dashed border-brand-border rounded-2xl p-6 text-center bg-brand-muted/20">
                <TrendingUp className="w-10 h-10 mx-auto text-slate-400 mb-3" />
                <h4 className="text-xs font-bold text-slate-800">Setup Active Product Campaigns</h4>
                <p className="text-[11px] text-gray-500 mt-1 mb-4 leading-relaxed">
                  Configuring specialized investment campaigns allows you to easily track user yield profiles and organize purchase limits.
                </p>
                <Button variant="outline" size="sm" onClick={() => setIsAddingPackage(true)} className="w-full">
                  Create First Campaign
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
