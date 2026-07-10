import React, { useState, useEffect } from 'react';
import { 
  Activity, Search, Filter, Download, 
  User, Database, Shield, History, Clock,
  ArrowRight, Tag, FileText, Settings
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { ActivityLog } from '../../types';
import { Card, Button, Input } from '../UI';
import { cn, formatDate } from '../../lib/utils';

export const ActivityLogs: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'activityLogs'), orderBy('timestamp', 'desc'), limit(100));
    const unsub = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ActivityLog));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'activityLogs'));
    return unsub;
  }, []);

  const getTargetIcon = (type: string) => {
    switch (type) {
      case 'USER': return <User className="w-4 h-4" />;
      case 'LIVESTOCK': return <Tag className="w-4 h-4" />;
      case 'INVOICE': return <FileText className="w-4 h-4" />;
      case 'SETTING': return <Settings className="w-4 h-4" />;
      default: return <Database className="w-4 h-4" />;
    }
  };

  const filteredLogs = logs.filter(log => 
    log.adminName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.targetId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input 
            placeholder="Search by admin, action, or target ID..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export Audit Trail
        </Button>
      </div>

      <Card title="System Audit Logs" icon={History}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-brand-border">
                <th className="pb-4 text-[10px] uppercase text-gray-500 font-bold tracking-widest">Timestamp</th>
                <th className="pb-4 text-[10px] uppercase text-gray-500 font-bold tracking-widest">Administrator</th>
                <th className="pb-4 text-[10px] uppercase text-gray-500 font-bold tracking-widest">Action</th>
                <th className="pb-4 text-[10px] uppercase text-gray-500 font-bold tracking-widest">Target</th>
                <th className="pb-4 text-[10px] uppercase text-gray-500 font-bold tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="group hover:bg-brand-muted/30 transition-colors">
                  <td className="py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      {formatDate(log.timestamp)}
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-brand-muted flex items-center justify-center text-[10px] font-bold">
                        {log.adminName[0]}
                      </div>
                      <span className="text-sm font-semibold">{log.adminName}</span>
                    </div>
                  </td>
                  <td className="py-4">
                    <span className="text-xs font-mono text-brand-green bg-brand-green/10 px-2 py-0.5 rounded border border-brand-green/20">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      {getTargetIcon(log.targetType)}
                      <span className="font-mono">{log.targetId.slice(0, 8)}...</span>
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-brand-green">
                      <Shield className="w-3 h-3" />
                      Verified
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
