import React, { useState, useEffect } from 'react';
import { 
  Beef as Cow, 
  ShieldCheck, 
  TrendingUp, 
  Users, 
  ChevronRight, 
  CheckCircle2, 
  Stethoscope, 
  Activity, 
  CreditCard, 
  FileText, 
  BarChart3, 
  Mail, 
  Phone, 
  MapPin, 
  MessageSquare,
  Search,
  UserPlus,
  ArrowRight,
  Menu,
  X,
  Plus,
  Briefcase,
  Calendar,
  Truck,
  Camera,
  Sun,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy, limit, where, addDoc, doc } from 'firebase/firestore';
import { Opportunity, SourcingRequestStatus } from '../types';
import { Button, Input, Card, Badge } from './UI';
import { cn, formatDate } from '../lib/utils';
import { useAuth } from '../lib/AuthContext';

interface LandingPageProps {
  onLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
  const { profile } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // Theme support
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.body.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.body.classList.remove('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Consultation Request State
  const [showConsultationModal, setShowConsultationModal] = useState(false);
  const [isSubmittingSourcing, setIsSubmittingSourcing] = useState(false);
  const [sourcingSuccess, setSourcingSuccess] = useState(false);
  const [sourcingError, setSourcingError] = useState('');
  const [consultationForm, setConsultationForm] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    preferredContactMethod: 'Phone',
    preferredContactTime: '',
    budgetRange: '',
    livestockInterest: 'Cattle',
    notes: ''
  });

  // Opportunity Application State
  const [selectedOppToApply, setSelectedOppToApply] = useState<Opportunity | null>(null);
  const [isSubmittingApp, setIsSubmittingApp] = useState(false);
  const [appSuccess, setAppSuccess] = useState(false);
  const [appError, setAppError] = useState('');
  const [appForm, setAppForm] = useState({
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    experience: '',
    coverLetter: ''
  });

  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const [isContactSuccess, setIsContactSuccess] = useState(false);
  const [contactError, setContactError] = useState('');

  // Real-time connected platform settings
  const [platformSettings, setPlatformSettings] = useState({
    companyName: 'CowPlugNG',
    contactEmail: 'cowplug.ng@gmail.com',
    contactPhone: '+234 808 271 9421',
    address: 'Badagry expressway, Pure water bustop, Lagos'
  });

  // General Form State
  const [generalForm, setGeneralForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    message: ''
  });

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingContact(true);
    setContactError('');

    try {
      await addDoc(collection(db, 'generalInquiries'), {
        firstName: generalForm.firstName,
        lastName: generalForm.lastName,
        email: generalForm.email,
        message: generalForm.message,
        createdAt: Date.now()
      });
      setIsContactSuccess(true);
    } catch (err: any) {
      console.error("Error submitting form: ", err);
      setContactError(err?.message || "Failed to submit request. Please try again.");
    } finally {
      setIsSubmittingContact(false);
    }
  };

  const handleConsultationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingSourcing(true);
    setSourcingError('');
    try {
      await addDoc(collection(db, 'consultationRequests'), {
        userId: profile?.uid || 'guest',
        investorName: consultationForm.fullName,
        email: consultationForm.email,
        phoneNumber: consultationForm.phoneNumber,
        preferredContactMethod: consultationForm.preferredContactMethod,
        preferredContactTime: consultationForm.preferredContactTime,
        budgetRange: consultationForm.budgetRange,
        livestockInterest: consultationForm.livestockInterest,
        notes: consultationForm.notes,
        status: 'Pending Contact',
        createdAt: Date.now() // Simple timestamp for guest leads
      });
      setSourcingSuccess(true);
    } catch (err: any) {
      console.error("Error submitting consultation request:", err);
      setSourcingError(err?.message || "Failed to submit request.");
    } finally {
      setIsSubmittingSourcing(false);
    }
  };

  const handleAppSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOppToApply) return;
    setIsSubmittingApp(true);
    setAppError('');
    try {
      if (profile) {
        await addDoc(collection(db, 'opportunityApplications'), {
          opportunityId: selectedOppToApply.id,
          custodianId: profile.uid,
          userId: profile.uid,
          userName: profile.name || profile.displayName || "Anonymous",
          userEmail: profile.email,
          status: 'PENDING',
          createdAt: Date.now()
        });
        setAppSuccess(true);
      } else {
        await addDoc(collection(db, 'generalInquiries'), {
          firstName: appForm.guestName.split(' ')[0] || 'Applicant',
          lastName: appForm.guestName.split(' ').slice(1).join(' ') || 'User',
          email: appForm.guestEmail,
          message: `Opportunity Application: Job for ${selectedOppToApply.title} (${selectedOppToApply.location}). Phone: ${appForm.guestPhone}. Experience: ${appForm.experience}. Cover Letter: ${appForm.coverLetter}`,
          createdAt: Date.now(),
          inquiryType: 'job_application'
        });
        setAppSuccess(true);
      }
    } catch (err: any) {
      console.error("Error submitting application:", err);
      setAppError(err?.message || "Failed to submit application.");
    } finally {
      setIsSubmittingApp(false);
    }
  };

  useEffect(() => {
    // Fetch opportunities
    const unsubOpp = onSnapshot(query(collection(db, 'opportunities'), where('status', '==', 'OPEN'), limit(3)), (snapshot) => {
      setOpportunities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Opportunity));
    }, (error) => {
      console.warn("Could not fetch opportunities:", error);
    });

    // Fetch global platform settings in real-time
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setPlatformSettings({
          companyName: data.companyName || 'CowPlugNG',
          contactEmail: data.contactEmail || 'cowplug.ng@gmail.com',
          contactPhone: data.contactPhone || '+234 808 271 9421',
          address: data.address || 'Badagry expressway, Pure water bustop, Lagos'
        });
      }
    }, (error) => {
      console.warn("Could not fetch platform settings:", error);
    });

    return () => {
      unsubOpp();
      unsubSettings();
    };
  }, []);

  const scrollTo = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
    setIsMenuOpen(false);
  };

  const navLinks = [
    { name: 'Home', id: 'hero' },
    { name: 'How It Works', id: 'how-it-works' },
    { name: 'Opportunities', id: 'opportunities' },
    { name: 'About', id: 'about' },
    { name: 'Contact', id: 'contact' },
  ];

  return (
    <div className="min-h-screen bg-brand-dark text-white font-sans selection:bg-brand-green/30 selection:text-brand-green transition-colors duration-300">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-brand-dark/80 backdrop-blur-md border-b border-white/10 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => scrollTo('hero')}>
            <div className="w-8 h-8 bg-brand-green rounded-lg flex items-center justify-center">
              <Cow className="w-5 h-5 text-black" />
            </div>
            <span className="font-bold text-xl tracking-tight">
              {platformSettings.companyName === 'CowPlugNG' ? (
                <>CowPlug<span className="text-brand-green">NG</span></>
              ) : (
                platformSettings.companyName
              )}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <button 
                key={link.id} 
                onClick={() => scrollTo(link.id)}
                className="text-sm font-medium text-gray-400 hover:text-brand-green transition-colors"
              >
                {link.name}
              </button>
            ))}
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg transition-colors border border-transparent hover:border-brand-border flex items-center justify-center shrink-0"
              title={theme === 'dark' ? "Switch to High-Contrast Light Mode" : "Switch to Default Dark Mode"}
            >
              {theme === 'dark' ? <Sun className="w-4.5 h-4.5 text-amber-500 animate-pulse" /> : <Moon className="w-4.5 h-4.5 text-indigo-400" />}
            </button>
            <Button onClick={onLogin} size="sm">Login</Button>
          </div>

          <div className="flex md:hidden items-center gap-4">
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg transition-colors"
              title={theme === 'dark' ? "Switch to High-Contrast Light Mode" : "Switch to Default Dark Mode"}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-indigo-400" />}
            </button>
            <button className="text-white" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-brand-dark border-b border-white/10 overflow-hidden"
            >
              <div className="px-6 py-8 flex flex-col gap-6">
                {navLinks.map((link) => (
                  <button 
                    key={link.id} 
                    onClick={() => scrollTo(link.id)}
                    className="text-lg font-medium text-gray-400 text-left"
                  >
                    {link.name}
                  </button>
                ))}
                <Button onClick={onLogin} className="w-full">Login</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <section id="hero" className="pt-40 pb-24 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            <Badge className="bg-brand-green/10 text-brand-green border-brand-green/20 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest">
              Professional Livestock Management
            </Badge>
            <h1 className="text-5xl lg:text-7xl font-bold leading-tight tracking-tight">
              Own Your <br />
              <span className="text-brand-green italic font-serif">Livestock Today.</span>
            </h1>
            <p className="text-brand-green text-xl font-medium tracking-tight">
              We'll Raise It Until You Need It.
            </p>
            <p className="text-gray-400 text-lg leading-relaxed max-w-xl">
              Purchase a healthy cow, goat, or ram today. CowPlugNG professionally manages your livestock, provides regular health updates, transparent records, and delivers your animal whenever you're ready.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button size="lg" className="px-8 h-14 text-base" onClick={onLogin}>
                Get Started
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
              <Button variant="outline" size="lg" className="px-8 h-14 text-base border-white/10 hover:border-white/20" onClick={onLogin}>
                Login to Portal
              </Button>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9, rotate: 2 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="relative"
          >
            <div className="absolute inset-0 bg-brand-green/20 blur-[120px] rounded-full" />
            <div className="relative aspect-square rounded-3xl overflow-hidden border border-white/10 bg-brand-surface/50 backdrop-blur-sm p-4">
               <div className="w-full h-full rounded-2xl bg-brand-dark flex items-center justify-center relative overflow-hidden group">
                  <div className="absolute inset-0 opacity-40 pointer-events-none bg-[url('/src/assets/images/cow_hero_tag_18_1783420576859.jpg')] bg-cover bg-center group-hover:scale-110 transition-transform duration-1000" />
                  <div className="relative z-10 text-center space-y-6 px-12">
                     <div className="w-24 h-24 bg-brand-green/20 rounded-full flex items-center justify-center mx-auto border border-brand-green/30">
                        <Cow className="w-12 h-12 text-brand-green" />
                     </div>
                     <div className="space-y-2">
                        <div className="flex items-center justify-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-brand-green" />
                          <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-green">Verified Asset</span>
                        </div>
                        <h3 className="text-3xl font-bold tracking-tighter">CPG-CW-0018</h3>
                        <div className="text-gray-400 text-sm font-medium">Uda Ram • 15kg • Excellent Health</div>
                     </div>
                     <div className="pt-6 grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                           <div className="text-xs text-gray-500 mb-1">Growth Progress</div>
                           <div className="text-xl font-bold text-brand-green">+12.4%</div>
                        </div>
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                           <div className="text-xs text-gray-500 mb-1">Weight Index</div>
                           <div className="text-xl font-bold">Optimal</div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Our Service Experience Blueprint */}
      <section id="how-it-works" className="py-24 px-6 bg-brand-surface/30">
        <div className="max-w-7xl mx-auto space-y-20">
          <div className="space-y-4 text-center max-w-3xl mx-auto">
            <Badge className="bg-brand-green/10 text-brand-green border-brand-green/20 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest">
              Our Service Experience Blueprint
            </Badge>
            <h2 className="text-3xl lg:text-5xl font-bold tracking-tight">Everything you need to secure and raise your animals with zero headache.</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
            {[
              { 
                step: '01',
                icon: Search, 
                title: 'Buy Livestock Today', 
                desc: 'Select from certified, healthy cows, goats, or rams inside our verified digital catalog.' 
              },
              { 
                step: '02',
                icon: ShieldCheck, 
                title: 'We Raise It For You', 
                desc: 'Our professional, certified pastoralist partners raise your animals in highly secure, premium green pastures.' 
              },
              { 
                step: '03',
                icon: Camera, 
                title: 'Regular Updates', 
                desc: 'Receive professional, regular updates on your livestock including photos, videos, and manual weight logs from our veterinary team.' 
              },
              { 
                step: '04',
                icon: Activity, 
                title: 'Custom Feeding Plans', 
                desc: 'Select your preferred nutrition regime—from standard pasture grass to premium high-density supplement mixes.' 
              },
              { 
                step: '05',
                icon: Stethoscope, 
                title: 'Full Veterinary Logs', 
                desc: 'Instant visibility of health reports, anti-parasite drenching histories, and regular vaccine tags.' 
              },
              { 
                step: '06',
                icon: Truck, 
                title: 'Deliver Whenever Needed', 
                desc: 'Request live transport directly to your wedding, festival, business premises, or home whenever you are ready.' 
              },
            ].map((step, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="relative group"
              >
                <div className="relative z-10 space-y-6 bg-brand-surface/50 border border-white/5 p-8 rounded-[2.5rem] hover:border-brand-green/30 transition-all duration-500">
                  <div className="flex justify-between items-start">
                    <div className="w-16 h-16 bg-brand-dark rounded-2xl border border-brand-border flex items-center justify-center group-hover:border-brand-green group-hover:bg-brand-green/10 transition-all duration-300">
                      <step.icon className="w-7 h-7 text-brand-green" />
                    </div>
                    <div className="text-right">
                      <div className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-gray-500 mb-1">Step {step.step}</div>
                      <div className="flex items-center gap-1.5 justify-end">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" />
                        <span className="text-[0.65rem] font-bold uppercase tracking-widest text-brand-green">Active</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-xl font-bold group-hover:text-brand-green transition-colors">{step.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose CowPlugNG */}
      <section className="py-24 px-6 border-y border-white/5">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <div className="space-y-4">
              <h2 className="text-3xl lg:text-5xl font-bold tracking-tight">Why Choose CowPlugNG</h2>
              <p className="text-gray-400 text-lg leading-relaxed max-w-2xl">
                We combine traditional agricultural expertise with modern administrative precision to deliver superior management for your livestock assets.
              </p>
            </div>
            <Button variant="outline" className="h-12 border-white/10" onClick={onLogin}>Explore Features</Button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: ShieldCheck, title: 'Verified Management', desc: 'Every operation is strictly supervised by our central administration.' },
              { icon: Activity, title: 'RFID / Tag Tracking', desc: 'Track every individual animal with unique identification numbers.' },
              { icon: Users, title: 'Professional Custodians', desc: 'Vetted farmers with proven tracks records in livestock care.' },
              { icon: Stethoscope, title: 'Veterinary Monitoring', desc: 'Regular health checks and professional medical interventions.' },
              { icon: BarChart3, title: 'Feeding & Growth', desc: 'Detailed reports on nutritional intake and weight milestones.' },
              { icon: CreditCard, title: 'Secure Verification', desc: 'All manual payments are strictly verified before asset allocation.' },
              { icon: FileText, title: 'Transparent Records', desc: 'Full history of health, feeding, and financial transactions.' },
              { icon: TrendingUp, title: 'Real-Time Updates', desc: 'Monitor your portfolio performance through our dashboard.' },
            ].map((feature, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
                className="p-8 rounded-3xl bg-brand-surface/30 border border-white/5 hover:border-brand-green/30 transition-all group"
              >
                <feature.icon className="w-8 h-8 text-brand-green mb-6 group-hover:scale-110 transition-transform" />
                <h3 className="text-lg font-bold mb-3">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Available Opportunities */}
      <section id="opportunities" className="py-24 px-6 border-b border-white/5">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <div className="space-y-4">
              <h2 className="text-3xl lg:text-5xl font-bold tracking-tight">Available Opportunities</h2>
              <p className="text-gray-400 text-lg leading-relaxed max-w-2xl">
                Join our network as a professional custodian or regional partner.
              </p>
            </div>
            <Button variant="outline" className="h-12 border-white/10" onClick={onLogin}>View All Opportunities</Button>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {opportunities.length > 0 ? (
              opportunities.map((opp, idx) => (
                <motion.div 
                  key={opp.id}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <Card className="h-full border-brand-border bg-brand-surface/30 hover:border-brand-green/30 transition-all p-8 flex flex-col">
                    <div className="flex justify-between items-start mb-6">
                      <div className="p-3 bg-brand-muted rounded-xl">
                        <Briefcase className="w-6 h-6 text-brand-green" />
                      </div>
                      <Badge variant="success">Open</Badge>
                    </div>
                    <h3 className="text-xl font-bold mb-2">{opp.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed mb-6 flex-grow">
                      {opp.description.length > 120 ? opp.description.substring(0, 120) + '...' : opp.description}
                    </p>
                    <div className="space-y-3 mb-8">
                      <div className="flex items-center gap-2 text-xs text-gray-500 uppercase font-bold tracking-widest">
                        <MapPin className="w-3.5 h-3.5 text-brand-green" />
                        {opp.location}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 uppercase font-bold tracking-widest">
                        <Calendar className="w-3.5 h-3.5 text-brand-green" />
                        Closes: {formatDate(opp.deadline)}
                      </div>
                    </div>
                    <Button 
                      onClick={() => {
                        setSelectedOppToApply(opp);
                        setAppForm({
                          guestName: '',
                          guestEmail: '',
                          guestPhone: '',
                          experience: '',
                          coverLetter: ''
                        });
                        setAppSuccess(false);
                        setAppError('');
                      }} 
                      variant="outline" 
                      className="w-full border-white/10 hover:border-brand-green hover:text-brand-green transition-colors"
                    >
                      Apply Now
                    </Button>
                  </Card>
                </motion.div>
              ))
            ) : (
              <div className="lg:col-span-3 py-20 text-center border-2 border-dashed border-brand-border rounded-3xl">
                <Briefcase className="w-12 h-12 mx-auto mb-4 text-gray-700" />
                <h4 className="text-xl font-bold text-gray-500">No Open Opportunities</h4>
                <p className="text-gray-600 mt-2">Check back later for new custodian and partner openings.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-32 px-6 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-4xl bg-brand-green/5 blur-[160px] rounded-full pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center space-y-12 relative z-10">
          <div className="w-20 h-20 bg-brand-green/20 rounded-full flex items-center justify-center mx-auto mb-8 border border-brand-green/30">
            <Cow className="w-10 h-10 text-brand-green" />
          </div>
          <h2 className="text-3xl lg:text-6xl font-bold tracking-tight">Our Mission</h2>
          <blockquote className="text-2xl lg:text-4xl font-serif italic text-gray-300 leading-tight">
            "CowPlugNG provides a structured livestock investment management platform that enables investors to participate in professionally managed livestock projects while supporting verified custodians and modern livestock administration."
          </blockquote>
          <p className="text-gray-400 text-lg leading-relaxed max-w-2xl mx-auto">
            We are dedicated to bridging the gap between urban capital and rural agricultural productivity through transparency, technology, and professional management.
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 px-6 bg-brand-surface/10 border-t border-white/5">
        <div className="max-w-3xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl lg:text-5xl font-bold tracking-tight">Frequently Asked Questions</h2>
            <p className="text-gray-400 text-lg leading-relaxed">Everything you need to know about investing with CowPlugNG.</p>
          </div>

          <div className="space-y-4">
            {[
              { q: 'How do I invest?', a: 'Register an account, verify your profile, and submit a sourcing request. Once reviewed, you will receive an invoice to complete your investment.' },
              { q: 'How does payment work?', a: 'We accept payments via manual bank transfer to our verified corporate accounts. This ensures maximum security and direct verification of every transaction.' },
              { q: 'How are livestock assigned?', a: 'Upon payment confirmation, the administration assigns specific animals to your portfolio. You will receive unique Tag numbers for each animal.' },
              { q: 'What is a Tag Number?', a: 'A Tag Number (e.g., CPG-CW-0001) is a unique identification assigned to each animal on our platform, allowing for precise tracking of health, growth, and ownership.' },
              { q: 'How do I monitor my livestock?', a: 'Log into your Investor Portal to see real-time updates on weight gain, veterinary reports, feeding schedules, and recent photos of your assets.' },
              { q: 'How are custodians selected?', a: 'Custodians undergo a rigorous vetting process, including physical farm inspections, background checks, and verification of their livestock management expertise.' },
            ].map((faq, idx) => (
              <div key={idx} className="border border-white/10 rounded-2xl overflow-hidden bg-brand-surface/30">
                <button 
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  className="w-full px-8 py-6 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                >
                  <span className="font-bold text-gray-200">{faq.q}</span>
                  <ChevronRight className={cn("w-5 h-5 text-brand-green transition-transform", activeFaq === idx && "rotate-90")} />
                </button>
                <AnimatePresence>
                  {activeFaq === idx && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-8 pb-8 text-gray-400 text-sm leading-relaxed border-t border-white/5 pt-4">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16">
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-3xl lg:text-5xl font-bold tracking-tight">Get in Touch</h2>
              <p className="text-gray-400 text-lg leading-relaxed">
                Have questions or need assistance? Our support team is ready to help you navigate your livestock investment journey.
              </p>
            </div>

            <div className="space-y-6 pt-4">
              <div className="flex items-center gap-4 group">
                <div className="w-12 h-12 bg-brand-green/10 rounded-xl flex items-center justify-center border border-brand-green/20 group-hover:bg-brand-green group-hover:text-black transition-all">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-gray-500 tracking-widest mb-0.5">Call Us</p>
                  <p className="text-white font-medium">{platformSettings.contactPhone}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 group">
                <div className="w-12 h-12 bg-brand-green/10 rounded-xl flex items-center justify-center border border-brand-green/20 group-hover:bg-brand-green group-hover:text-black transition-all">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-gray-500 tracking-widest mb-0.5">Email Support</p>
                  <p className="text-white font-medium">{platformSettings.contactEmail}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 group">
                <div className="w-12 h-12 bg-brand-green/10 rounded-xl flex items-center justify-center border border-brand-green/20 group-hover:bg-brand-green group-hover:text-black transition-all">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-gray-500 tracking-widest mb-0.5">Office Address</p>
                  <p className="text-white font-medium">{platformSettings.address}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 group">
                <div className="w-12 h-12 bg-brand-green/10 rounded-xl flex items-center justify-center border border-brand-green/20 group-hover:bg-brand-green group-hover:text-black transition-all">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-gray-500 tracking-widest mb-0.5">WhatsApp</p>
                  <p className="text-white font-medium">+234 808 271 9421</p>
                </div>
              </div>
            </div>
          </div>

          <Card className="p-8 border-brand-border bg-brand-surface/30">
            {isContactSuccess ? (
              <div className="py-12 text-center space-y-6">
                <div className="w-16 h-16 bg-brand-green/20 rounded-full flex items-center justify-center mx-auto border border-brand-green/30 animate-bounce">
                  <CheckCircle2 className="w-8 h-8 text-brand-green" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold tracking-tight text-white">Message Sent Successfully!</h3>
                  <p className="text-gray-400 text-sm max-w-sm mx-auto">
                    Thank you for getting in touch. Our support team will get back to you shortly.
                  </p>
                </div>
                <Button onClick={() => {
                  setIsContactSuccess(false);
                  setGeneralForm({ firstName: '', lastName: '', email: '', message: '' });
                }} className="h-12 px-6">
                  Send Another Message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-6">
                {contactError && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl font-medium">
                    {contactError}
                  </div>
                )}

                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-1.5 text-left">
                      <label className="text-xs font-bold uppercase tracking-widest text-gray-500 block">First Name</label>
                      <input
                        type="text"
                        required
                        value={generalForm.firstName}
                        onChange={(e) => setGeneralForm({ ...generalForm, firstName: e.target.value })}
                        className="w-full h-12 bg-brand-dark border border-brand-border rounded-xl px-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-green transition-all"
                        placeholder="John"
                      />
                    </div>
                    <div className="space-y-1.5 text-left">
                      <label className="text-xs font-bold uppercase tracking-widest text-gray-500 block">Last Name</label>
                      <input
                        type="text"
                        required
                        value={generalForm.lastName}
                        onChange={(e) => setGeneralForm({ ...generalForm, lastName: e.target.value })}
                        className="w-full h-12 bg-brand-dark border border-brand-border rounded-xl px-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-green transition-all"
                        placeholder="Doe"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500 block">Email Address</label>
                    <input
                      type="email"
                      required
                      value={generalForm.email}
                      onChange={(e) => setGeneralForm({ ...generalForm, email: e.target.value })}
                      className="w-full h-12 bg-brand-dark border border-brand-border rounded-xl px-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-green transition-all"
                      placeholder="john@example.com"
                    />
                  </div>

                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500 block">Message</label>
                    <textarea
                      required
                      value={generalForm.message}
                      onChange={(e) => setGeneralForm({ ...generalForm, message: e.target.value })}
                      className="w-full bg-brand-dark border border-brand-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-green transition-all min-h-[150px] resize-none"
                      placeholder="How can we help you?"
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={isSubmittingContact} 
                  className="w-full h-14 text-base font-bold tracking-tight flex items-center justify-center gap-2"
                >
                  {isSubmittingContact ? (
                    <>
                      <div className="w-5 h-5 border-2 border-brand-dark border-t-transparent rounded-full animate-spin" />
                      Submitting Request...
                    </>
                  ) : (
                    'Send Message'
                  )}
                </Button>
              </form>
            )}
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 px-6 bg-brand-surface/30 border-t border-white/5">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-12 mb-20">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-brand-green rounded-lg flex items-center justify-center">
                <Cow className="w-5 h-5 text-black" />
              </div>
              <span className="font-bold text-xl tracking-tight text-white">
                {platformSettings.companyName === 'CowPlugNG' ? (
                  <>CowPlug<span className="text-brand-green">NG</span></>
                ) : (
                  platformSettings.companyName
                )}
              </span>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed">
              Professional livestock investment and management platform. Enabling sustainable agricultural wealth.
            </p>
          </div>

          <div>
            <h4 className="text-white font-bold mb-6">Company</h4>
            <ul className="space-y-4 text-gray-500 text-sm">
              <li><button onClick={() => scrollTo('about')} className="hover:text-brand-green transition-colors">About Us</button></li>
              <li><button onClick={() => scrollTo('opportunities')} className="hover:text-brand-green transition-colors">Opportunities</button></li>
              <li><button onClick={() => scrollTo('hero')} className="hover:text-brand-green transition-colors">Our Mission</button></li>
              <li><button onClick={() => scrollTo('contact')} className="hover:text-brand-green transition-colors">Contact</button></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-6">Support</h4>
            <ul className="space-y-4 text-gray-500 text-sm">
              <li><button className="hover:text-brand-green transition-colors">Privacy Policy</button></li>
              <li><button className="hover:text-brand-green transition-colors">Terms of Service</button></li>
              <li><button className="hover:text-brand-green transition-colors">FAQ</button></li>
              <li><button className="hover:text-brand-green transition-colors">Help Center</button></li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-gray-600 text-xs font-medium tracking-widest uppercase">
          <p>© 2026 {platformSettings.companyName.toUpperCase()} PLATFORM. ALL RIGHTS RESERVED.</p>
          <div className="flex gap-8">
            <button className="hover:text-brand-green transition-colors">Twitter</button>
            <button className="hover:text-brand-green transition-colors">LinkedIn</button>
            <button className="hover:text-brand-green transition-colors">Instagram</button>
          </div>
        </div>
      </footer>

      {/* Consultation Request Modal */}
      <AnimatePresence>
        {showConsultationModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConsultationModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-brand-surface border border-white/10 p-8 rounded-3xl shadow-2xl overflow-y-auto max-h-[90vh] z-10"
            >
              <button 
                onClick={() => setShowConsultationModal(false)}
                className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Badge className="bg-brand-green/10 text-brand-green border-brand-green/20">
                    Sourcing Consultation
                  </Badge>
                  <h3 className="text-2xl font-bold tracking-tight">
                    Request a Consultation
                  </h3>
                  <p className="text-gray-400 text-sm">
                    A CowPlugNG representative will contact you to discuss your livestock sourcing requirements.
                  </p>
                </div>

                {sourcingSuccess ? (
                  <div className="py-8 text-center space-y-4">
                    <div className="w-16 h-16 bg-brand-green/20 rounded-full flex items-center justify-center mx-auto border border-brand-green/30">
                      <CheckCircle2 className="w-8 h-8 text-brand-green" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xl font-bold">Request Received!</h4>
                      <p className="text-gray-400 text-sm">
                        Thank you. Your consultation request has been received. A CowPlugNG representative will contact you to discuss your livestock sourcing requirements.
                      </p>
                    </div>
                    <Button onClick={() => setShowConsultationModal(false)} className="w-full h-12 mt-4">
                      Close Window
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleConsultationSubmit} className="space-y-4">
                    {sourcingError && (
                      <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl font-medium">
                        {sourcingError}
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-bold uppercase tracking-widest text-gray-500 block">Full Name</label>
                        <input
                          type="text"
                          required
                          value={consultationForm.fullName}
                          onChange={(e) => setConsultationForm({ ...consultationForm, fullName: e.target.value })}
                          className="w-full h-11 bg-brand-dark border border-brand-border rounded-xl px-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-green transition-all"
                          placeholder="John Doe"
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5 text-left">
                          <label className="text-xs font-bold uppercase tracking-widest text-gray-500 block">Email Address</label>
                          <input
                            type="email"
                            required
                            value={consultationForm.email}
                            onChange={(e) => setConsultationForm({ ...consultationForm, email: e.target.value })}
                            className="w-full h-11 bg-brand-dark border border-brand-border rounded-xl px-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-green transition-all"
                            placeholder="john@example.com"
                          />
                        </div>
                        <div className="space-y-1.5 text-left">
                          <label className="text-xs font-bold uppercase tracking-widest text-gray-500 block">Phone Number</label>
                          <input
                            type="tel"
                            required
                            value={consultationForm.phoneNumber}
                            onChange={(e) => setConsultationForm({ ...consultationForm, phoneNumber: e.target.value })}
                            className="w-full h-11 bg-brand-dark border border-brand-border rounded-xl px-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-green transition-all"
                            placeholder="+234 ..."
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5 text-left">
                          <label className="text-xs font-bold uppercase tracking-widest text-gray-500 block">Contact Method</label>
                          <select 
                            className="w-full h-11 bg-brand-dark border border-brand-border rounded-xl px-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-green transition-all"
                            value={consultationForm.preferredContactMethod}
                            onChange={e => setConsultationForm({ ...consultationForm, preferredContactMethod: e.target.value as any })}
                          >
                            <option value="Phone">Phone</option>
                            <option value="WhatsApp">WhatsApp</option>
                            <option value="Email">Email</option>
                          </select>
                        </div>
                        <div className="space-y-1.5 text-left">
                          <label className="text-xs font-bold uppercase tracking-widest text-gray-500 block">Preferred Time</label>
                          <input
                            type="text"
                            required
                            value={consultationForm.preferredContactTime}
                            onChange={(e) => setConsultationForm({ ...consultationForm, preferredContactTime: e.target.value })}
                            className="w-full h-11 bg-brand-dark border border-brand-border rounded-xl px-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-green transition-all"
                            placeholder="e.g. Morning"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5 text-left">
                          <label className="text-xs font-bold uppercase tracking-widest text-gray-500 block">Budget Range</label>
                          <input
                            type="text"
                            required
                            value={consultationForm.budgetRange}
                            onChange={(e) => setConsultationForm({ ...consultationForm, budgetRange: e.target.value })}
                            className="w-full h-11 bg-brand-dark border border-brand-border rounded-xl px-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-green transition-all"
                            placeholder="e.g. ₦1M - ₦5M"
                          />
                        </div>
                        <div className="space-y-1.5 text-left">
                          <label className="text-xs font-bold uppercase tracking-widest text-gray-500 block">Livestock Interest</label>
                          <select 
                            className="w-full h-11 bg-brand-dark border border-brand-border rounded-xl px-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-green transition-all"
                            value={consultationForm.livestockInterest}
                            onChange={e => setConsultationForm({ ...consultationForm, livestockInterest: e.target.value as any })}
                          >
                            <option value="Cattle">Cattle</option>
                            <option value="Rams">Rams</option>
                            <option value="Goats">Goats</option>
                            <option value="Multiple">Multiple</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-bold uppercase tracking-widest text-gray-500 block">Notes (Optional)</label>
                        <textarea
                          value={consultationForm.notes}
                          onChange={(e) => setConsultationForm({ ...consultationForm, notes: e.target.value })}
                          className="w-full bg-brand-dark border border-brand-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-green transition-all min-h-[80px] resize-none"
                          placeholder="Tell us more about your needs..."
                        />
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      disabled={isSubmittingSourcing}
                      className="w-full h-12 mt-4"
                    >
                      {isSubmittingSourcing ? 'Submitting...' : 'Request a Consultation'}
                    </Button>
                    {!profile && (
                      <p className="text-[10px] text-gray-500 text-center mt-2">
                        You can also <button type="button" onClick={() => { setShowConsultationModal(false); onLogin(); }} className="text-brand-green hover:underline">login or sign up</button> to manage your requests online.
                      </p>
                    )}
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Job Application Modal */}
      <AnimatePresence>
        {selectedOppToApply && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOppToApply(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-brand-surface border border-white/10 p-8 rounded-3xl shadow-2xl overflow-y-auto max-h-[90vh] z-10"
            >
              <button 
                onClick={() => setSelectedOppToApply(null)}
                className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Badge className="bg-brand-green/10 text-brand-green border-brand-green/20">
                    Join Our Network
                  </Badge>
                  <h3 className="text-2xl font-bold tracking-tight">
                    Apply: {selectedOppToApply.title}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Location: {selectedOppToApply.location} • Closes: {formatDate(selectedOppToApply.deadline)}
                  </p>
                </div>

                {appSuccess ? (
                  <div className="py-8 text-center space-y-4">
                    <div className="w-16 h-16 bg-brand-green/20 rounded-full flex items-center justify-center mx-auto border border-brand-green/30">
                      <CheckCircle2 className="w-8 h-8 text-brand-green" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xl font-bold">Application Received!</h4>
                      <p className="text-gray-400 text-sm">
                        {profile 
                          ? "We have registered your application on the portal! Our administrative desk will review your credentials."
                          : "Thank you for applying! Our administrative desk has received your information. We'll contact you via email soon."
                        }
                      </p>
                    </div>
                    <Button onClick={() => setSelectedOppToApply(null)} className="w-full h-12 mt-4">
                      Close Window
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleAppSubmit} className="space-y-4">
                    {appError && (
                      <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl font-medium">
                        {appError}
                      </div>
                    )}

                    {!profile ? (
                      <div className="space-y-4">
                        <div className="space-y-1.5 text-left">
                          <label className="text-xs font-bold uppercase tracking-widest text-gray-500 block">Your Full Name</label>
                          <input
                            type="text"
                            required
                            value={appForm.guestName}
                            onChange={(e) => setAppForm({ ...appForm, guestName: e.target.value })}
                            className="w-full h-11 bg-brand-dark border border-brand-border rounded-xl px-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-green transition-all"
                            placeholder="John Doe"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5 text-left">
                            <label className="text-xs font-bold uppercase tracking-widest text-gray-500 block">Email Address</label>
                            <input
                              type="email"
                              required
                              value={appForm.guestEmail}
                              onChange={(e) => setAppForm({ ...appForm, guestEmail: e.target.value })}
                              className="w-full h-11 bg-brand-dark border border-brand-border rounded-xl px-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-green transition-all"
                              placeholder="john@example.com"
                            />
                          </div>
                          <div className="space-y-1.5 text-left">
                            <label className="text-xs font-bold uppercase tracking-widest text-gray-500 block">Phone Number</label>
                            <input
                              type="tel"
                              required
                              value={appForm.guestPhone}
                              onChange={(e) => setAppForm({ ...appForm, guestPhone: e.target.value })}
                              className="w-full h-11 bg-brand-dark border border-brand-border rounded-xl px-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-green transition-all"
                              placeholder="+234 808 271 9421"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5 text-left">
                          <label className="text-xs font-bold uppercase tracking-widest text-gray-500 block">Brief Experience / Qualifications</label>
                          <textarea
                            required
                            value={appForm.experience}
                            onChange={(e) => setAppForm({ ...appForm, experience: e.target.value })}
                            className="w-full bg-brand-dark border border-brand-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-green transition-all min-h-[80px] resize-none"
                            placeholder="Briefly state your experience with livestock custody, farming, or operations."
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-brand-muted/50 border border-brand-border rounded-xl">
                        <p className="text-sm text-gray-400">
                          Applying as verified user: <strong className="text-white">{profile.name || profile.displayName}</strong> ({profile.email}).
                        </p>
                      </div>
                    )}

                    <div className="space-y-1.5 text-left">
                      <label className="text-xs font-bold uppercase tracking-widest text-gray-500 block">Cover Letter / Message</label>
                      <textarea
                        required={!profile}
                        value={appForm.coverLetter}
                        onChange={(e) => setAppForm({ ...appForm, coverLetter: e.target.value })}
                        className="w-full bg-brand-dark border border-brand-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-green transition-all min-h-[100px] resize-none"
                        placeholder="Why do you want to join our pastoralist/custodian network?"
                      />
                    </div>

                    <Button 
                      type="submit" 
                      disabled={isSubmittingApp}
                      className="w-full h-12 text-sm font-bold tracking-tight mt-2 flex items-center justify-center gap-2"
                    >
                      {isSubmittingApp ? (
                        <>
                          <div className="w-4 h-4 border-2 border-brand-dark border-t-transparent rounded-full animate-spin" />
                          Submitting Application...
                        </>
                      ) : (
                        'Submit Application'
                      )}
                    </Button>
                    {!profile && (
                      <p className="text-[10px] text-gray-500 text-center mt-2">
                        You can also <button type="button" onClick={() => { setSelectedOppToApply(null); onLogin(); }} className="text-brand-green hover:underline">login or sign up</button> to track your applications directly.
                      </p>
                    )}
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
