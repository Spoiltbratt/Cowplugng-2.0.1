import React, { useState, useEffect } from 'react';
import { db, sendNotification } from '../../lib/firebase';
import { collection, onSnapshot, query, where, doc, updateDoc, addDoc, setDoc, getDocs, getDoc } from 'firebase/firestore';
import { Card, PageHeader, Button, Badge, Input, Select, Modal } from '../UI';
import { Livestock } from '../../types';
import { HealthRecordSystem } from '../investor/VitalityLogModal';
import { GrowthRecord } from '../investor/GrowthDataModal';
import { formatDate, formatCurrency, cn, formatWeight, isHistoryAnimal } from '../../lib/utils';
import { uploadToCloudinary } from '../../lib/cloudinary';
import { useAuth } from '../../lib/AuthContext';
import { 
  HeartPulse, Search, Plus, Trash2, CalendarDays, TrendingUp, 
  Stethoscope, Pill, Syringe, FileText, DollarSign, Clock, 
  Image as ImageIcon, Video, CheckCircle2, ChevronRight, Eye, RefreshCw, 
  ShieldCheck, AlertCircle, Play, Edit3
} from 'lucide-react';
import { CowIcon as Beef } from '../CowIcon';
import { recordAuthoritativeWeight, syncHealthStatus, removeUndefinedFields, repairHealthRecords } from '../../lib/syncLivestockRecords';

type TabKey = 'overview' | 'growth' | 'vet' | 'meds' | 'vaccines' | 'timeline';

export const HealthRecordManager: React.FC = () => {
  const { profile, isAdmin } = useAuth();
  const [livestockList, setLivestockList] = useState<Livestock[]>([]);
  const [healthRecords, setHealthRecords] = useState<HealthRecordSystem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Selection
  const [searchTerm, setSearchTerm] = useState('');
  const [listTab, setListTab] = useState<'active' | 'history'>('active');
  const [selectedAnimal, setSelectedAnimal] = useState<Livestock | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // Selected animal's health data & growth data from the unified collections
  const [activeHealthData, setActiveHealthData] = useState<HealthRecordSystem | null>(null);
  const [activeGrowthRecords, setActiveGrowthRecords] = useState<GrowthRecord[]>([]);

  // Data Inspector State (Admin Audit)
  const [inspectorData, setInspectorData] = useState<any>(null);
  const [inspectorLoading, setInspectorLoading] = useState(false);

  // Repair modal state
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState<{
    created: number;
    merged: number;
    duplicatesDeleted: number;
    idFieldsCleaned: number;
    skipped: number;
    errors: Array<{ id: string; code: string; message: string }>;
  } | null>(null);
  const [repairError, setRepairError] = useState<string | null>(null);

  const canRepair = profile && (['admin', 'super_admin', 'staff', 'ADMIN', 'SUPER_ADMIN'].includes(profile.role) || isAdmin);

  // Sub-modal creation forms for Admin within Health Record
  const [showAddForm, setShowAddForm] = useState<
    'growth' | 'exam' | 'med' | 'vaccine' | 'doc' | 'expense' | 'status' | null
  >(null);

  // Form states
  // 1. Growth form
  const [growthDate, setGrowthDate] = useState(new Date().toISOString().split('T')[0]);
  const [growthWeight, setGrowthWeight] = useState<number>(0);
  const [growthBodyCond, setGrowthBodyCond] = useState('');
  const [growthFeeding, setGrowthFeeding] = useState('');
  const [growthMedia, setGrowthMedia] = useState<Array<{ url: string; publicId?: string; type: 'image' | 'video'; caption?: string }>>([]);
  const [growthUploading, setGrowthUploading] = useState(false);
  const [growthPublishStatus, setGrowthPublishStatus] = useState<'draft' | 'published'>('published');
  const [isGrowthCorrection, setIsGrowthCorrection] = useState(false);
  const [growthCorrectionReason, setGrowthCorrectionReason] = useState('');
  const [editingGrowthRecordId, setEditingGrowthRecordId] = useState<string | null>(null);

  // 2. Exam form
  const [examDate, setExamDate] = useState(new Date().toISOString().split('T')[0]);
  const [examVet, setExamVet] = useState('Dr. D. Oladipo, DVM');
  const [examType, setExamType] = useState('Routine Checkup');
  const [examFindings, setExamFindings] = useState('');
  const [examDiagnosis, setExamDiagnosis] = useState('');
  const [examTreatment, setExamTreatment] = useState('');
  const [examFollowUp, setExamFollowUp] = useState('');

  // 3. Med form
  const [medName, setMedName] = useState('');
  const [medReason, setMedReason] = useState('');
  const [medDosage, setMedDosage] = useState('');
  const [medStart, setMedStart] = useState(new Date().toISOString().split('T')[0]);
  const [medEnd, setMedEnd] = useState('');
  const [medVet, setMedVet] = useState('Dr. D. Oladipo');

  // 4. Vaccine form
  const [vacName, setVacName] = useState('');
  const [vacDate, setVacDate] = useState(new Date().toISOString().split('T')[0]);
  const [vacBatch, setVacBatch] = useState('');
  const [vacNextDue, setVacNextDue] = useState('');

  // 5. Doc/Media form
  const [docTitle, setDocTitle] = useState('');
  const [docType, setDocType] = useState<'report' | 'prescription' | 'lab' | 'certificate' | 'invoice' | 'other'>('report');
  const [docUrl, setDocUrl] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // 6. Expense form
  const [expCategory, setExpCategory] = useState('Veterinary / Health');
  const [expDescription, setExpDescription] = useState('');
  const [expAmount, setExpAmount] = useState<number>(0);

  // 7. Health Status quick update
  const [newHealthStatus, setNewHealthStatus] = useState<'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'>('GOOD');
  const [newConcerns, setNewConcerns] = useState('');
  const [newNextExam, setNewNextExam] = useState('');

  // Fetch all Livestock & Health Records
  useEffect(() => {
    const unsubLivestock = onSnapshot(collection(db, 'livestock'), (snapshot) => {
      const animals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Livestock);
      setLivestockList(animals);
      setLoading(false);
    });

    const unsubHealth = onSnapshot(collection(db, 'livestockHealthRecords'), (snapshot) => {
      const hrList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as HealthRecordSystem);
      setHealthRecords(hrList);
    });

    return () => {
      unsubLivestock();
      unsubHealth();
    };
  }, []);

  // Keep selectedAnimal in sync with livestockList updates in real-time
  useEffect(() => {
    if (selectedAnimal) {
      const latest = livestockList.find(a => a.id === selectedAnimal.id);
      if (latest && (latest.weight !== selectedAnimal.weight || latest.healthStatus !== selectedAnimal.healthStatus || latest.status !== selectedAnimal.status)) {
        setSelectedAnimal(latest);
      }
    }
  }, [livestockList]);

  // When selectedAnimal changes, listen to its specific health data & growth measurements
  useEffect(() => {
    if (!selectedAnimal) {
      setActiveHealthData(null);
      setActiveGrowthRecords([]);
      return;
    }

    const healthRef = doc(db, 'livestockHealthRecords', selectedAnimal.id);
    const unsubH = onSnapshot(healthRef, (docSnap) => {
      if (docSnap.exists()) {
        setActiveHealthData({ ...docSnap.data(), id: docSnap.id } as HealthRecordSystem);
      } else {
        const qHealth = query(
          collection(db, 'livestockHealthRecords'),
          where('livestockId', '==', selectedAnimal.id)
        );
        getDocs(qHealth).then((querySnap) => {
          if (!querySnap.empty) {
            const docs = querySnap.docs.map(d => ({ ...d.data(), id: d.id } as HealthRecordSystem));
            docs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            setActiveHealthData(docs[0]);
          } else {
            setActiveHealthData(null);
          }
        }).catch(() => {
          setActiveHealthData(null);
        });
      }
    });

    const qGrowth = query(
      collection(db, 'livestockGrowthRecords'),
      where('livestockId', '==', selectedAnimal.id)
    );
    const unsubG = onSnapshot(qGrowth, (snapshot) => {
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as GrowthRecord);
      records.sort((a, b) => b.measurementDate - a.measurementDate);
      setActiveGrowthRecords(records);
    });

    return () => {
      unsubH();
      unsubG();
    };
  }, [selectedAnimal]);

  // Real-time Data Inspector audit effect for selected animal
  useEffect(() => {
    if (!selectedAnimal) {
      setInspectorData(null);
      return;
    }
    let isMounted = true;
    setInspectorLoading(true);

    async function runInspector() {
      const report: any = {
        animalId: selectedAnimal.id,
        tagNumber: selectedAnimal.tagNumber,
        timestamp: new Date().toISOString()
      };

      // a) livestock/{id}: ownerId, weight, healthStatus
      try {
        const lSnap = await getDoc(doc(db, 'livestock', selectedAnimal.id));
        report.livestockDoc = {
          exists: lSnap.exists(),
          data: lSnap.exists() ? {
            ownerId: lSnap.data().ownerId || null,
            weight: lSnap.data().weight || null,
            healthStatus: lSnap.data().healthStatus || null,
            status: lSnap.data().status || null
          } : null
        };
      } catch (err: any) {
        report.livestockDoc = {
          exists: false,
          errorCode: err.code || 'unknown',
          errorMessage: err.message
        };
      }

      // b) livestockHealthRecords/{id}
      try {
        const hrSnap = await getDoc(doc(db, 'livestockHealthRecords', selectedAnimal.id));
        if (hrSnap.exists()) {
          const raw = hrSnap.data();
          report.primaryHealthRecord = {
            exists: true,
            hasIdFieldStored: 'id' in raw,
            counts: {
              examinations: raw.examinations?.length || 0,
              medications: raw.medications?.length || 0,
              vaccinations: raw.vaccinations?.length || 0,
              medicalDocuments: raw.medicalDocuments?.length || 0,
              medicalExpenses: raw.medicalExpenses?.length || 0,
              timeline: raw.timeline?.length || 0,
              growthRecords: raw.growthRecords?.length || 0
            }
          };
        } else {
          report.primaryHealthRecord = {
            exists: false
          };
        }
      } catch (err: any) {
        report.primaryHealthRecord = {
          exists: false,
          errorCode: err.code || 'unknown',
          errorMessage: err.message
        };
      }

      // c) ALL docs in livestockHealthRecords where livestockId == id
      try {
        const qHR = query(
          collection(db, 'livestockHealthRecords'),
          where('livestockId', '==', selectedAnimal.id)
        );
        const qHRSnap = await getDocs(qHR);
        report.allHealthRecordsWhereLivestockId = qHRSnap.docs.map(d => ({
          docId: d.id,
          idFieldStored: d.data().id,
          hasIdFieldStored: 'id' in d.data(),
          hasLivestockIdField: 'livestockId' in d.data(),
          livestockIdValue: d.data().livestockId,
          examinationsCount: d.data().examinations?.length || 0,
          timelineCount: d.data().timeline?.length || 0
        }));
      } catch (err: any) {
        report.allHealthRecordsWhereLivestockId = {
          errorCode: err.code || 'unknown',
          errorMessage: err.message
        };
      }

      // d) ALL docs in livestockGrowthRecords where livestockId == id
      try {
        const qGR = query(
          collection(db, 'livestockGrowthRecords'),
          where('livestockId', '==', selectedAnimal.id)
        );
        const qGRSnap = await getDocs(qGR);
        report.allGrowthRecordsWhereLivestockId = qGRSnap.docs.map(d => ({
          docId: d.id,
          status: d.data().status,
          weightKg: d.data().weightKg,
          measurementDate: d.data().measurementDate
        }));
      } catch (err: any) {
        report.allGrowthRecordsWhereLivestockId = {
          errorCode: err.code || 'unknown',
          errorMessage: err.message
        };
      }

      if (isMounted) {
        setInspectorData(report);
        setInspectorLoading(false);
      }
    }

    runInspector();

    return () => {
      isMounted = false;
    };
  }, [selectedAnimal, activeHealthData, activeGrowthRecords]);

  // Filter animals by search and active/history tab
  const activeList = livestockList.filter(a => !isHistoryAnimal(a));
  const historyList = livestockList.filter(a => isHistoryAnimal(a));
  const currentList = listTab === 'active' ? activeList : historyList;
  const filteredLivestock = currentList.filter(a => 
    (a.tagNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.breed || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.id || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper to get or create health record base
  const getOrCreateHealthBase = (): HealthRecordSystem => {
    if (activeHealthData) return {
      ...activeHealthData,
      id: selectedAnimal!.id,
      livestockId: selectedAnimal!.id,
      tagNumber: selectedAnimal!.tagNumber,
      healthStatus: activeHealthData.healthStatus || selectedAnimal!.healthStatus || 'GOOD',
      examinations: Array.isArray(activeHealthData.examinations) ? activeHealthData.examinations : [],
      medications: Array.isArray(activeHealthData.medications) ? activeHealthData.medications : [],
      vaccinations: Array.isArray(activeHealthData.vaccinations) ? activeHealthData.vaccinations : [],
      medicalDocuments: Array.isArray(activeHealthData.medicalDocuments) ? activeHealthData.medicalDocuments : [],
      medicalExpenses: Array.isArray(activeHealthData.medicalExpenses) ? activeHealthData.medicalExpenses : [],
      growthRecords: Array.isArray(activeHealthData.growthRecords) ? activeHealthData.growthRecords : [],
      timeline: Array.isArray(activeHealthData.timeline) ? activeHealthData.timeline : []
    };
    return {
      id: selectedAnimal!.id,
      livestockId: selectedAnimal!.id,
      tagNumber: selectedAnimal!.tagNumber,
      healthStatus: selectedAnimal!.healthStatus || 'GOOD',
      examinations: [],
      medications: [],
      vaccinations: [],
      medicalDocuments: [],
      medicalExpenses: [],
      growthRecords: [],
      timeline: [],
      updatedAt: Date.now()
    };
  };

  const saveHealthRecordUpdate = async (updated: HealthRecordSystem, notifyMsg?: string) => {
    updated.updatedAt = Date.now();
    updated.livestockId = selectedAnimal!.id;
    updated.tagNumber = selectedAnimal!.tagNumber;
    const { id: _, ...dataToSave } = updated;
    const cleanData = removeUndefinedFields(dataToSave);
    try {
      const docRef = doc(db, 'livestockHealthRecords', selectedAnimal!.id);
      await setDoc(docRef, cleanData, { merge: true });

      if (notifyMsg && selectedAnimal?.ownerId) {
        await sendNotification(
          selectedAnimal.ownerId,
          `Health Record Update: ${selectedAnimal.tagNumber}`,
          notifyMsg,
          'Investment Updates'
        );
      }
      setShowAddForm(null);
    } catch (err: any) {
      console.error("Error saving health record:", err);
      alert("Failed to save health record: " + err.message);
    }
  };

  // Media upload handlers using Cloudinary
  const handleUploadGrowthMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !profile) return;
    setGrowthUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res = await uploadToCloudinary(file, profile.uid, 'livestock_growth', false);
        const isVid = file.type.includes('video') || file.name.match(/\.(mp4|mov|webm|avi)$/i);
        setGrowthMedia(prev => [
          ...prev,
          {
            url: res.url,
            publicId: res.publicId,
            type: isVid ? 'video' : 'image',
            caption: file.name
          }
        ]);
      }
    } catch (err: any) {
      console.error(err);
      alert("Upload error: " + err.message);
    } finally {
      setGrowthUploading(false);
    }
  };

  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploadingDoc(true);
    try {
      const res = await uploadToCloudinary(file, profile.uid, 'medical_doc', false);
      setDocUrl(res.url);
    } catch (err: any) {
      console.error(err);
      alert("Upload error: " + err.message);
    } finally {
      setUploadingDoc(false);
    }
  };

  // 1. Save Growth Measurement (Authoritative Synchronizer)
  const handleSaveGrowthMeasurement = async () => {
    if (!selectedAnimal || !profile) return;
    if (!growthWeight || growthWeight <= 0) {
      alert("Please enter a valid measured weight in kg (greater than 0).");
      return;
    }

    try {
      const res = await recordAuthoritativeWeight({
        livestockId: selectedAnimal.id,
        tagNumber: selectedAnimal.tagNumber,
        weightKg: Number(growthWeight),
        measurementDate: new Date(growthDate).getTime(),
        observations: growthBodyCond || 'Optimal muscle & body condition score',
        feedingNotes: growthFeeding || 'Standard formulated feed ration',
        media: growthMedia,
        status: growthPublishStatus,
        authorId: profile.uid,
        authorName: profile.displayName || profile.email || 'Farm Administrator',
        isCorrection: isGrowthCorrection,
        correctionReason: isGrowthCorrection ? (growthCorrectionReason || 'Administrative correction') : undefined,
        targetRecordId: editingGrowthRecordId || undefined
      });

      if (growthPublishStatus === 'published' && selectedAnimal.ownerId) {
        let msg = `New verified weight recorded: ${growthWeight} kg for ${selectedAnimal.tagNumber}.`;
        if (growthMedia.length > 0) msg += ` New photos added.`;
        await sendNotification(
          selectedAnimal.ownerId,
          `Growth Update: ${selectedAnimal.tagNumber}`,
          msg,
          'Investment Updates'
        );
      }

      // Reset
      setGrowthWeight(0);
      setGrowthBodyCond('');
      setGrowthFeeding('');
      setGrowthCorrectionReason('');
      setIsGrowthCorrection(false);
      setEditingGrowthRecordId(null);
      setGrowthMedia([]);
      setShowAddForm(null);
    } catch (err: any) {
      alert("Error saving growth record: " + err.message);
    }
  };


  // 2. Save Exam
  const handleSaveExam = async () => {
    if (!selectedAnimal || !profile) return;
    const base = getOrCreateHealthBase();
    const newId = `exam_${Date.now()}`;
    const examDateMs = new Date(examDate).getTime();
    const followUpMs = examFollowUp ? new Date(examFollowUp).getTime() : undefined;

    const newExam: any = {
      id: newId,
      examDate: examDateMs,
      vetName: examVet,
      examType,
      findings: examFindings || 'Routine clinical checkup normal.',
      diagnosis: examDiagnosis,
      treatment: examTreatment,
      status: 'published'
    };
    if (followUpMs) {
      newExam.followUpDate = followUpMs;
    }
    base.examinations.push(newExam);
    base.lastVetExamDate = examDateMs;
    if (followUpMs) {
      base.nextScheduledExamDate = followUpMs;
    }

    base.timeline.push({
      id: newId,
      date: examDateMs,
      title: `Veterinary Exam: ${examType}`,
      type: 'exam',
      description: examFindings || 'Clinical exam logged.',
      author: examVet
    });

    await saveHealthRecordUpdate(
      base, 
      `Veterinary examination (${examType}) performed by ${examVet} for asset ${selectedAnimal.tagNumber}. Findings: ${examFindings || 'Routine checkup'}.`
    );
    setExamFindings('');
    setExamDiagnosis('');
    setExamTreatment('');
    setExamFollowUp('');
  };

  // 3. Save Med
  const handleSaveMed = async () => {
    if (!selectedAnimal || !profile) return;
    const base = getOrCreateHealthBase();
    const newId = `med_${Date.now()}`;
    const startMs = new Date(medStart).getTime();
    const endMs = medEnd ? new Date(medEnd).getTime() : undefined;

    const newMed: any = {
      id: newId,
      name: medName,
      reason: medReason,
      instructions: medDosage,
      startDate: startMs,
      administeredBy: profile.displayName || 'Farm Veterinarian',
      prescribingVet: medVet,
      status: 'published'
    };
    if (endMs) {
      newMed.endDate = endMs;
    }
    base.medications.push(newMed);
    base.treatmentStatus = `Active: ${medName}`;

    base.timeline.push({
      id: newId,
      date: startMs,
      title: `Medication Administered: ${medName}`,
      type: 'treatment',
      description: `Reason: ${medReason}. Dosage: ${medDosage}`,
      author: medVet
    });

    await saveHealthRecordUpdate(
      base,
      `Medication prescribed (${medName}) by ${medVet} for ${selectedAnimal.tagNumber}. Indication: ${medReason}. Dosage: ${medDosage}.`
    );
    setMedName('');
    setMedReason('');
    setMedDosage('');
  };

  // 4. Save Vaccine
  const handleSaveVaccine = async () => {
    if (!selectedAnimal || !profile) return;
    const base = getOrCreateHealthBase();
    const newId = `vac_${Date.now()}`;
    const vacDateMs = new Date(vacDate).getTime();
    const nextDueMs = vacNextDue ? new Date(vacNextDue).getTime() : undefined;

    const newVac: any = {
      id: newId,
      vaccineName: vacName,
      adminDate: vacDateMs,
      adminBy: profile.displayName || 'Veterinary Health Team',
      batchNumber: vacBatch || `BATCH-${Math.floor(100000 + Math.random() * 900000)}`,
      status: 'published'
    };
    if (nextDueMs) {
      newVac.nextDueDate = nextDueMs;
    }
    base.vaccinations.push(newVac);

    base.timeline.push({
      id: newId,
      date: vacDateMs,
      title: `Vaccine Inoculation: ${vacName}`,
      type: 'vaccination',
      description: `Batch: ${vacBatch || 'Logged'}. Next due: ${vacNextDue || 'Scheduled'}`,
      author: profile.displayName || 'Health Team'
    });

    await saveHealthRecordUpdate(
      base,
      `Vaccine inoculation (${vacName}) administered for ${selectedAnimal.tagNumber}. Batch: ${vacBatch || 'Verified'}.`
    );
    setVacName('');
    setVacBatch('');
    setVacNextDue('');
  };

  // 5. Save Document / Media
  const handleSaveDoc = async () => {
    if (!selectedAnimal || !profile) return;
    const base = getOrCreateHealthBase();
    const newId = `doc_${Date.now()}`;

    base.medicalDocuments.push({
      id: newId,
      title: docTitle || 'Veterinary Document',
      docType,
      url: docUrl,
      uploadedAt: Date.now(),
      status: 'published'
    });

    base.timeline.push({
      id: newId,
      date: Date.now(),
      title: `Document Uploaded: ${docTitle}`,
      type: 'update',
      description: `Type: ${docType}`,
      author: profile.displayName || 'Admin'
    });

    await saveHealthRecordUpdate(base, `New medical document / report (${docTitle || docType}) uploaded and attached to ${selectedAnimal.tagNumber}.`);
    setDocTitle('');
    setDocUrl('');
  };

  // 6. Save Expense
  const handleSaveExpense = async () => {
    if (!selectedAnimal || !profile) return;
    const base = getOrCreateHealthBase();
    const newId = `exp_${Date.now()}`;

    base.medicalExpenses.push({
      id: newId,
      category: expCategory,
      description: expDescription,
      amount: Number(expAmount),
      date: Date.now(),
      paymentStatus: 'CONFIRMED'
    });

    await saveHealthRecordUpdate(base, `New medical expense logged for ${selectedAnimal.tagNumber}: ${expCategory} (${formatCurrency(expAmount)}).`);
    setExpDescription('');
    setExpAmount(0);
  };

  // 7. Save Health Status Overview
  const handleSaveOverviewStatus = async () => {
    if (!selectedAnimal || !profile) return;
    try {
      await syncHealthStatus(
        selectedAnimal.id,
        newHealthStatus,
        profile.displayName || profile.email || 'Farm Administrator',
        newConcerns ? `Observations: ${newConcerns}` : undefined
      );

      const base = getOrCreateHealthBase();
      base.healthStatus = newHealthStatus;
      if (newConcerns) base.outstandingConcerns = newConcerns;
      if (newNextExam) base.nextScheduledExamDate = new Date(newNextExam).getTime();

      base.timeline.unshift({
        id: `status_${Date.now()}`,
        date: Date.now(),
        title: `Health Status Updated to ${newHealthStatus}`,
        type: 'update',
        description: newConcerns ? `Observations: ${newConcerns}` : 'Routine health audit passed.',
        author: profile.displayName || profile.email || 'Admin'
      });

      await saveHealthRecordUpdate(
        base,
        `Health status updated to ${newHealthStatus} for ${selectedAnimal.tagNumber}.${newConcerns ? ' Notes: ' + newConcerns : ''}`
      );

      setSelectedAnimal(prev => prev ? { ...prev, healthStatus: newHealthStatus } : null);
      setShowAddForm(null);
      setNewConcerns('');
      setNewNextExam('');
    } catch (err: any) {
      console.error("Error updating health status:", err);
      alert("Failed to update health status: " + err.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div>
          <PageHeader 
            title="Comprehensive Health Record Manager" 
            subtitle="Centralized management of health overview, growth metrics, veterinary exams, treatments, vaccinations, media & expenses." 
          />
        </div>
        <div className="flex items-center gap-2">
          {canRepair && (
            <Button 
              variant="outline" 
              size="sm" 
              className="text-rose-600 border-rose-200 hover:bg-rose-50"
              onClick={() => {
                setRepairResult(null);
                setRepairError(null);
                setShowRepairModal(true);
              }}
            >
              Repair Health Records
            </Button>
          )}
          <Badge variant="success" className="px-3 py-1 font-bold">
            {healthRecords.length} Active Records
          </Badge>
          <Badge variant="outline" className="px-3 py-1 font-bold">
            {livestockList.length} Total Livestock
          </Badge>
        </div>
      </div>

      {/* Main Two-Column Layout: Animal Selector on Left, Health Management Tabs on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Animal Search & Selection List */}
        <div className="lg:col-span-4 space-y-4">
          <Card title="Select Livestock" icon={Beef} className="p-4">
            <div className="space-y-3">
              <div className="flex bg-slate-100 p-1 rounded-xl mb-3">
                <button
                  type="button"
                  onClick={() => setListTab('active')}
                  className={cn(
                    "flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer",
                    listTab === 'active' ? "bg-emerald-700 text-white shadow" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  Active ({activeList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setListTab('history')}
                  className={cn(
                    "flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer",
                    listTab === 'history' ? "bg-emerald-700 text-white shadow" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  History ({historyList.length})
                </button>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input 
                  placeholder="Search tag number, breed, or ID..." 
                  className="pl-10 text-xs bg-slate-50 border-slate-200"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
                {loading ? (
                  <div className="py-8 text-center text-xs text-slate-400">Loading livestock records...</div>
                ) : filteredLivestock.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">No matching livestock found.</div>
                ) : (
                  filteredLivestock.map(animal => {
                    const isSelected = selectedAnimal?.id === animal.id;
                    const matchedRecord = healthRecords.find(hr => hr.livestockId === animal.id);
                    return (
                      <div
                        key={animal.id}
                        onClick={() => {
                          setSelectedAnimal(animal);
                          setShowAddForm(null);
                        }}
                        className={cn(
                          "p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 text-left",
                          isSelected 
                            ? "bg-emerald-50 border-emerald-300 shadow-sm" 
                            : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/50"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {animal.livestockImageUrl || animal.photos?.[0] ? (
                              <img 
                                src={animal.livestockImageUrl || animal.photos?.[0]} 
                                alt="" 
                                className="w-full h-full object-cover" 
                              />
                            ) : (
                              <Beef className="w-5 h-5 text-slate-300" />
                            )}
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-black text-slate-900 leading-tight truncate">
                              {animal.tagNumber}
                            </p>
                            <p className="text-[10px] text-slate-500 font-medium truncate">
                              {animal.breed} • {animal.weight || 'Weight N/A'}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {(() => {
                            const effectiveStatus = animal.healthStatus || matchedRecord?.healthStatus || 'GOOD';
                            return (
                              <Badge 
                                variant={
                                  effectiveStatus === 'EXCELLENT' ? 'success' :
                                  effectiveStatus === 'GOOD' ? 'success' :
                                  effectiveStatus === 'FAIR' ? 'warning' : 'error'
                                }
                                className="text-[9px] px-2 py-0.5"
                              >
                                {effectiveStatus}
                              </Badge>
                            );
                          })()}
                          <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", isSelected ? "text-emerald-700 translate-x-0.5" : "text-slate-300")} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN: Full Health Record Tabs & Controls */}
        <div className="lg:col-span-8 space-y-6">
          {!selectedAnimal ? (
            <Card className="py-24 text-center border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center space-y-3">
              <HeartPulse className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-700">No Animal Selected</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Select an animal from the left directory to view and manage its complete Health Record, including growth tracking, veterinary visits, medications, vaccines, and media.
              </p>
            </Card>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Selected Animal Profile Banner */}
              <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-slate-950 p-6 rounded-3xl text-white shadow-lg relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1 relative z-10">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                      Tag: {selectedAnimal.tagNumber}
                    </span>
                    <span className="text-xs text-slate-300">
                      Type: {selectedAnimal.type || 'COW'} • {selectedAnimal.breed}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    {selectedAnimal.breed} ({selectedAnimal.tagNumber})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Location: <span className="text-white font-medium">{selectedAnimal.farm || 'Main Ranch'}</span> • Status: <span className="text-emerald-400 font-bold">{selectedAnimal.status}</span>
                  </p>
                </div>

                <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10 relative z-10">
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-300 block">Health Rating</span>
                    <p className="text-lg font-black text-white">
                      {selectedAnimal.healthStatus || activeHealthData?.healthStatus || 'GOOD'}
                    </p>
                  </div>
                  <div className="pl-4 border-l border-white/20">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-300 block">Current Weight</span>
                    <p className="text-lg font-black text-white">
                      {selectedAnimal.weight ? formatWeight(selectedAnimal.weight) : activeGrowthRecords[0]?.weightKg ? `${activeGrowthRecords[0].weightKg} kg` : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Navigation Tabs (All Subsections of Health Record) */}
              <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200 overflow-x-auto gap-1">
                {[
                  { id: 'overview', label: 'Health Overview', icon: HeartPulse },
                  { id: 'growth', label: `Growth & Dev (${activeGrowthRecords.length})`, icon: TrendingUp },
                  { id: 'vet', label: `Vet Care (${activeHealthData?.examinations?.length || 0})`, icon: Stethoscope },
                  { id: 'meds', label: `Meds & Rx (${activeHealthData?.medications?.length || 0})`, icon: Pill },
                  { id: 'vaccines', label: `Vaccines (${activeHealthData?.vaccinations?.length || 0})`, icon: Syringe },
                  { id: 'timeline', label: 'Timeline History', icon: Clock }
                ].map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id as TabKey);
                        setShowAddForm(null);
                      }}
                      className={cn(
                        "px-3.5 py-2 text-[10px] uppercase tracking-wider font-bold rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer",
                        isActive 
                          ? "bg-emerald-700 text-white shadow-sm" 
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* SUBSECTION A: HEALTH OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-800">Health Status & Clinical Parameters</span>
                    <Button 
                      size="sm" 
                      onClick={() => setShowAddForm(showAddForm === 'status' ? null : 'status')}
                      className="gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Update Health Status
                    </Button>
                  </div>

                  {showAddForm === 'status' && (
                    <Card title="Update Health Status & Clinical Notes" className="bg-emerald-50/30 border-emerald-200">
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Select 
                            label="Health Rating" 
                            value={newHealthStatus} 
                            onChange={e => setNewHealthStatus(e.target.value as any)}
                          >
                            <option value="EXCELLENT">EXCELLENT - Optimal vitality, clear eyes, high activity</option>
                            <option value="GOOD">GOOD - Healthy, normal grazing, standard vitality</option>
                            <option value="FAIR">FAIR - Under observation, minor fatigue or stress</option>
                            <option value="POOR">POOR - Requires clinical intervention & immediate vet attention</option>
                          </Select>
                          <Input 
                            label="Next Scheduled Routine Exam" 
                            type="date" 
                            value={newNextExam} 
                            onChange={e => setNewNextExam(e.target.value)} 
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Clinical Observations & Outstanding Concerns
                          </label>
                          <textarea 
                            rows={3} 
                            className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-900"
                            placeholder="Note any symptoms, appetite changes, locomotion observations..." 
                            value={newConcerns}
                            onChange={e => setNewConcerns(e.target.value)}
                          />
                        </div>

                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setShowAddForm(null)}>Cancel</Button>
                          <Button size="sm" onClick={handleSaveOverviewStatus}>Save Status Update</Button>
                        </div>
                      </div>
                    </Card>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card title="Current Vitals Summary" icon={HeartPulse}>
                      <div className="space-y-3 text-xs">
                        <div className="flex justify-between py-2 border-b border-slate-100">
                          <span className="text-slate-400 font-medium">Recorded Health Status</span>
                          <span className={cn("font-bold", (selectedAnimal.healthStatus || activeHealthData?.healthStatus) === 'POOR' ? 'text-rose-600' : 'text-emerald-700')}>
                            {selectedAnimal.healthStatus || activeHealthData?.healthStatus || 'GOOD'}
                          </span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-slate-100">
                          <span className="text-slate-400 font-medium">Last Veterinary Examination</span>
                          <span className="font-semibold text-slate-900">
                            {activeHealthData?.lastVetExamDate ? formatDate(activeHealthData.lastVetExamDate) : 'Routine checks active'}
                          </span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-slate-100">
                          <span className="text-slate-400 font-medium">Next Scheduled Exam</span>
                          <span className="font-semibold text-slate-900">
                            {activeHealthData?.nextScheduledExamDate ? formatDate(activeHealthData.nextScheduledExamDate) : 'Bi-weekly routine cycle'}
                          </span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-slate-100">
                          <span className="text-slate-400 font-medium">Active Treatment Status</span>
                          <span className="font-semibold text-slate-900">
                            {activeHealthData?.treatmentStatus || 'No active treatments'}
                          </span>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-slate-400 font-medium">Last Master Update</span>
                          <span className="font-semibold text-slate-900">
                            {activeHealthData?.updatedAt ? formatDate(activeHealthData.updatedAt) : formatDate(selectedAnimal.purchaseDate)}
                          </span>
                        </div>
                      </div>
                    </Card>

                    <Card title="Biosecurity & Outstanding Concerns" icon={ShieldCheck}>
                      <div className="space-y-4 text-xs">
                        <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Outstanding Concerns / Watchlist Notes
                          </span>
                          <p className="text-slate-800 font-medium">
                            {activeHealthData?.outstandingConcerns || 'No active clinical concerns. Animal is cleared for standard feeding and herd integration.'}
                          </p>
                        </div>
                        <div className="p-3 bg-emerald-50 rounded-xl text-emerald-900 space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                            Herd Quarantine & Vaccine Protocol
                          </span>
                          <p className="text-[11px] leading-relaxed">
                            Full compliance verified. Standard tick-borne prophylactic dip and multivitamin injections completed during arrival onboarding.
                          </p>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              )}

              {/* SUBSECTION B: GROWTH & DEVELOPMENT */}
              {activeTab === 'growth' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Growth Tracking & Weight Trajectory</span>
                      <span className="text-[10px] text-slate-400">
                        Historical weight logs, automated gain calculus, body-condition scores & media
                      </span>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => setShowAddForm(showAddForm === 'growth' ? null : 'growth')}
                      className="gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Record Growth Measurement
                    </Button>
                  </div>

                  {showAddForm === 'growth' && (
                    <Card title="Record New Growth Measurement" className="bg-emerald-50/20 border-emerald-200">
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Input 
                            label="Measurement Date" 
                            type="date" 
                            value={growthDate} 
                            onChange={e => setGrowthDate(e.target.value)} 
                          />
                          <Input 
                            label="Actual Measured Weight (kg)" 
                            type="number" 
                            placeholder="e.g. 420" 
                            value={growthWeight || ''} 
                            onChange={e => setGrowthWeight(parseFloat(e.target.value) || 0)} 
                          />
                        </div>

                        {isGrowthCorrection && (
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                              Audited Correction Reason
                            </label>
                            <input 
                              className="w-full bg-white border border-amber-300 rounded-xl p-2.5 text-xs text-slate-900"
                              placeholder="e.g. Scale recalibration adjustment or clerical correction..."
                              value={growthCorrectionReason}
                              onChange={e => setGrowthCorrectionReason(e.target.value)}
                            />
                          </div>
                        )}

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Body-Condition Score & Muscling Observations
                          </label>
                          <textarea 
                            rows={2}
                            className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs"
                            placeholder="Describe coat shine, rib cage fat cover, frame development..."
                            value={growthBodyCond}
                            onChange={e => setGrowthBodyCond(e.target.value)}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Feeding, Forage & Nutrition Notes
                          </label>
                          <textarea 
                            rows={2}
                            className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs"
                            placeholder="Feed intake, concentrate ration, silage quality, mineral block lick..."
                            value={growthFeeding}
                            onChange={e => setGrowthFeeding(e.target.value)}
                          />
                        </div>

                        <div className="space-y-2 pt-2 border-t border-slate-200">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Attach Growth Progress Photos & Videos
                          </label>
                          <div className="flex items-center gap-3">
                            <input 
                              type="file" 
                              multiple 
                              accept="image/*,video/*" 
                              onChange={handleUploadGrowthMedia}
                              className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-emerald-50 file:text-emerald-700" 
                            />
                            {growthUploading && <span className="text-xs text-emerald-600 animate-pulse font-bold">Uploading...</span>}
                          </div>

                          {growthMedia.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                              {growthMedia.map((m, idx) => (
                                <div key={idx} className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 aspect-square">
                                  {m.type === 'video' ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white p-2">
                                      <Video className="w-5 h-5 text-emerald-400 mb-1" />
                                      <span className="text-[8px] truncate">{m.caption}</span>
                                    </div>
                                  ) : (
                                    <img src={m.url} alt="" className="w-full h-full object-cover" />
                                  )}
                                  <button 
                                    onClick={() => setGrowthMedia(growthMedia.filter((_, i) => i !== idx))} 
                                    className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-md"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                          <Select 
                            className="w-44 text-xs" 
                            value={growthPublishStatus} 
                            onChange={e => setGrowthPublishStatus(e.target.value as any)}
                          >
                            <option value="published">Publish to Investor</option>
                            <option value="draft">Save as Internal Draft</option>
                          </Select>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setShowAddForm(null)}>Cancel</Button>
                            <Button size="sm" onClick={handleSaveGrowthMeasurement}>Save Growth Record</Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Growth History List */}
                  <div className="space-y-4">
                    {activeGrowthRecords.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
                        No growth measurements recorded yet for this asset. Click "Record Growth Measurement" to add the first verified weight log.
                      </div>
                    ) : (
                      activeGrowthRecords.map((rec, index) => (
                        <div key={rec.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-sm font-bold text-slate-900">
                                Measured Weight: <span className="text-emerald-700 text-base">{rec.weightKg} kg</span>
                              </h4>
                              <p className="text-[11px] text-slate-500">
                                Date: {formatDate(rec.measurementDate)} • Log #{activeGrowthRecords.length - index}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {rec.weightGain !== undefined && (
                                <Badge variant={rec.weightGain >= 0 ? 'success' : 'error'}>
                                  {rec.weightGain >= 0 ? `+${rec.weightGain} kg` : `${rec.weightGain} kg`}
                                </Badge>
                              )}
                              <Badge variant={rec.status === 'published' ? 'success' : 'warning'}>
                                {rec.status}
                              </Badge>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 text-slate-600"
                                title="Correct this measurement"
                                onClick={() => {
                                  setIsGrowthCorrection(true);
                                  setEditingGrowthRecordId(rec.id);
                                  setGrowthWeight(rec.weightKg);
                                  setGrowthDate(new Date(rec.measurementDate).toISOString().split('T')[0]);
                                  setGrowthBodyCond(rec.bodyCondition || '');
                                  setGrowthFeeding(rec.feedingNotes || '');
                                  setGrowthCorrectionReason((rec as any).correctionReason || '');
                                  setGrowthMedia((rec.media || []).map(m => ({
                                    url: m.url,
                                    publicId: m.publicId,
                                    type: m.type,
                                    caption: m.caption
                                  })));
                                  setShowAddForm('growth');
                                }}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>

                          {(rec as any).isCorrected && (
                            <div className="p-2.5 bg-amber-50 rounded-xl text-amber-900 text-xs border border-amber-200">
                              <span className="font-bold">Correction Note:</span> {(rec as any).correctionReason || 'Audited weight correction'} 
                              <span className="text-slate-400 block text-[10px]">Adjusted by {(rec as any).correctedBy || rec.authorName}</span>
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Body Condition</span>
                              <p className="text-slate-800 font-medium">{rec.bodyCondition}</p>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Feeding & Ration</span>
                              <p className="text-slate-800 font-medium">{rec.feedingNotes}</p>
                            </div>
                          </div>

                          {rec.media && rec.media.length > 0 && (
                            <div className="space-y-1 pt-1">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                                <ImageIcon className="w-3 h-3 text-emerald-600" /> Evidence Photos & Videos ({rec.media.length})
                              </span>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {rec.media.map((m, mIdx) => (
                                  <a key={mIdx} href={m.url} target="_blank" rel="noopener noreferrer" className="relative rounded-xl overflow-hidden border border-slate-200 aspect-square group block">
                                    {m.type === 'video' ? (
                                      <div className="w-full h-full bg-slate-900 flex items-center justify-center text-white">
                                        <Play className="w-6 h-6 text-emerald-400" />
                                      </div>
                                    ) : (
                                      <img src={m.url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                    )}
                                    <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] p-1 truncate">
                                      {m.caption || 'Media file'}
                                    </span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* SUBSECTION C: VETERINARY CARE */}
              {activeTab === 'vet' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-800">Veterinary Clinical Examinations</span>
                    <Button 
                      size="sm" 
                      onClick={() => setShowAddForm(showAddForm === 'exam' ? null : 'exam')}
                      className="gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Record Vet Examination
                    </Button>
                  </div>

                  {showAddForm === 'exam' && (
                    <Card title="Log Veterinary Clinical Examination" className="bg-emerald-50/20 border-emerald-200">
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Input label="Examination Date" type="date" value={examDate} onChange={e => setExamDate(e.target.value)} />
                          <Input label="Veterinarian Name" value={examVet} onChange={e => setExamVet(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Input label="Exam Type" value={examType} onChange={e => setExamType(e.target.value)} placeholder="Routine / Biosecurity / Emergency" />
                          <Input label="Follow-Up Appointment Date" type="date" value={examFollowUp} onChange={e => setExamFollowUp(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Documented Findings</label>
                          <textarea rows={2} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs" placeholder="Clinical findings..." value={examFindings} onChange={e => setExamFindings(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Input label="Diagnosis" value={examDiagnosis} onChange={e => setExamDiagnosis(e.target.value)} placeholder="Diagnosis if documented" />
                          <Input label="Recommended Treatment" value={examTreatment} onChange={e => setExamTreatment(e.target.value)} placeholder="Treatment plan" />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setShowAddForm(null)}>Cancel</Button>
                          <Button size="sm" onClick={handleSaveExam}>Save Exam</Button>
                        </div>
                      </div>
                    </Card>
                  )}

                  <div className="space-y-4">
                    {!activeHealthData?.examinations || activeHealthData.examinations.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
                        No veterinary clinical exams recorded yet.
                      </div>
                    ) : (
                      activeHealthData.examinations.map(exam => (
                        <div key={exam.id} className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2 text-xs">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-sm font-bold text-slate-900">{exam.examType}</h4>
                              <p className="text-[11px] text-slate-500">By {exam.vetName} on {formatDate(exam.examDate)}</p>
                            </div>
                            <Badge variant="success">Published</Badge>
                          </div>
                          <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Findings</span>
                            <p className="text-slate-800 font-medium">{exam.findings}</p>
                          </div>
                          {exam.diagnosis && <p className="text-slate-900 font-bold">Diagnosis: {exam.diagnosis}</p>}
                          {exam.treatment && <p className="text-emerald-700 font-bold">Treatment Plan: {exam.treatment}</p>}
                          {exam.followUpDate && <p className="text-amber-700 font-medium">Follow-Up Date: {formatDate(exam.followUpDate)}</p>}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* SUBSECTION D: MEDICATION & TREATMENT */}
              {activeTab === 'meds' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-800">Medications, Prescriptions & Protocols</span>
                    <Button 
                      size="sm" 
                      onClick={() => setShowAddForm(showAddForm === 'med' ? null : 'med')}
                      className="gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Prescribe Treatment
                    </Button>
                  </div>

                  {showAddForm === 'med' && (
                    <Card title="Prescribe Medication & Treatment" className="bg-emerald-50/20 border-emerald-200">
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Input label="Medication / Drug Name" value={medName} onChange={e => setMedName(e.target.value)} placeholder="e.g. Oxytetracycline LA" />
                          <Input label="Reason / Indication" value={medReason} onChange={e => setMedReason(e.target.value)} placeholder="Respiratory prophylaxis" />
                        </div>
                        <Input label="Dosage & Instructions" value={medDosage} onChange={e => setMedDosage(e.target.value)} placeholder="10ml IM single injection" />
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <Input label="Start Date" type="date" value={medStart} onChange={e => setMedStart(e.target.value)} />
                          <Input label="End Date" type="date" value={medEnd} onChange={e => setMedEnd(e.target.value)} />
                          <Input label="Prescribing Vet" value={medVet} onChange={e => setMedVet(e.target.value)} />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setShowAddForm(null)}>Cancel</Button>
                          <Button size="sm" onClick={handleSaveMed}>Save Treatment</Button>
                        </div>
                      </div>
                    </Card>
                  )}

                  <div className="space-y-4">
                    {!activeHealthData?.medications || activeHealthData.medications.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
                        No active or past medications logged for this asset.
                      </div>
                    ) : (
                      activeHealthData.medications.map(med => (
                        <div key={med.id} className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2 text-xs">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-sm font-bold text-slate-900">{med.name}</h4>
                              <p className="text-[11px] text-slate-500">Prescribed by {med.prescribingVet} • Started {formatDate(med.startDate)}</p>
                            </div>
                            <Badge variant="info">Active Protocol</Badge>
                          </div>
                          <p className="text-slate-800 font-bold">Reason: {med.reason}</p>
                          <p className="text-slate-600 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100">
                            Instructions: {med.instructions}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* SUBSECTION E: VACCINATION & PREVENTIVE CARE */}
              {activeTab === 'vaccines' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-800">Vaccinations & Herd Immunization</span>
                    <Button 
                      size="sm" 
                      onClick={() => setShowAddForm(showAddForm === 'vaccine' ? null : 'vaccine')}
                      className="gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Record Vaccination
                    </Button>
                  </div>

                  {showAddForm === 'vaccine' && (
                    <Card title="Record Vaccine Inoculation" className="bg-emerald-50/20 border-emerald-200">
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Input label="Vaccine Name" value={vacName} onChange={e => setVacName(e.target.value)} placeholder="CBPP / FMD Vaccine" />
                          <Input label="Date Administered" type="date" value={vacDate} onChange={e => setVacDate(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Input label="Batch Number" value={vacBatch} onChange={e => setVacBatch(e.target.value)} placeholder="BATCH-994821" />
                          <Input label="Next Due Date" type="date" value={vacNextDue} onChange={e => setVacNextDue(e.target.value)} />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setShowAddForm(null)}>Cancel</Button>
                          <Button size="sm" onClick={handleSaveVaccine}>Save Vaccination</Button>
                        </div>
                      </div>
                    </Card>
                  )}

                  <div className="space-y-4">
                    {!activeHealthData?.vaccinations || activeHealthData.vaccinations.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
                        No vaccination records logged yet for this asset.
                      </div>
                    ) : (
                      activeHealthData.vaccinations.map(vac => (
                        <div key={vac.id} className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2 text-xs">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-sm font-bold text-slate-900">{vac.vaccineName}</h4>
                              <p className="text-[11px] text-slate-500">Administered on {formatDate(vac.adminDate)} • Batch: {vac.batchNumber}</p>
                            </div>
                            <Badge variant="success">Completed</Badge>
                          </div>
                          {vac.nextDueDate && (
                            <p className="text-amber-700 font-semibold">
                              Next Scheduled Booster: {formatDate(vac.nextDueDate)}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* SUBSECTION F: PHOTOS, VIDEOS & DOCUMENTS */}
              {activeTab === 'media' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-800">Medical Reports, Lab Results & Media Evidence</span>
                    <Button 
                      size="sm" 
                      onClick={() => setShowAddForm(showAddForm === 'doc' ? null : 'doc')}
                      className="gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Upload Document
                    </Button>
                  </div>

                  {showAddForm === 'doc' && (
                    <Card title="Upload Supporting Medical Document / Report" className="bg-emerald-50/20 border-emerald-200">
                      <div className="space-y-4">
                        <Input label="Document Title" value={docTitle} onChange={e => setDocTitle(e.target.value)} placeholder="e.g. Lab Serology Report 2026" />
                        <Select label="Document Category" value={docType} onChange={e => setDocType(e.target.value as any)}>
                          <option value="report">Veterinary Inspection Report</option>
                          <option value="prescription">Official Prescription</option>
                          <option value="lab">Laboratory Analysis</option>
                          <option value="certificate">Vaccination Certificate</option>
                          <option value="invoice">Medical Expense Invoice</option>
                          <option value="other">Other Document</option>
                        </Select>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Upload File (Cloudinary)</label>
                          <input type="file" onChange={handleUploadDoc} className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-emerald-50 file:text-emerald-700" />
                          {uploadingDoc && <p className="text-xs text-emerald-600 animate-pulse font-bold">Uploading document...</p>}
                          {docUrl && <p className="text-xs text-emerald-600 font-bold">Document uploaded successfully!</p>}
                        </div>

                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setShowAddForm(null)}>Cancel</Button>
                          <Button size="sm" disabled={!docUrl} onClick={handleSaveDoc}>Save Document</Button>
                        </div>
                      </div>
                    </Card>
                  )}

                  <div className="space-y-4">
                    {!activeHealthData?.medicalDocuments || activeHealthData.medicalDocuments.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
                        No medical documents uploaded yet.
                      </div>
                    ) : (
                      activeHealthData.medicalDocuments.map(docItem => (
                        <div key={docItem.id} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between text-xs">
                          <div>
                            <h4 className="font-bold text-slate-900">{docItem.title}</h4>
                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                              {docItem.docType} • Uploaded {formatDate(docItem.uploadedAt)}
                            </p>
                          </div>
                          <a 
                            href={docItem.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-emerald-50 text-emerald-700 font-semibold rounded-xl hover:bg-emerald-100 transition-colors"
                          >
                            View Document
                          </a>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* SUBSECTION G: MEDICAL EXPENSES */}
              {activeTab === 'expenses' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-800">Veterinary & Medical Expenses Ledger</span>
                    <Button 
                      size="sm" 
                      onClick={() => setShowAddForm(showAddForm === 'expense' ? null : 'expense')}
                      className="gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Log Medical Expense
                    </Button>
                  </div>

                  {showAddForm === 'expense' && (
                    <Card title="Log Veterinary Expense" className="bg-emerald-50/20 border-emerald-200">
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Input label="Category" value={expCategory} onChange={e => setExpCategory(e.target.value)} />
                          <Input label="Amount (₦)" type="number" value={expAmount || ''} onChange={e => setExpAmount(parseFloat(e.target.value) || 0)} placeholder="15000" />
                        </div>
                        <Input label="Description" value={expDescription} onChange={e => setExpDescription(e.target.value)} placeholder="Antibiotics, clinical consultation..." />
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setShowAddForm(null)}>Cancel</Button>
                          <Button size="sm" onClick={handleSaveExpense}>Save Expense</Button>
                        </div>
                      </div>
                    </Card>
                  )}

                  <div className="space-y-4">
                    {!activeHealthData?.medicalExpenses || activeHealthData.medicalExpenses.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
                        No veterinary expenses logged yet for this asset.
                      </div>
                    ) : (
                      activeHealthData.medicalExpenses.map(exp => (
                        <div key={exp.id} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between text-xs">
                          <div>
                            <h4 className="font-bold text-slate-900">{exp.category}</h4>
                            <p className="text-[11px] text-slate-500">{exp.description} • {formatDate(exp.date)}</p>
                          </div>
                          <span className="text-sm font-black text-slate-900">{formatCurrency(exp.amount)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* SUBSECTION H: HEALTH HISTORY TIMELINE */}
              {activeTab === 'timeline' && (
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-800 block">Unified Chronological Health & Growth Timeline</span>
                    <span className="text-[10px] text-slate-400">Complete audit trail of examinations, inoculations, treatments, growth logs & milestones</span>
                  </div>

                  {!activeHealthData?.timeline || activeHealthData.timeline.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
                      No timeline events recorded yet.
                    </div>
                  ) : (
                    <div className="space-y-4 pl-4 border-l-2 border-emerald-600/30">
                      {activeHealthData.timeline
                        .slice()
                        .sort((a, b) => b.date - a.date)
                        .map(item => (
                          <div key={item.id} className="relative pl-6 space-y-1">
                            <div className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full bg-emerald-600 border-2 border-white shadow-sm" />
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">{formatDate(item.date)}</span>
                            <h4 className="text-sm font-black text-slate-900">{item.title}</h4>
                            <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
                            <span className="text-[9px] text-slate-400 font-bold block">Logged by: {item.author}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* SUBSECTION I: DATA INSPECTOR PANEL (ADMIN ONLY) */}
              <div className="mt-8 pt-6 border-t border-slate-200">
                <Card className="bg-slate-900 border-slate-800 text-slate-100 p-6 rounded-2xl shadow-xl">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <h4 className="text-sm font-bold uppercase tracking-wider text-emerald-400">Data Inspector (Admin Only)</h4>
                      <Badge variant="neutral" className="bg-slate-800 text-slate-300 border-slate-700 text-[10px]">
                        Tag: {selectedAnimal.tagNumber}
                      </Badge>
                    </div>
                    {inspectorLoading && <span className="text-xs text-slate-400">Refreshing inspector...</span>}
                  </div>
                  <p className="text-xs text-slate-400 mb-3">
                    Direct live audit of Firestore documents: checks document existence, internal 'id' field presence, counts, and duplicates.
                  </p>
                  <pre className="bg-slate-950 p-4 rounded-xl text-xs text-emerald-400 font-mono overflow-auto max-h-96 border border-slate-800">
                    {inspectorData ? JSON.stringify(inspectorData, null, 2) : "Loading inspection data..."}
                  </pre>
                </Card>
              </div>

            </div>
          )}
        </div>

      </div>

      <Modal
        isOpen={showRepairModal}
        onClose={() => !repairing && setShowRepairModal(false)}
        title="Repair Health Records"
        subtitle="Data integrity audit and reconciliation"
      >
        <div className="space-y-6">
          {!repairResult ? (
            <div className="space-y-4">
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                This will merge duplicate health records, create any missing ones, and remove stray id fields. No records are deleted except duplicates after their data is merged.
              </p>
              {repairError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                  {repairError}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowRepairModal(false)}
                  disabled={repairing}
                >
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  isLoading={repairing}
                  onClick={async () => {
                    setRepairing(true);
                    setRepairError(null);
                    try {
                      const res = await repairHealthRecords();
                      setRepairResult(res);
                    } catch (err: any) {
                      setRepairError(err.message || 'Repair failed unexpectedly.');
                    } finally {
                      setRepairing(false);
                    }
                  }}
                >
                  {repairing ? 'Repairing...' : 'Run Repair'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
                <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Repair Completed Successfully</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-1">
                  <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-xs">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Created</span>
                    <span className="text-lg font-black text-emerald-700">{repairResult.created}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-xs">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Merged</span>
                    <span className="text-lg font-black text-emerald-700">{repairResult.merged}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-xs">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Duplicates Deleted</span>
                    <span className="text-lg font-black text-emerald-700">{repairResult.duplicatesDeleted}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-xs">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">ID Fields Cleaned</span>
                    <span className="text-lg font-black text-emerald-700">{repairResult.idFieldsCleaned}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-xs">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Skipped</span>
                    <span className="text-lg font-black text-amber-700">{repairResult.skipped}</span>
                  </div>
                </div>
              </div>

              {repairResult.errors.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">Errors Encountered ({repairResult.errors.length})</span>
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                    {repairResult.errors.map((err, idx) => (
                      <div key={idx} className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1">
                        <div className="flex items-center justify-between text-rose-900 font-bold">
                          <span>Target ID: {err.id}</span>
                          <span className="text-[10px] bg-rose-200 text-rose-800 px-2 py-0.5 rounded">{err.code}</span>
                        </div>
                        <p className="text-rose-700 font-medium">{err.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button 
                  size="sm" 
                  onClick={() => setShowRepairModal(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
