import React, { useRef, useState, useEffect } from 'react';
import { 
  Download, Printer, ShieldCheck, 
  MapPin, Mail, Phone, Globe, User, Building2, 
  FileText, Wallet, HeartPulse, Truck, Shield, Sparkles, X,
  Receipt
} from 'lucide-react';
import { Invoice, UserProfile, PlatformSettings } from '../types';
import { formatCurrency, formatDate } from '../lib/utils';
import jsPDF from 'jspdf';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { BrandLogo } from './BrandLogo';

interface CowPlugInvoiceProps {
  invoice: Invoice;
  investor?: UserProfile | null;
  onClose?: () => void;
  showActions?: boolean;
}

export const CowPlugInvoice: React.FC<CowPlugInvoiceProps> = ({
  invoice,
  investor: propInvestor,
  onClose,
  showActions = true
}) => {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [investor, setInvestor] = useState<UserProfile | null>(propInvestor || null);
  const [settings, setSettings] = useState<Partial<PlatformSettings>>({});

  useEffect(() => {
    // If investor is not passed in props, fetch from Firestore
    if (!propInvestor && invoice.investorId) {
      getDoc(doc(db, 'users', invoice.investorId)).then(snap => {
        if (snap.exists()) {
          setInvestor(snap.data() as UserProfile);
        }
      }).catch(err => console.error("Error fetching investor for invoice:", err));
    } else if (propInvestor) {
      setInvestor(propInvestor);
    }

    // Fetch global settings for company information
    getDoc(doc(db, 'settings', 'global')).then(snap => {
      if (snap.exists()) {
        setSettings(snap.data() as PlatformSettings);
      }
    }).catch(err => console.error("Error fetching settings for invoice:", err));
  }, [invoice, propInvestor]);

  // Derive dynamic line items
  const getItemRows = () => {
    if (invoice.items && invoice.items.length > 0) {
      return invoice.items.map((item, index) => {
        let Icon = FileText;
        const descLower = item.description.toLowerCase();
        const catLower = (item.category || '').toLowerCase();
        
        if (descLower.includes('cow') || descLower.includes('bull') || descLower.includes('cattle') || catLower.includes('livestock')) {
          Icon = FileText;
        } else if (descLower.includes('transport') || descLower.includes('logistics') || catLower.includes('transport')) {
          Icon = Truck;
        } else if (descLower.includes('vet') || descLower.includes('medical') || catLower.includes('healthcare')) {
          Icon = HeartPulse;
        } else if (descLower.includes('feed') || descLower.includes('fattening')) {
          Icon = Sparkles;
        } else {
          Icon = Shield;
        }

        return {
          id: index,
          Icon,
          description: item.description + (item.livestockTag ? ` (Tag: ${item.livestockTag})` : ''),
          category: item.category || 'Livestock Service',
          period: item.quantity > 1 ? `Qty: ${item.quantity}` : 'Standard',
          amount: item.amount || ((item.unitPrice || item.price || 0) * (item.quantity || 1))
        };
      });
    }

    // Fallback if structured items array isn't populated on legacy invoices
    const rows = [];
    let count = 0;

    if (invoice.sourcingDetails) {
      rows.push({
        id: count++,
        Icon: FileText,
        description: `${invoice.sourcingDetails.animalType || 'Livestock'} (${invoice.sourcingDetails.breed || 'Standard Breed'})`,
        category: 'Livestock Sourcing',
        period: `Qty: ${invoice.sourcingDetails.quantity || 1}`,
        amount: invoice.purchaseCost || invoice.totalAmount || 0
      });
    } else if (invoice.livestockPackage || invoice.livestockDetails) {
      rows.push({
        id: count++,
        Icon: FileText,
        description: invoice.livestockPackage || invoice.livestockDetails || 'Livestock Purchase',
        category: 'Livestock Sourcing',
        period: invoice.quantity ? `Qty: ${invoice.quantity}` : 'One-time',
        amount: invoice.purchaseCost || invoice.totalAmount || 0
      });
    }

    if (invoice.purchaseCost && !invoice.sourcingDetails && !invoice.livestockPackage && !invoice.livestockDetails) {
      rows.push({
        id: count++,
        Icon: FileText,
        description: 'Livestock Acquisition & Purchase Cost',
        category: 'Livestock Purchase',
        period: 'One-time',
        amount: invoice.purchaseCost
      });
    }

    if (invoice.transportationCost) {
      rows.push({
        id: count++,
        Icon: Truck,
        description: 'Logistics, Handling & Transportation',
        category: 'Logistics',
        period: 'In Transit',
        amount: invoice.transportationCost
      });
    }

    if (invoice.veterinaryCost) {
      rows.push({
        id: count++,
        Icon: HeartPulse,
        description: 'Veterinary Inspection & Health Clearance',
        category: 'Healthcare',
        period: 'Initial Check',
        amount: invoice.veterinaryCost
      });
    }

    if (invoice.otherCharges) {
      rows.push({
        id: count++,
        Icon: Shield,
        description: 'Farm Management & Processing Services',
        category: 'Farm Management',
        period: 'Service Term',
        amount: invoice.otherCharges
      });
    }

    if (rows.length === 0) {
      rows.push({
        id: 0,
        Icon: FileText,
        description: invoice.notes || 'CowPlugNG Livestock Investment Package',
        category: 'Investment Plan',
        period: 'Standard',
        amount: invoice.totalAmount || 0
      });
    }

    return rows;
  };

  const itemRows = getItemRows();
  const subtotal = invoice.subtotal || itemRows.reduce((acc, r) => acc + r.amount, 0);
  const discount = (invoice as any).discount || 0;
  const serviceCharge = (invoice as any).serviceCharge || 0;
  const totalAmount = invoice.totalAmount || (subtotal - discount + serviceCharge);

  // Bank Account details
  const bankName = invoice.bankDetails?.bankName || invoice.bankName || settings.bankDetails?.bankName || 'CowPlug Bank';
  const accountName = invoice.bankDetails?.accountName || invoice.accountName || settings.bankDetails?.accountName || 'CowPlugNG Operations';
  const accountNumber = invoice.bankDetails?.accountNumber || invoice.accountNumber || settings.bankDetails?.accountNumber || '0123456789';

  // PDF Export
  const handleDownloadPDF = async () => {
  console.log("handleDownloadPDF called");
  if (!invoiceRef.current) return;

  setDownloading(true);

  try {
    const element = invoiceRef.current;

    // Create a clean copy for PDF generation
    const clone = element.cloneNode(true) as HTMLElement;

    clone.style.width = '800px';
    clone.style.minHeight = '1050px';
    clone.style.height = 'auto';
    clone.style.position = 'absolute';
    clone.style.left = '-99999px';
    clone.style.top = '0';
    clone.style.background = '#ffffff';
    clone.style.overflow = 'visible';

    // Inject style sanitizer to prevent html2canvas oklch color parsing errors
    const styleSanitizer = document.createElement('style');
    styleSanitizer.innerHTML = `
      * {
        border-color: #cbd5e1 !important;
      }
      .text-white { color: #ffffff !important; }
      .bg-white { background-color: #ffffff !important; }
      .bg-emerald-600 { background-color: #059669 !important; }
      .text-emerald-700 { color: #047857 !important; }
      .text-emerald-600 { color: #059669 !important; }
      .bg-emerald-50 { background-color: #ecfdf5 !important; }
      .bg-slate-50 { background-color: #f8fafc !important; }
      .bg-slate-900 { background-color: #0f172a !important; }
      .text-slate-900 { color: #0f172a !important; }
      .text-slate-600 { color: #475569 !important; }
      .text-slate-500 { color: #64748b !important; }
      .border-slate-200 { border-color: #e2e8f0 !important; }
    `;
    clone.appendChild(styleSanitizer);

    document.body.appendChild(clone);

    // Make sure the browser has rendered the clone
    await new Promise(resolve => setTimeout(resolve, 300));

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    await pdf.html(clone, {
      callback: (doc) => {
        doc.save(`CowPlugNG_Invoice_${invoice.invoiceNumber || 'Document'}.pdf`);
      },
      x: 10,
      y: 10,
      width: 190,
      windowWidth: 800,
      margin: [10, 10, 10, 10]
    });

    document.body.removeChild(clone);

  } catch (error) {
    console.error('PDF GENERATION ERROR:', error);
    if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
    }

    alert(
      'Unable to generate the PDF. Please try again. Error: ' + (error instanceof Error ? error.message : 'Unknown')
    );
  } finally {
    setDownloading(false);
  }
};

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Top Bar Actions */}
      {showActions && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 text-white p-4 rounded-2xl print:hidden">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-xs font-black tracking-wide uppercase text-emerald-400">Official Billing Statement</p>
              <p className="text-sm font-bold text-slate-200">Invoice #{invoice.invoiceNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              type="button"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border border-slate-700"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              type="button"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-lg shadow-emerald-900/30 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{downloading ? 'Generating PDF...' : 'Download Invoice PDF'}</span>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                type="button"
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Printable Invoice Container (Exact A4 Styling matching Reference Image) */}
      <div className="overflow-x-auto pb-4">
        <div 
          ref={invoiceRef}
          className="w-[800px] min-h-[1050px] bg-white text-slate-800 p-10 mx-auto shadow-2xl rounded-sm font-sans relative flex flex-col justify-between border border-slate-200 print:shadow-none print:w-full print:p-6 print:border-none"
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          {/* TOP SECTION: Header branding & Title */}
          <div>
            <div className="flex justify-between items-start border-b-2 border-emerald-800/20 pb-6 mb-8">
              {/* Brand Logo & Name */}
              <BrandLogo variant="invoice" />

              {/* Invoice Title & Number */}
              <div className="text-right space-y-2">
                <h2 className="text-2xl font-black tracking-tight text-emerald-800 uppercase">
                  BILLING INVOICE
                </h2>
                <div className="inline-flex items-center gap-2 bg-emerald-900 text-white px-4 py-1.5 rounded-full text-xs font-mono font-bold shadow-sm">
                  <span>INVOICE NO:</span>
                  <span className="text-emerald-300">{invoice.invoiceNumber}</span>
                </div>
                <p className="text-xs font-bold text-slate-600 block">
                  DATE: <span className="font-semibold text-slate-800">{formatDate(invoice.createdAt)}</span>
                </p>
              </div>
            </div>

            {/* BILLED TO & COWPLUG CONTACT DETAILS GRID */}
            <div className="grid grid-cols-2 gap-8 mb-8 pb-6 border-b border-slate-100 relative">
              {/* Vertical divider */}
              <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-200" />

              {/* Billed To Column */}
              <div className="pr-4 space-y-2">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-900 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <User className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-black text-emerald-800 uppercase tracking-wider">
                    BILLED TO
                  </h3>
                </div>

                <div className="pl-1 space-y-1 text-xs">
                  <p className="font-extrabold text-slate-900 text-base">
                    {invoice.investorName || investor?.displayName || 'Valued Investor'}
                  </p>
                  <p className="text-slate-600 font-medium">
                    <span className="font-bold text-slate-800">Investor ID:</span> {investor?.uid ? `CPG-${investor.uid.slice(0, 8).toUpperCase()}` : 'CPG-INVESTOR'}
                  </p>
                  <p className="text-slate-600 font-medium">
                    <span className="font-bold text-slate-800">Email:</span> {investor?.email || 'investor@cowplug.ng'}
                  </p>
                  <p className="text-slate-600 font-medium">
                    <span className="font-bold text-slate-800">Phone:</span> {investor?.phoneNumber || investor?.phone || '+234 800 000 0000'}
                  </p>
                </div>
              </div>

              {/* CowPlugNG Business Information Column */}
              <div className="pl-6 space-y-2">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-900 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 tracking-tight leading-none">
                      CowPlugNG
                    </h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      CowPlug Ltd. Smart Agriculture
                    </p>
                  </div>
                </div>

                <div className="pl-1 space-y-1.5 text-xs text-slate-600">
                  <p className="flex items-center gap-2 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>{settings.address || 'Suite 402, Farmtech Hub, Central District, Abuja, Nigeria'}</span>
                  </p>
                  <p className="flex items-center gap-2 font-medium">
                    <Mail className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>{settings.contactEmail || 'info@cowplug.ng'}</span>
                  </p>
                  <p className="flex items-center gap-2 font-medium">
                    <Phone className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>{settings.contactPhone || '+234 800 269 7584'}</span>
                  </p>
                  <p className="flex items-center gap-2 font-medium">
                    <Globe className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>www.cowplug.ng</span>
                  </p>
                </div>
              </div>
            </div>

            {/* ITEM / DESCRIPTION TABLE */}
            <div className="mb-8">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-emerald-900 text-white text-[11px] font-black uppercase tracking-wider rounded-t-xl overflow-hidden">
                    <th className="py-3 px-4 rounded-tl-xl">ITEM / DESCRIPTION</th>
                    <th className="py-3 px-4">PLAN / SERVICE</th>
                    <th className="py-3 px-4 text-center">PERIOD</th>
                    <th className="py-3 px-4 text-right rounded-tr-xl">AMOUNT (₦)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {itemRows.map((row) => {
                    const RowIcon = row.Icon;
                    return (
                      <tr key={row.id} className="hover:bg-emerald-50/20 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-800">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-emerald-100/70 border border-emerald-200 text-emerald-800 flex items-center justify-center shrink-0">
                              <RowIcon className="w-3.5 h-3.5" />
                            </div>
                            <span>{row.description}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-600">
                          {row.category}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                          {row.period}
                        </td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-slate-900">
                          {formatCurrency(row.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* LOWER SECTION: Note & Payment Methods (Left) vs Financial Calculation (Right) */}
            <div className="grid grid-cols-12 gap-8 mb-8 pt-4">
              {/* Left Column (8 cols): Note & Payment Methods */}
              <div className="col-span-7 space-y-6">
                {/* Note block */}
                <div className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-full bg-emerald-900 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-1">
                      NOTE
                    </h4>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      {invoice.notes || "Thank you for trusting CowPlugNG with your investment. We are committed to managing your livestock with care and transparency."}
                    </p>
                  </div>
                </div>

                {/* Payment Methods & Account Details */}
                <div className="flex gap-3 items-start pt-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-900 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      PAYMENT METHODS
                    </h4>
                    
                    {/* Bank Coordinates Card */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 font-mono text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans font-bold">Bank:</span>
                        <span className="font-bold text-slate-900">{bankName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans font-bold">Account Name:</span>
                        <span className="font-bold text-slate-900">{accountName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans font-bold">Account No:</span>
                        <span className="font-black text-emerald-800 text-sm">{accountNumber}</span>
                      </div>
                    </div>

                    {/* Supported Providers Badges */}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Accepted:</span>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">OPay</span>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md">PalmPay</span>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-md">Kuda</span>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md">Direct Wire</span>
                    </div>

                    <p className="text-[10px] text-slate-500 font-medium italic pt-1">
                      After payment, please upload your receipt on the app. Our team will verify and confirm your payment.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column (5 cols): Financial Breakdown */}
              <div className="col-span-5 pl-4 border-l border-slate-200 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-extrabold text-slate-600">
                    <span>SUBTOTAL</span>
                    <span className="font-bold text-slate-800">{formatCurrency(subtotal)}</span>
                  </div>

                  <div className="flex justify-between text-xs font-extrabold text-slate-600">
                    <span>DISCOUNT</span>
                    <span className="font-bold text-slate-800">{discount > 0 ? `- ${formatCurrency(discount)}` : '₦0.00'}</span>
                  </div>

                  <div className="flex justify-between text-xs font-extrabold text-slate-600">
                    <span>SERVICE CHARGE</span>
                    <span className="font-bold text-slate-800">{serviceCharge > 0 ? formatCurrency(serviceCharge) : '₦0.00'}</span>
                  </div>

                  <div className="border-t-2 border-emerald-900 pt-3 flex justify-between items-center">
                    <span className="text-xs font-black text-emerald-900 uppercase tracking-wider">TOTAL AMOUNT (₦)</span>
                    <span className="text-lg font-black text-emerald-800">
                      {formatCurrency(totalAmount)}
                    </span>
                  </div>
                </div>

                {/* Status Stamp */}
                <div className="pt-6">
                  <div className={`p-3 rounded-xl border text-center font-black text-xs uppercase tracking-widest ${
                    invoice.status === 'PAID' 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300' 
                      : invoice.status === 'CANCELLED' 
                      ? 'bg-red-50 text-red-700 border-red-300' 
                      : 'bg-amber-50 text-amber-800 border-amber-300'
                  }`}>
                    STATUS: {invoice.status || 'PENDING'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* FOOTER BAR: Dark Green Curved Banner matching reference */}
          <div className="bg-emerald-900 text-white rounded-2xl p-4 flex items-center justify-center mt-8 shadow-lg">
            <span className="font-serif italic text-lg tracking-wide text-emerald-200">
              Thank You!
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
