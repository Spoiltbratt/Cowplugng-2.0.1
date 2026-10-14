import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import { Livestock, LivestockStatus } from '../../types';
import { Card, Badge, Button } from '../UI';
import { 
  HeartPulse, 
  Package, 
  MapPin, 
  History, 
  CircleCheck, 
  TriangleAlert, 
  CalendarDays, 
  Star,
  Eye
} from 'lucide-react';
import { CowIcon as Beef } from '../CowIcon';
import { formatCurrency, formatDate, cn, formatWeight, isHistoryAnimal } from '../../lib/utils';
import { useFavorites } from '../../lib/useFavorites';
import { MediaContainer } from '../common/MediaContainer';
import { GrowthDataModal } from './GrowthDataModal';
import { VitalityLogModal } from './VitalityLogModal';

export const MyLivestock: React.FC = () => {
  const { profile } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [livestock, setLivestock] = useState<Livestock[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'starred' | 'history'>('active');

  const [selectedGrowthAnimal, setSelectedGrowthAnimal] = useState<Livestock | null>(null);
  const [selectedVitalityAnimal, setSelectedVitalityAnimal] = useState<Livestock | null>(null);

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'livestock'), where('ownerId', '==', profile.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLivestock(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Livestock));
      setLoading(false);
    });
    return unsubscribe;
  }, [profile]);

  // Active Portfolio: Any livestock not in history
  const activePortfolio = livestock.filter(animal => !isHistoryAnimal(animal));

  // Starred / Saved Livestock
  const starredPortfolio = livestock.filter(animal => isFavorite(animal.id));

  // Portfolio History: Livestock in history
  const portfolioHistory = livestock.filter(animal => isHistoryAnimal(animal));

  const displayedAnimals = 
    activeTab === 'active' 
      ? activePortfolio 
      : activeTab === 'starred' 
        ? starredPortfolio 
        : portfolioHistory;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">My Livestock Portfolio</h2>
          <p className="text-sm text-gray-500">Track the growth, health, and lifecycle of your livestock assets.</p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center bg-slate-100 p-1.5 rounded-[1.5rem] border border-slate-200 shadow-inner self-start flex-wrap gap-1">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2.5 text-[10px] uppercase tracking-widest font-semibold rounded-[1.2rem] transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'active' 
                ? 'bg-emerald-700 text-white shadow-lg' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Beef className="w-3.5 h-3.5" />
            Active ({activePortfolio.length})
          </button>
          <button
            onClick={() => setActiveTab('starred')}
            className={`px-4 py-2.5 text-[10px] uppercase tracking-widest font-semibold rounded-[1.2rem] transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'starred' 
                ? 'bg-emerald-700 text-white shadow-lg' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Star className={cn("w-3.5 h-3.5", starredPortfolio.length > 0 ? "fill-amber-400 text-amber-400" : "")} />
            Starred ({starredPortfolio.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2.5 text-[10px] uppercase tracking-widest font-semibold rounded-[1.2rem] transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'history' 
                ? 'bg-emerald-700 text-white shadow-lg' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            History ({portfolioHistory.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-gray-500">Retrieving your livestock assets...</div>
        ) : displayedAnimals.length === 0 ? (
          <Card className="col-span-full flex flex-col items-center justify-center py-20 text-center border-dashed border">
            {activeTab === 'active' ? (
              <>
                <Beef className="w-12 h-12 text-slate-600 mb-4 opacity-40" />
                <h3 className="text-lg font-bold text-gray-900">No Active Portfolio Assets</h3>
                <p className="text-gray-500 max-w-sm mt-2 text-sm leading-relaxed">Your agricultural assets will appear here once your sourced livestock is assigned to your investment portfolio by management.</p>
              </>
            ) : activeTab === 'starred' ? (
              <>
                <Star className="w-12 h-12 text-amber-500 mb-4 opacity-40" />
                <h3 className="text-lg font-bold text-gray-900">No Starred Livestock</h3>
                <p className="text-gray-500 max-w-sm mt-2 text-sm leading-relaxed">Click the star icon on any livestock asset in your portfolio to bookmark and track it here.</p>
              </>
            ) : (
              <>
                <History className="w-12 h-12 text-slate-600 mb-4 opacity-40" />
                <h3 className="text-lg font-bold text-gray-900">No Portfolio History</h3>
                <p className="text-gray-500 max-w-sm mt-2 text-sm leading-relaxed">No agricultural assets in your portfolio have been archived or liquidated yet.</p>
              </>
            )}
          </Card>
        ) : (
          displayedAnimals.map(animal => (
            <Card key={animal.id} className="overflow-hidden group hover:border-emerald-200 transition-all duration-500 p-0 flex flex-col h-full rounded-[2.5rem] border-slate-100 shadow-sm hover:shadow-xl hover:shadow-emerald-900/5">
              <div className="aspect-[16/10] bg-slate-100 relative overflow-hidden flex-shrink-0">
                {animal.livestockImageUrl || animal.photos?.[0] || animal.photoUrl || (animal as any).imageUrl || (animal as any).portraitUrl || (animal as any).image || (animal as any).livestockImage || (animal as any).cloudinaryUrl ? (
                  <MediaContainer 
                    src={animal.livestockImageUrl || animal.photos?.[0] || animal.photoUrl || (animal as any).imageUrl || (animal as any).portraitUrl || (animal as any).image || (animal as any).livestockImage || (animal as any).cloudinaryUrl} 
                    alt={animal.breed}
                    containerClassName="w-full h-full"
                    className="group-hover:scale-110"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 border-b border-slate-100">
                    <Beef className="w-12 h-12 text-slate-200 mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Livestock image pending</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={(e) => toggleFavorite(animal.id, e)}
                  aria-label={isFavorite(animal.id) ? "Remove from starred favorites" : "Star and save to favorites"}
                  title={isFavorite(animal.id) ? "Starred in favorites" : "Star to save"}
                  className="absolute top-5 right-5 p-2 rounded-2xl bg-white/95 backdrop-blur-md shadow-md border border-slate-100/80 hover:bg-white text-slate-400 hover:text-amber-500 transition-all cursor-pointer z-10"
                >
                  <Star className={cn("w-4 h-4 transition-transform active:scale-125", isFavorite(animal.id) ? "fill-amber-400 text-amber-500" : "text-slate-400")} />
                </button>

                <div className="absolute top-5 left-5 flex flex-col gap-2">
                  <Badge variant="success" className="shadow-lg px-3 py-1 font-semibold backdrop-blur-sm bg-emerald-700/90 border-transparent text-white">{animal.tagNumber}</Badge>
                  <Badge className={`backdrop-blur-md shadow-lg px-3 py-1 font-semibold ${
                    animal.status === LivestockStatus.DECEASED ? 'bg-red-500 text-white border-transparent' :
                    animal.status === LivestockStatus.DELIVERED ? 'bg-emerald-500 text-white border-transparent' :
                    animal.status === LivestockStatus.AWAITING_ARRIVAL ? 'bg-amber-500 text-white border-transparent' :
                    'bg-white/95 text-slate-900 border-transparent'
                  }`}>{ (animal.status || '').replace('_', ' ') }</Badge>
                </div>
              </div>
              
              <div className="p-8 flex flex-col flex-grow justify-between space-y-6 bg-white">
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-start">
                      <h3 className="text-xl font-semibold text-slate-900 tracking-tight leading-none group-hover:text-emerald-700 transition-colors">
                        {animal.type}
                      </h3>
                      <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">{animal.tagNumber}</span>
                    </div>
                    <p className="text-sm font-normal text-slate-500 mt-1">Breed: <span className="font-medium text-slate-700">{animal.breed}</span></p>
                    <div className="flex items-center gap-2 mt-3 text-slate-400 text-[10px] font-medium uppercase tracking-widest">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{animal.farm || 'Main Ranch'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 py-6 border-y border-slate-50 text-xs">
                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase text-slate-400 font-medium tracking-widest flex items-center gap-2">
                        <CalendarDays className="w-3.5 h-3.5 text-emerald-600" /> Acquired
                      </p>
                      <p className="text-sm font-medium text-slate-900 tracking-tight">{formatDate(animal.createdAt)}</p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase text-slate-400 font-medium tracking-widest flex items-center gap-2">
                        <CalendarDays className="w-3.5 h-3.5 text-emerald-600" /> Liquidation
                      </p>
                      <p className="text-sm font-medium text-slate-900 tracking-tight">
                        {animal.expectedLiquidationDate ? formatDate(animal.expectedLiquidationDate) : 'Not set'}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase text-slate-400 font-medium tracking-widest flex items-center gap-2">
                        <HeartPulse className="w-3.5 h-3.5 text-emerald-600" /> Vitality
                      </p>
                      <p className={`text-sm font-semibold tracking-tight ${
                        animal.healthStatus === 'EXCELLENT' ? 'text-emerald-600' :
                        animal.healthStatus === 'GOOD' ? 'text-emerald-500' :
                        animal.healthStatus === 'FAIR' ? 'text-amber-500' : 'text-rose-500'
                      }`}>{animal.healthStatus}</p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase text-slate-400 font-medium tracking-widest flex items-center gap-2">
                        <Package className="w-3.5 h-3.5 text-emerald-600" /> Weight
                      </p>
                      <p className="text-sm font-semibold text-slate-900 tracking-tight">{formatWeight(animal.weight)}</p>
                    </div>
                  </div>

                  {/* Awaiting Arrival Banner */}
                  {animal.status === LivestockStatus.AWAITING_ARRIVAL && (
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-amber-900 font-semibold">
                        <TriangleAlert className="w-4 h-4 text-amber-600" />
                        <span>Reserved Asset</span>
                      </div>
                      <p className="text-amber-800 text-[10px] leading-relaxed">
                        This animal has been secured for your portfolio and is currently in transit or awaiting arrival at our farm for formal onboarding.
                      </p>
                    </div>
                  )}

                  {/* Financial Summary */}
                  <div className="p-5 bg-slate-50 rounded-[1.5rem] border border-slate-100 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[10px] font-medium uppercase tracking-widest text-slate-400">Purchase Value</span>
                      <span className="text-sm font-bold text-slate-900">{formatCurrency(animal.purchasePrice || 0)}</span>
                    </div>
                  </div>

                  {/* Portfolio History Metadata Block */}
                  {(animal.status === LivestockStatus.DELIVERED || animal.status === LivestockStatus.DECEASED) && (
                    <div className={`p-5 rounded-[1.5rem] border space-y-3 text-xs ${
                      animal.status === LivestockStatus.DELIVERED 
                        ? 'bg-emerald-50 border-emerald-100 text-emerald-900' 
                        : 'bg-red-50 border-red-100 text-red-900'
                    }`}>
                      <div className="flex items-center gap-2 font-semibold uppercase tracking-[0.2em] text-[9px]">
                        {animal.status === LivestockStatus.DELIVERED ? (
                          <CircleCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        ) : (
                          <TriangleAlert className="w-4 h-4 text-red-600 flex-shrink-0" />
                        )}
                        <span>
                          {animal.status === LivestockStatus.DELIVERED ? 'Lifecycle Completed' : 'Asset Loss Recorded'}
                        </span>
                      </div>

                      {animal.statusChangeDate && (
                        <div className="flex items-center gap-2 text-slate-500 font-medium">
                          <CalendarDays className="w-4 h-4" />
                          <span>Finalized on: {formatDate(animal.statusChangeDate)}</span>
                        </div>
                      )}

                      {animal.statusChangeReason && (
                        <div>
                          <span className="font-medium uppercase tracking-widest text-[9px] text-slate-400 block mb-1">Reasoning</span>
                          <span className="text-slate-900 font-semibold leading-relaxed">{animal.statusChangeReason}</span>
                        </div>
                      )}

                      {animal.statusChangeNotes && (
                        <div>
                          <span className="font-medium uppercase tracking-widest text-[9px] text-slate-400 block mb-1">Operational Notes</span>
                          <p className="mt-1 text-slate-600 bg-white/50 p-4 rounded-xl border border-white/50 font-mono text-[11px] leading-relaxed shadow-inner">
                            {animal.statusChangeNotes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-50">
                  <Button 
                    variant="outline" 
                    className="flex-1 text-[10px] h-11 uppercase font-semibold tracking-widest rounded-xl" 
                    size="sm"
                    onClick={() => setSelectedGrowthAnimal(animal)}
                  >
                    <Package className="w-3.5 h-3.5 mr-1 text-slate-500" /> Growth Data
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1 text-[10px] h-11 uppercase font-semibold tracking-widest rounded-xl" 
                    size="sm"
                    onClick={() => setSelectedVitalityAnimal(animal)}
                  >
                    <HeartPulse className="w-3.5 h-3.5 mr-1 text-slate-500" /> Vitality Log
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <GrowthDataModal 
        isOpen={Boolean(selectedGrowthAnimal)} 
        onClose={() => setSelectedGrowthAnimal(null)} 
        animal={selectedGrowthAnimal} 
        isAdmin={false} 
      />

      <VitalityLogModal 
        isOpen={Boolean(selectedVitalityAnimal)} 
        onClose={() => setSelectedVitalityAnimal(null)} 
        animal={selectedVitalityAnimal} 
        isAdmin={false} 
      />
    </div>
  );
};

