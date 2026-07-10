import React, { useState, useEffect } from 'react';
import { 
  Users, Search, Filter, MoreVertical, Shield, 
  ShieldAlert, Mail, Phone, MapPin, Calendar,
  CreditCard, FileText, Activity, Trash2, CheckCircle,
  XCircle, Edit
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { UserProfile, UserRole } from '../../types';
import { Card, Button, Badge, Input } from '../UI';
import { cn, formatDate } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../lib/AuthContext';

export const InvestorManager: React.FC = () => {
  const { hasPermission } = useAuth();
  const [investors, setInvestors] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvestor, setSelectedInvestor] = useState<UserProfile | null>(null);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED' | 'PENDING'>('ALL');

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => doc.data() as UserProfile)
        .filter(user => user.role === UserRole.INVESTOR);
      setInvestors(users);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const filteredInvestors = investors.filter(inv => {
    const matchesSearch = inv.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         inv.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         inv.investorId?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'ALL' || inv.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleStatusChange = async (uid: string, newStatus: 'ACTIVE' | 'SUSPENDED') => {
    try {
      await updateDoc(doc(db, 'users', uid), { status: newStatus });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleDelete = async (uid: string) => {
    if (!hasPermission('investors.delete')) {
      alert("You do not have permission to delete investors.");
      return;
    }
    if (confirm("Are you sure you want to delete this investor? This action cannot be undone.")) {
      try {
        await deleteDoc(doc(db, 'users', uid));
        setSelectedInvestor(null);
      } catch (error) {
        console.error("Error deleting investor:", error);
        alert("Failed to delete investor. Please check your permissions.");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input 
            placeholder="Search by name, email or ID..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto no-scrollbar">
          {(['ALL', 'ACTIVE', 'SUSPENDED', 'PENDING'] as const).map((status) => (
            <Button
              key={status}
              variant={filterStatus === status ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus(status)}
              className="whitespace-nowrap"
            >
              {status}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card title="Investors" icon={Users}>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-brand-border">
                    <th className="pb-4 text-[10px] uppercase text-gray-500 font-bold tracking-widest">Investor</th>
                    <th className="pb-4 text-[10px] uppercase text-gray-500 font-bold tracking-widest">ID</th>
                    <th className="pb-4 text-[10px] uppercase text-gray-500 font-bold tracking-widest">Status</th>
                    <th className="pb-4 text-[10px] uppercase text-gray-500 font-bold tracking-widest">Registered</th>
                    <th className="pb-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {filteredInvestors.map((inv) => (
                    <tr 
                      key={inv.uid} 
                      className={cn(
                        "group hover:bg-brand-muted/50 transition-colors cursor-pointer",
                        selectedInvestor?.uid === inv.uid && "bg-brand-muted"
                      )}
                      onClick={() => setSelectedInvestor(inv)}
                    >
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 border border-brand-border flex items-center justify-center text-[10px] font-bold">
                            {inv.displayName[0]}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">{inv.displayName}</p>
                            <p className="text-[10px] text-gray-500">{inv.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <span className="text-xs font-mono text-brand-green">{inv.investorId || '---'}</span>
                      </td>
                      <td className="py-4">
                        <Badge variant={
                          inv.status === 'ACTIVE' ? 'success' : 
                          inv.status === 'SUSPENDED' ? 'error' : 'warning'
                        }>
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="py-4 text-xs text-gray-400">
                        {formatDate(inv.createdAt)}
                      </td>
                      <td className="py-4 text-right">
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
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
            {selectedInvestor ? (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <Card title="Investor Profile" icon={Shield}>
                  <div className="space-y-6">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 border border-brand-border flex items-center justify-center text-xl font-bold mb-4">
                        {selectedInvestor.displayName[0]}
                      </div>
                      <h3 className="text-lg font-bold">{selectedInvestor.displayName}</h3>
                      <p className="text-xs text-gray-500 font-mono mb-2">{selectedInvestor.uid}</p>
                      <Badge variant={selectedInvestor.status === 'ACTIVE' ? 'success' : 'error'}>
                        {selectedInvestor.status}
                      </Badge>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-sm">
                        <Mail className="w-4 h-4 text-gray-500" />
                        <span>{selectedInvestor.email}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <Phone className="w-4 h-4 text-gray-500" />
                        <span>{selectedInvestor.phoneNumber || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        <span>{selectedInvestor.address || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span>Joined {formatDate(selectedInvestor.createdAt)}</span>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-brand-border grid grid-cols-2 gap-3">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => handleStatusChange(selectedInvestor.uid, selectedInvestor.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')}
                      >
                        {selectedInvestor.status === 'ACTIVE' ? (
                          <>
                            <ShieldAlert className="w-3 h-3 mr-2" />
                            Suspend
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-3 h-3 mr-2" />
                            Activate
                          </>
                        )}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full bg-red-600 text-white hover:bg-red-700 border-red-600"
                        onClick={() => handleDelete(selectedInvestor.uid)}
                      >
                        <Trash2 className="w-3 h-3 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ) : (
              <div className="h-full flex items-center justify-center border-2 border-dashed border-brand-border rounded-xl p-8 text-center text-gray-500">
                <div className="space-y-2">
                  <Users className="w-8 h-8 mx-auto opacity-20" />
                  <p className="text-sm">Select an investor to view full profile details and manage account.</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
