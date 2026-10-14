import React, { useState, useEffect } from 'react';
import { Modal, Card, Badge } from '../UI';
import { cn } from '../../lib/utils';
import { Livestock } from '../../types';
import { AlertCircle, Video, Image as ImageIcon } from 'lucide-react';
import { db } from '../../lib/firebase';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { formatDate } from '../../lib/utils';
import { normalizeHealthRecord } from '../../lib/syncLivestockRecords';

export interface HealthRecordSystem {
  id: string;
  livestockId: string;
  tagNumber?: string;
  healthStatus: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  lastVetExamDate?: number;
  nextScheduledExamDate?: number;
  treatmentStatus?: string;
  outstandingConcerns?: string;
  examinations?: any[];
  medications: any[];
  vaccinations: any[];
  medicalDocuments?: any[];
  medicalExpenses?: any[];
  timeline: any[];
  growthRecords: any[];
  updatedAt: number;
}

interface VitalityLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  animal: Livestock | null;
}

export const VitalityLogModal: React.FC<VitalityLogModalProps> = ({
  isOpen,
  onClose,
  animal
}) => {
  const [healthData, setHealthData] = useState<HealthRecordSystem | null>(null);
  const [growthRecords, setGrowthRecords] = useState<any[]>([]);
  const [errorBanner, setErrorBanner] = useState<{ code: string; message: string; path: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'media' | 'vaccines' | 'meds' | 'timeline'>('overview');
  
  useEffect(() => {
    if (!animal) return;
    
    // Health Records
    const healthRef = doc(db, 'livestockHealthRecords', animal.id);
    const unsubHealth = onSnapshot(healthRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = normalizeHealthRecord(docSnap.id, docSnap.data());
        setHealthData(data as HealthRecordSystem);
        setErrorBanner(null);
      } else {
        setHealthData(null);
      }
    }, (err) => {
      setErrorBanner({ code: err.code || 'unknown', message: err.message, path: `livestockHealthRecords/${animal.id}` });
    });

    // Growth Records (Media)
    const growthRef = query(collection(db, 'livestockGrowthRecords'), where('livestockId', '==', animal.id));
    const unsubGrowth = onSnapshot(growthRef, (snap) => {
        const records = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        setGrowthRecords(records);
    }, (err) => {
      setErrorBanner({ code: err.code || 'unknown', message: err.message, path: 'livestockGrowthRecords' });
    });

    return () => { unsubHealth(); unsubGrowth(); };
  }, [animal]);

  if (!animal) return null;

  const getMediaItems = () => {
    if (!healthData) return [];
    
    // (a) growthRecords collection
    const growthMedia = growthRecords
        .filter(r => r.status === 'published')
        .flatMap(r => (r.media || []).map((m: any) => ({ ...m, recordId: r.id, date: r.measurementDate, weight: r.weightKg })));
    
    // (b) healthRecords growthRecords array
    const healthMedia = (healthData.growthRecords || [])
        .filter(r => r.status !== 'draft')
        .flatMap(r => (r.media || []).map((m: any) => ({ ...m, recordId: r.id, date: r.measurementDate, weight: r.weightKg })));

    // Merge & Deduplicate
    const merged = [...growthMedia, ...healthMedia];
    const unique = Array.from(new Map(merged.map(item => [item.url, item])).values());
    
    return unique.sort((a, b) => b.date - a.date);
  };

  const mediaItems = getMediaItems();

  const renderTabContent = () => {
    if (!healthData) return <p className="text-sm text-slate-500">No records yet.</p>;
    
    switch (activeTab) {
      case 'media': {
        if (mediaItems.length === 0) return <p className="text-sm text-slate-500">No photos or videos yet. Updates from farm management will appear here.</p>;
        return (
            <div className="grid grid-cols-2 gap-3">
                {mediaItems.map((item, i) => (
                    <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="bg-slate-50 rounded-xl border p-2 space-y-2">
                        {item.type === 'video' ? (
                            <div className="w-full h-32 bg-slate-200 rounded-lg flex items-center justify-center relative">
                                <Video className="w-8 h-8 text-slate-500" />
                                <span className="absolute bottom-2 right-2 text-[10px] bg-black/50 text-white px-1 rounded">VIDEO</span>
                            </div>
                        ) : (
                            <img src={item.url} alt={item.caption || 'Media'} className="w-full h-32 object-cover rounded-lg" />
                        )}
                        <p className="text-[10px] text-slate-600 font-medium truncate">{formatDate(item.date)} • {item.weight} kg</p>
                    </a>
                ))}
            </div>
        );
      }
      case 'vaccines': {
        const data = healthData.vaccinations.filter(v => v.status !== 'draft');
        if (data.length === 0) return <p className="text-sm text-slate-500">No vaccinations recorded yet.</p>;
        return data.map((item, i) => (
           <div key={i} className="p-3 bg-slate-50 rounded-xl border">
              <p className="font-semibold text-xs">{item.vaccineName}</p>
              <p className="text-xs text-slate-500">Administered: {formatDate(item.adminDate)} by {item.adminBy}</p>
              <p className="text-xs text-slate-500">Batch: {item.batchNumber}</p>
              {item.nextDueDate && <p className="text-xs text-emerald-600 font-semibold">Next due: {formatDate(item.nextDueDate)}</p>}
           </div>
        ));
      }
      case 'meds': {
        const data = healthData.medications.filter(m => m.status !== 'draft');
        if (data.length === 0) return <p className="text-sm text-slate-500">No medications or prescriptions recorded yet.</p>;
        return data.map((item, i) => (
           <div key={i} className="p-3 bg-slate-50 rounded-xl border">
             <p className="font-semibold text-xs">{item.name}</p>
             <p className="text-xs text-slate-500">Reason: {item.reason}</p>
             <p className="text-xs text-slate-500">Dosage / Instructions: {item.instructions}</p>
             <p className="text-xs text-slate-500">Period: {formatDate(item.startDate)} - {item.endDate ? formatDate(item.endDate) : 'Ongoing'}</p>
             <p className="text-xs text-slate-500">Prescribed by: {item.prescribingVet}</p>
             <p className="text-xs text-slate-500">Administered by: {item.administeredBy}</p>
           </div>
        ));
      }
      case 'timeline': {
        const data = healthData.timeline.filter(t => t.status !== 'draft').sort((a, b) => b.date - a.date);
        if (data.length === 0) return <p className="text-sm text-slate-500">No timeline events yet.</p>;
        return data.map((item, i) => (
            <div key={i} className="p-3 bg-slate-50 rounded-xl border">
                <p className="font-semibold text-xs">{formatDate(item.date)} - {item.title}</p>
                <p className="text-xs text-slate-500">{item.description}</p>
            </div>
        ));
      }
      default:
        return null;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Vitality Log & Veterinary Records" subtitle={`ASSET TAG: ${animal.tagNumber} (${animal.breed})`} maxWidth="2xl">
      <div className="space-y-6">
        {errorBanner && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-900 p-4 rounded-2xl">
            <AlertCircle className="w-5 h-5 text-red-600 inline mr-2" />
            <span className="text-xs font-semibold">Error {errorBanner.code}: {errorBanner.message} ({errorBanner.path})</span>
          </div>
        )}
        
        <div className="bg-gradient-to-br from-slate-900 to-emerald-950 rounded-3xl p-6 text-white shadow-xl space-y-3">
          <div className="flex justify-between items-start">
             <Badge variant="success">HEALTH STATUS: {healthData?.healthStatus || animal.healthStatus || 'GOOD'}</Badge>
             <span className="text-xs text-emerald-300">Tag: {animal.tagNumber}</span>
          </div>
          <h4 className="text-2xl font-bold tracking-tight">{animal.breed}</h4>
          <p className="text-sm text-slate-300">Treatment Status: {healthData?.treatmentStatus || 'Routine monitoring'}</p>
          <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-xs border border-white/10">
            <span className="block text-emerald-300 font-semibold mb-1">LAST VET EXAM</span>
            {healthData?.lastVetExamDate ? formatDate(healthData.lastVetExamDate) : "Routine checks current"}
          </div>
        </div>

        <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'media', label: `Media (${mediaItems.length})` },
            { id: 'vaccines', label: `Vaccines (${healthData?.vaccinations.filter(v => v.status !== 'draft').length || 0})` },
            { id: 'meds', label: `Meds & Rx (${healthData?.medications.filter(m => m.status !== 'draft').length || 0})` },
            { id: 'timeline', label: `Timeline (${healthData?.timeline.filter(t => t.status !== 'draft').length || 0})` }
          ].map(tab => (
             <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={cn("px-4 py-2 text-[10px] uppercase font-semibold rounded-xl transition-all whitespace-nowrap", activeTab === tab.id ? "bg-emerald-700 text-white" : "text-slate-500 hover:bg-white")}>
               {tab.label}
             </button>
          ))}
        </div>
        
        <div className="space-y-4">
           {activeTab === 'overview' && (
             <Card title="Health Summary & Vitals">
               <div className="space-y-2 text-sm">
                 <p><strong>CURRENT HEALTH STATUS:</strong> {healthData?.healthStatus || animal.healthStatus || 'GOOD'}</p>
                 <p><strong>LAST VETERINARIAN EXAM:</strong> {healthData?.lastVetExamDate ? formatDate(healthData.lastVetExamDate) : "No recent exam"}</p>
                 <p><strong>NEXT SCHEDULED EXAM:</strong> Bi-weekly routine check scheduled</p>
                 <p><strong>TREATMENT STATUS:</strong> {healthData?.treatmentStatus || 'Routine monitoring'}</p>
               </div>
             </Card>
           )}
           {activeTab !== 'overview' && (
             <Card title={activeTab.toUpperCase()}>
               {renderTabContent()}
             </Card>
           )}
        </div>
      </div>
    </Modal>
  );
};
