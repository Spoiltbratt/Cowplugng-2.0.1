import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import { Livestock, LivestockStatus } from '../../types';
import { Card, Badge, Button } from '../UI';
import { Beef as Cow, Activity, Ruler, Weight, Tag, Camera, MapPin, History, CheckCircle2, AlertTriangle, Calendar, UserCheck } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/utils';

export const MyLivestock: React.FC = () => {
  const { profile } = useAuth();
  const [livestock, setLivestock] = useState<Livestock[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'livestock'), where('ownerId', '==', profile.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLivestock(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Livestock));
      setLoading(false);
    });
    return unsubscribe;
  }, [profile]);

  // Active Portfolio: Any livestock not marked as DELIVERED, DECEASED, or ARCHIVED
  const activePortfolio = livestock.filter(animal => 
    animal.status !== LivestockStatus.DELIVERED && 
    animal.status !== LivestockStatus.DECEASED &&
    animal.status !== LivestockStatus.ARCHIVED &&
    animal.status !== LivestockStatus.SOLD &&
    animal.status !== LivestockStatus.TRANSFERRED
  );

  // Portfolio History: Livestock marked as DELIVERED, DECEASED, ARCHIVED, SOLD, or TRANSFERRED
  const portfolioHistory = livestock.filter(animal => 
    animal.status === LivestockStatus.DELIVERED || 
    animal.status === LivestockStatus.DECEASED ||
    animal.status === LivestockStatus.ARCHIVED ||
    animal.status === LivestockStatus.SOLD ||
    animal.status === LivestockStatus.TRANSFERRED
  );

  const displayedAnimals = activeTab === 'active' ? activePortfolio : portfolioHistory;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold mb-1">My Livestock Portfolio</h2>
          <p className="text-gray-400">Track the growth, health, and lifecycle of your livestock assets.</p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center bg-brand-muted p-1 rounded-xl border border-brand-border self-start">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'active' 
                ? 'bg-brand-green text-black shadow-md' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Cow className="w-3.5 h-3.5" />
            Active Portfolio ({activePortfolio.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'history' 
                ? 'bg-brand-green text-black shadow-md' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Portfolio History ({portfolioHistory.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-gray-500">Retrieving your livestock assets...</div>
        ) : displayedAnimals.length === 0 ? (
          <Card className="col-span-full flex flex-col items-center justify-center py-20 text-center border-dashed border-2">
            {activeTab === 'active' ? (
              <>
                <Cow className="w-12 h-12 text-gray-600 mb-4" />
                <h3 className="text-xl font-bold">No Active Assets Yet</h3>
                <p className="text-gray-500 max-w-xs mt-2">Your livestock assets will appear here once your sourced animals are assigned to you by the management.</p>
              </>
            ) : (
              <>
                <History className="w-12 h-12 text-gray-600 mb-4" />
                <h3 className="text-xl font-bold">No Portfolio History</h3>
                <p className="text-gray-500 max-w-xs mt-2">No animals in your portfolio have been archived or removed from the active registry yet.</p>
              </>
            )}
          </Card>
        ) : (
          displayedAnimals.map(animal => (
            <Card key={animal.id} className="overflow-hidden group hover:border-brand-green/50 transition-all p-0 flex flex-col h-full">
              <div className="aspect-[16/10] bg-brand-muted relative flex-shrink-0">
                {animal.photos?.[0] ? (
                  <img src={animal.photos[0]} alt={animal.breed} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-brand-muted/50">
                    <Cow className="w-12 h-12 text-gray-700" />
                  </div>
                )}
                <div className="absolute top-4 left-4 flex gap-2">
                  <Badge variant="success" className="shadow-lg">{animal.tagNumber}</Badge>
                  <Badge className={`backdrop-blur-md shadow-lg ${
                    animal.status === LivestockStatus.DECEASED ? 'bg-red-950/80 text-red-300 border border-red-500/20' :
                    animal.status === LivestockStatus.DELIVERED ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/20' :
                    'bg-black/60 border-white/10 text-white'
                  }`}>{animal.status}</Badge>
                </div>
              </div>
              
              <div className="p-6 flex flex-col flex-grow justify-between space-y-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-white group-hover:text-brand-green transition-colors">{animal.breed} {animal.type}</h3>
                    <div className="flex items-center gap-2 mt-1 text-gray-500 text-xs">
                      <MapPin className="w-3 h-3" />
                      <span>{animal.farm || 'Main Ranch'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 py-4 border-y border-brand-border text-xs">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase text-gray-500 font-bold tracking-widest flex items-center gap-1">
                        <Weight className="w-3.5 h-3.5" /> Weight
                      </p>
                      <p className="text-sm font-bold text-gray-200">{animal.weight}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase text-gray-500 font-bold tracking-widest flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5" /> Health
                      </p>
                      <p className={`text-sm font-bold ${
                        animal.healthStatus === 'EXCELLENT' ? 'text-emerald-400' :
                        animal.healthStatus === 'GOOD' ? 'text-brand-green' :
                        animal.healthStatus === 'FAIR' ? 'text-amber-400' : 'text-rose-400'
                      }`}>{animal.healthStatus}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase text-gray-500 font-bold tracking-widest flex items-center gap-1">
                        <Tag className="w-3.5 h-3.5" /> Package
                      </p>
                      <p className="text-sm font-bold text-gray-200">{animal.investmentPackage}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase text-gray-500 font-bold tracking-widest flex items-center gap-1">
                        <Ruler className="w-3.5 h-3.5" /> Age
                      </p>
                      <p className="text-sm font-bold text-gray-200">{animal.age}</p>
                    </div>
                  </div>

                  {/* Portfolio History Metadata Block */}
                  {(animal.status === LivestockStatus.DELIVERED || animal.status === LivestockStatus.DECEASED) && (
                    <div className={`p-4 rounded-xl border space-y-2.5 text-xs ${
                      animal.status === LivestockStatus.DELIVERED 
                        ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-200' 
                        : 'bg-red-950/20 border-red-500/20 text-red-200'
                    }`}>
                      <div className="flex items-center gap-1.5 font-semibold">
                        {animal.status === LivestockStatus.DELIVERED ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                        )}
                        <span>
                          {animal.status === LivestockStatus.DELIVERED ? 'Delivered Status Log' : 'Deceased Status Log'}
                        </span>
                      </div>

                      {animal.statusChangeDate && (
                        <div className="flex items-center gap-1.5 text-gray-400">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Changed on: {formatDate(animal.statusChangeDate)}</span>
                        </div>
                      )}

                      {animal.statusChangeReason && (
                        <div>
                          <span className="font-semibold text-gray-300">Reason:</span>{' '}
                          <span className="text-gray-400">{animal.statusChangeReason}</span>
                        </div>
                      )}

                      {animal.statusChangeNotes && (
                        <div>
                          <span className="font-semibold text-gray-300">Notes:</span>{' '}
                          <p className="mt-0.5 text-gray-400 bg-black/20 p-2 rounded border border-brand-border font-mono text-[11px] leading-relaxed">
                            {animal.statusChangeNotes}
                          </p>
                        </div>
                      )}

                      {animal.statusChangeAdminName && (
                        <div className="flex items-center gap-1.5 text-gray-400 text-[10px] pt-1 border-t border-brand-border/40">
                          <UserCheck className="w-3.5 h-3.5 text-brand-green" />
                          <span>Processed by: {animal.statusChangeAdminName}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" size="sm">Growth Reports</Button>
                  <Button variant="outline" className="flex-1" size="sm">Health History</Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

