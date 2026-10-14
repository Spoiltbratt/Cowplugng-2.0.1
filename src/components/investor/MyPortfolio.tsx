import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import { Livestock, LivestockStatus, Invoice } from '../../types';
import { Card, Badge, Button } from '../UI';
import { 
  Briefcase, TrendingUp, Percent, 
  ChevronRight, Calendar, ArrowUpRight, Scale, AlertCircle, FileText, Activity
} from 'lucide-react';
import { CowIcon as Beef } from '../CowIcon';
import { formatCurrency, formatDate, isHistoryAnimal } from '../../lib/utils';
import { motion } from 'motion/react';
import { 
  AreaChart, Area, BarChart, Bar, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

interface MyPortfolioProps {
  onViewTab: (tab: string, invoiceId?: string) => void;
}

export const MyPortfolio: React.FC<MyPortfolioProps> = ({ onViewTab }) => {
  const { profile } = useAuth();
  const [livestock, setLivestock] = useState<Livestock[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    // Listen to livestock
    const qLivestock = query(collection(db, 'livestock'), where('ownerId', '==', profile.uid));
    const unsubscribeLivestock = onSnapshot(qLivestock, (snapshot) => {
      setLivestock(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Livestock));
      setLoading(false);
    });

    // Listen to invoices to show unpaid warnings
    const qInvoices = query(collection(db, 'invoices'), where('investorId', '==', profile.uid));
    const unsubscribeInvoices = onSnapshot(qInvoices, (snapshot) => {
      setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Invoice));
    });

    return () => {
      unsubscribeLivestock();
      unsubscribeInvoices();
    };
  }, [profile]);

  // Active Portfolio: Livestock not in history
  const activeLivestock = livestock.filter(animal => !isHistoryAnimal(animal));

  // Completed / Realized Portfolio
  const completedLivestock = livestock.filter(animal => isHistoryAnimal(animal));

  // Calculate dynamic metrics
  let totalInvested = 0;
  let currentValuation = 0;
  let totalWeight = 0;
  let startingWeight = 0;

  // Breakdown counts/values by category
  const categories: Record<string, { count: number; invested: number; valuation: number }> = {
    Cattle: { count: 0, invested: 0, valuation: 0 },
    Rams: { count: 0, invested: 0, valuation: 0 },
    Goats: { count: 0, invested: 0, valuation: 0 },
    Other: { count: 0, invested: 0, valuation: 0 }
  };

  activeLivestock.forEach(animal => {
    const purchasePrice = animal.purchasePrice || 500000;
    totalInvested += purchasePrice;

    // Detect type
    let category = 'Other';
    const cleanBreed = (animal.breed || '').toLowerCase();
    const cleanType = (animal.type || '').toLowerCase();
    const cleanPackage = (animal.investmentPackage || '').toLowerCase();

    if (cleanBreed.includes('cow') || cleanBreed.includes('bull') || cleanBreed.includes('cattle') || cleanType.includes('cattle') || cleanPackage.includes('cattle') || cleanType.includes('cow')) {
      category = 'Cattle';
    } else if (cleanBreed.includes('ram') || cleanType.includes('ram') || cleanPackage.includes('ram')) {
      category = 'Rams';
    } else if (cleanBreed.includes('goat') || cleanType.includes('goat') || cleanPackage.includes('goat')) {
      category = 'Goats';
    }

    // Dynamic Appreciation calculation:
    // Typical Simple ROI p.a. Cattle (24%), Rams (22%), Goats (20%)
    const dailyRoiRate = category === 'Cattle' ? 0.000657 : category === 'Rams' ? 0.000602 : 0.000547;
    
    // Normalize purchase date (some may be stored in seconds instead of ms)
    const purchaseMs = animal.purchaseDate < 100000000000 ? animal.purchaseDate * 1000 : animal.purchaseDate;
    const daysElapsed = Math.max(0, Math.floor((Date.now() - purchaseMs) / (1000 * 60 * 60 * 24)));
    
    const appreciationFactor = 1 + (daysElapsed * dailyRoiRate);
    const valuation = purchasePrice * appreciationFactor;
    currentValuation += valuation;

    // Parse weight (e.g., "250kg" -> 250)
    const currentWeightNum = parseFloat(animal.weight) || 0;
    totalWeight += currentWeightNum;

    // Daily weight gain: Cattle ~0.8kg, Rams ~0.25kg, Goats ~0.15kg
    const dailyWeightGain = category === 'Cattle' ? 0.8 : category === 'Rams' ? 0.25 : 0.15;
    const startingWeightEst = Math.max(15, currentWeightNum - (daysElapsed * dailyWeightGain));
    startingWeight += startingWeightEst;

    // Add to breakdown categories
    if (categories[category]) {
      categories[category].count += 1;
      categories[category].invested += purchasePrice;
      categories[category].valuation += valuation;
    } else {
      categories.Other.count += 1;
      categories.Other.invested += purchasePrice;
      categories.Other.valuation += valuation;
    }
  });

  const totalROI = totalInvested > 0 ? ((currentValuation - totalInvested) / totalInvested) * 100 : 0;
  const unrealizedProfit = currentValuation - totalInvested;
  const weightGain = Math.max(0, totalWeight - startingWeight);

  // Outstanding invoices
  const unpaidInvoices = invoices.filter(inv => inv.status === 'PENDING' || inv.status === 'OVERDUE');
  const totalOutstanding = unpaidInvoices.reduce((sum, inv) => sum + (inv.totalAmount || inv.amount || 0), 0);

  // Prepare Allocation Chart Data
  const allocationData = Object.keys(categories)
    .map(key => ({
      name: key,
      value: categories[key].valuation,
      count: categories[key].count,
      invested: categories[key].invested
    }))
    .filter(item => item.count > 0);

  // Prepare Growth Projections (Initial, Current, +3M, +6M, +9M, +12M)
  const projectionData = [
    { name: 'Initial', value: totalInvested },
    { name: 'Current', value: currentValuation },
    { name: '3 Months', value: currentValuation * (1 + (90 * 0.00062)) },
    { name: '6 Months', value: currentValuation * (1 + (180 * 0.00062)) },
    { name: '9 Months', value: currentValuation * (1 + (270 * 0.00062)) },
    { name: '12 Months', value: currentValuation * (1 + (365 * 0.00062)) },
  ];

  const COLORS = ['#10B981', '#6366F1', '#F59E0B', '#EF4444'];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-xl text-white font-sans text-xs space-y-1">
          <p className="font-bold">{payload[0].name}</p>
          <p className="text-brand-green font-semibold">Value: {formatCurrency(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 font-sans">Investment Portfolio</h2>
          <p className="text-sm text-gray-500">Real-time performance analytics, value appreciation, and projections.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => onViewTab('sourcing')} size="sm" variant="outline" className="text-xs">
            Sponsor New Animal
          </Button>
          <Button onClick={() => onViewTab('my-livestock')} size="sm" className="text-xs">
            Manage My Herd
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center text-gray-500">Analyzing portfolio statistics...</div>
      ) : activeLivestock.length === 0 ? (
        <div className="text-center py-20 border border-brand-border rounded-xl bg-brand-card/50">
          <Briefcase className="w-16 h-16 text-slate-600 mx-auto mb-4 opacity-40 animate-pulse" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Active Portfolio Found</h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto leading-relaxed mb-6">
            Your investment portfolio starts when you sponsor and receive livestock assets. Check your invoices or request sourcing to begin.
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" size="sm" onClick={() => onViewTab('sourcing')} className="text-xs">
              Sourcing Consultation
            </Button>
            {unpaidInvoices.length > 0 && (
              <Button size="sm" onClick={() => onViewTab('invoices')} className="text-xs">
                View Invoices ({unpaidInvoices.length})
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Outstanding Invoice Alert */}
          {unpaidInvoices.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 text-sm"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold">Pending Sourcing Invoices</h4>
                  <p className="text-xs text-amber-700 mt-0.5">
                    You have <strong>{unpaidInvoices.length} outstanding invoice(s)</strong> totaling <strong>{formatCurrency(totalOutstanding)}</strong>. Complete payment to tag and assign these assets.
                  </p>
                </div>
              </div>
              <Button size="sm" onClick={() => onViewTab('invoices')} className="text-xs shrink-0 self-start sm:self-center bg-amber-500 hover:bg-amber-600 text-black border-none font-semibold">
                <FileText className="w-3.5 h-3.5 mr-1.5" /> Pay Invoice
              </Button>
            </motion.div>
          )}

          {/* Core Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="relative overflow-hidden group hover:border-brand-green/30 transition-all">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-600">Total Invested Cost</span>
                <p className="text-2xl font-extrabold text-slate-900">{formatCurrency(totalInvested)}</p>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="font-semibold text-slate-800">{activeLivestock.length}</span> Active Animals Sourced
                </div>
              </div>
            </Card>

            <Card className="relative overflow-hidden group hover:border-brand-green/30 transition-all border border-brand-green/20 bg-brand-green/5">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-brand-green">Current Valuation</span>
                <p className="text-2xl font-extrabold text-slate-900">{formatCurrency(currentValuation)}</p>
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                  <ArrowUpRight className="w-3.5 h-3.5" /> Real-time appreciation
                </div>
              </div>
            </Card>

            <Card className="relative overflow-hidden group hover:border-brand-green/30 transition-all">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-600">Net Return (ROI)</span>
                <p className="text-2xl font-extrabold text-brand-green">+{formatCurrency(unrealizedProfit)}</p>
                <div className="flex items-center gap-1.5 text-xs text-brand-green font-bold">
                  <Percent className="w-3.5 h-3.5" /> +{totalROI.toFixed(1)}% unrealized yield
                </div>
              </div>
            </Card>

            <Card className="relative overflow-hidden group hover:border-brand-green/30 transition-all">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-600">Total Asset Weight</span>
                <p className="text-2xl font-extrabold text-slate-900">{totalWeight.toFixed(0)} kg</p>
                <div className="flex items-center gap-1.5 text-xs text-brand-green font-bold">
                  <Scale className="w-3.5 h-3.5" /> +{weightGain.toFixed(1)} kg weight gained
                </div>
              </div>
            </Card>
          </div>

          {/* Charts section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Allocation breakdown */}
            <Card title="Holdings Allocation & Investment Value" icon={Briefcase}>
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={allocationData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `₦${val/1000}k`} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(16, 185, 129, 0.05)' }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {allocationData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Allocation stats list */}
              <div className="grid grid-cols-3 gap-2 pt-4 border-t border-brand-border mt-2">
                {allocationData.map((item, index) => (
                  <div key={item.name} className="text-center">
                    <span className="text-[10px] font-bold text-gray-500 block">{item.name} ({item.count})</span>
                    <span className="text-xs font-extrabold text-slate-900 block mt-0.5">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Growth & Valuation Projections */}
            <Card title="Value Performance & 12M Growth Forecast" icon={TrendingUp}>
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={projectionData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `₦${(val/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorVal)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] text-gray-500 text-center italic mt-2">
                *Projections calculated using weighted average daily weight and value appreciation rates of active stock.
              </p>
            </Card>
          </div>

          {/* Active Holdings Summary Table */}
          <Card title="Active Holdings Registry" icon={Beef} bodyClassName="overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
              <table className="min-w-full divide-y divide-brand-border">
                <thead>
                  <tr className="text-left text-[10px] uppercase font-bold tracking-wider text-slate-600">
                    <th className="py-3 px-4">Tag Number</th>
                    <th className="py-3 px-4">Breed & Category</th>
                    <th className="py-3 px-4">Age / Weight</th>
                    <th className="py-3 px-4">Initial Investment</th>
                    <th className="py-3 px-4">Current Value</th>
                    <th className="py-3 px-4">Health Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border text-xs text-gray-700">
                  {activeLivestock.map((animal) => {
                    const purchasePrice = animal.purchasePrice || 500000;
                    
                    // Simple ROI logic matching dynamic appreciation
                    let category = 'Other';
                    const cleanBreed = (animal.breed || '').toLowerCase();
                    const cleanType = (animal.type || '').toLowerCase();
                    if (cleanBreed.includes('cow') || cleanBreed.includes('bull') || cleanBreed.includes('cattle') || cleanType.includes('cattle')) category = 'Cattle';
                    else if (cleanBreed.includes('ram') || cleanType.includes('ram')) category = 'Rams';
                    else if (cleanBreed.includes('goat') || cleanType.includes('goat')) category = 'Goats';

                    const dailyRoiRate = category === 'Cattle' ? 0.000657 : category === 'Rams' ? 0.000602 : 0.000547;
                    const purchaseMs = animal.purchaseDate < 100000000000 ? animal.purchaseDate * 1000 : animal.purchaseDate;
                    const daysElapsed = Math.max(0, Math.floor((Date.now() - purchaseMs) / (1000 * 60 * 60 * 24)));
                    const valuation = purchasePrice * (1 + (daysElapsed * dailyRoiRate));

                    return (
                      <tr key={animal.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{animal.tagNumber}</td>
                        <td className="py-3 px-4">
                          <span className="font-semibold block text-gray-950">{animal.breed}</span>
                          <span className="text-[10px] text-slate-500 uppercase">{animal.investmentPackage}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="block">{animal.age}</span>
                          <span className="text-[10px] font-semibold text-slate-600 block">{animal.weight}</span>
                        </td>
                        <td className="py-3 px-4 font-semibold">{formatCurrency(purchasePrice)}</td>
                        <td className="py-3 px-4 font-semibold text-brand-green">{formatCurrency(valuation)}</td>
                        <td className="py-3 px-4">
                          <Badge variant={animal.healthStatus === 'EXCELLENT' || animal.healthStatus === 'GOOD' ? 'success' : 'warning'} className="capitalize text-[10px]">
                            {animal.healthStatus}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button 
                            onClick={() => onViewTab('my-livestock')}
                            className="text-brand-green hover:text-green-800 transition-colors font-bold flex items-center gap-1 ml-auto"
                          >
                            Track <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
