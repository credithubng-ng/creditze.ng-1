import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { 
  Users, 
  Wallet, 
  Building2, 
  UserCheck,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  FileText,
  Settings,
  DollarSign,
  ChevronRight,
  Search,
  ArrowLeft,
  Brain,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  const checkAdminAndLoad = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      if (currentUser.role !== 'admin') {
        window.location.href = createPageUrl('Dashboard');
        return;
      }

      await loadStats();
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const [users, loans, affiliates, creditSearches, employers] = await Promise.all([
        base44.entities.KYCProfile.list(),
        base44.entities.LoanApplication.list(),
        base44.entities.Affiliate.list(),
        base44.entities.CreditSearch.list(),
        base44.entities.Tier1Employer.list()
      ]);

      const totalDisbursed = loans
        .filter(l => ['disbursed', 'repaid'].includes(l.status))
        .reduce((sum, l) => sum + (l.amount_approved || 0), 0);

      const totalOutstanding = loans
        .filter(l => ['disbursed', 'overdue'].includes(l.status))
        .reduce((sum, l) => sum + (l.total_repayment || 0), 0);

      const overdueLoans = loans.filter(l => l.status === 'overdue').length;
      const defaultedLoans = loans.filter(l => l.status === 'defaulted').length;

      const successfulSearches = creditSearches.filter(s => s.search_status === 'successful').length;

      setStats({
        totalUsers: users.length,
        verifiedUsers: users.filter(u => u.kyc_status === 'verified').length,
        totalLoans: loans.length,
        activeLoans: loans.filter(l => ['disbursed', 'overdue'].includes(l.status)).length,
        totalDisbursed,
        totalOutstanding,
        overdueLoans,
        defaultedLoans,
        totalAffiliates: affiliates.length,
        activeAffiliates: affiliates.filter(a => a.status === 'active').length,
        totalSearches: creditSearches.length,
        successfulSearches,
        tier1Employers: employers.length
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={createPageUrl('Dashboard')}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-500 text-sm">getawin.ng Management Console</p>
            </div>
          </div>
          <Link to={createPageUrl('AdminSettings')}>
            <Button variant="outline">
              <Settings className="w-4 h-4 mr-2" /> Settings
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            label="Total Users"
            value={stats?.totalUsers || 0}
            subtext={`${stats?.verifiedUsers || 0} verified`}
            color="blue"
          />
          <StatCard
            icon={Wallet}
            label="Total Disbursed"
            value={`₦${((stats?.totalDisbursed || 0) / 1000000).toFixed(1)}M`}
            subtext={`${stats?.totalLoans || 0} loans`}
            color="emerald"
          />
          <StatCard
            icon={TrendingUp}
            label="Outstanding"
            value={`₦${((stats?.totalOutstanding || 0) / 1000000).toFixed(1)}M`}
            subtext={`${stats?.activeLoans || 0} active`}
            color="amber"
          />
          <StatCard
            icon={AlertTriangle}
            label="At Risk"
            value={stats?.overdueLoans || 0}
            subtext={`${stats?.defaultedLoans || 0} defaulted`}
            color="red"
          />
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500 font-normal">Credit Searches</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-gray-900">{stats?.totalSearches || 0}</p>
                  <p className="text-sm text-emerald-600">{stats?.successfulSearches || 0} successful</p>
                </div>
                <FileText className="w-12 h-12 text-gray-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500 font-normal">Affiliates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-gray-900">{stats?.totalAffiliates || 0}</p>
                  <p className="text-sm text-emerald-600">{stats?.activeAffiliates || 0} active</p>
                </div>
                <UserCheck className="w-12 h-12 text-gray-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500 font-normal">Tier-1 Employers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-gray-900">{stats?.tier1Employers || 0}</p>
                  <p className="text-sm text-gray-500">companies</p>
                </div>
                <Building2 className="w-12 h-12 text-gray-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Links */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <QuickLink 
                href={createPageUrl('AdminLoanReview')} 
                icon={AlertTriangle} 
                label="Loan Review Queue" 
                desc="Review flagged applications"
                highlight={true}
              />
              <QuickLink 
                href={createPageUrl('AdminUsers')} 
                icon={Users} 
                label="Manage Users" 
                desc="View and manage all users"
              />
              <QuickLink 
                href={createPageUrl('AdminLoans')} 
                icon={Wallet} 
                label="Loan Management" 
                desc="View and manage loans"
              />
              <QuickLink 
                href={createPageUrl('AdminAffiliates')} 
                icon={UserCheck} 
                label="Affiliates" 
                desc="Manage affiliate partners"
              />
              <QuickLink 
                href={createPageUrl('AdminReferrals')} 
                icon={Users} 
                label="Referrals" 
                desc="Monitor referral program"
              />
              <QuickLink 
                href={createPageUrl('AdminDisbursements')} 
                icon={DollarSign} 
                label="Disbursements" 
                desc="Loan disbursement logs"
              />
              <QuickLink 
                href={createPageUrl('AdminEmployers')} 
                icon={Building2} 
                label="Tier-1 Employers" 
                desc="Manage approved employers"
              />
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Reports & Analytics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <QuickLink 
                href={createPageUrl('AdminCollections')} 
                icon={AlertTriangle} 
                label="Collections" 
                desc="Manage overdue loans"
              />
              <QuickLink 
                href={createPageUrl('AdminCreditSearches')} 
                icon={FileText} 
                label="Credit Searches" 
                desc="View credit search analytics"
              />
              <QuickLink 
                href={createPageUrl('AdminAuditLog')} 
                icon={FileText} 
                label="Audit Log" 
                desc="View system activity"
              />
              <QuickLink 
                href={createPageUrl('AdminSettings')} 
                icon={Settings} 
                label="Configuration" 
                desc="Loan rules and thresholds"
              />
              <QuickLink 
                href={createPageUrl('AdminMLScoring')} 
                icon={Brain} 
                label="ML Scoring" 
                desc="AI scoring configuration"
              />
              <QuickLink 
                href={createPageUrl('AdminDisputes')} 
                icon={MessageSquare} 
                label="Disputes" 
                desc="Handle user disputes"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, subtext, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className={`w-10 h-10 ${colors[color]} rounded-xl flex items-center justify-center mb-3`}>
            <Icon className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
          {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function QuickLink({ href, icon: Icon, label, desc, highlight }) {
  return (
    <Link to={href}>
      <div className={`flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition ${highlight ? 'bg-amber-50 border border-amber-200' : ''}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${highlight ? 'bg-amber-100' : 'bg-gray-100'}`}>
            <Icon className={`w-5 h-5 ${highlight ? 'text-amber-600' : 'text-gray-600'}`} />
          </div>
          <div>
            <p className="font-medium text-gray-900">{label}</p>
            <p className="text-sm text-gray-500">{desc}</p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400" />
      </div>
    </Link>
  );
}