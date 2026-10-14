import React, { useState } from 'react';
import { 
  ConsultationRequest, 
  ConsultationRequestStatus, 
  Invoice, 
  PaymentReceipt,
  PaymentStatus,
  Livestock,
  LivestockStatus
} from '../../types';
import { Button, Badge, Card } from '../UI';
import { 
  CheckCircle2, 
  Clock, 
  FileText, 
  CreditCard, 
  ArrowRight, 
  AlertCircle, 
  Plus, 
  Search, 
  ShieldCheck,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { CowIcon as Cow } from '../CowIcon';
import { CowIcon as Beef } from '../CowIcon';
import { formatCurrency, formatDate } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export interface SourcingProgressSectionProps {
  requests: ConsultationRequest[];
  invoices: Invoice[];
  receipts: PaymentReceipt[];
  livestock: Livestock[];
  onViewTab: (tab: string, invoiceId?: string) => void;
  onRequestLivestock: () => void;
}

export interface StageDetails {
  stepIndex: number; // 0: Request Submitted, 1: Sourcing, 2: Invoice, 3: Payment, 4: Confirmed
  stageName: string;
  badgeLabel: string;
  badgeVariant: 'default' | 'success' | 'warning' | 'info';
  heading: string;
  description: string;
  ctaText: string;
  ctaTab: 'sourcing' | 'invoices' | 'receipts' | 'my-livestock';
  targetInvoiceId?: string;
  isUrgentAction: boolean;
}

export const getSourcingStageInfo = (
  request: ConsultationRequest,
  invoices: Invoice[],
  receipts: PaymentReceipt[],
  allLivestock: Livestock[]
): StageDetails => {
  // Check if any livestock slots are created for this request
  const requestLivestock = allLivestock.filter(l => l.sourcingRequestId === request.id);
  const isAwaitingArrival = requestLivestock.some(l => l.status === LivestockStatus.AWAITING_ARRIVAL);

  // Find linked invoice (by requestId or matching investor/amount)
  const linkedInvoice = invoices.find(inv => 
    inv.requestId === request.id || 
    (inv.investorId === request.userId && inv.status !== 'CANCELLED')
  );

  if (isAwaitingArrival) {
    return {
      stepIndex: 4,
      stageName: 'Livestock Reserved',
      badgeLabel: 'Awaiting Arrival',
      badgeVariant: 'warning',
      heading: 'Livestock Reserved & En Route',
      description: 'Your livestock slots have been reserved and are currently awaiting arrival at our farm for formal onboarding.',
      ctaText: 'View Reserved Assets',
      ctaTab: 'my-livestock',
      isUrgentAction: false
    };
  }

  if (linkedInvoice) {
    const linkedReceipt = receipts.find(r => r.invoiceId === linkedInvoice.id);

    if (linkedInvoice.status === 'PAID' || request.status === ConsultationRequestStatus.COMPLETED) {
      return {
        stepIndex: 4,
        stageName: 'Confirmed',
        badgeLabel: 'Purchase Confirmed',
        badgeVariant: 'success',
        heading: 'Purchase Confirmed',
        description: 'Your livestock purchase has been confirmed and added to your portfolio.',
        ctaText: 'View Livestock',
        ctaTab: 'my-livestock',
        isUrgentAction: false
      };
    }

    if (linkedReceipt && linkedReceipt.status === PaymentStatus.UNDER_REVIEW) {
      return {
        stepIndex: 3,
        stageName: 'Payment Under Review',
        badgeLabel: 'Payment Verifying',
        badgeVariant: 'info',
        heading: 'Payment Under Review',
        description: "We've received your payment receipt and are currently verifying it.",
        ctaText: 'View Payment',
        ctaTab: 'receipts',
        targetInvoiceId: linkedInvoice.id,
        isUrgentAction: false
      };
    }

    if (linkedInvoice.status === 'PENDING') {
      return {
        stepIndex: 2,
        stageName: 'Invoice Ready',
        badgeLabel: 'Payment Required',
        badgeVariant: 'warning',
        heading: 'Invoice Ready for Payment',
        description: `Your invoice of ${formatCurrency(linkedInvoice.totalAmount || linkedInvoice.amount || 0)} is ready. Complete your payment to continue.`,
        ctaText: 'Review & Pay Invoice',
        ctaTab: 'invoices',
        targetInvoiceId: linkedInvoice.id,
        isUrgentAction: true
      };
    }
  }

  // Handle request statuses when no explicit pending invoice is found
  const reqStatus = (request.status || '').toString();

  if (reqStatus === ConsultationRequestStatus.INVOICE_SENT || reqStatus === 'Invoice Sent') {
    return {
      stepIndex: 2,
      stageName: 'Invoice Ready',
      badgeLabel: 'Invoice Ready',
      badgeVariant: 'warning',
      heading: 'Invoice Ready',
      description: 'Your sourcing request has been completed and your invoice is ready for payment.',
      ctaText: 'View Invoice',
      ctaTab: 'invoices',
      isUrgentAction: true
    };
  }

  if (reqStatus === ConsultationRequestStatus.QUOTATION_PREPARED || reqStatus === 'Quotation Prepared') {
    return {
      stepIndex: 1,
      stageName: 'Livestock Found',
      badgeLabel: 'Livestock Found',
      badgeVariant: 'info',
      heading: 'Livestock Found',
      description: "We've found livestock that matches your request. Finalizing invoice details.",
      ctaText: 'Review Selection',
      ctaTab: 'sourcing',
      isUrgentAction: false
    };
  }

  if (reqStatus === ConsultationRequestStatus.CONTACTED || reqStatus === 'Contacted') {
    return {
      stepIndex: 1,
      stageName: 'Sourcing in Progress',
      badgeLabel: 'Sourcing in Progress',
      badgeVariant: 'info',
      heading: 'Sourcing in Progress',
      description: "We're currently looking for livestock that matches your request.",
      ctaText: 'View Request',
      ctaTab: 'sourcing',
      isUrgentAction: false
    };
  }

  // Default: Pending Contact / Request Submitted
  return {
    stepIndex: 0,
    stageName: 'Request Submitted',
    badgeLabel: 'Request Submitted',
    badgeVariant: 'default',
    heading: 'Request Submitted',
    description: "We've received your livestock request and our team is reviewing it.",
    ctaText: 'View Request',
    ctaTab: 'sourcing',
    isUrgentAction: false
  };
};

const TRACKER_STEPS = [
  { label: 'Request Submitted', shortLabel: 'Submitted' },
  { label: 'Sourcing in Progress', shortLabel: 'Sourcing' },
  { label: 'Invoice Ready', shortLabel: 'Invoice' },
  { label: 'Payment', shortLabel: 'Payment' },
  { label: 'Confirmed', shortLabel: 'Confirmed' }
];

export const SourcingProgressSection: React.FC<SourcingProgressSectionProps> = ({
  requests,
  invoices,
  receipts,
  livestock,
  onViewTab,
  onRequestLivestock
}) => {
  // Filter active requests (exclude Completed & Cancelled)
  const activeRequests = requests.filter(req => {
    const status = (req.status || '').toString();
    return (
      status !== ConsultationRequestStatus.COMPLETED &&
      status !== ConsultationRequestStatus.CANCELLED &&
      status !== 'Completed' &&
      status !== 'Cancelled'
    );
  });

  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefreshProgress = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 700);
  };

  // Default to first active request if not selected
  const currentRequest = activeRequests.find(r => r.id === selectedRequestId) || activeRequests[0];

  // If no active requests exist, show compact prompt card
  if (activeRequests.length === 0) {
    return (
      <div className="p-6 bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-900 rounded-2xl text-white shadow-md border border-emerald-800/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-emerald-500/10 blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
              <Search className="w-4 h-4 text-emerald-400" />
              Sourcing & Acquisitions
            </div>
            <h3 className="text-lg font-black tracking-tight text-white">
              Looking for specific livestock?
            </h3>
            <p className="text-slate-300 text-xs max-w-lg font-medium">
              Tell us what you need and our sourcing team will find verified livestock that matches your specifications.
            </p>
          </div>
          <Button 
            onClick={onRequestLivestock} 
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black shrink-0 text-xs px-5 py-2.5 shadow-lg border-0"
          >
            <Plus className="w-4 h-4 mr-1.5 stroke-[3]" /> Source Livestock
          </Button>
        </div>
      </div>
    );
  }

  // Active request exists
  const stageInfo = currentRequest ? getSourcingStageInfo(currentRequest, invoices, receipts, livestock) : null;

  return (
    <Card className="border-slate-200/90 shadow-sm overflow-hidden bg-white">
      {/* SECTION HEADER */}
      <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              Sourcing & Acquisitions
            </h2>
            {activeRequests.length > 1 && (
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold text-[10px] rounded-full">
                {activeRequests.length} Active Requests
              </span>
            )}
          </div>
          <p className="text-slate-500 text-xs font-medium mt-0.5">
            Track your livestock request from sourcing to purchase.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefreshProgress} 
            disabled={refreshing}
            className="text-slate-700 font-bold text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onViewTab('sourcing')} 
            className="text-slate-700 font-bold text-xs"
          >
            View All Requests <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      </div>

      {/* MULTIPLE ACTIVE REQUESTS SELECTOR (IF > 1) */}
      {activeRequests.length > 1 && (
        <div className="px-5 py-3 bg-slate-100/70 border-b border-slate-200/60 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
            Active Requests:
          </span>
          {activeRequests.map((req) => {
            const reqStage = getSourcingStageInfo(req, invoices, receipts, livestock);
            const isSelected = req.id === currentRequest?.id;
            return (
              <button
                key={req.id}
                onClick={() => setSelectedRequestId(req.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 border ${
                  isSelected 
                    ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs' 
                    : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-500'
                }`}
              >
                <span>{req.livestockInterest || 'Livestock'} Request</span>
                <span className={`px-1.5 py-0.2 text-[9px] rounded-md font-extrabold ${
                  isSelected ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-100 text-slate-600'
                }`}>
                  {reqStage.stageName}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ACTIVE REQUEST MAIN DISPLAY */}
      {currentRequest && stageInfo && (
        <div className="p-5 sm:p-6 space-y-6">
          {/* REQUEST TITLE & SUMMARY */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/70">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 text-base">
                  {currentRequest.notes ? (currentRequest.notes as string).slice(0, 40) : `${currentRequest.livestockInterest || 'Livestock'} Sourcing Request`}
                </h3>
                <Badge variant={stageInfo.badgeVariant}>
                  {stageInfo.badgeLabel}
                </Badge>
              </div>
              <p className="text-slate-500 text-xs font-medium mt-1">
                Interest: <span className="font-bold text-slate-800">{currentRequest.livestockInterest}</span>
                {currentRequest.budgetRange && ` · Budget: ${currentRequest.budgetRange}`}
                {currentRequest.createdAt && ` · Date: ${formatDate(currentRequest.createdAt)}`}
              </p>
            </div>
          </div>

          {/* 5-STEP HORIZONTAL PROGRESS TRACKER */}
          <div className="py-2">
            <div className="relative flex items-center justify-between w-full">
              {/* Progress Line */}
              <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-1 bg-slate-200 rounded-full z-0" />
              <div 
                className="absolute top-1/2 left-0 -translate-y-1/2 h-1 bg-emerald-600 rounded-full z-0 transition-all duration-500" 
                style={{ width: `${(stageInfo.stepIndex / (TRACKER_STEPS.length - 1)) * 100}%` }}
              />

              {/* Step Circles */}
              {TRACKER_STEPS.map((step, idx) => {
                const isCompleted = idx < stageInfo.stepIndex;
                const isCurrent = idx === stageInfo.stepIndex;

                return (
                  <div key={idx} className="relative z-10 flex flex-col items-center group">
                    <div 
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 ${
                        isCompleted 
                          ? 'bg-emerald-600 text-white ring-4 ring-emerald-50' 
                          : isCurrent 
                          ? 'bg-emerald-700 text-white ring-4 ring-emerald-100 scale-110 shadow-md' 
                          : 'bg-white text-slate-400 border-2 border-slate-200'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                      ) : isCurrent ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                      ) : (
                        <span>{idx + 1}</span>
                      )}
                    </div>
                    <span className={`text-[11px] font-bold mt-2 text-center hidden sm:block ${
                      isCurrent ? 'text-emerald-800 font-black' : isCompleted ? 'text-slate-700' : 'text-slate-400'
                    }`}>
                      {step.label}
                    </span>
                    <span className={`text-[10px] font-bold mt-2 text-center sm:hidden ${
                      isCurrent ? 'text-emerald-800 font-black' : isCompleted ? 'text-slate-700' : 'text-slate-400'
                    }`}>
                      {step.shortLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CURRENT STAGE REMINDER & ACTION BOX */}
          <div className={`p-5 rounded-2xl border transition-all ${
            stageInfo.isUrgentAction 
              ? 'bg-amber-50/80 border-amber-200/90 shadow-sm' 
              : 'bg-emerald-50/60 border-emerald-200/80'
          }`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                    stageInfo.isUrgentAction ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'
                  }`}>
                    Current Step
                  </span>
                  <h4 className="font-black text-slate-900 text-base">
                    {stageInfo.heading}
                  </h4>
                </div>
                <p className="text-slate-700 text-xs font-medium leading-relaxed max-w-xl">
                  {stageInfo.description}
                </p>
              </div>

              <Button 
                onClick={() => onViewTab(stageInfo.ctaTab, stageInfo.targetInvoiceId)}
                className={`font-black text-xs px-6 py-3 shrink-0 shadow-md transition-all ${
                  stageInfo.isUrgentAction 
                    ? 'bg-amber-600 hover:bg-amber-700 text-white' 
                    : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                }`}
              >
                {stageInfo.ctaText} <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
