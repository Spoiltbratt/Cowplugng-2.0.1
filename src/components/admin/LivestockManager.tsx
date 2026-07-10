import React, { useState, useEffect } from 'react';
import { 
  Beef, Search, Plus, Filter, Edit, Trash2, 
  Tag, Activity, Heart, Thermometer, User, MapPin,
  ExternalLink, ChevronRight, Save, X, Camera,
  MoreVertical, Eye, Archive, UserPlus, UserMinus,
  RefreshCw, AlertTriangle, CheckCircle2, Calendar,
  DollarSign, ClipboardList, Info, History
} from 'lucide-react';
import { db, sendNotification } from '../../lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, addDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { Livestock, LivestockStatus, UserProfile, UserRole } from '../../types';
import { Card, Button, Badge, Input } from '../UI';
import { cn, formatDate, formatCurrency } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../lib/AuthContext';

const PRESET_ANIMAL_PHOTOS = [
  { name: 'Brown Cow', url: 'https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?auto=format&fit=crop&w=800&q=80' },
  { name: 'White Calf', url: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=80' },
  { name: 'White Fulani', url: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?auto=format&fit=crop&w=800&q=80' },
  { name: 'Majestic Bull', url: 'https://images.unsplash.com/photo-1551085254-e96b210db58a?auto=format&fit=crop&w=800&q=80' },
  { name: 'Sheep/Ram', url: 'https://images.unsplash.com/photo-1484557985045-edf25e08da73?auto=format&fit=crop&w=800&q=80' }
];

export const LivestockManager: React.FC = () => {
  const { profile } = useAuth();
  const [livestock, setLivestock] = useState<Livestock[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAnimal, setSelectedAnimal] = useState<Livestock | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [investors, setInvestors] = useState<UserProfile[]>([]);
  const [custodians, setCustodians] = useState<UserProfile[]>([]);
  
  // Actions Menu & Modals State
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  
  // Edit Modal State
  const [isEditing, setIsEditing] = useState(false);
  const [editingAnimal, setEditingAnimal] = useState<Livestock | null>(null);
  const [editFields, setEditFields] = useState({
    tagNumber: '',
    breed: '',
    type: 'COW',
    gender: 'M' as 'M' | 'F',
    weight: '',
    age: '',
    farm: '',
    purchasePrice: 0,
    investmentPackage: 'Standard',
    healthStatus: 'GOOD' as 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR',
    ownerId: '',
    custodianId: '',
    feedSchedule: '',
    growthProgress: '',
    photoUrl: ''
  });

  // Status Change Modal State
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [statusChangeAnimal, setStatusChangeAnimal] = useState<Livestock | null>(null);
  const [newStatus, setNewStatus] = useState<LivestockStatus>(LivestockStatus.ACTIVE);
  const [statusDate, setStatusDate] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [statusNotes, setStatusNotes] = useState('');

  // Assign Modal State
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignAnimal, setAssignAnimal] = useState<Livestock | null>(null);
  const [assignOwnerId, setAssignOwnerId] = useState('');
  const [assignCustodianId, setAssignCustodianId] = useState('');

  const isSuperAdmin = profile?.role === UserRole.SUPER_ADMIN;

  const [viewHistory, setViewHistory] = useState(false);

  useEffect(() => {
    const unsubscribeLivestock = onSnapshot(query(collection(db, 'livestock')), (snapshot) => {
      setLivestock(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Livestock));
      setLoading(false);
    });

    const unsubscribeUsers = onSnapshot(query(collection(db, 'users')), (snapshot) => {
      const users = snapshot.docs.map(doc => doc.data() as UserProfile);
      setInvestors(users.filter(u => u.role === UserRole.INVESTOR));
      setCustodians(users.filter(u => u.role === UserRole.CUSTODIAN));
    });

    return () => {
      unsubscribeLivestock();
      unsubscribeUsers();
    };
  }, []);

  const filteredLivestock = livestock.filter(animal => 
    (
      viewHistory ? 
      (animal.status === LivestockStatus.DELIVERED || animal.status === LivestockStatus.DECEASED || animal.status === LivestockStatus.TRANSFERRED || animal.status === LivestockStatus.ARCHIVED || animal.status === LivestockStatus.SOLD) :
      (animal.status !== LivestockStatus.DELIVERED && animal.status !== LivestockStatus.DECEASED && animal.status !== LivestockStatus.TRANSFERRED && animal.status !== LivestockStatus.ARCHIVED && animal.status !== LivestockStatus.SOLD)
    ) &&
    (
      animal.tagNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      animal.breed.toLowerCase().includes(searchTerm.toLowerCase()) ||
      animal.ownerId.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // Quick Inline Status Update (from original sidebar buttons)
  const handleUpdateStatusDirect = async (id: string, status: LivestockStatus) => {
    const animal = livestock.find(a => a.id === id);
    if (!animal) return;
    
    try {
      await updateDoc(doc(db, 'livestock', id), { 
        status: status,
        statusChangeDate: Date.now(),
        statusChangeReason: 'Direct action update from Administrator Console',
        statusChangeNotes: 'Status changed quickly via dashboard sidebar action button.',
        statusChangeAdminId: profile?.uid || 'unknown',
        statusChangeAdminName: profile?.displayName || profile?.email || 'Admin',
        lastUpdated: Date.now()
      });

      // Notification to investor
      if (animal.ownerId) {
        await sendNotification(
          animal.ownerId,
          `Livestock Status Changed: ${animal.tagNumber}`,
          `Your animal (${animal.breed} - ${animal.tagNumber}) has been updated to ${status}.`,
          'Investment Updates',
          'INFO'
        );
      }

      // Activity Log
      await addDoc(collection(db, 'activityLogs'), {
        adminId: profile?.uid || 'unknown',
        adminName: profile?.displayName || profile?.email || 'Admin',
        action: 'LIVESTOCK_STATUS_CHANGE',
        targetId: id,
        targetType: 'LIVESTOCK',
        newValue: { status: status, reason: 'Direct change' },
        timestamp: Date.now()
      });

      // Update selectedAnimal state if open
      if (selectedAnimal?.id === id) {
        setSelectedAnimal({
          ...selectedAnimal,
          status,
          statusChangeDate: Date.now(),
          statusChangeReason: 'Direct action update from Administrator Console',
          statusChangeNotes: 'Status changed quickly via dashboard sidebar action button.',
          statusChangeAdminId: profile?.uid || 'unknown',
          statusChangeAdminName: profile?.displayName || profile?.email || 'Admin'
        });
      }
    } catch (err: any) {
      alert("Error updating status: " + err.message);
    }
  };

  const [newLivestock, setNewLivestock] = useState<Partial<Livestock>>({
    breed: 'White Fulani',
    gender: 'M',
    weight: '350kg',
    age: '2.5 years',
    farm: 'Oyo Farm',
    healthStatus: 'GOOD',
    status: LivestockStatus.AVAILABLE,
    investmentPackage: 'Standard',
    photos: []
  });

  const handleAddLivestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLivestock.tagNumber) {
      alert('Tag number is required');
      return;
    }
    
    try {
      await addDoc(collection(db, 'livestock'), {
        ...newLivestock,
        type: newLivestock.type || 'COW',
        purchasePrice: Number((newLivestock as any).purchasePrice) || 500000,
        createdAt: Date.now(),
        lastUpdated: Date.now(),
        photos: newLivestock.photos || []
      });
      
      // Activity log
      await addDoc(collection(db, 'activityLogs'), {
        adminId: profile?.uid || 'unknown',
        adminName: profile?.displayName || profile?.email || 'Admin',
        action: 'LIVESTOCK_CREATE',
        targetId: newLivestock.tagNumber,
        targetType: 'LIVESTOCK',
        newValue: { breed: newLivestock.breed, tagNumber: newLivestock.tagNumber },
        timestamp: Date.now()
      });

      setIsAdding(false);
      setNewLivestock({
        breed: 'White Fulani',
        gender: 'M',
        weight: '350kg',
        age: '2.5 years',
        farm: 'Oyo Farm',
        healthStatus: 'GOOD',
        status: LivestockStatus.AVAILABLE,
        investmentPackage: 'Standard',
        photos: []
      });
    } catch (err: any) {
      alert("Error adding livestock: " + err.message);
    }
  };

  // Modals Trigger Handlers
  const handleOpenEdit = (animal: Livestock) => {
    setEditingAnimal(animal);
    setEditFields({
      tagNumber: animal.tagNumber || '',
      breed: animal.breed || '',
      type: animal.type || 'COW',
      gender: animal.gender || 'M',
      weight: animal.weight || '',
      age: animal.age || '',
      farm: animal.farm || '',
      purchasePrice: animal.purchasePrice || 0,
      investmentPackage: animal.investmentPackage || 'Standard',
      healthStatus: animal.healthStatus || 'GOOD',
      ownerId: animal.ownerId || '',
      custodianId: animal.custodianId || '',
      feedSchedule: animal.feedSchedule || '',
      growthProgress: animal.growthProgress || '',
      photoUrl: animal.photos?.[0] || ''
    });
    setIsEditing(true);
  };

  const handleOpenChangeStatus = (animal: Livestock) => {
    setStatusChangeAnimal(animal);
    setNewStatus(animal.status);
    setStatusDate(new Date().toISOString().substring(0, 10));
    setStatusReason('');
    setStatusNotes('');
    setIsChangingStatus(true);
  };

  const handleOpenAssign = (animal: Livestock) => {
    setAssignAnimal(animal);
    setAssignOwnerId(animal.ownerId || '');
    setAssignCustodianId(animal.custodianId || '');
    setIsAssigning(true);
  };

  const handleQuickArchive = (animal: Livestock) => {
    setStatusChangeAnimal(animal);
    setNewStatus(LivestockStatus.ARCHIVED);
    setStatusDate(new Date().toISOString().substring(0, 10));
    setStatusReason('Archived by administrator request');
    setStatusNotes('System archive to remove record from main registry list while maintaining durable safety.');
    setIsChangingStatus(true);
  };

  const handleOpenRemoveFromPortfolio = (animal: Livestock) => {
    setStatusChangeAnimal(animal);
    setNewStatus(LivestockStatus.DELIVERED); // Default to Delivered to move to history
    setStatusDate(new Date().toISOString().substring(0, 10));
    setStatusReason('Completed lifecycle and removed from active portfolio');
    setStatusNotes('Investor request completed. Moved safely into historical records.');
    setIsChangingStatus(true);
  };

  // Modals Save Handlers
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAnimal) return;

    try {
      await updateDoc(doc(db, 'livestock', editingAnimal.id), {
        tagNumber: editFields.tagNumber,
        breed: editFields.breed,
        type: editFields.type,
        gender: editFields.gender,
        weight: editFields.weight,
        age: editFields.age,
        farm: editFields.farm,
        purchasePrice: Number(editFields.purchasePrice),
        investmentPackage: editFields.investmentPackage,
        healthStatus: editFields.healthStatus,
        ownerId: editFields.ownerId,
        custodianId: editFields.custodianId,
        feedSchedule: editFields.feedSchedule,
        growthProgress: editFields.growthProgress,
        photos: editFields.photoUrl ? [editFields.photoUrl] : [],
        lastUpdated: Date.now()
      });

      // Activity log
      await addDoc(collection(db, 'activityLogs'), {
        adminId: profile?.uid || 'unknown',
        adminName: profile?.displayName || profile?.email || 'Admin',
        action: 'LIVESTOCK_UPDATE',
        targetId: editingAnimal.id,
        targetType: 'LIVESTOCK',
        newValue: { tagNumber: editFields.tagNumber, breed: editFields.breed },
        timestamp: Date.now()
      });

      // Notify investor
      if (editFields.ownerId) {
        await sendNotification(
          editFields.ownerId,
          `Asset Details Updated: ${editFields.tagNumber}`,
          `Your animal (${editFields.breed} - ${editFields.tagNumber}) information has been updated by administration.`,
          'Investment Updates',
          'INFO'
        );
      }

      setIsEditing(false);
      setEditingAnimal(null);

      // Refresh selected animal state if matches
      if (selectedAnimal?.id === editingAnimal.id) {
        setSelectedAnimal({
          ...selectedAnimal,
          ...editFields,
          id: editingAnimal.id,
          photos: editFields.photoUrl ? [editFields.photoUrl] : []
        } as any);
      }
    } catch (err: any) {
      alert("Error saving edits: " + err.message);
    }
  };

  const handleConfirmStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusChangeAnimal) return;

    try {
      const parsedDate = statusDate ? new Date(statusDate).getTime() : Date.now();
      const animalRef = doc(db, 'livestock', statusChangeAnimal.id);

      await updateDoc(animalRef, {
        status: newStatus,
        statusChangeDate: parsedDate,
        statusChangeReason: statusReason,
        statusChangeNotes: statusNotes,
        statusChangeAdminId: profile?.uid || 'unknown',
        statusChangeAdminName: profile?.displayName || profile?.email || 'Admin',
        lastUpdated: Date.now()
      });

      // Create Activity Log
      await addDoc(collection(db, 'activityLogs'), {
        adminId: profile?.uid || 'unknown',
        adminName: profile?.displayName || profile?.email || 'Admin',
        action: 'LIVESTOCK_STATUS_CHANGE',
        targetId: statusChangeAnimal.id,
        targetType: 'LIVESTOCK',
        newValue: { status: newStatus, reason: statusReason, notes: statusNotes },
        timestamp: Date.now()
      });

      // Notify Investor
      if (statusChangeAnimal.ownerId) {
        const priority = newStatus === LivestockStatus.DECEASED ? 'CRITICAL' :
                         newStatus === LivestockStatus.DELIVERED ? 'SUCCESS' : 'INFO';
        
        let msg = `The lifecycle status of your animal (${statusChangeAnimal.breed} - ${statusChangeAnimal.tagNumber}) has been updated to ${newStatus}.`;
        if (statusReason) msg += ` Reason: ${statusReason}.`;
        if (statusNotes) msg += ` Notes: ${statusNotes}`;

        await sendNotification(
          statusChangeAnimal.ownerId,
          `Livestock Lifecycle Update: ${statusChangeAnimal.tagNumber}`,
          msg,
          'Investment Updates',
          priority
        );
      }

      setIsChangingStatus(false);
      setStatusChangeAnimal(null);
      
      // Refresh selected animal
      if (selectedAnimal?.id === statusChangeAnimal.id) {
        setSelectedAnimal(prev => prev ? {
          ...prev,
          status: newStatus,
          statusChangeDate: parsedDate,
          statusChangeReason: statusReason,
          statusChangeNotes: statusNotes,
          statusChangeAdminId: profile?.uid || 'unknown',
          statusChangeAdminName: profile?.displayName || profile?.email || 'Admin'
        } : null);
      }
    } catch (err: any) {
      alert("Error saving lifecycle status: " + err.message);
    }
  };

  const handleConfirmAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignAnimal) return;

    try {
      await updateDoc(doc(db, 'livestock', assignAnimal.id), {
        ownerId: assignOwnerId,
        custodianId: assignCustodianId,
        status: assignOwnerId ? LivestockStatus.ASSIGNED : LivestockStatus.AVAILABLE,
        lastUpdated: Date.now()
      });

      // Activity log
      await addDoc(collection(db, 'activityLogs'), {
        adminId: profile?.uid || 'unknown',
        adminName: profile?.displayName || profile?.email || 'Admin',
        action: 'LIVESTOCK_ASSIGNMENT',
        targetId: assignAnimal.id,
        targetType: 'LIVESTOCK',
        newValue: { ownerId: assignOwnerId, custodianId: assignCustodianId },
        timestamp: Date.now()
      });

      // Notify investor
      if (assignOwnerId) {
        await sendNotification(
          assignOwnerId,
          `New Livestock Asset Assigned: ${assignAnimal.tagNumber}`,
          `A livestock asset (${assignAnimal.breed} - ${assignAnimal.tagNumber}) has been newly assigned to your active portfolio.`,
          'Investment Updates',
          'SUCCESS'
        );
      }

      setIsAssigning(false);
      setAssignAnimal(null);

      if (selectedAnimal?.id === assignAnimal.id) {
        setSelectedAnimal(prev => prev ? { 
          ...prev, 
          ownerId: assignOwnerId, 
          custodianId: assignCustodianId,
          status: assignOwnerId ? LivestockStatus.ASSIGNED : LivestockStatus.AVAILABLE
        } : null);
      }
    } catch (err: any) {
      alert("Error assigning assets: " + err.message);
    }
  };

  // Discouraged permanent delete option (Restricted only to Super Admins with specific double confirm warning)
  const handlePermanentDelete = async (id: string, tag: string) => {
    if (!isSuperAdmin) {
      alert("Unauthorized. Only the Super Admin has capabilities to perform permanent deletion of records.");
      return;
    }
    
    const doubleConfirm = window.confirm(`⚠️ WARNING: Permenant deletion is highly discouraged. You should mark records as "Archived" instead to retain full audit trails.\n\nAre you absolutely sure you want to permanently delete animal record ${tag}? This action cannot be undone.`);
    if (!doubleConfirm) return;

    try {
      await deleteDoc(doc(db, 'livestock', id));
      
      // Activity Log
      await addDoc(collection(db, 'activityLogs'), {
        adminId: profile?.uid || 'unknown',
        adminName: profile?.displayName || profile?.email || 'Admin',
        action: 'LIVESTOCK_PERMANENT_DELETE',
        targetId: id,
        targetType: 'LIVESTOCK',
        details: `Permanently deleted record with tag number: ${tag}`,
        timestamp: Date.now()
      });

      setSelectedAnimal(null);
      alert("Livestock record successfully deleted.");
    } catch (err: any) {
      alert("Error deleting livestock: " + err.message);
    }
  };

  if (isAdding) {
    return (
      <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Card title="Register New Livestock" icon={Plus}>
          <form onSubmit={handleAddLivestock} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input 
                label="Tag Number" 
                placeholder="e.g. CP-2026-001"
                required
                value={newLivestock.tagNumber || ''}
                onChange={e => setNewLivestock({...newLivestock, tagNumber: e.target.value})}
              />
              <Input 
                label="Breed" 
                value={newLivestock.breed}
                onChange={e => setNewLivestock({...newLivestock, breed: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-300">Animal Type</label>
                <select 
                  className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-green"
                  value={newLivestock.type || 'COW'}
                  onChange={e => setNewLivestock({...newLivestock, type: e.target.value})}
                >
                  <option value="COW">Cow</option>
                  <option value="BULL">Bull</option>
                  <option value="RAM">Ram</option>
                  <option value="SHEEP">Sheep</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-300">Gender</label>
                <select 
                  className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-green"
                  value={newLivestock.gender}
                  onChange={e => setNewLivestock({...newLivestock, gender: e.target.value as 'M' | 'F'})}
                >
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input 
                label="Weight" 
                value={newLivestock.weight}
                onChange={e => setNewLivestock({...newLivestock, weight: e.target.value})}
              />
              <Input 
                label="Age" 
                value={newLivestock.age}
                onChange={e => setNewLivestock({...newLivestock, age: e.target.value})}
              />
              <Input 
                label="Farm Location" 
                value={newLivestock.farm || ''}
                placeholder="e.g. Oyo Farm"
                onChange={e => setNewLivestock({...newLivestock, farm: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input 
                label="Value / Price (₦)" 
                type="number"
                placeholder="₦500,000"
                value={(newLivestock as any).purchasePrice || ''}
                onChange={e => setNewLivestock({...newLivestock, purchasePrice: Number(e.target.value)} as any)}
              />
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-300">Investment Package</label>
                <select 
                  className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-green"
                  value={newLivestock.investmentPackage}
                  onChange={e => setNewLivestock({...newLivestock, investmentPackage: e.target.value})}
                >
                  <option value="Standard">Standard</option>
                  <option value="Premium">Premium</option>
                  <option value="Executive">Executive</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-300">Health Status</label>
                <select 
                  className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-green"
                  value={newLivestock.healthStatus}
                  onChange={e => setNewLivestock({...newLivestock, healthStatus: e.target.value as any})}
                >
                  <option value="EXCELLENT">Excellent</option>
                  <option value="GOOD">Good</option>
                  <option value="FAIR">Fair</option>
                  <option value="POOR">Poor</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-300">Assign Investor</label>
                <select 
                  className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-green"
                  value={newLivestock.ownerId || ''}
                  onChange={e => setNewLivestock({...newLivestock, ownerId: e.target.value})}
                >
                  <option value="">Unassigned</option>
                  {investors.map(i => (
                    <option key={i.uid} value={i.uid}>{i.displayName}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-300">Assign Custodian</label>
                <select 
                  className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-green"
                  value={newLivestock.custodianId || ''}
                  onChange={e => setNewLivestock({...newLivestock, custodianId: e.target.value})}
                >
                  <option value="">Unassigned</option>
                  {custodians.map(c => (
                    <option key={c.uid} value={c.uid}>{c.displayName}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2 border-t border-brand-border/40 pt-4">
              <label className="text-sm font-medium text-gray-300 block">Livestock Portrait / Picture</label>
              
              <div className="flex flex-wrap gap-2 mb-2">
                {PRESET_ANIMAL_PHOTOS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => setNewLivestock({ ...newLivestock, photos: [preset.url] })}
                    className={cn(
                      "px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 bg-brand-muted hover:bg-brand-muted/80",
                      newLivestock.photos?.[0] === preset.url
                        ? "border-brand-green text-brand-green bg-brand-green/5"
                        : "border-brand-border text-gray-400"
                    )}
                  >
                    <span className="w-4 h-4 rounded overflow-hidden flex-shrink-0 bg-brand-dark">
                      <img src={preset.url} alt="" className="w-full h-full object-cover" />
                    </span>
                    {preset.name}
                  </button>
                ))}
              </div>

              <div className="flex gap-4 items-start">
                <div className="flex-grow">
                  <Input 
                    label="Custom Photo URL" 
                    placeholder="https://images.unsplash.com/..."
                    value={newLivestock.photos?.[0] || ''}
                    onChange={e => setNewLivestock({ ...newLivestock, photos: e.target.value ? [e.target.value] : [] })}
                  />
                </div>
                {newLivestock.photos?.[0] && (
                  <div className="w-16 h-16 rounded-xl border border-brand-border bg-brand-muted overflow-hidden flex-shrink-0 self-end">
                    <img src={newLivestock.photos[0]} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setIsAdding(false)}>Cancel</Button>
              <Button type="submit" className="flex-1">Save Livestock</Button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input 
              placeholder="Search by tag, breed or owner..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={() => setViewHistory(!viewHistory)} className={viewHistory ? "bg-brand-muted" : ""}>
            <History className="w-4 h-4 mr-2" />
            {viewHistory ? 'View Active' : 'View History'}
          </Button>
        </div>
        <Button onClick={() => setIsAdding(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Register Livestock
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card title={viewHistory ? "Livestock History Registry" : "Livestock Registry"} icon={viewHistory ? History : Beef}>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-brand-border">
                    <th className="pb-4 text-[10px] uppercase text-gray-500 font-bold tracking-widest">Animal</th>
                    <th className="pb-4 text-[10px] uppercase text-gray-500 font-bold tracking-widest">Status</th>
                    <th className="pb-4 text-[10px] uppercase text-gray-500 font-bold tracking-widest">Location</th>
                    <th className="pb-4 text-[10px] uppercase text-gray-500 font-bold tracking-widest">Owner</th>
                    <th className="pb-4 text-right text-[10px] uppercase text-gray-500 font-bold tracking-widest pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {filteredLivestock.map((animal) => (
                    <tr 
                      key={animal.id} 
                      className={cn(
                        "group hover:bg-brand-muted/50 transition-colors cursor-pointer",
                        selectedAnimal?.id === animal.id && "bg-brand-muted"
                      )}
                      onClick={() => setSelectedAnimal(animal)}
                    >
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-brand-muted border border-brand-border flex items-center justify-center">
                            {animal.photos?.[0] ? (
                              <img src={animal.photos[0]} alt="" className="w-full h-full object-cover rounded-lg" />
                            ) : (
                              <Beef className="w-5 h-5 text-gray-500" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">{animal.tagNumber}</p>
                            <p className="text-[10px] text-gray-500">{animal.breed} • {animal.type || 'COW'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <Badge variant={
                          animal.status === LivestockStatus.AVAILABLE ? 'success' : 
                          animal.status === LivestockStatus.SICK ? 'error' :
                          animal.status === LivestockStatus.DECEASED ? 'error' :
                          animal.status === LivestockStatus.DELIVERED ? 'success' : 'warning'
                        }>
                          {animal.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-4 text-xs text-gray-400">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {animal.farm || 'Main Ranch'}
                        </div>
                      </td>
                      <td className="py-4 text-xs text-gray-400">
                        {investors.find(i => i.uid === animal.ownerId)?.displayName || 'Unassigned'}
                      </td>
                      <td className="py-4 text-right pr-4" onClick={(e) => e.stopPropagation()}>
                        <div className="relative inline-block text-left">
                          <button 
                            onClick={() => setActiveDropdownId(activeDropdownId === animal.id ? null : animal.id)}
                            className="p-1.5 hover:bg-brand-muted rounded-lg border border-transparent hover:border-brand-border transition-all text-gray-400 hover:text-white"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          
                          {activeDropdownId === animal.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setActiveDropdownId(null)} />
                              <div className="absolute right-0 mt-2 w-56 rounded-xl bg-brand-dark border border-brand-border shadow-2xl py-1.5 z-50 text-left">
                                <button 
                                  onClick={() => { setSelectedAnimal(animal); setActiveDropdownId(null); }}
                                  className="w-full px-4 py-2 text-xs font-semibold hover:bg-brand-muted transition-colors flex items-center gap-2 text-gray-200"
                                >
                                  <Eye className="w-3.5 h-3.5 text-gray-400" />
                                  View Profile
                                </button>
                                <button 
                                  onClick={() => { handleOpenEdit(animal); setActiveDropdownId(null); }}
                                  className="w-full px-4 py-2 text-xs font-semibold hover:bg-brand-muted transition-colors flex items-center gap-2 text-gray-200"
                                >
                                  <Edit className="w-3.5 h-3.5 text-gray-400" />
                                  Edit Details
                                </button>
                                <button 
                                  onClick={() => { handleOpenChangeStatus(animal); setActiveDropdownId(null); }}
                                  className="w-full px-4 py-2 text-xs font-semibold hover:bg-brand-muted transition-colors flex items-center gap-2 text-brand-green"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  Change Status
                                </button>
                                <button 
                                  onClick={() => { handleOpenAssign(animal); setActiveDropdownId(null); }}
                                  className="w-full px-4 py-2 text-xs font-semibold hover:bg-brand-muted transition-colors flex items-center gap-2 text-gray-200"
                                >
                                  <UserPlus className="w-3.5 h-3.5 text-gray-400" />
                                  Assign Owner/Custodian
                                </button>
                                <button 
                                  onClick={() => { handleQuickArchive(animal); setActiveDropdownId(null); }}
                                  className="w-full px-4 py-2 text-xs font-semibold hover:bg-brand-muted transition-colors flex items-center gap-2 text-amber-400"
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                  Archive Record
                                </button>
                                {animal.ownerId && (
                                  <button 
                                    onClick={() => { handleOpenRemoveFromPortfolio(animal); setActiveDropdownId(null); }}
                                    className="w-full px-4 py-2 text-xs font-semibold hover:bg-brand-muted transition-colors flex items-center gap-2 text-rose-400 hover:text-rose-300"
                                  >
                                    <UserMinus className="w-3.5 h-3.5" />
                                    Remove from Portfolio
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div>
          <AnimatePresence mode="wait">
            {selectedAnimal ? (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <Card title="Animal Profile" icon={Activity}>
                  <div className="space-y-6">
                    <div className="aspect-video bg-brand-muted rounded-xl border border-brand-border relative overflow-hidden group">
                      {selectedAnimal.photos?.[0] ? (
                        <img src={selectedAnimal.photos[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-600">
                          <Camera className="w-8 h-8" />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-lg bg-brand-muted border border-brand-border">
                        <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">Weight</p>
                        <p className="text-sm font-bold">{selectedAnimal.weight}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-brand-muted border border-brand-border">
                        <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">Age</p>
                        <p className="text-sm font-bold">{selectedAnimal.age}</p>
                      </div>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Gender</span>
                        <span className="font-semibold text-gray-300">{selectedAnimal.gender === 'M' ? 'Male' : 'Female'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Value</span>
                        <span className="font-semibold text-brand-green">{formatCurrency(selectedAnimal.purchasePrice || 500000)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Investor</span>
                        <span className="font-semibold text-gray-300">{investors.find(i => i.uid === selectedAnimal.ownerId)?.displayName || 'Unassigned'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Custodian</span>
                        <span className="font-semibold text-gray-300">{custodians.find(c => c.uid === selectedAnimal.custodianId)?.displayName || 'Unassigned'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Farm Location</span>
                        <span className="font-semibold text-gray-300">{selectedAnimal.farm || 'Main Ranch'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Health State</span>
                        <span className={cn(
                          "font-bold",
                          selectedAnimal.healthStatus === 'EXCELLENT' ? 'text-emerald-400' :
                          selectedAnimal.healthStatus === 'GOOD' ? 'text-brand-green' :
                          selectedAnimal.healthStatus === 'FAIR' ? 'text-amber-400' : 'text-rose-400'
                        )}>{selectedAnimal.healthStatus}</span>
                      </div>
                    </div>

                    {/* Status Change Audit Trail Block */}
                    {selectedAnimal.statusChangeDate && (
                      <div className="p-4 rounded-xl border border-brand-border bg-brand-muted/40 space-y-2 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-gray-200">
                          <ClipboardList className="w-4 h-4 text-brand-green" />
                          <span>Lifecycle Action Log</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-gray-400 mt-1">
                          <div>Changed Date:</div>
                          <div className="text-gray-300 font-mono text-[11px]">{formatDate(selectedAnimal.statusChangeDate)}</div>
                          <div>Reason:</div>
                          <div className="text-gray-300">{selectedAnimal.statusChangeReason || 'N/A'}</div>
                          <div>Performed By:</div>
                          <div className="text-gray-300">{selectedAnimal.statusChangeAdminName || 'Admin'}</div>
                        </div>
                        {selectedAnimal.statusChangeNotes && (
                          <div className="pt-2 border-t border-brand-border mt-2">
                            <span className="text-gray-400 font-semibold">Notes:</span>
                            <p className="text-gray-300 mt-1 font-sans leading-relaxed text-[11px] bg-black/25 p-2 rounded border border-brand-border/50">
                              {selectedAnimal.statusChangeNotes}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="pt-6 border-t border-brand-border space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleOpenEdit(selectedAnimal)}>
                          <Edit className="w-3.5 h-3.5 mr-1.5" />
                          Edit Details
                        </Button>
                        <Button variant="outline" size="sm" className="text-brand-green border-brand-green/20" onClick={() => handleOpenChangeStatus(selectedAnimal)}>
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                          Status Change
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-brand-green border-brand-green/20 hover:bg-brand-green/10"
                          onClick={() => handleUpdateStatusDirect(selectedAnimal.id, LivestockStatus.ACTIVE)}
                        >
                          Mark Active
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-red-500 border-red-500/20 hover:bg-red-500/10"
                          onClick={() => handleUpdateStatusDirect(selectedAnimal.id, LivestockStatus.SICK)}
                        >
                          Mark Sick
                        </Button>
                      </div>

                      {/* Discouraged Permanent Deletion ONLY for Super Admin */}
                      {isSuperAdmin && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full text-rose-500 border-rose-500/15 hover:bg-rose-500/10 mt-2"
                          onClick={() => handlePermanentDelete(selectedAnimal.id, selectedAnimal.tagNumber)}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                          Permanently Delete Record (Discouraged)
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ) : (
              <div className="h-full flex items-center justify-center border-2 border-dashed border-brand-border rounded-xl p-8 text-center text-gray-500">
                <div className="space-y-2">
                  <Beef className="w-8 h-8 mx-auto opacity-20" />
                  <p className="text-sm">Select an animal from the registry to view its health status, lifecycle history, and ownership details.</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* MODAL 1: EDIT DETAILS */}
      <AnimatePresence>
        {isEditing && editingAnimal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl"
            >
              <Card title={`Edit Livestock: ${editingAnimal.tagNumber}`} icon={Edit}>
                <form onSubmit={handleSaveEdit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Input 
                      label="Tag Number" 
                      required
                      value={editFields.tagNumber}
                      onChange={e => setEditFields({...editFields, tagNumber: e.target.value})}
                    />
                    <Input 
                      label="Breed" 
                      value={editFields.breed}
                      onChange={e => setEditFields({...editFields, breed: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-300">Animal Type</label>
                      <select 
                        className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-green"
                        value={editFields.type}
                        onChange={e => setEditFields({...editFields, type: e.target.value})}
                      >
                        <option value="COW">Cow</option>
                        <option value="BULL">Bull</option>
                        <option value="RAM">Ram</option>
                        <option value="SHEEP">Sheep</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-300">Gender</label>
                      <select 
                        className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-green"
                        value={editFields.gender}
                        onChange={e => setEditFields({...editFields, gender: e.target.value as 'M' | 'F'})}
                      >
                        <option value="M">Male</option>
                        <option value="F">Female</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <Input 
                      label="Weight" 
                      value={editFields.weight}
                      onChange={e => setEditFields({...editFields, weight: e.target.value})}
                    />
                    <Input 
                      label="Age" 
                      value={editFields.age}
                      onChange={e => setEditFields({...editFields, age: e.target.value})}
                    />
                    <Input 
                      label="Farm Location" 
                      value={editFields.farm}
                      onChange={e => setEditFields({...editFields, farm: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <Input 
                      label="Value / Price (₦)" 
                      type="number"
                      value={editFields.purchasePrice}
                      onChange={e => setEditFields({...editFields, purchasePrice: Number(e.target.value)})}
                    />
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-300">Investment Package</label>
                      <select 
                        className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-green"
                        value={editFields.investmentPackage}
                        onChange={e => setEditFields({...editFields, investmentPackage: e.target.value})}
                      >
                        <option value="Standard">Standard</option>
                        <option value="Premium">Premium</option>
                        <option value="Executive">Executive</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-300">Health Status</label>
                      <select 
                        className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-green"
                        value={editFields.healthStatus}
                        onChange={e => setEditFields({...editFields, healthStatus: e.target.value as any})}
                      >
                        <option value="EXCELLENT">Excellent</option>
                        <option value="GOOD">Good</option>
                        <option value="FAIR">Fair</option>
                        <option value="POOR">Poor</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-300">Assign Investor</label>
                      <select 
                        className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-green"
                        value={editFields.ownerId}
                        onChange={e => setEditFields({...editFields, ownerId: e.target.value})}
                      >
                        <option value="">Unassigned</option>
                        {investors.map(i => (
                          <option key={i.uid} value={i.uid}>{i.displayName}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-300">Assign Custodian</label>
                      <select 
                        className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-green"
                        value={editFields.custodianId}
                        onChange={e => setEditFields({...editFields, custodianId: e.target.value})}
                      >
                        <option value="">Unassigned</option>
                        {custodians.map(c => (
                          <option key={c.uid} value={c.uid}>{c.displayName}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-brand-border/40 pt-4">
                    <label className="text-sm font-medium text-gray-300 block">Livestock Portrait / Picture</label>
                    
                    <div className="flex flex-wrap gap-2 mb-2">
                      {PRESET_ANIMAL_PHOTOS.map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => setEditFields({ ...editFields, photoUrl: preset.url })}
                          className={cn(
                            "px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 bg-brand-muted hover:bg-brand-muted/80",
                            editFields.photoUrl === preset.url
                              ? "border-brand-green text-brand-green bg-brand-green/5"
                              : "border-brand-border text-gray-400"
                          )}
                        >
                          <span className="w-4 h-4 rounded overflow-hidden flex-shrink-0 bg-brand-dark">
                            <img src={preset.url} alt="" className="w-full h-full object-cover" />
                          </span>
                          {preset.name}
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-4 items-start">
                      <div className="flex-grow">
                        <Input 
                          label="Custom Photo URL" 
                          placeholder="https://images.unsplash.com/..."
                          value={editFields.photoUrl}
                          onChange={e => setEditFields({ ...editFields, photoUrl: e.target.value })}
                        />
                      </div>
                      {editFields.photoUrl && (
                        <div className="w-16 h-16 rounded-xl border border-brand-border bg-brand-muted overflow-hidden flex-shrink-0 self-end">
                          <img src={editFields.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => { setIsEditing(false); setEditingAnimal(null); }}>Cancel</Button>
                    <Button type="submit" className="flex-1">Save Changes</Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: CHANGE LIFECYCLE STATUS */}
      <AnimatePresence>
        {isChangingStatus && statusChangeAnimal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg"
            >
              <Card title="Change Lifecycle Status" icon={RefreshCw}>
                <form onSubmit={handleConfirmStatusChange} className="space-y-4">
                  
                  {/* Warning label for active portfolio removal */}
                  {(newStatus === LivestockStatus.DELIVERED || newStatus === LivestockStatus.DECEASED) && (
                    <div className="p-3 bg-red-950/40 border border-red-500/20 text-red-300 rounded-lg text-xs flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Portfolio Movement Action:</span>
                        <p className="mt-0.5 text-gray-300">
                          Marking this animal as <span className="font-bold underline">{newStatus}</span> will automatically remove it from the investor's active portfolio grid and transfer it immediately into the <span className="font-semibold text-brand-green">Portfolio History Section</span>.
                        </p>
                      </div>
                    </div>
                  )}

                  {newStatus === LivestockStatus.ARCHIVED && (
                    <div className="p-3 bg-amber-950/40 border border-amber-500/20 text-amber-300 rounded-lg text-xs flex items-start gap-2">
                      <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Archival Action:</span>
                        <p className="mt-0.5 text-gray-300">
                          This will archive the record. The animal will remain saved in Firestore but safely hidden from the investor's active assets.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-300">Select New Status</label>
                    <select 
                      className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-brand-green font-semibold"
                      value={newStatus}
                      onChange={e => setNewStatus(e.target.value as LivestockStatus)}
                    >
                      <option value={LivestockStatus.ACTIVE}>Active</option>
                      <option value={LivestockStatus.DELIVERED}>Delivered</option>
                      <option value={LivestockStatus.DECEASED}>Deceased</option>
                      <option value={LivestockStatus.SOLD}>Sold</option>
                      <option value={LivestockStatus.TRANSFERRED}>Transferred</option>
                      <option value={LivestockStatus.ARCHIVED}>Archived</option>
                      <option value={LivestockStatus.AVAILABLE}>Available</option>
                      <option value={LivestockStatus.ASSIGNED}>Assigned</option>
                      <option value={LivestockStatus.SICK}>Sick</option>
                    </select>
                  </div>

                  <Input 
                    label="Status Change Date" 
                    type="date"
                    required
                    value={statusDate}
                    onChange={e => setStatusDate(e.target.value)}
                  />

                  <Input 
                    label="Reason for Change" 
                    placeholder="e.g. Completed 18-month maturity period, Died from illness..."
                    required
                    value={statusReason}
                    onChange={e => setStatusReason(e.target.value)}
                  />

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-300">Detailed Notes / Observation</label>
                    <textarea 
                      className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-brand-green text-sm min-h-[100px]"
                      placeholder="Input additional observations, vet signatures, or special instructions here..."
                      value={statusNotes}
                      onChange={e => setStatusNotes(e.target.value)}
                    />
                  </div>

                  <div className="text-[11px] text-gray-500 bg-brand-muted/50 p-2.5 rounded border border-brand-border font-mono">
                    <span className="font-semibold text-gray-400">Admin signature:</span> {profile?.displayName || profile?.email || 'System Admin'} (Super Admin Override)
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => { setIsChangingStatus(false); setStatusChangeAnimal(null); }}>Cancel</Button>
                    <Button type="submit" className="flex-1">Confirm Status Change</Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: ASSIGN ASSETS */}
      <AnimatePresence>
        {isAssigning && assignAnimal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md"
            >
              <Card title="Assign Animal Assets" icon={UserPlus}>
                <form onSubmit={handleConfirmAssignment} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-300">Assign Owner (Investor)</label>
                    <select 
                      className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-green"
                      value={assignOwnerId}
                      onChange={e => setAssignOwnerId(e.target.value)}
                    >
                      <option value="">Unassigned (Available)</option>
                      {investors.map(i => (
                        <option key={i.uid} value={i.uid}>{i.displayName}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-300">Assign Caretaker (Custodian)</label>
                    <select 
                      className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-green"
                      value={assignCustodianId}
                      onChange={e => setAssignCustodianId(e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {custodians.map(c => (
                        <option key={c.uid} value={c.uid}>{c.displayName}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => { setIsAssigning(false); setAssignAnimal(null); }}>Cancel</Button>
                    <Button type="submit" className="flex-1">Save Assignments</Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
