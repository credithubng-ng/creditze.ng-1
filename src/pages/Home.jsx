import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { 
  ArrowRight, 
  Shield, 
  Clock, 
  TrendingUp, 
  CheckCircle2,
  Zap,
  Building2,
  Users,
  FileText,
  Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [affiliateCode, setAffiliateCode] = useState(null);
  const [user, setUser] = useState(null);
  const [creditSearch, setCreditSearch] = useState(null);

  useEffect(() => {
    checkAuth();
    captureAffiliate();
    captureReferral();
  }, []);

  const checkAuth = async () => {
    const auth = await base44.auth.isAuthenticated();
    setIsAuthenticated(auth);
    
    if (auth) {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error('Error loading user:', error);
      }
    }
  };

  const captureAffiliate = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const affiliateCode = urlParams.get('aff');
    if (affiliateCode) {
      localStorage.setItem('affiliate_code', affiliateCode);
    }
  };

  const captureReferral = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const referralCode = urlParams.get('ref');
    if (referralCode) {
      localStorage.setItem('referral_code', referralCode);
    }
  };



  const handleGetStarted = () => {
    if (isAuthenticated) {
      window.location.href = createPageUrl('Dashboard');
    } else {
      base44.auth.redirectToLogin(createPageUrl('Dashboard'));
    }
  };

  const handleExternalLoan = (url, type) => {
    if (!isAuthenticated) {
      base44.auth.redirectToLogin(createPageUrl(`CreditCheckGateway?type=${type}&url=${encodeURIComponent(url)}`));
      return;
    }
    
    // Navigate to credit check gateway
    window.location.href = createPageUrl(`CreditCheckGateway?type=${type}&url=${encodeURIComponent(url)}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69864d541609ebe758aa5d6d/ea48dae69_PHOTO-2026-02-05-09-26-23.jpg" 
              alt="Creditze Logo" 
              className="h-10"
            />
          </div>
          <div className="flex items-center gap-3">
            {!isAuthenticated && (
              <Button 
                variant="ghost"
                onClick={() => base44.auth.redirectToLogin(createPageUrl('Dashboard'))}
                className="text-gray-700 hover:text-gray-900 rounded-full px-6"
              >
                Login
              </Button>
            )}
            <Button 
              onClick={handleGetStarted}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-6"
            >
              {isAuthenticated ? 'Dashboard' : 'Get Started'}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium mb-6">
              Fast • Secure • Trusted
            </span>
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Get instant loans,
              <br />
              <span className="text-emerald-600">build your credit</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
              Access quick loans up to ₦5,000,000. Build your credit limit with every successful repayment.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                onClick={handleGetStarted}
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-8 py-6 text-lg"
              >
                {isAuthenticated ? 'Go to Dashboard' : 'Apply Now'} <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              {!isAuthenticated && (
                <Button 
                  size="lg"
                  variant="outline"
                  className="rounded-full px-8 py-6 text-lg border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => base44.auth.redirectToLogin(createPageUrl('Dashboard'))}
                >
                  Login
                </Button>
              )}
              {isAuthenticated && (
                <Button 
                  variant="outline"
                  size="lg"
                  className="rounded-full px-8 py-6 text-lg border-2"
                  asChild
                >
                  <Link to={createPageUrl('HowItWorks')}>
                    Learn More
                  </Link>
                </Button>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: '₦10k', label: 'Starting Amount' },
              { value: '5 mins', label: 'Quick Approval' },
              { value: '20%', label: 'Credit Growth' },
              { value: '₦5M', label: 'Borrow Up to' }
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="text-center p-6 bg-white rounded-2xl shadow-sm border border-gray-100"
              >
                <div className="text-2xl md:text-3xl font-bold text-emerald-600">{stat.value}</div>
                <div className="text-gray-500 text-sm mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Our Loan Products</h2>
            <p className="text-gray-600">Choose the option that works best for you</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {/* Urgent 10k */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-white rounded-3xl p-8 shadow-lg border border-gray-100 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -translate-y-16 translate-x-16" />
              <div className="relative">
                <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mb-6">
                  <Zap className="w-7 h-7 text-emerald-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Urgent ₦10,000</h3>
                <p className="text-gray-500 mb-6">Credit limit builder for new users</p>
                <ul className="space-y-3 mb-8">
                  {[
                    'Start with ₦10,000',
                    'Instant approval if eligible',
                    '20% limit increase per repayment',
                    'Build your credit history'
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-700">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button 
                  onClick={handleGetStarted}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-xl py-6"
                >
                  Apply Now
                </Button>
              </div>
            </motion.div>

            {/* Tier 1 */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 shadow-lg relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full -translate-y-16 translate-x-16" />
              <div className="relative">
                <div className="w-14 h-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-6">
                  <Building2 className="w-7 h-7 text-emerald-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Tier-1 Personal Loan</h3>
                <p className="text-gray-400 mb-6">For employees of approved companies</p>
                <ul className="space-y-3 mb-8">
                  {[
                    'Up to ₦5,000,000',
                    'Employer verification',
                    'Competitive rates',
                    'Flexible tenure'
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-300">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button 
                  onClick={handleGetStarted}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 rounded-xl py-6"
                >
                  Check Eligibility
                </Button>
              </div>
            </motion.div>

            {/* POF Loans */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-3xl p-8 shadow-lg border border-gray-100 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -translate-y-16 translate-x-16" />
              <div className="relative">
                <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-6">
                  <FileText className="w-7 h-7 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">POF Loans</h3>
                <p className="text-gray-500 mb-6">Show financial capacity with confidence</p>
                <ul className="space-y-3 mb-8">
                  {[
                    'Same day disbursement',
                    'Demonstrate financial capacity',
                    'Flexible loan amounts',
                    'Competitive rates'
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-700">
                      <CheckCircle2 className="w-5 h-5 text-blue-500" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button 
                  onClick={() => handleExternalLoan('https://creditze.ng/products/proof-of-funds-and-relocation-solutions/', 'pof')}
                  className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl py-6"
                >
                  {!isAuthenticated ? 'Login to Apply' : 'Apply Now'} <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </motion.div>

            {/* UK Loan */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-3xl p-8 shadow-lg relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full -translate-y-16 translate-x-16" />
              <div className="relative">
                <div className="w-14 h-14 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-6">
                  <Globe className="w-7 h-7 text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">£10,000 UK Loan</h3>
                <p className="text-blue-200 mb-6">For Nigerians living in UK</p>
                <ul className="space-y-3 mb-8">
                  {[
                    'Up to £10,000',
                    'Quick approval',
                    'We act as loan broker',
                    'UK residents only'
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-blue-100">
                      <CheckCircle2 className="w-5 h-5 text-blue-400" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button 
                  onClick={() => handleExternalLoan('https://creditze.ng/products/credit-brokerage-for-uk-based-nigerians/', 'uk')}
                  className="w-full bg-blue-500 hover:bg-blue-600 rounded-xl py-6"
                >
                  {!isAuthenticated ? 'Login to Apply' : 'Apply Now'} <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-gray-600">Simple steps to get your loan</p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { icon: Users, title: 'Complete KYC', desc: 'Verify your identity with BVN & NIN' },
              { icon: Shield, title: 'Credit Check', desc: 'Pay for credit search (₦850)' },
              { icon: Clock, title: 'Get Scored', desc: 'Automated scoring in minutes' },
              { icon: TrendingUp, title: 'Receive Funds', desc: 'Instant disbursement to your bank' }
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="relative inline-block mb-4">
                  <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center">
                    <step.icon className="w-8 h-8 text-emerald-600" />
                  </div>
                  <span className="absolute -top-2 -right-2 w-7 h-7 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {i + 1}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-500 text-sm">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69864d541609ebe758aa5d6d/ea48dae69_PHOTO-2026-02-05-09-26-23.jpg" 
                alt="Creditze Logo" 
                className="h-10"
              />
            </div>
            <div className="flex gap-6 text-gray-400 text-sm">
              <Link to={createPageUrl('Terms')} className="hover:text-white transition">Terms</Link>
              <Link to={createPageUrl('Privacy')} className="hover:text-white transition">Privacy</Link>
              <Link to={createPageUrl('Contact')} className="hover:text-white transition">Contact</Link>
            </div>
          </div>
          
          {/* Regulatory Compliance */}
          <div className="mt-8 pt-6 border-t border-gray-800">
            <p className="text-center text-gray-400 text-xs mb-4">Registered and Regulated by</p>
            <div className="flex flex-wrap items-center justify-center gap-8">
              <a href="https://ndpc.gov.ng/" target="_blank" rel="noopener noreferrer" className="transition hover:opacity-80">
                <img 
                  src="https://ndpc.gov.ng/wp-content/uploads/2024/02/cropped-NDPC_logo.png" 
                  alt="NDPC - Nigeria Data Protection Commission" 
                  className="h-12 md:h-14"
                />
              </a>
              <a href="https://fccpc.gov.ng/" target="_blank" rel="noopener noreferrer" className="transition hover:opacity-80">
                <img 
                  src="https://cdn.brandfetch.io/id6aUp1mV6/w/400/h/400/theme/dark/icon.jpeg" 
                  alt="FCCPC - Federal Competition and Consumer Protection Commission" 
                  className="h-12 md:h-14 rounded-lg"
                />
              </a>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-500 text-sm">
            © 2026 Creditze. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}