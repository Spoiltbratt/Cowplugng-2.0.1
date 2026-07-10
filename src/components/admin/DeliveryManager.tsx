import React, { useState, useEffect } from 'react';
import { 
  Truck, Search, Filter, MapPin, 
  Calendar, Package, ChevronRight, CheckCircle,
  Clock, AlertCircle, User, Phone, Map, Navigation
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, where } from 'firebase/firestore';
import { DeliveryRequest, DeliveryStatus, UserProfile, UserRole } from '../../types';
import { Card, Button, Badge, Input } from '../UI';
import { cn, formatDate } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export const DeliveryManager: React.FC = () => {
  const [deliveries, setDeliveries] = useState<DeliveryRequest[]>([]);
  const [investors, setInvestors] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryRequest | null>(null);

  useEffect(() => {
    const unsubDel = onSnapshot(query(collection(db, 'deliveryRequests')), (snapshot) => {
      setDeliveries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as DeliveryRequest));
      setLoading(false);
    });

    const unsubInv = onSnapshot(query(collection(db, 'users'), where('role', '==', UserRole.INVESTOR)), (snapshot) => {
      setInvestors(snapshot.docs.map(doc => doc.data() as UserProfile));
    });

    return () => {
      unsubDel();
      unsubInv();
    };
  }, []);

  const handleStatusChange = async (id: string, status: DeliveryStatus) => {
    await updateDoc(doc(db, 'deliveryRequests', id), { status });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input 
            placeholder="Search deliveries by address or investor..." 
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar w-full md:w-auto">
          {Object.values(DeliveryStatus).map((status) => (
            <Button key={status as string} variant="outline" size="sm" className="whitespace-nowrap">
              {(status as string).replace('_', ' ')}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Active Logistics" icon={Truck}>
            <div className="space-y-4">
              {deliveries.map((del) => (
                <div 
                  key={del.id}
                  onClick={() => setSelectedDelivery(del)}
                  className={cn(
                    "p-4 rounded-xl border border-brand-border bg-brand-muted/30 cursor-pointer hover:bg-brand-muted/50 transition-all group",
                    selectedDelivery?.id === del.id && "border-brand-green bg-brand-muted"
                  )}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-brand-surface border border-brand-border flex items-center justify-center">
                        <Package className="w-5 h-5 text-brand-green" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">
                          {investors.find(i => i.uid === del.investorId)?.displayName}
                        </p>
                        <p className="text-[10px] text-gray-500 font-mono tracking-widest">{del.id.slice(0, 10).toUpperCase()}</p>
                      </div>
                    </div>
                    <Badge variant={
                      del.status === DeliveryStatus.DELIVERED ? 'success' : 
                      del.status === DeliveryStatus.CANCELLED ? 'error' : 'warning'
                    }>
                      {(del.status as string).replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {del.address}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {del.scheduledAt ? formatDate(del.scheduledAt) : 'Not Scheduled'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div>
          <AnimatePresence mode="wait">
            {selectedDelivery ? (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <Card title="Delivery Context" icon={Navigation}>
                  <div className="space-y-6">
                    <div className="p-4 bg-brand-muted rounded-xl border border-brand-border space-y-4">
                      <div>
                        <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">Destination</p>
                        <p className="text-xs font-semibold leading-relaxed">{selectedDelivery.address}</p>
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">Item</p>
                          <p className="text-xs font-bold text-brand-green">1 Livestock</p>
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] uppercase text-gray-500 font-bold mb-1">Contact</p>
                          <p className="text-xs font-semibold">{investors.find(i => i.uid === selectedDelivery.investorId)?.phoneNumber || 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-[10px] uppercase text-gray-500 font-bold tracking-widest">Update Logistics Status</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.values(DeliveryStatus).slice(0, 4).map((status) => (
                          <Button 
                            key={status as string}
                            variant={selectedDelivery.status === status ? 'primary' : 'outline'}
                            size="sm"
                            className="text-[10px] py-1 h-auto"
                            onClick={() => handleStatusChange(selectedDelivery.id, status as DeliveryStatus)}
                          >
                            {(status as string).replace('_', ' ')}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-6 border-t border-brand-border space-y-3">
                      <Button variant="outline" size="sm" className="w-full">
                        <Map className="w-3 h-3 mr-2" />
                        View on Map
                      </Button>
                      <Button variant="outline" size="sm" className="w-full text-red-500 border-red-500/20 hover:bg-red-500/10">
                        Cancel Shipment
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ) : (
              <div className="h-full flex items-center justify-center border-2 border-dashed border-brand-border rounded-xl p-8 text-center text-gray-500">
                <Truck className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="text-sm">Select a delivery request to schedule logistics, assign drivers, and update status.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
