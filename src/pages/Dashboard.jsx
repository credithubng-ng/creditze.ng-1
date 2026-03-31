import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { 
  Wallet, 
  TrendingUp, 
  Clock, 
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  XCircle,
  FileText,
  Shield,
  Building2,
  ChevronRight,
  CreditCard,
  Download,
  Crown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [kyc, setKyc] = useState(null);
  const [creditSearch, setCreditSearch] = useState(null);
  const [creditLimit, setCreditLimit] = useState(null);
  const [loans, setLoans] = useState([]);
  const [approvedLoansWithoutMandate, setApprovedLoansWithoutMandate] = useState([]);
  const [premiumReports, setPremiumReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const [kycData, creditData, limitData, loanData, premiumData] = await Promise.all([
        base44.entities.KYCProfile.filter({ user_id: currentUser.id }),
        base44.entities.CreditSearch.filter({ user_id: currentUser.id }, '-created_date', 1),
        base44.entities.UserCreditLimit.filter({ user_id: currentUser.id }),
        base44.entities.LoanApplication.filter({ user_id: currentUser.id }, '-created_date', 5),
        base44.entities.CreditSearch.filter({ user_id: currentUser.id, payment_status: 'paid', report_url: { $exists: true } }, '-created_date')
      ]);

      setKyc(kycData[0] || null);
      setCreditSearch(creditData[0] || null);
      setCreditLimit(limitData[0] || null);
      setLoans(loanData);
      setPremiumReports(premiumData.filter(r => r.report_url));

      // Check for approved loans without mandates
      const approvedLoans = loanData.filter(loan => loan.status === 'approved');
      if (approvedLoans.length > 0) {
        const loansWithoutMandates = [];
        for (const loan of approvedLoans) {
          const mandates = await base44.entities.DirectDebitMandate.filter({ 
            loan_id: loan.id,
            status: { $in: ['active', 'pending'] }
          });
          if (mandates.length === 0) {
            loansWithoutMandates.push(loan);
          }
        }
        setApprovedLoansWithoutMandate(loansWithoutMandates);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getKycProgress = () => {
    if (!kyc) return 0;
    let progress = 0;
    if (kyc.phone_verified) progress += 20;
    if (kyc.bvn_verified) progress += 25;
    if (kyc.nin_verified) progress += 25;
    if (kyc.residential_address) progress += 30;
    return progress;
  };

  const isCreditSearchValid = () => {
    if (!creditSearch || creditSearch.search_status !== 'successful') return false;
    const expiry = new Date(creditSearch.expiry_date);
    return expiry > new Date();
  };

  const canApplyForLoan = () => {
    return kyc?.kyc_status === 'verified' && kyc?.phone_verified && isCreditSearchValid() && !creditLimit?.is_frozen;
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-blue-100 text-blue-700',
      disbursed: 'bg-emerald-100 text-emerald-700',
      repaid: 'bg-green-100 text-green-700',
      overdue: 'bg-orange-100 text-orange-700',
      defaulted: 'bg-red-100 text-red-700',
      rejected: 'bg-gray-100 text-gray-700'
    };
    return styles[status] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 px-4 pt-6 pb-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-emerald-100 text-sm">Welcome back,</p>
              <h1 className="text-white text-xl font-bold">{(kyc?.full_name || user?.full_name)?.split(' ')[0] || 'User'}</h1>
            </div>
            <Link to={createPageUrl('Profile')}>
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold">
                  {(kyc?.full_name || user?.full_name)?.charAt(0) || 'U'}
                </span>
              </div>
            </Link>
          </div>

          {/* Credit Limit Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-6 shadow-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-500 text-sm">Your Credit Limit</span>
              {creditLimit?.is_frozen && (
                <Badge variant="destructive" className="text-xs">Frozen</Badge>
              )}
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-2">
              ₦{(creditLimit?.current_limit || 10000).toLocaleString()}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-gray-600">
                {creditLimit?.successful_repayments || 0} successful repayments
              </span>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-4 space-y-4">
        {/* Phone Verification Warning */}
        {kyc?.phone_number && !kyc?.phone_verified && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <Card className="border-0 shadow-lg border-l-4 border-l-amber-500">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-6 h-6 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">Phone Not Verified</h3>
                    <p className="text-sm text-gray-500 mb-3">
                      Your phone number {kyc.phone_number} is not verified. This may affect your loan eligibility.
                    </p>
                    <Button asChild className="bg-amber-500 hover:bg-amber-600">
                      <Link to={createPageUrl('KYC')}>
                        Verify Phone Now <ArrowRight className="ml-2 w-4 h-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Direct Debit Setup Required */}
        {approvedLoansWithoutMandate.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-0 shadow-lg border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <CreditCard className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">Complete Direct Debit Setup</h3>
                    <p className="text-sm text-gray-500 mb-3">
                      Your loan is approved! Set up direct debit to receive your funds.
                    </p>
                    <Button asChild className="bg-blue-600 hover:bg-blue-700">
                      <Link to={createPageUrl(`SetupDirectDebit?loan_id=${approvedLoansWithoutMandate[0].id}`)}>
                        Set Up Now <ArrowRight className="ml-2 w-4 h-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Quick Actions */}
        {canApplyForLoan() && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <Link to={createPageUrl('ApplyLoan')}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                        <Wallet className="w-6 h-6 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Apply for a Loan</h3>
                        <p className="text-sm text-gray-500">Up to ₦{(creditLimit?.current_limit || 10000).toLocaleString()}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* KYC Progress */}
        {(!kyc || kyc.kyc_status !== 'verified') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-600" />
                  Complete Your KYC
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-500">Progress</span>
                    <span className="font-medium">{getKycProgress()}%</span>
                  </div>
                  <Progress value={getKycProgress()} className="h-2" />
                </div>
                <div className="space-y-2 mb-4">
                  {[
                    { label: 'Phone Verification', done: kyc?.phone_verified, warning: kyc?.phone_number && !kyc?.phone_verified },
                    { label: 'Pay ₦850 Credit Search', done: !!creditSearch && creditSearch.payment_status === 'paid' },
                    { label: 'BVN Verification', done: kyc?.bvn_verified },
                    { label: 'NIN Verification', done: kyc?.nin_verified },
                    { label: 'Liveness Check', done: kyc?.facial_recognition_verified },
                    { label: 'Address Details', done: kyc?.residential_address }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {item.done ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : item.warning ? (
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                      )}
                      <span className={item.done ? 'text-gray-500' : item.warning ? 'text-amber-600 font-medium' : 'text-gray-700'}>
                        {item.label}
                        {item.warning && ' (Unverified)'}
                      </span>
                    </div>
                  ))}
                </div>
                <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700">
                  <Link to={createPageUrl('KYC')}>
                    Continue KYC <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Credit Search Menu */}
        {kyc?.bvn && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className={`border-0 shadow-md ${!isCreditSearchValid() ? 'border-l-4 border-l-amber-500' : ''}`}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* Standard Credit Search */}
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isCreditSearchValid() ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                      <FileText className={`w-6 h-6 ${isCreditSearchValid() ? 'text-emerald-600' : 'text-amber-600'}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {isCreditSearchValid() ? 'Credit Search Active' : 'Credit Search'}
                      </h3>
                      <p className="text-sm text-gray-500 mb-3">
                        {isCreditSearchValid()
                          ? `Valid until ${new Date(creditSearch.expiry_date).toLocaleDateString()}`
                          : 'Complete a credit search to unlock loan applications. Valid for 90 days.'}
                      </p>
                      {!isCreditSearchValid() && (
                        <Button asChild size="sm" className="bg-amber-500 hover:bg-amber-600">
                          <Link to={createPageUrl('CreditSearch')}>
                            Pay ₦850 & Search <ArrowRight className="ml-2 w-4 h-4" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Premium Reports Section */}
                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Crown className="w-6 h-6 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">Premium Report</h3>
                        <p className="text-sm text-gray-500 mb-3">
                          {premiumReports.length > 0 
                            ? 'Download your detailed premium analysis' 
                            : 'Get comprehensive credit analysis with personalized improvement advice'}
                        </p>
                        {premiumReports.length > 0 ? (
                          <div className="space-y-2">
                            {premiumReports.slice(0, 3).map((report) => (
                              <Link
                                key={report.id}
                                to={report.report_url}
                                target="_blank"
                                className="flex items-center justify-between p-2 bg-purple-50 hover:bg-purple-100 rounded-lg transition"
                              >
                                <span className="text-sm font-medium text-purple-900">
                                  Premium Report • {new Date(report.created_date).toLocaleDateString()}
                                </span>
                                <Download className="w-4 h-4 text-purple-600" />
                              </Link>
                            ))}
                            {premiumReports.length > 3 && (
                              <Link
                                to={createPageUrl('CreditSearchHistory')}
                                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                              >
                                View all reports →
                              </Link>
                            )}
                          </div>
                        ) : (
                          <Button asChild size="sm" className="bg-purple-600 hover:bg-purple-700">
                            <Link to={createPageUrl('CreditSearch')}>
                              Pay ₦2,500 & Get Premium Report <ArrowRight className="ml-2 w-4 h-4" />
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Active Loans */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center justify-between">
                <span>Your Loans</span>
                {loans.length > 0 && (
                  <Link to={createPageUrl('CreditHistory')} className="text-sm text-emerald-600 font-normal">
                    View History
                  </Link>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loans.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Wallet className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500">No loans yet</p>
                  <p className="text-sm text-gray-400">Complete your verification to apply</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {loans.slice(0, 3).map((loan) => (
                    <Link key={loan.id} to={createPageUrl(`LoanDetails?id=${loan.id}`)}>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition">
                        <div>
                          <div className="font-medium text-gray-900">
                            ₦{loan.amount_approved?.toLocaleString() || loan.amount_requested?.toLocaleString()}
                          </div>
                          <div className="text-sm text-gray-500">
                            {loan.loan_type === 'urgent_10k' ? 'Urgent Loan' : 'Tier-1 Loan'}
                          </div>
                        </div>
                        <Badge className={getStatusBadge(loan.status)}>
                          {loan.status}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Tier-1 Employer Option */}
        {kyc?.kyc_status === 'verified' && isCreditSearchValid() && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="border-0 shadow-md bg-gradient-to-br from-gray-900 to-gray-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">Work at a Tier-1 Company?</h3>
                    <p className="text-sm text-gray-400">Unlock higher loan limits up to ₦5,000,000</p>
                  </div>
                  <Link to={createPageUrl('Tier1Verification')}>
                    <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600">
                      Verify
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}