import React, { useState, useEffect } from 'react';
import { 
  Briefcase, Search, Plus, MapPin, 
  DollarSign, Calendar, Users, Trash2,
  Edit, CheckCircle, Clock, FileText,
  User, Mail, Phone, Target, AlertTriangle
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, addDoc, deleteDoc, where } from 'firebase/firestore';
import { Opportunity, OpportunityApplication, UserProfile, UserRole } from '../../types';
import { Card, Button, Badge, Input } from '../UI';
import { cn, formatDate } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export const OpportunityManager: React.FC = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [applications, setApplications] = useState<OpportunityApplication[]>([]);
  const [custodians, setCustodians] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);

  // Add / Edit form states
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formSalary, setFormSalary] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formRequirements, setFormRequirements] = useState('');
  const [formDeadline, setFormDeadline] = useState('');
  const [formStatus, setFormStatus] = useState<'OPEN' | 'CLOSED'>('OPEN');

  // Skeleton Components
  const OpportunitySkeleton = () => (
    <div className="p-4 rounded-xl border border-brand-border/50 bg-brand-muted/10 animate-pulse">
      <div className="flex justify-between items-start mb-3">
        <div className="h-4 w-3/4 bg-slate-200 rounded" />
        <div className="h-4 w-12 bg-slate-200 rounded-full" />
      </div>
      <div className="space-y-3 mb-5">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-slate-200 rounded-full" />
          <div className="h-2 w-1/2 bg-slate-200 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-slate-200 rounded-full" />
          <div className="h-2 w-1/3 bg-slate-200 rounded" />
        </div>
      </div>
      <div className="flex justify-between items-center pt-2 border-t border-brand-border/10">
        <div className="h-2 w-16 bg-slate-200 rounded" />
        <div className="h-2 w-16 bg-slate-200 rounded" />
      </div>
    </div>
  );

  const ApplicationSkeleton = () => (
    <div className="p-4 rounded-xl border border-brand-border/50 bg-brand-surface animate-pulse flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 flex-1">
        <div className="w-10 h-10 rounded-full bg-slate-200" />
        <div className="space-y-2 flex-1">
          <div className="h-3 w-1/3 bg-slate-200 rounded" />
          <div className="h-2 w-1/2 bg-slate-200 rounded" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="w-8 h-8 rounded bg-slate-200" />
        <div className="w-8 h-8 rounded bg-slate-200" />
      </div>
    </div>
  );

  useEffect(() => {
    const unsubOpp = onSnapshot(query(collection(db, 'opportunities')), (snapshot) => {
      const opps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Opportunity);
      // Sort by newest first
      setOpportunities(opps.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      setLoading(false);
    });

    const unsubApp = onSnapshot(query(collection(db, 'opportunityApplications')), (snapshot) => {
      setApplications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as OpportunityApplication));
    });

    const unsubCust = onSnapshot(query(collection(db, 'users'), where('role', '==', UserRole.CUSTODIAN)), (snapshot) => {
      setCustodians(snapshot.docs.map(doc => doc.data() as UserProfile));
    });

    return () => {
      unsubOpp();
      unsubApp();
      unsubCust();
    };
  }, []);

  const handleApplicationStatus = async (appId: string, status: 'APPROVED' | 'REJECTED' | 'REVIEWING') => {
    try {
      await updateDoc(doc(db, 'opportunityApplications', appId), { status });
    } catch (err) {
      console.error("Error updating application status:", err);
      alert("Failed to update status.");
    }
  };

  const resetForm = () => {
    setFormTitle('');
    setFormLocation('');
    setFormSalary('');
    setFormDescription('');
    setFormRequirements('');
    setFormDeadline('');
    setFormStatus('OPEN');
    setIsAdding(false);
    setIsEditing(false);
  };

  const startEdit = (opp: Opportunity) => {
    setFormTitle(opp.title);
    setFormLocation(opp.location);
    setFormSalary(opp.salary || '');
    setFormDescription(opp.description);
    setFormRequirements(opp.requirements.join('\n'));
    
    // Convert deadline timestamp to YYYY-MM-DD for date input
    const date = new Date(opp.deadline);
    const dateString = date.toISOString().split('T')[0];
    setFormDeadline(dateString);
    setFormStatus(opp.status || 'OPEN');
    
    setIsEditing(true);
    setIsAdding(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formLocation.trim() || !formDescription.trim() || !formDeadline) {
      alert("Please fill in all required fields.");
      return;
    }

    const reqs = formRequirements
      .split('\n')
      .map(r => r.trim())
      .filter(r => r.length > 0);

    const deadlineTimestamp = new Date(formDeadline).getTime();

    try {
      if (isEditing && selectedOpportunity) {
        // Update opportunity
        const oppRef = doc(db, 'opportunities', selectedOpportunity.id);
        const updatedData = {
          title: formTitle,
          location: formLocation,
          salary: formSalary,
          description: formDescription,
          requirements: reqs,
          deadline: deadlineTimestamp,
          status: formStatus,
        };
        await updateDoc(oppRef, updatedData);
        
        // Update selected state locally
        setSelectedOpportunity({
          ...selectedOpportunity,
          ...updatedData
        });
      } else {
        // Create opportunity
        await addDoc(collection(db, 'opportunities'), {
          title: formTitle,
          location: formLocation,
          salary: formSalary,
          description: formDescription,
          requirements: reqs,
          deadline: deadlineTimestamp,
          status: 'OPEN',
          createdAt: Date.now()
        });
      }
      resetForm();
    } catch (err) {
      console.error("Error saving opportunity:", err);
      alert("Failed to save opportunity.");
    }
  };

  const handleDelete = async (oppId: string) => {
    if (confirm("Are you sure you want to delete this job opportunity? This action cannot be undone.")) {
      try {
        await deleteDoc(doc(db, 'opportunities', oppId));
        setSelectedOpportunity(null);
        resetForm();
      } catch (err) {
        console.error("Error deleting opportunity:", err);
        alert("Failed to delete opportunity.");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-brand-green" />
          Opportunity Management
        </h2>
        <Button onClick={() => { setIsAdding(true); setIsEditing(false); setSelectedOpportunity(null); }}>
          <Plus className="w-4 h-4 mr-2" />
          Post New Job
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Active Jobs" icon={Target}>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => <OpportunitySkeleton key={i} />)}
              </div>
            ) : opportunities.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-brand-border rounded-xl">
                <Briefcase className="w-12 h-12 mx-auto mb-4 text-gray-700" />
                <p className="text-gray-500 text-sm">No job opportunities have been posted yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {opportunities.map((opp) => (
                  <div 
                    key={opp.id} 
                    onClick={() => {
                      setSelectedOpportunity(opp);
                      setIsAdding(false);
                      setIsEditing(false);
                    }}
                    className={cn(
                      "p-4 rounded-xl border border-brand-border bg-brand-muted/30 cursor-pointer hover:bg-brand-muted/50 transition-all",
                      selectedOpportunity?.id === opp.id && "border-brand-green bg-brand-muted"
                    )}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-slate-900 text-sm">{opp.title}</h3>
                      <Badge variant={opp.status === 'OPEN' && Date.now() < opp.deadline ? 'success' : 'error'}>
                        {opp.status === 'OPEN' && Date.now() < opp.deadline ? 'Open' : 'Closed'}
                      </Badge>
                    </div>
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                        <MapPin className="w-3 h-3" />
                        {opp.location}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-brand-green font-bold uppercase tracking-widest">
                        <DollarSign className="w-3 h-3" />
                        {opp.salary || "N/A"}
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-gray-500">
                      <span>{applications.filter(a => a.opportunityId === opp.id).length} Applications</span>
                      <span>Ends {formatDate(opp.deadline)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {selectedOpportunity && !isAdding && !isEditing && (
            <Card title={`Applications for ${selectedOpportunity.title}`} icon={Users}>
              <div className="space-y-4">
                {loading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => <ApplicationSkeleton key={i} />)}
                  </div>
                ) : applications.filter(a => a.opportunityId === selectedOpportunity.id).length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-xs">No applications submitted for this role yet.</div>
                ) : (
                  applications.filter(a => a.opportunityId === selectedOpportunity.id).map((app) => {
                    const custodian = custodians.find(c => c.uid === app.userId);
                    const isExpanded = expandedAppId === app.id;
                    const applicantName = custodian?.displayName || app.userName || app.fullName || 'Anonymous';
                    const applicantEmail = custodian?.email || app.userEmail || app.email || 'No Email';
                    return (
                      <div key={app.id} className="p-4 rounded-xl border border-brand-border bg-brand-surface flex flex-col gap-4 transition-all hover:border-brand-green/30">
                        <div 
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none"
                          onClick={() => setExpandedAppId(isExpanded ? null : app.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-brand-muted flex items-center justify-center text-xs font-bold text-brand-green">
                              {applicantName[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                {applicantName}
                                {!app.userId && <Badge variant="warning" className="text-[9px] py-0 px-1.5 font-normal tracking-wide lowercase">Guest</Badge>}
                              </p>
                              <p className="text-[10px] text-slate-600 font-medium">{applicantEmail}</p>
                              <p className="text-[10px] text-gray-500 font-mono tracking-widest mt-0.5">{formatDate(app.createdAt)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                            <Badge variant={
                              app.status === 'APPROVED' ? 'success' : 
                              app.status === 'REJECTED' ? 'error' : 'warning'
                            }>
                              {app.status}
                            </Badge>
                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-brand-green border-brand-green/20 hover:bg-brand-green/10"
                                onClick={() => handleApplicationStatus(app.id, 'APPROVED')}
                              >
                                <CheckCircle className="w-3 h-3" />
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-red-500 border-red-500/20 hover:bg-red-500/10"
                                onClick={() => handleApplicationStatus(app.id, 'REJECTED')}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Collapsible content */}
                        {isExpanded && (
                          <div className="border-t border-brand-border/60 pt-4 mt-1 text-xs space-y-3 animate-in fade-in duration-200">
                            {app.phoneNumber && (
                              <div>
                                <h5 className="text-[9px] uppercase tracking-wider font-bold text-slate-500 mb-0.5">Phone Number</h5>
                                <p className="text-slate-800 font-semibold select-all">{app.phoneNumber}</p>
                              </div>
                            )}
                            {app.experience && (
                              <div>
                                <h5 className="text-[9px] uppercase tracking-wider font-bold text-slate-500 mb-0.5">Experience & Qualifications</h5>
                                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{app.experience}</p>
                              </div>
                            )}
                            {app.coverLetter && (
                              <div>
                                <h5 className="text-[9px] uppercase tracking-wider font-bold text-slate-500 mb-0.5">Cover Letter / Message</h5>
                                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{app.coverLetter}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          )}
        </div>

        <div>
          <AnimatePresence mode="wait">
            {isAdding || isEditing ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <Card title={isEditing ? "Edit Opportunity" : "Post New Job"} icon={Briefcase}>
                  <form onSubmit={handleSave} className="space-y-4">
                    <Input 
                      label="Job Title" 
                      placeholder="e.g. Lead Cattle Custodian"
                      value={formTitle}
                      onChange={e => setFormTitle(e.target.value)}
                      required
                    />
                    <div className="grid grid-cols-1 gap-4">
                      <Input 
                        label="Location" 
                        placeholder="e.g. Oyo State Farm"
                        value={formLocation}
                        onChange={e => setFormLocation(e.target.value)}
                        required
                      />
                      <Input 
                        label="Salary / Compensation" 
                        placeholder="e.g. ₦150,000 / month"
                        value={formSalary}
                        onChange={e => setFormSalary(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-1.5">Job Description</label>
                      <textarea
                        className="w-full bg-white border border-brand-border rounded-lg px-4 py-2 text-slate-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all text-sm h-28 resize-none"
                        placeholder="Describe the role, farm setting, responsibilities, and key aspects of this livestock management opportunity..."
                        value={formDescription}
                        onChange={e => setFormDescription(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 block mb-1.5">Requirements (one per line)</label>
                      <textarea
                        className="w-full bg-white border border-brand-border rounded-lg px-4 py-2 text-slate-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all text-sm h-24 resize-none"
                        placeholder="e.g. Minimum 3 years experience with cattle&#10;Basic veterinary knowledge&#10;Strong physical fitness"
                        value={formRequirements}
                        onChange={e => setFormRequirements(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <Input 
                        label="Application Deadline" 
                        type="date"
                        value={formDeadline}
                        onChange={e => setFormDeadline(e.target.value)}
                        required
                      />
                      {isEditing && (
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-slate-700 block">Status</label>
                          <select 
                            className="w-full bg-white border border-brand-border rounded-lg px-4 py-2 text-slate-900 focus:outline-none focus:border-brand-green text-sm"
                            value={formStatus}
                            onChange={e => setFormStatus(e.target.value as 'OPEN' | 'CLOSED')}
                          >
                            <option value="OPEN">Open</option>
                            <option value="CLOSED">Closed</option>
                          </select>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 pt-4">
                      <Button type="button" variant="outline" className="flex-1" onClick={resetForm}>
                        Cancel
                      </Button>
                      <Button type="submit" className="flex-1">
                        Save Job
                      </Button>
                    </div>
                  </form>
                </Card>
              </motion.div>
            ) : selectedOpportunity ? (
              <motion.div
                key="details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <Card title="Job Details" icon={FileText}>
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-[10px] uppercase text-gray-500 font-bold mb-2 tracking-widest">Description</h4>
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{selectedOpportunity.description}</p>
                    </div>

                    {selectedOpportunity.requirements && selectedOpportunity.requirements.length > 0 && (
                      <div>
                        <h4 className="text-[10px] uppercase text-gray-500 font-bold mb-2 tracking-widest">Requirements</h4>
                        <ul className="space-y-1">
                          {selectedOpportunity.requirements.map((req, idx) => (
                            <li key={idx} className="text-xs text-slate-600 flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-brand-green mt-1.5 shrink-0" />
                              {req}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="pt-6 border-t border-brand-border space-y-3">
                      <Button variant="outline" size="sm" className="w-full" onClick={() => startEdit(selectedOpportunity)}>
                        <Edit className="w-3 h-3 mr-2" />
                        Edit Opportunity
                      </Button>
                      <Button variant="outline" size="sm" className="w-full text-red-500 border-red-500/20 hover:bg-red-500/10" onClick={() => handleDelete(selectedOpportunity.id)}>
                        <Trash2 className="w-3 h-3 mr-2" />
                        Delete Post
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ) : (
              <div className="h-full flex items-center justify-center border-2 border-dashed border-brand-border rounded-xl p-8 text-center text-gray-500">
                <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="text-sm">Select a job post to view full details and review custodian applications.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
