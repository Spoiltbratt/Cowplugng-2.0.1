import React, { useState, useEffect } from 'react';
import { Modal, Card, Button, Badge } from '../UI';
import { Livestock } from '../../types';
import { Package, AlertCircle, Video } from 'lucide-react';
import { db, auth } from '../../lib/firebase';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { formatDate, cn } from '../../lib/utils';
import { useAuth } from '../../lib/AuthContext';
import { normalizeHealthRecord } from '../../lib/syncLivestockRecords';

export interface GrowthRecord {
  id: string;
  livestockId: string;
  tagNumber: string;
  measurementDate: number;
  weightKg: number;
  previousWeightKg?: number;
  weightGain?: number;
  bodyCondition?: string;
  feedingNotes?: string;
  media?: Array<{ url: string; publicId?: string; type: 'image' | 'video'; caption?: string }>;
  status?: 'draft' | 'published';
  authorName?: string;
  createdAt?: number;
}

interface GrowthDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  animal: Livestock | null;
  isAdmin?: boolean;
}

export const GrowthDataModal: React.FC<GrowthDataModalProps> = ({
  isOpen,
  onClose,
  animal,
  isAdmin = false
}) => {
  const [growthData, setGrowthData] = useState<any[]>([]);
  const [errorBanner, setErrorBanner] = useState<{ code: string; message: string; path: string } | null>(null);

  useEffect(() => {
    if (!animal) return;

    // 1. Get growth records
    const growthRef = query(collection(db, 'livestockGrowthRecords'), where('livestockId', '==', animal.id));
    const unsubGrowth = onSnapshot(growthRef, (snap) => {
        const records = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        setGrowthData(prev => {
            const merged = [...prev.filter(p => !records.find(r => r.id === p.id)), ...records];
            return merged.sort((a, b) => (b.measurementDate || 0) - (a.measurementDate || 0));
        });
    }, (err) => {
        setErrorBanner({ code: err.code || 'unknown', message: err.message, path: 'livestockGrowthRecords' });
    });

    // 2. Get health record for growth data (independent)
    const unsubHealth = onSnapshot(doc(db, 'livestockHealthRecords', animal.id), (docSnap) => {
      if (docSnap.exists()) {
        const data = normalizeHealthRecord(docSnap.id, docSnap.data());
        if (data.growthRecords) {
           setGrowthData(prev => {
              const merged = [...prev.filter(p => !data.growthRecords.find((r: any) => r.id === p.id)), ...data.growthRecords];
              return merged.sort((a, b) => (b.measurementDate || 0) - (a.measurementDate || 0));
           });
        }
      }
    }, (err) => {
       setErrorBanner({ code: err.code || 'unknown', message: err.message, path: `livestockHealthRecords/${animal.id}` });
    });

    return () => { unsubGrowth(); unsubHealth(); };
  }, [animal]);

  if (!animal) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Growth Data & Metrics" subtitle={`${animal.breed} • ${animal.tagNumber}`} maxWidth="2xl">
      <div className="space-y-6">
        {errorBanner && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-900 p-4 rounded-2xl">
            <AlertCircle className="w-5 h-5 text-red-600 inline mr-2" />
            <span className="text-xs font-semibold">Error {errorBanner.code}: {errorBanner.message} ({errorBanner.path})</span>
          </div>
        )}
        
        <div className="bg-gradient-to-br from-slate-900 to-emerald-950 rounded-3xl p-6 text-white shadow-xl space-y-3">
          <div className="flex justify-between items-start">
             <Badge variant="success">{animal.type} • {animal.tagNumber}</Badge>
          </div>
          <h4 className="text-2xl font-bold tracking-tight">{animal.breed}</h4>
          <p className="text-sm text-emerald-300">Farm Location: {animal.farm || 'N/A'}</p>
          <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-xs border border-white/10">
            <span className="block text-emerald-300 font-semibold mb-1">AUTHORITATIVE WEIGHT</span>
            {animal.weight || 'N/A'}
          </div>
        </div>

        <Card title={`Growth History & Chronological Measurements (${growthData.length})`}>
          {growthData.length > 0 ? (
            <div className="space-y-3">
              {growthData.map((record, i) => (
                <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                   <div className="flex justify-between font-semibold text-sm">
                      <span>{record.measurementDate ? formatDate(record.measurementDate) : 'Unknown Date'}</span>
                      <span className="text-emerald-700">{record.weightKg} kg</span>
                   </div>
                   <p className="text-xs text-slate-500 mt-1">Gain: {record.weightGain ?? 0} kg</p>
                   <p className="text-xs text-slate-700 mt-2">{record.bodyCondition || 'No observations recorded.'}</p>
                   
                   {record.media && record.media.length > 0 && (
                     <div className="grid grid-cols-3 gap-2 mt-3">
                       {record.media.map((m: any, idx: number) => (
                          <a key={idx} href={m.url} target="_blank" rel="noopener noreferrer" className="block p-1 bg-white rounded-lg border">
                             {m.type === 'video' ? <Video className="w-6 h-6 text-slate-400 mx-auto" /> : <img src={m.url} alt={m.caption} className="w-full h-16 object-cover rounded" />}
                             <p className="text-[9px] truncate mt-1">{m.caption}</p>
                          </a>
                       ))}
                     </div>
                   )}
                   <p className="text-[10px] text-slate-400 mt-1">Recorded by: {record.authorName}</p>
                </div>
              ))}
            </div>
          ) : (
             <p className="text-sm text-slate-500">No Growth Records Found. Verified growth measurements will appear here once published by farm management.</p>
          )}
        </Card>

        {/* Diagnostic Footer */}
        <div className="mt-6 p-2 bg-slate-900 rounded-lg text-[10px] font-mono text-slate-400 border border-slate-800">
           UID: {auth.currentUser?.uid || 'none'}, Animal: {animal.id}, Owner: {animal.ownerId}, OWNER MATCH: {auth.currentUser?.uid === animal.ownerId ? 'yes' : 'no'}
        </div>
      </div>
    </Modal>
  );
};
