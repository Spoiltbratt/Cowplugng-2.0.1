import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, UserRound, Search, ListFilter, 
  CheckCircle, CircleCheck, Ban, AlertCircle, Eye, 
  Clock, Download, ExternalLink, MapPin,
  FileText, Calendar, Mail, Phone,
  ChevronRight, TriangleAlert, Image as ImageIcon, BadgeCheck
} from 'lucide-react';
import { CowIcon as Beef } from '../CowIcon';
import { db, logActivity, sendNotification } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import { 
  collection, query, onSnapshot, doc, 
  updateDoc, where, orderBy, getDoc 
} from 'firebase/firestore';
import { UserProfile, VerificationStatus, UserRole } from '../../types';
import { LoadingButton } from '../LoadingButton';
import { Card, Button, Badge, Input, Modal } from '../UI';
import { cn, formatDate } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export const AdminKycManager: React.FC = () => {
  const { profile } = useAuth();
  const [kycRequests, setKycRequests] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>(VerificationStatus.UNDER_REVIEW);
  const [selectedRequest, setSelectedRequest] = useState<UserProfile | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRejectionForm, setShowRejectionForm] = useState(false);
  const [showFlagForm, setShowFlagForm] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [flagMessage, setFlagMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      where('verificationStatus', '!=', VerificationStatus.NOT_STARTED),
      orderBy('verificationStatus'),
      orderBy('verificationSubmittedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => d.data() as UserProfile);
      console.log(`[AdminKycManager] Received snapshot with ${docs.length} documents (fromCache: ${snapshot.metadata.fromCache})`);
      setKycRequests(docs);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching KYC requests:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredRequests = kycRequests.filter(req => {
    const matchesSearch = 
      req.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.verifiedName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = 
      filterStatus === 'ALL' || 
      req.verificationStatus === filterStatus ||
      (filterStatus === VerificationStatus.UNDER_REVIEW && req.verificationStatus === VerificationStatus.SUBMITTED);
    
    return matchesSearch && matchesStatus;
  });

  const handleReview = (request: UserProfile) => {
    setSelectedRequest(request);
    setIsDetailModalOpen(true);
    setRejectionReason('');
    setShowRejectionForm(false);
    setShowFlagForm(false);
    setFlagReason('');
    setFlagMessage('');
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    setIsProcessing(true);
    try {
      const adminRef = doc(db, 'users', selectedRequest.uid);
      await updateDoc(adminRef, {
        verificationStatus: VerificationStatus.APPROVED,
        isVerified: true,
        verificationReviewedAt: Date.now(),
        reviewedBy: profile?.displayName || 'Admin',
        // Once approved, verifiedName becomes the official name
        displayName: selectedRequest.verifiedName || selectedRequest.displayName,
        name: selectedRequest.verifiedName || selectedRequest.displayName
      });

      // Update local state immediately for instant feedback
      setKycRequests(prev => prev.map(req => 
        req.uid === selectedRequest.uid 
          ? { 
              ...req, 
              verificationStatus: VerificationStatus.APPROVED, 
              isVerified: true,
              verificationReviewedAt: Date.now(),
              reviewedBy: profile?.displayName || 'Admin',
              displayName: selectedRequest.verifiedName || selectedRequest.displayName,
              name: selectedRequest.verifiedName || selectedRequest.displayName
            } 
          : req
      ));

      setIsDetailModalOpen(false);
      setSuccessMessage('Verification approved successfully.');

      // Perform background tasks
      logActivity(
        'ADMIN',
        'System Admin',
        'KYC_APPROVED',
        'USER',
        selectedRequest.uid,
        `Approved KYC for ${selectedRequest.verifiedName}`
      ).catch(err => console.warn('Activity log failed:', err));

      sendNotification(
        selectedRequest.uid,
        'Identity Verified',
        'Your identity has been successfully verified. Welcome to CowPlugNG!',
        'Security Alerts',
        'SUCCESS'
      ).catch(err => console.warn('Notification failed:', err));
    } catch (error) {
      console.error("Error approving KYC:", error);
      alert('Failed to approve KYC.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || !rejectionReason) {
      alert('Please provide a reason for rejection.');
      return;
    }
    setIsProcessing(true);
    try {
      const userRef = doc(db, 'users', selectedRequest.uid);
      await updateDoc(userRef, {
        verificationStatus: VerificationStatus.REJECTED,
        isVerified: false,
        rejectionReason: rejectionReason,
        verificationReviewedAt: Date.now(),
        reviewedBy: profile?.displayName || 'Admin'
      });

      // Update local state immediately
      setKycRequests(prev => prev.map(req => 
        req.uid === selectedRequest.uid 
          ? { 
              ...req, 
              verificationStatus: VerificationStatus.REJECTED, 
              isVerified: false,
              rejectionReason: rejectionReason,
              verificationReviewedAt: Date.now(),
              reviewedBy: profile?.displayName || 'Admin'
            } 
          : req
      ));

      setIsDetailModalOpen(false);
      setSuccessMessage('Verification rejected successfully.');

      // Background tasks
      logActivity(
        'ADMIN',
        'System Admin',
        'KYC_REJECTED',
        'USER',
        selectedRequest.uid,
        `Rejected KYC for ${selectedRequest.verifiedName}. Reason: ${rejectionReason}`
      ).catch(err => console.warn('Activity log failed:', err));

      sendNotification(
        selectedRequest.uid,
        'Verification Action Required',
        `We couldn't verify your identity. Reason: ${rejectionReason}. Please resubmit with correct information.`,
        'Security Alerts',
        'WARNING'
      ).catch(err => console.warn('Notification failed:', err));
    } catch (error) {
      console.error("Error rejecting KYC:", error);
      alert('Failed to reject KYC.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFlag = async () => {
    if (!selectedRequest || !flagReason || !flagMessage) {
      alert('Please provide a reason and a customer-facing message.');
      return;
    }
    setIsProcessing(true);
    try {
      const userRef = doc(db, 'users', selectedRequest.uid);
      await updateDoc(userRef, {
        verificationStatus: VerificationStatus.VERIFICATION_ISSUE,
        verificationIssueReason: flagReason,
        verificationIssueMessage: flagMessage,
        verificationReviewedAt: Date.now(),
        reviewedBy: profile?.displayName || 'Admin',
        isVerified: false
      });

      // Update local state immediately
      setKycRequests(prev => prev.map(req => 
        req.uid === selectedRequest.uid 
          ? { 
              ...req, 
              verificationStatus: VerificationStatus.VERIFICATION_ISSUE,
              verificationIssueReason: flagReason,
              verificationIssueMessage: flagMessage,
              verificationReviewedAt: Date.now(),
              reviewedBy: profile?.displayName || 'Admin',
              isVerified: false
            } 
          : req
      ));

      setIsDetailModalOpen(false);
      setSuccessMessage('Account flagged successfully.');

      // Background tasks
      logActivity(
        'ADMIN',
        'System Admin',
        'VERIFICATION_ISSUE_FLAGGED',
        'USER',
        selectedRequest.uid,
        `Flagged verification issue for ${selectedRequest.displayName}. Reason: ${flagReason}`
      ).catch(err => console.warn('Activity log failed:', err));

      sendNotification(
        selectedRequest.uid,
        'Account Information Review',
        'We need some additional information about your account. Please check your account dashboard.',
        'Security Alerts',
        'WARNING'
      ).catch(err => console.warn('Notification failed:', err));
    } catch (error) {
      console.error("Error flagging account:", error);
      alert('Failed to flag account.');
    } finally {
      setIsProcessing(false);
    }
  };

  const maskNin = (nin: string | undefined) => {
    if (!nin) return 'N/A';
    return `••••••••${nin.slice(-4)}`;
  };

  return (
    <div className="space-y-6 relative">
      {/* Toast Notification */}
      <AnimatePresence>
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[110] px-6 py-3 bg-emerald-900 text-white rounded-full shadow-2xl flex items-center gap-2 border border-emerald-500/30 backdrop-blur-md"
          >
            <CircleCheck className="w-5 h-5 text-emerald-400" />
            <span className="text-sm font-black tracking-tight">{successMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Identity Verifications</h2>
          <p className="text-slate-500 text-sm">Manage and review user KYC submissions</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-white px-3 py-1.5 h-auto border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            <span className="text-xs font-black text-emerald-900">
              {kycRequests.filter(r => r.verificationStatus === VerificationStatus.UNDER_REVIEW || r.verificationStatus === VerificationStatus.SUBMITTED).length} Pending Review
            </span>
          </Badge>
        </div>
      </div>

      <Card className="p-4 border-slate-200 bg-slate-50/50">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search by name, email..."
              className="pl-10 bg-white border-slate-200"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm overflow-x-auto max-w-full">
              {[
                { id: 'ALL', label: 'All', count: kycRequests.length },
                { id: VerificationStatus.UNDER_REVIEW, label: 'To Review', count: kycRequests.filter(r => r.verificationStatus === VerificationStatus.UNDER_REVIEW || r.verificationStatus === VerificationStatus.SUBMITTED).length },
                { id: VerificationStatus.APPROVED, label: 'Approved', count: kycRequests.filter(r => r.verificationStatus === VerificationStatus.APPROVED).length },
                { id: VerificationStatus.REJECTED, label: 'Rejected', count: kycRequests.filter(r => r.verificationStatus === VerificationStatus.REJECTED).length },
                { id: VerificationStatus.VERIFICATION_ISSUE, label: 'Issues', count: kycRequests.filter(r => r.verificationStatus === VerificationStatus.VERIFICATION_ISSUE).length },
              ].map((status) => (
                <button
                  key={status.id}
                  onClick={() => setFilterStatus(status.id)}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap",
                    filterStatus === status.id 
                      ? "bg-slate-900 text-white shadow-md shadow-slate-900/10" 
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                  )}
                >
                  {status.label}
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-md text-[10px]",
                    filterStatus === status.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  )}>
                    {status.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Loading Requests...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <Card className="py-20 flex flex-col items-center justify-center text-center border-dashed">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No requests found</h3>
          <p className="text-slate-500 text-sm max-w-xs mx-auto">
            There are no identity verification requests matching your current filters.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredRequests.map((request) => (
              <motion.div
                key={request.uid}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Card className="group hover:border-emerald-200 transition-all hover:shadow-md h-full flex flex-col overflow-hidden">
                  <div className="p-5 flex-1">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center overflow-hidden border border-slate-200 group-hover:border-emerald-100 group-hover:bg-emerald-50 transition-colors">
                          {request.photoURL ? (
                            <img src={request.photoURL} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <UserRound className="w-6 h-6 text-slate-400 group-hover:text-emerald-500" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 leading-tight">{request.verifiedName || request.displayName}</h4>
                          <p className="text-[10px] text-slate-500 font-medium truncate max-w-[150px]">{request.email}</p>
                        </div>
                      </div>
                      <Badge variant={
                        request.verificationStatus === VerificationStatus.APPROVED ? 'success' :
                        request.verificationStatus === VerificationStatus.REJECTED ? 'danger' :
                        request.verificationStatus === VerificationStatus.SUBMITTED ? 'warning' : 'info'
                      }>
                        {(request.verificationStatus || 'SUBMITTED').replace('_', ' ')}
                      </Badge>
                    </div>

                    <div className="space-y-2 mb-6">
                      <div className="flex items-center gap-2 text-[11px] text-slate-600">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Submitted: {formatDate(request.verificationSubmittedAt || request.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>Location: {request.ninLocation || 'Not provided'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border-t border-slate-100 flex gap-2">
                    <Button 
                      className="flex-1 text-xs h-9 font-bold bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                      onClick={() => handleReview(request)}
                    >
                      <Eye className="w-3.5 h-3.5 mr-2" />
                      Review Detail
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* DETAIL MODAL */}
      <Modal 
        isOpen={isDetailModalOpen} 
        onClose={() => setIsDetailModalOpen(false)}
        title="Review Identity Verification"
        size="lg"
      >
        {selectedRequest && (
          <div className="space-y-8">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 p-6 bg-slate-900 text-white rounded-2xl">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
                  <UserRound className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-black">{selectedRequest.verifiedName}</h3>
                  <p className="text-slate-400 text-xs font-medium">{selectedRequest.email}</p>
                </div>
              </div>
              <Badge variant={
                selectedRequest.verificationStatus === VerificationStatus.APPROVED ? 'success' :
                selectedRequest.verificationStatus === VerificationStatus.REJECTED ? 'danger' : 'warning'
              } className="px-4 py-1.5 h-auto text-xs">
                {(selectedRequest.verificationStatus || 'SUBMITTED').replace('_', ' ')}
              </Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column: Information */}
              <div className="space-y-6">
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Submitted Details
                  </h4>
                  
                  <Card className="divide-y divide-slate-100 overflow-hidden">
                    <div className="p-4 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Legal Name</span>
                      <span className="text-sm font-bold text-slate-900">{selectedRequest.verifiedName}</span>
                    </div>
                    <div className="p-4 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">NIN Number</span>
                      <span className="text-sm font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                        {maskNin(selectedRequest.ninNumber)}
                      </span>
                    </div>
                    <div className="p-4 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">NIN Location</span>
                      <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {selectedRequest.ninLocation}
                      </span>
                    </div>
                    <div className="p-4 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Submission Date</span>
                      <span className="text-sm font-bold text-slate-900">
                        {formatDate(selectedRequest.verificationSubmittedAt || selectedRequest.createdAt)}
                      </span>
                    </div>
                  </Card>
                </div>

                {selectedRequest.verificationStatus === VerificationStatus.REJECTED && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-red-900 font-bold text-xs uppercase tracking-widest">
                      <TriangleAlert className="w-4 h-4" />
                      Rejection History
                    </div>
                    <p className="text-sm text-red-800 italic">"{selectedRequest.rejectionReason}"</p>
                  </div>
                )}

                {/* Status Update / Rejection Form / Flag Form */}
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  {!showRejectionForm && !showFlagForm ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <LoadingButton 
                          className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black"
                          onClick={handleApprove}
                          isLoading={isProcessing}
                          loadingText="Approving..."
                          disabled={isProcessing || selectedRequest.verificationStatus === VerificationStatus.APPROVED}
                        >
                          <CheckCircle className="w-5 h-5 mr-2" />
                          {selectedRequest.verificationStatus === VerificationStatus.VERIFICATION_ISSUE ? 'Resolve & Approve' : 'Approve Identity'}
                        </LoadingButton>
                        <Button 
                          variant="outline" 
                          className="flex-1 h-12 border-red-200 text-red-600 hover:bg-red-50 font-black"
                          onClick={() => setShowRejectionForm(true)}
                          disabled={isProcessing}
                        >
                          <Ban className="w-5 h-5 mr-2" />
                          Request Changes
                        </Button>
                      </div>
                      
                      <Button 
                        variant="ghost"
                        className="w-full h-11 text-amber-600 hover:bg-amber-50 font-bold border border-amber-200 border-dashed"
                        onClick={() => setShowFlagForm(true)}
                        disabled={isProcessing}
                      >
                        <TriangleAlert className="w-4 h-4 mr-2" />
                        Flag Identity Issue
                      </Button>
                    </div>
                  ) : showRejectionForm ? (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between">
                        <h5 className="text-sm font-bold text-slate-900">Specify Rejection Reason</h5>
                        <Button size="sm" variant="ghost" onClick={() => setShowRejectionForm(false)}>
                          Cancel
                        </Button>
                      </div>
                      <textarea 
                        className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 min-h-[100px]"
                        placeholder="Explain what needs to be changed (e.g., Image is blurry, NIN doesn't match name...)"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                      />
                      <LoadingButton 
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-black h-11 shadow-lg shadow-red-600/20"
                        onClick={handleReject}
                        isLoading={isProcessing}
                        loadingText="Rejecting..."
                        disabled={isProcessing || !rejectionReason}
                      >
                        Confirm Rejection
                      </LoadingButton>
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between">
                        <h5 className="text-sm font-bold text-amber-900">Flag Verification Issue</h5>
                        <Button size="sm" variant="ghost" onClick={() => setShowFlagForm(false)}>
                          Cancel
                        </Button>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-500">Internal Reason (Select one)</label>
                          <select 
                            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-amber-500/50"
                            value={flagReason}
                            onChange={(e) => setFlagReason(e.target.value)}
                          >
                            <option value="">Select a reason...</option>
                            <option value="Identity information doesn't match">Identity information doesn't match</option>
                            <option value="NIN document unclear">NIN document unclear</option>
                            <option value="Name doesn't match submitted information">Name doesn't match submitted information</option>
                            <option value="Additional information required">Additional information required</option>
                            <option value="Payment/account information requires review">Payment/account information requires review</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-500">Customer-Facing Message</label>
                          <textarea 
                            className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs focus:ring-2 focus:ring-amber-500/50 min-h-[80px]"
                            placeholder="Explain the issue to the customer in a professional tone..."
                            value={flagMessage}
                            onChange={(e) => setFlagMessage(e.target.value)}
                          />
                        </div>
                      </div>

                      <LoadingButton 
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black h-11 shadow-lg shadow-amber-600/20"
                        onClick={handleFlag}
                        isLoading={isProcessing}
                        loadingText="Flagging..."
                        disabled={isProcessing || !flagReason || !flagMessage}
                      >
                        Flag Account
                      </LoadingButton>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Documents */}
              <div className="space-y-6">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  NIN Document Images
                </h4>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">NIN Front</span>
                      {selectedRequest.ninFrontUrl && (
                        <a href={selectedRequest.ninFrontUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 hover:underline">
                          View Full <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <div className="aspect-[1.6/1] bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden relative group">
                      {selectedRequest.ninFrontUrl ? (
                        <img src={selectedRequest.ninFrontUrl} alt="NIN Front" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                          <AlertCircle className="w-8 h-8 mb-2" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">No Image Available</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">NIN Back</span>
                      {selectedRequest.ninBackUrl && (
                        <a href={selectedRequest.ninBackUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 hover:underline">
                          View Full <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <div className="aspect-[1.6/1] bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden relative group">
                      {selectedRequest.ninBackUrl ? (
                        <img src={selectedRequest.ninBackUrl} alt="NIN Back" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                          <AlertCircle className="w-8 h-8 mb-2" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">No Image Available</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl space-y-2">
                  <div className="flex items-start gap-2 text-slate-500 text-[10px] leading-relaxed">
                    <TriangleAlert className="w-4 h-4 shrink-0 text-amber-500" />
                    <p>
                      <strong>Security Note:</strong> These documents contain sensitive PII. 
                      Ensure you are in a private environment before reviewing. 
                      Full NIN numbers are only visible to authorized personnel.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
