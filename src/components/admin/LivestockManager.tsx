import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, ListFilter, Pencil, Trash2, 
  Tag, HeartPulse, User, MapPin,
  ExternalLink, ChevronRight, Save, X, ImagePlus,
  Ellipsis, Eye, Archive, UserPlus, UserMinus,
  RefreshCw, TriangleAlert, CircleCheck, CalendarDays,
  DollarSign, ClipboardList, Info, History, Star, Package, ArrowUpDown, Activity, Edit
} from 'lucide-react';
import { CowIcon as Beef } from '../CowIcon';
import { db, sendNotification, logActivity } from '../../lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, addDoc, deleteDoc, Timestamp, getDoc } from 'firebase/firestore';
import { Livestock, LivestockStatus, UserProfile, UserRole } from '../../types';
import { Card, Button, Badge, Input } from '../UI';
import { uploadToCloudinary } from '../../lib/cloudinary';
import { cn, formatDate, formatCurrency, isHistoryAnimal } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../lib/AuthContext';
import { GrowthDataModal } from '../investor/GrowthDataModal';
import { VitalityLogModal } from '../investor/VitalityLogModal';
import { recordAuthoritativeWeight, syncHealthStatus, logLivestockTimelineEvent, ensureHealthRecord, syncLivestockWeightFromLatestGrowth } from '../../lib/syncLivestockRecords';

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
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedAnimal, setSelectedAnimal] = useState<Livestock | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [investors, setInvestors] = useState<UserProfile[]>([]);
  const [custodians, setCustodians] = useState<UserProfile[]>([]);
  
  // Actions Menu & Modals State
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [adminGrowthAnimal, setAdminGrowthAnimal] = useState<Livestock | null>(null);
  const [adminVitalityAnimal, setAdminVitalityAnimal] = useState<Livestock | null>(null);
  
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
    photoUrl: '',
    livestockImageUrl: '',
    livestockImagePublicId: ''
  });

  // Image Upload State
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [tempImagePreview, setTempImagePreview] = useState<string | null>(null);

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

  useEffect(() => {
    if (selectedAnimal) {
      const current = livestock.find(a => a.id === selectedAnimal.id);
      if (current) {
        if (JSON.stringify(current) !== JSON.stringify(selectedAnimal)) {
          setSelectedAnimal(current);
        }
      }
    }
  }, [livestock, selectedAnimal]);

  const filteredLivestock = livestock.filter(animal => 
    (viewHistory ? isHistoryAnimal(animal) : !isHistoryAnimal(animal)) &&
    (
      (animal.tagNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (animal.breed || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (animal.ownerId || '').toLowerCase().includes(searchTerm.toLowerCase())
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
      await logActivity(
        profile?.uid || 'unknown',
        profile?.displayName || profile?.email || 'Admin',
        'LIVESTOCK_STATUS_CHANGE',
        'LIVESTOCK',
        id,
        `Directly updated animal status to ${status}.`
      );

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
    
    setLoading(true);
    try {
      console.log("Livestock image upload result:", newLivestock.livestockImageUrl);

      const docRef = await addDoc(collection(db, 'livestock'), {
        ...newLivestock,
        type: newLivestock.type || 'COW',
        purchasePrice: Number((newLivestock as any).purchasePrice) || 500000,
        createdAt: Date.now(),
        lastUpdated: Date.now(),
        photos: newLivestock.photos || [],
        livestockImageUrl: newLivestock.livestockImageUrl || '',
        livestockImagePublicId: newLivestock.livestockImagePublicId || ''
      });

      // Verify the write
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const savedData = docSnap.data();
        console.log("Livestock document image field:", savedData.livestockImageUrl);
        
        // If an image URL was uploaded but is missing from read-back document
        if (newLivestock.livestockImageUrl && !savedData.livestockImageUrl) {
          throw new Error("Verification failed: The livestock image was not saved successfully in Firestore.");
        }
      } else {
        throw new Error("Verification failed: Could not read back the saved livestock record.");
      }
      
      const adminName = profile?.displayName || profile?.email || 'Admin';

      // Initialize authoritative health record document right away
      try {
        await syncHealthStatus(
          docRef.id,
          (newLivestock.healthStatus as any) || 'GOOD',
          adminName,
          `Initial baseline health record registered for ${newLivestock.breed} (${newLivestock.tagNumber})`,
          newLivestock.tagNumber
        );
      } catch (healthErr) {
        console.warn("Could not initialize health record document during creation:", healthErr);
      }

      // Activity log
      await logActivity(
        profile?.uid || 'unknown',
        adminName,
        'LIVESTOCK_CREATE',
        'LIVESTOCK',
        newLivestock.tagNumber || 'unknown',
        `Registered new ${newLivestock.breed} livestock with tag: ${newLivestock.tagNumber}`
      );

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
        photos: [],
        livestockImageUrl: '',
        livestockImagePublicId: ''
      });
      setTempImagePreview(null);
    } catch (err: any) {
      alert("Error adding livestock: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Modals Trigger Handlers
  const handleOpenEdit = (animal: Livestock) => {
    const resolvedImage = animal.livestockImageUrl || 
                          animal.photos?.[0] || 
                          (animal as any).photoUrl || 
                          (animal as any).imageUrl || 
                          (animal as any).portraitUrl || 
                          (animal as any).image || 
                          (animal as any).livestockImage || 
                          (animal as any).cloudinaryUrl || 
                          '';

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
      photoUrl: resolvedImage,
      livestockImageUrl: resolvedImage,
      livestockImagePublicId: animal.livestockImagePublicId || ''
    });
    setTempImagePreview(resolvedImage || null);
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

  const handleRestoreToActive = async (animal: Livestock) => {
    try {
      const animalRef = doc(db, 'livestock', animal.id);
      await updateDoc(animalRef, {
        status: LivestockStatus.ACTIVE,
        statusChangeDate: Date.now(),
        statusChangeReason: 'Restored to active status by administrator',
        statusChangeNotes: 'Animal moved back to active portfolio.',
        statusChangeAdminId: profile?.uid || 'unknown',
        statusChangeAdminName: profile?.displayName || profile?.email || 'Admin',
        liquidationStatus: null,
        archivedAt: null,
        lastUpdated: Date.now()
      });

      await logLivestockTimelineEvent(
        animal.id,
        animal.tagNumber,
        'Restored to Active',
        'Animal status restored from history back to Active.',
        profile?.displayName || profile?.email || 'Admin'
      );

      if (animal.ownerId) {
        await sendNotification(
          animal.ownerId,
          `Asset Restored to Active: ${animal.tagNumber}`,
          `Your animal (${animal.breed} - ${animal.tagNumber}) has been restored to active status.`,
          'Investment Updates',
          'SUCCESS'
        );
      }

      if (selectedAnimal?.id === animal.id) {
        setSelectedAnimal(prev => prev ? {
          ...prev,
          status: LivestockStatus.ACTIVE,
          liquidationStatus: undefined,
          archivedAt: undefined
        } : null);
      }
    } catch (err: any) {
      alert("Error restoring animal: " + err.message);
    }
  };

  // Modals Save Handlers
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAnimal) return;

    setLoading(true);
    try {
      const updateData: any = {
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
        photos: editFields.livestockImageUrl ? [editFields.livestockImageUrl] : [],
        livestockImageUrl: editFields.livestockImageUrl,
        livestockImagePublicId: editFields.livestockImagePublicId,
        lastUpdated: Date.now()
      };

      // If completing from AWAITING_ARRIVAL, change status to ACTIVE
      if (editingAnimal.status === LivestockStatus.AWAITING_ARRIVAL) {
        updateData.status = LivestockStatus.ACTIVE;
        updateData.statusChangeDate = Date.now();
        updateData.statusChangeReason = 'Animal arrived and registration completed';
        updateData.statusChangeAdminId = profile?.uid || 'unknown';
        updateData.statusChangeAdminName = profile?.displayName || profile?.email || 'Admin';
      }

      console.log("Livestock image upload result:", editFields.livestockImageUrl);

      const animalDocRef = doc(db, 'livestock', editingAnimal.id);
      await updateDoc(animalDocRef, updateData);

      // Verify the write
      const docSnap = await getDoc(animalDocRef);
      if (docSnap.exists()) {
        const savedData = docSnap.data();
        console.log("Livestock document image field:", savedData.livestockImageUrl);
        
        // If an image URL was uploaded but is missing from read-back document
        if (editFields.livestockImageUrl && !savedData.livestockImageUrl) {
          throw new Error("Verification failed: The livestock image was not saved successfully in Firestore.");
        }
      } else {
        throw new Error("Verification failed: Could not read back the updated livestock record.");
      }

      const adminName = profile?.displayName || profile?.email || 'Administrator';

      // 1. Health Status change sync & document existence guarantee
      try {
        await ensureHealthRecord(editingAnimal.id, { 
          tagNumber: editFields.tagNumber,
          healthStatus: editFields.healthStatus
        });
        
        const healthChanged = editFields.healthStatus !== editingAnimal.healthStatus;
        if (healthChanged) {
          await syncHealthStatus(
            editingAnimal.id,
            editFields.healthStatus,
            adminName,
            `Health status updated from ${editingAnimal.healthStatus || 'N/A'} to ${editFields.healthStatus}`,
            editFields.tagNumber
          );
        }
      } catch (err: any) {
        alert("Failed to sync health status: " + err.message);
        throw err;
      }

      // 2. Owner assignment change audit log
      if (editFields.ownerId !== editingAnimal.ownerId) {
        try {
          await ensureHealthRecord(editingAnimal.id, { tagNumber: editFields.tagNumber }); // Ensure doc exists
          await logLivestockTimelineEvent(
            editingAnimal.id,
            editFields.tagNumber,
            'Owner Assigned',
            `Assigned to owner ID: ${editFields.ownerId || 'Unassigned'}`,
            adminName
          );
        } catch (err: any) {
          alert("Owner assignment audit log failed: " + err.message);
          throw err;
        }
      }

      // 3. Feed schedule update audit log
      if (editFields.feedSchedule !== editingAnimal.feedSchedule) {
        try {
          await logLivestockTimelineEvent(
            editingAnimal.id,
            editFields.tagNumber,
            'Feed Schedule Updated',
            `Feed schedule updated to: ${editFields.feedSchedule}`,
            adminName
          );
        } catch (err: any) {
          console.warn("Feed schedule audit log failed:", err);
        }
      }

      // 4. Growth progress update audit log
      if (editFields.growthProgress !== editingAnimal.growthProgress) {
        try {
          await logLivestockTimelineEvent(
            editingAnimal.id,
            editFields.tagNumber,
            'Growth Progress Updated',
            `Growth progress updated to: ${editFields.growthProgress}`,
            adminName
          );
        } catch (err: any) {
          console.warn("Growth progress audit log failed:", err);
        }
      }

      // 5. Weight change sync
      const numericNewWeight = parseFloat(editFields.weight);
      const numericOldWeight = parseFloat(editingAnimal.weight);
      if (!isNaN(numericNewWeight) && numericNewWeight > 0 && numericNewWeight !== numericOldWeight) {
        try {
          await recordAuthoritativeWeight({
            livestockId: editingAnimal.id,
            tagNumber: editFields.tagNumber || editingAnimal.tagNumber,
            weightKg: numericNewWeight,
            measurementDate: Date.now(),
            observations: editFields.growthProgress || 'Registry weight adjustment',
            feedingNotes: editFields.feedSchedule || 'Standard formulated feed schedule',
            authorId: profile?.uid || 'admin',
            authorName: adminName,
            status: 'published'
          });
          // Update card to match authoritative source
          await syncLivestockWeightFromLatestGrowth(editingAnimal.id);
        } catch (syncErr: any) {
          alert("Failed to record authoritative weight: " + syncErr.message);
          throw syncErr;
        }
      }

      // Activity log
      await logActivity(
        profile?.uid || 'unknown',
        profile?.displayName || profile?.email || 'Admin',
        'LIVESTOCK_UPDATE',
        'LIVESTOCK',
        editingAnimal.id,
        `Updated animal record for tag: ${editFields.tagNumber}`
      );

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
      setTempImagePreview(null);

      // Refresh selected animal state if matches
      if (selectedAnimal?.id === editingAnimal.id) {
        setSelectedAnimal({
          ...selectedAnimal,
          ...editFields,
          id: editingAnimal.id,
          photos: editFields.livestockImageUrl ? [editFields.livestockImageUrl] : []
        } as any);
      }
    } catch (err: any) {
      alert("Error saving edits: " + err.message);
    } finally {
      setLoading(false);
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
        archivedAt: isHistoryAnimal({ status: newStatus }) ? Date.now() : null,
        lastUpdated: Date.now()
      });

      try {
        await logLivestockTimelineEvent(
          statusChangeAnimal.id,
          statusChangeAnimal.tagNumber,
          `Status Changed to ${newStatus}`,
          statusReason || statusNotes || `Lifecycle status updated to ${newStatus}`,
          profile?.displayName || profile?.email || 'Admin'
        );
      } catch (timelineErr) {
        console.warn("Failed to log status change timeline event:", timelineErr);
      }

      // Create Activity Log
      await logActivity(
        profile?.uid || 'unknown',
        profile?.displayName || profile?.email || 'Admin',
        'LIVESTOCK_STATUS_CHANGE',
        'LIVESTOCK',
        statusChangeAnimal.id,
        `Updated lifecycle status to ${newStatus}. Reason: ${statusReason || 'Not specified'}`
      );

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
      await logActivity(
        profile?.uid || 'unknown',
        profile?.displayName || profile?.email || 'Admin',
        'LIVESTOCK_ASSIGNMENT',
        'LIVESTOCK',
        assignAnimal.id,
        `Assigned animal to owner ${assignOwnerId || 'None'} and custodian ${assignCustodianId || 'None'}`
      );

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
    
    const doubleConfirm = window.confirm(`WARNING: Permanent deletion is highly discouraged. You should mark records as "Archived" instead to retain full audit trails.\n\nAre you absolutely sure you want to permanently delete animal record ${tag}? This action cannot be undone.`);
    if (!doubleConfirm) return;

    try {
      await deleteDoc(doc(db, 'livestock', id));
      
      // Activity Log
      await logActivity(
        profile?.uid || 'unknown',
        profile?.displayName || profile?.email || 'Admin',
        'LIVESTOCK_PERMANENT_DELETE',
        'LIVESTOCK',
        id,
        `Permanently deleted record with tag number: ${tag}`
      );

      setSelectedAnimal(null);
      alert("Livestock record successfully deleted.");
    } catch (err: any) {
      alert("Error deleting livestock: " + err.message);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadProgress(10); // Fake progress start

    try {
      // Preview locally first
      const reader = new FileReader();
      reader.onloadend = () => {
        setTempImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      const result = await uploadToCloudinary(file, profile?.uid || 'admin', 'livestock');
      
      if (isEdit) {
        setEditFields(prev => ({
          ...prev,
          livestockImageUrl: result.url,
          livestockImagePublicId: result.publicId
        }));
      } else {
        setNewLivestock(prev => ({
          ...prev,
          livestockImageUrl: result.url,
          livestockImagePublicId: result.publicId,
          photos: [result.url]
        }));
      }
      setUploadProgress(100);
    } catch (err: any) {
      setUploadError(err.message);
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (isEdit: boolean = false) => {
    setTempImagePreview(null);
    if (isEdit) {
      setEditFields(prev => ({
        ...prev,
        livestockImageUrl: '',
        livestockImagePublicId: ''
      }));
    } else {
      setNewLivestock(prev => ({
        ...prev,
        livestockImageUrl: '',
        livestockImagePublicId: '',
        photos: []
      }));
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
                onChange={e => setNewLivestock(prev => ({...prev, tagNumber: e.target.value}))}
              />
              <Input 
                label="Breed" 
                value={newLivestock.breed}
                onChange={e => setNewLivestock(prev => ({...prev, breed: e.target.value}))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Animal Type</label>
                <select 
                  className="w-full bg-white border border-brand-border rounded-lg px-4 py-2 text-slate-900 focus:outline-none focus:border-brand-green"
                  value={newLivestock.type || 'COW'}
                  onChange={e => setNewLivestock(prev => ({...prev, type: e.target.value}))}
                >
                  <option value="COW">Cow</option>
                  <option value="BULL">Bull</option>
                  <option value="RAM">Ram</option>
                  <option value="SHEEP">Sheep</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Gender</label>
                <select 
                  className="w-full bg-white border border-brand-border rounded-lg px-4 py-2 text-slate-900 focus:outline-none focus:border-brand-green"
                  value={newLivestock.gender}
                  onChange={e => setNewLivestock(prev => ({...prev, gender: e.target.value as 'M' | 'F'}))}
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
                onChange={e => setNewLivestock(prev => ({...prev, weight: e.target.value}))}
              />
              <Input 
                label="Age" 
                value={newLivestock.age}
                onChange={e => setNewLivestock(prev => ({...prev, age: e.target.value}))}
              />
              <Input 
                label="Farm Location" 
                value={newLivestock.farm || ''}
                placeholder="e.g. Oyo Farm"
                onChange={e => setNewLivestock(prev => ({...prev, farm: e.target.value}))}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input 
                label="Value / Price (₦)" 
                type="number"
                placeholder="₦500,000"
                value={(newLivestock as any).purchasePrice || ''}
                onChange={e => setNewLivestock(prev => ({...prev, purchasePrice: Number(e.target.value)}) as any)}
              />
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Investment Package</label>
                <select 
                  className="w-full bg-white border border-brand-border rounded-lg px-4 py-2 text-slate-900 focus:outline-none focus:border-brand-green"
                  value={newLivestock.investmentPackage}
                  onChange={e => setNewLivestock(prev => ({...prev, investmentPackage: e.target.value}))}
                >
                  <option value="Standard">Standard</option>
                  <option value="Premium">Premium</option>
                  <option value="Executive">Executive</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Health Status</label>
                <select 
                  className="w-full bg-white border border-brand-border rounded-lg px-4 py-2 text-slate-900 focus:outline-none focus:border-brand-green"
                  value={newLivestock.healthStatus}
                  onChange={e => setNewLivestock(prev => ({...prev, healthStatus: e.target.value as any}))}
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
                <label className="text-sm font-medium text-slate-700">Assign Investor</label>
                <select 
                  className="w-full bg-white border border-brand-border rounded-lg px-4 py-2 text-slate-900 focus:outline-none focus:border-brand-green"
                  value={newLivestock.ownerId || ''}
                  onChange={e => setNewLivestock(prev => ({...prev, ownerId: e.target.value}))}
                >
                  <option value="">Unassigned</option>
                  {investors.map(i => (
                    <option key={i.uid} value={i.uid}>{i.displayName}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Assign Custodian</label>
                <select 
                  className="w-full bg-white border border-brand-border rounded-lg px-4 py-2 text-slate-900 focus:outline-none focus:border-brand-green"
                  value={newLivestock.custodianId || ''}
                  onChange={e => setNewLivestock(prev => ({...prev, custodianId: e.target.value}))}
                >
                  <option value="">Unassigned</option>
                  {custodians.map(c => (
                    <option key={c.uid} value={c.uid}>{c.displayName}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-4 border-t border-brand-border/40 pt-4">
              <label className="text-sm font-black uppercase tracking-widest text-slate-400 block mb-2">Livestock Portrait / Picture</label>
              
              <div 
                className={cn(
                  "relative border-2 border-dashed rounded-[2rem] transition-all h-64 overflow-hidden flex flex-col items-center justify-center gap-3 group",
                  tempImagePreview 
                    ? "border-emerald-500 bg-emerald-50" 
                    : "border-slate-200 bg-slate-50 hover:border-emerald-400 hover:bg-emerald-50/50"
                )}
              >
                {uploading && (
                  <div className="absolute inset-0 z-20 bg-white/80 flex flex-col items-center justify-center gap-3">
                    <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Uploading Asset Photo...</p>
                    <div className="w-48 h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-300" 
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {tempImagePreview ? (
                  <div className="relative w-full h-full group">
                    <img 
                      src={tempImagePreview} 
                      alt="Asset preview" 
                      className="w-full h-full object-cover" 
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <Button 
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-white border-white hover:bg-white/20"
                        onClick={() => {
                          const fileInput = document.getElementById('livestock-upload') as HTMLInputElement;
                          if (fileInput) fileInput.click();
                        }}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Replace
                      </Button>
                      <Button 
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-white border-white hover:bg-rose-500/20 hover:border-rose-500"
                        onClick={() => removeImage(false)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-white rounded-3xl shadow-sm flex items-center justify-center text-slate-300 group-hover:text-emerald-500 transition-colors">
                      <ImagePlus className="w-8 h-8" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-black text-slate-900">Click to Upload Portrait</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">High resolution JPG or PNG preferred</p>
                    </div>
                    <input 
                      id="livestock-upload"
                      type="file" 
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => handleImageUpload(e, false)}
                    />
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" className="flex-1" disabled={uploading || loading} onClick={() => setIsAdding(false)}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={uploading || loading}>
                {uploading ? 'Uploading Portrait...' : loading ? 'Saving...' : 'Save Livestock'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-6 items-center justify-between bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <Input 
              placeholder="Filter by tag, breed or investor portfolio..." 
              className="pl-12 bg-slate-50/50 border-slate-100"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={() => setViewHistory(!viewHistory)} className={cn("rounded-2xl", viewHistory ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "")}>
            <History className="w-4 h-4 mr-2" />
            {viewHistory ? 'Active Assets Registry' : 'Historical Asset Archives'}
          </Button>
        </div>
        <Button onClick={() => setIsAdding(true)} className="w-full md:w-auto shadow-lg shadow-emerald-700/20">
          <Plus className="w-4 h-4 mr-2" />
          Onboard New Agricultural Asset
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card title={viewHistory ? "Historical Asset Registry" : "Active Asset Registry"} icon={viewHistory ? History : Beef}>
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-slate-400">
                    <th className="pb-4 px-4 text-[10px] uppercase font-black tracking-[0.2em]">Asset Identity</th>
                    <th className="pb-4 px-4 text-[10px] uppercase font-black tracking-[0.2em]">Vitality Status</th>
                    <th className="pb-4 px-4 text-[10px] uppercase font-black tracking-[0.2em]">Location</th>
                    <th className="pb-4 px-4 text-[10px] uppercase font-black tracking-[0.2em]">Investor</th>
                    <th className="pb-4 px-4 text-right text-[10px] uppercase font-black tracking-[0.2em]">Actions</th>
                  </tr>
                </thead>
                <tbody className="">
                  {filteredLivestock.map((animal) => (
                    <tr 
                      key={animal.id} 
                      className={cn(
                        "group transition-all duration-300 cursor-pointer",
                        selectedAnimal?.id === animal.id ? "bg-emerald-50/50" : "hover:bg-slate-50"
                      )}
                      onClick={() => {
                        setSelectedAnimal(animal);
                        setIsDetailModalOpen(true);
                      }}
                    >
                      <td className="py-4 px-4 rounded-l-2xl border-y border-l border-slate-50 group-hover:border-emerald-100">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shadow-sm group-hover:scale-110 transition-transform">
                            {animal.livestockImageUrl || animal.photos?.[0] || animal.photoUrl || (animal as any).imageUrl || (animal as any).portraitUrl || (animal as any).image || (animal as any).livestockImage || (animal as any).cloudinaryUrl ? (
                              <img 
                                src={animal.livestockImageUrl || animal.photos?.[0] || animal.photoUrl || (animal as any).imageUrl || (animal as any).portraitUrl || (animal as any).image || (animal as any).livestockImage || (animal as any).cloudinaryUrl} 
                                alt="" 
                                className="w-full h-full object-cover" 
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <Beef className="w-6 h-6" />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900 tracking-tight">{animal.tagNumber}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{animal.breed} • {animal.type || 'COW'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 border-y border-slate-50 group-hover:border-emerald-100">
                        <Badge variant={
                          animal.status === LivestockStatus.AVAILABLE ? 'success' : 
                          animal.status === LivestockStatus.SICK ? 'error' :
                          animal.status === LivestockStatus.DECEASED ? 'error' :
                          animal.status === LivestockStatus.DELIVERED ? 'success' : 'warning'
                        }>
                          {(animal.status || '').replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 border-y border-slate-50 group-hover:border-emerald-100">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                          {animal.farm || 'Main Ranch'}
                        </div>
                      </td>
                      <td className="py-4 px-4 border-y border-slate-50 group-hover:border-emerald-100">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-800">{investors.find(i => i.uid === animal.ownerId)?.displayName || 'Unassigned'}</span>
                          {animal.ownerId && <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Active Portfolio</span>}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right rounded-r-2xl border-y border-r border-slate-50 group-hover:border-emerald-100" onClick={(e) => e.stopPropagation()}>
                        <div className="relative inline-block text-left">
                          <button 
                            onClick={() => setActiveDropdownId(activeDropdownId === animal.id ? null : animal.id)}
                            className="p-2.5 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 hover:shadow-sm transition-all text-slate-400 hover:text-emerald-700"
                            aria-label="More options"
                            title="More options"
                          >
                            <Ellipsis className="w-5 h-5" />
                          </button>
                          
                          {activeDropdownId === animal.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setActiveDropdownId(null)} />
                              <div className="absolute right-0 mt-3 w-64 rounded-[1.5rem] bg-white border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.1)] py-2 z-50 text-left overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                <button 
                                  onClick={() => { setSelectedAnimal(animal); setActiveDropdownId(null); }}
                                  className="w-full px-5 py-3 text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-colors flex items-center gap-3 text-slate-600"
                                >
                                  <Eye className="w-4 h-4" />
                                  Inspect Profile
                                </button>
                                <button 
                                  onClick={() => { handleOpenEdit(animal); setActiveDropdownId(null); }}
                                  className="w-full px-5 py-3 text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-colors flex items-center gap-3 text-slate-600 border-t border-slate-50"
                                >
                                  <Pencil className="w-4 h-4" />
                                  Edit Registry
                                </button>
                                <button 
                                  onClick={() => { handleOpenChangeStatus(animal); setActiveDropdownId(null); }}
                                  className="w-full px-5 py-3 text-[11px] font-black uppercase tracking-widest hover:bg-emerald-50 transition-colors flex items-center gap-3 text-emerald-700 border-t border-slate-50"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                  Update Status
                                </button>
                                <button 
                                  onClick={() => { handleOpenAssign(animal); setActiveDropdownId(null); }}
                                  className="w-full px-5 py-3 text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-colors flex items-center gap-3 text-slate-600 border-t border-slate-50"
                                >
                                  <UserPlus className="w-4 h-4" />
                                  Assign Portfolio
                                </button>
                                <button 
                                  onClick={() => { handleQuickArchive(animal); setActiveDropdownId(null); }}
                                  className="w-full px-5 py-3 text-[11px] font-black uppercase tracking-widest hover:bg-amber-50 transition-colors flex items-center gap-3 text-amber-600 border-t border-slate-50"
                                >
                                  <Archive className="w-4 h-4" />
                                  Archive Asset
                                </button>
                                {animal.ownerId && (
                                  <button 
                                    onClick={() => { handleOpenRemoveFromPortfolio(animal); setActiveDropdownId(null); }}
                                    className="w-full px-5 py-3 text-[11px] font-black uppercase tracking-widest hover:bg-rose-50 transition-colors flex items-center gap-3 text-rose-600 border-t border-slate-50"
                                  >
                                    <UserMinus className="w-4 h-4" />
                                    Release from Portfolio
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
                    <div className="aspect-video bg-slate-100 rounded-[2rem] border border-slate-200 relative overflow-hidden group shadow-sm mb-6">
                      {selectedAnimal.livestockImageUrl || selectedAnimal.photos?.[0] || selectedAnimal.photoUrl || (selectedAnimal as any).imageUrl || (selectedAnimal as any).portraitUrl || (selectedAnimal as any).image || (selectedAnimal as any).livestockImage || (selectedAnimal as any).cloudinaryUrl ? (
                        <img 
                          src={selectedAnimal.livestockImageUrl || selectedAnimal.photos?.[0] || selectedAnimal.photoUrl || (selectedAnimal as any).imageUrl || (selectedAnimal as any).portraitUrl || (selectedAnimal as any).image || (selectedAnimal as any).livestockImage || (selectedAnimal as any).cloudinaryUrl} 
                          alt={selectedAnimal.breed} 
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-300">
                          <Beef className="w-12 h-12 mb-2" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No portrait available</p>
                        </div>
                      )}
                      <div className="absolute top-4 right-4">
                        <Badge variant="success" className="shadow-lg">{selectedAnimal.tagNumber}</Badge>
                      </div>
                    </div>

                    {selectedAnimal.status === LivestockStatus.AWAITING_ARRIVAL && (
                      <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 shadow-sm space-y-3">
                        <div className="flex items-start gap-3">
                          <TriangleAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-black text-amber-900">Awaiting Arrival</h4>
                            <p className="text-[11px] text-amber-800 leading-relaxed">
                              This is a placeholder record for a purchased asset. The physical animal has not been registered at the farm yet.
                            </p>
                          </div>
                        </div>
                        <Button 
                          className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold"
                          onClick={() => handleOpenEdit(selectedAnimal)}
                        >
                          <CircleCheck className="w-4 h-4 mr-2" />
                          Complete Livestock Details
                        </Button>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 shadow-sm">
                        <p className="text-[10px] uppercase text-slate-400 font-black tracking-widest mb-1">Live Weight</p>
                        <p className="text-base font-black text-slate-900 tracking-tight">{selectedAnimal.weight}</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 shadow-sm">
                        <p className="text-[10px] uppercase text-slate-400 font-black tracking-widest mb-1">Asset Age</p>
                        <p className="text-base font-black text-slate-900 tracking-tight">{selectedAnimal.age}</p>
                      </div>
                    </div>

                    <div className="space-y-4 text-sm bg-white p-6 rounded-[1.5rem] border border-slate-100 shadow-sm">
                      <div className="flex items-center justify-between py-1 border-b border-slate-50">
                        <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">Gender</span>
                        <span className="font-black text-slate-900 uppercase tracking-widest text-[11px]">{selectedAnimal.gender === 'M' ? 'Male / Bull' : 'Female / Heifer'}</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-slate-50">
                        <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">Asset Value</span>
                        <span className="font-black text-emerald-700">{formatCurrency(selectedAnimal.purchasePrice || 500000)}</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-slate-50">
                        <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">Portfolio Owner</span>
                        <span className="font-black text-slate-900">{investors.find(i => i.uid === selectedAnimal.ownerId)?.displayName || 'Unassigned'}</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-slate-50">
                        <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">Asset Handler</span>
                        <span className="font-black text-slate-900">{custodians.find(c => c.uid === selectedAnimal.custodianId)?.displayName || 'Unassigned'}</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-slate-50">
                        <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">Station / Ranch</span>
                        <span className="font-black text-slate-900">{selectedAnimal.farm || 'Main Ranch'}</span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">Vitality State</span>
                        <Badge variant={selectedAnimal.healthStatus === 'EXCELLENT' || selectedAnimal.healthStatus === 'GOOD' ? 'success' : 'error'}>
                          {selectedAnimal.healthStatus}
                        </Badge>
                      </div>
                    </div>

                    {/* Status Change Audit Trail Block */}
                    {selectedAnimal.statusChangeDate && (
                      <div className="p-4 rounded-xl border border-brand-border bg-brand-muted/40 space-y-2 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-gray-200">
                          <ClipboardList className="w-4 h-4 text-brand-green" />
                          <span>Lifecycle Action Log</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-slate-600 mt-1">
                          <div>Changed Date:</div>
                          <div className="text-slate-700 font-mono text-[11px]">{formatDate(selectedAnimal.statusChangeDate)}</div>
                          <div>Reason:</div>
                          <div className="text-slate-700">{selectedAnimal.statusChangeReason || 'N/A'}</div>
                          <div>Performed By:</div>
                          <div className="text-slate-700">{selectedAnimal.statusChangeAdminName || 'Admin'}</div>
                        </div>
                        {selectedAnimal.statusChangeNotes && (
                          <div className="pt-2 border-t border-brand-border mt-2">
                            <span className="text-slate-600 font-semibold">Notes:</span>
                            <p className="text-slate-700 mt-1 font-sans leading-relaxed text-[11px] bg-slate-100 p-2 rounded border border-brand-border/50">
                              {selectedAnimal.statusChangeNotes}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="pt-6 border-t border-brand-border space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleOpenEdit(selectedAnimal)}>
                          <Pencil className="w-3.5 h-3.5 mr-1.5" />
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
                      onChange={e => setEditFields(prev => ({...prev, tagNumber: e.target.value}))}
                    />
                    <Input 
                      label="Breed" 
                      value={editFields.breed}
                      onChange={e => setEditFields(prev => ({...prev, breed: e.target.value}))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Animal Type</label>
                      <select 
                        className="w-full bg-white border border-brand-border rounded-lg px-4 py-2 text-slate-900 focus:outline-none focus:border-brand-green"
                        value={editFields.type}
                        onChange={e => setEditFields(prev => ({...prev, type: e.target.value}))}
                      >
                        <option value="COW">Cow</option>
                        <option value="BULL">Bull</option>
                        <option value="RAM">Ram</option>
                        <option value="SHEEP">Sheep</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Gender</label>
                      <select 
                        className="w-full bg-white border border-brand-border rounded-lg px-4 py-2 text-slate-900 focus:outline-none focus:border-brand-green"
                        value={editFields.gender}
                        onChange={e => setEditFields(prev => ({...prev, gender: e.target.value as 'M' | 'F'}))}
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
                      onChange={e => setEditFields(prev => ({...prev, weight: e.target.value}))}
                    />
                    <Input 
                      label="Age" 
                      value={editFields.age}
                      onChange={e => setEditFields(prev => ({...prev, age: e.target.value}))}
                    />
                    <Input 
                      label="Farm Location" 
                      value={editFields.farm}
                      onChange={e => setEditFields(prev => ({...prev, farm: e.target.value}))}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <Input 
                      label="Value / Price (₦)" 
                      type="number"
                      value={editFields.purchasePrice}
                      onChange={e => setEditFields(prev => ({...prev, purchasePrice: Number(e.target.value)}))}
                    />
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Investment Package</label>
                      <select 
                        className="w-full bg-white border border-brand-border rounded-lg px-4 py-2 text-slate-900 focus:outline-none focus:border-brand-green"
                        value={editFields.investmentPackage}
                        onChange={e => setEditFields(prev => ({...prev, investmentPackage: e.target.value}))}
                      >
                        <option value="Standard">Standard</option>
                        <option value="Premium">Premium</option>
                        <option value="Executive">Executive</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Health Status</label>
                      <select 
                        className="w-full bg-white border border-brand-border rounded-lg px-4 py-2 text-slate-900 focus:outline-none focus:border-brand-green"
                        value={editFields.healthStatus}
                        onChange={e => setEditFields(prev => ({...prev, healthStatus: e.target.value as any}))}
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
                      <label className="text-sm font-medium text-slate-700">Assign Investor</label>
                      <select 
                        className="w-full bg-white border border-brand-border rounded-lg px-4 py-2 text-slate-900 focus:outline-none focus:border-brand-green"
                        value={editFields.ownerId}
                        onChange={e => setEditFields(prev => ({...prev, ownerId: e.target.value}))}
                      >
                        <option value="">Unassigned</option>
                        {investors.map(i => (
                          <option key={i.uid} value={i.uid}>{i.displayName}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Assign Custodian</label>
                      <select 
                        className="w-full bg-white border border-brand-border rounded-lg px-4 py-2 text-slate-900 focus:outline-none focus:border-brand-green"
                        value={editFields.custodianId}
                        onChange={e => setEditFields(prev => ({...prev, custodianId: e.target.value}))}
                      >
                        <option value="">Unassigned</option>
                        {custodians.map(c => (
                          <option key={c.uid} value={c.uid}>{c.displayName}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4 border-t border-brand-border/40 pt-4">
                    <label className="text-sm font-black uppercase tracking-widest text-slate-400 block mb-2">Livestock Portrait / Picture</label>
                    
                    <div 
                      className={cn(
                        "relative border-2 border-dashed rounded-[2rem] transition-all h-64 overflow-hidden flex flex-col items-center justify-center gap-3 group",
                        tempImagePreview 
                          ? "border-emerald-500 bg-emerald-50" 
                          : "border-slate-200 bg-slate-50 hover:border-emerald-400 hover:bg-emerald-50/50"
                      )}
                    >
                      {uploading && (
                        <div className="absolute inset-0 z-20 bg-white/80 flex flex-col items-center justify-center gap-3">
                          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Uploading Asset Photo...</p>
                          <div className="w-48 h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-500 transition-all duration-300" 
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {tempImagePreview ? (
                        <div className="relative w-full h-full group">
                          <img 
                            src={tempImagePreview} 
                            alt="Asset preview" 
                            className="w-full h-full object-cover" 
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                            <Button 
                              type="button"
                              size="sm"
                              variant="outline"
                              className="text-white border-white hover:bg-white/20"
                              onClick={() => {
                                const fileInput = document.getElementById('livestock-edit-upload') as HTMLInputElement;
                                if (fileInput) fileInput.click();
                              }}
                            >
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Replace
                            </Button>
                            <Button 
                              type="button"
                              size="sm"
                              variant="outline"
                              className="text-white border-white hover:bg-rose-500/20 hover:border-rose-500"
                              onClick={() => removeImage(true)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="w-16 h-16 bg-white rounded-3xl shadow-sm flex items-center justify-center text-slate-300 group-hover:text-emerald-500 transition-colors">
                            <ImagePlus className="w-8 h-8" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-black text-slate-900">Click to Upload Portrait</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">High resolution JPG or PNG preferred</p>
                          </div>
                          <input 
                            id="livestock-edit-upload"
                            type="file" 
                            accept="image/*"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={(e) => handleImageUpload(e, true)}
                          />
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button type="button" variant="outline" className="flex-1" disabled={uploading || loading} onClick={() => { setIsEditing(false); setEditingAnimal(null); }}>Cancel</Button>
                    <Button type="submit" className="flex-1" disabled={uploading || loading}>
                      {uploading ? 'Uploading Portrait...' : loading ? 'Saving...' : 'Save Changes'}
                    </Button>
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
                      <TriangleAlert className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Portfolio Movement Action:</span>
                        <p className="mt-0.5 text-slate-700">
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
                        <p className="mt-0.5 text-slate-700">
                          This will archive the record. The animal will remain saved in Firestore but safely hidden from the investor's active assets.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Select New Status</label>
                    <select 
                      className="w-full bg-white border border-brand-border rounded-lg px-4 py-2.5 text-slate-900 focus:outline-none focus:border-brand-green font-semibold"
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
                    <label className="text-sm font-medium text-slate-700">Detailed Notes / Observation</label>
                    <textarea 
                      className="w-full bg-white border border-brand-border rounded-lg px-4 py-2.5 text-slate-900 focus:outline-none focus:border-brand-green text-sm min-h-[100px]"
                      placeholder="Input additional observations, vet signatures, or special instructions here..."
                      value={statusNotes}
                      onChange={e => setStatusNotes(e.target.value)}
                    />
                  </div>

                  <div className="text-[11px] text-gray-500 bg-brand-muted/50 p-2.5 rounded border border-brand-border font-mono">
                    <span className="font-semibold text-slate-600">Admin signature:</span> {profile?.displayName || profile?.email || 'System Admin'} (Super Admin Override)
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
                    <label className="text-sm font-medium text-slate-700">Assign Owner (Investor)</label>
                    <select 
                      className="w-full bg-white border border-brand-border rounded-lg px-4 py-2 text-slate-900 focus:outline-none focus:border-brand-green"
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
                    <label className="text-sm font-medium text-slate-700">Assign Caretaker (Custodian)</label>
                    <select 
                      className="w-full bg-white border border-brand-border rounded-lg px-4 py-2 text-slate-900 focus:outline-none focus:border-brand-green"
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

      <GrowthDataModal 
        isOpen={Boolean(adminGrowthAnimal)} 
        onClose={() => setAdminGrowthAnimal(null)} 
        animal={adminGrowthAnimal} 
        isAdmin={true} 
      />

      <VitalityLogModal 
        isOpen={Boolean(adminVitalityAnimal)} 
        onClose={() => setAdminVitalityAnimal(null)} 
        animal={adminVitalityAnimal} 
        isAdmin={true} 
      />
    </div>
  );
};
