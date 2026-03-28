import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { 
  FileText, 
  CreditCard, 
  CheckCircle2, 
  Loader2,
  AlertCircle,
  ArrowLeft,
  Download,
  Shield,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function PremiumReportPayment() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [purchaseComplete, setPurchaseComplete] = useState(false);
  const [reportUrl, setReportUrl] = useState(null);
  const [aiAdvice, setAiAdvice] = useState(null);
  const [score, setScore] = useState(null);

  const searchParams = new URLSearchParams(window.location.search);
  const searchId = searchParams.get('search_id');
  const reference = searchParams.get('reference');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (reference) {
      handlePaymentCallback();
    }
  }, [reference]);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      setError('Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentCallback = async () => {
    setProcessing(true);
    try {
      const response = await base44.functions.invoke('purchasePremiumReport', {
        reference: reference,
        search_id: searchId
      });

      if (response.data.success) {
        setPurchaseComplete(true);
        setReportUrl(response.data.report_url);
        setAiAdvice(response.data.ai_advice);
        setScore(response.data.score);
      } else {
        setError(response.data.error || 'Purchase failed');
      }
    } catch (err) {
      setError('Failed to process payment. Please contact support.');
    } finally {
      setProcessing(false);
    }
  };

  const initiatePayment = async () => {
    if (!searchId) {
      setError('Invalid search ID');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const response = await base44.functions.invoke('paystackInitializePayment', {
        amount: 2500,
        email: user.email,
        callback_url: `${window.location.origin}${createPageUrl('PremiumReportPayment')}?search_id=${searchId}`
      });

      if (response.data.success) {
        window.location.href = response.data.authorization_url;
      } else {
        setError(response.data.error || 'Failed to initialize payment');
      }
    } catch (err) {
      setError('Payment initialization failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const downloadReport = () => {
    if (reportUrl) {
      window.open(reportUrl, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (processing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-0 shadow-lg">
          <CardContent className="pt-12 pb-12 text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Processing Payment</h2>
            <p className="text-gray-500">
              Please wait while we verify your payment and fetch your premium report...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (purchaseComplete) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <Card className="border-0 shadow-lg">
            <CardContent className="pt-12 pb-8 text-center">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Report Ready!</h2>
              <p className="text-gray-500 mb-2">
                Your premium credit report has been sent to {user?.email}
              </p>

              {score && (
                <div className="bg-gray-900 rounded-xl px-6 py-4 mb-6 text-center">
                  <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Credit Score</p>
                  <p className={`text-4xl font-bold mb-1 ${score >= 700 ? 'text-emerald-400' : score >= 600 ? 'text-green-400' : score >= 500 ? 'text-yellow-400' : 'text-red-400'}`}>{score}</p>
                  <p className={`text-sm font-medium ${score >= 700 ? 'text-emerald-400' : score >= 600 ? 'text-green-400' : score >= 500 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {score >= 700 ? 'Excellent' : score >= 600 ? 'Good' : score >= 500 ? 'Fair' : 'Poor'} Rating
                  </p>
                </div>
              )}
              
              {reportUrl && (
                <Button 
                  onClick={downloadReport}
                  className="w-full bg-gray-900 hover:bg-gray-800 mb-4"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Premium Report
                </Button>
              )}

              {aiAdvice && (
                <div className="text-left bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                    <h4 className="font-semibold text-gray-900 text-sm">Your Personalised Credit Advice</h4>
                  </div>
                  <p className="text-gray-700 text-xs leading-relaxed whitespace-pre-line">{aiAdvice}</p>
                </div>
              )}
              
              <Button 
                variant="outline"
                onClick={() => navigate(createPageUrl('Dashboard'))}
                className="w-full"
              >
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Dashboard'))}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold text-gray-900">Premium Credit Report</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Premium Report Card */}
        <Card className="border-0 shadow-md mb-6">
          <CardHeader>
            <div className="w-16 h-16 bg-gradient-to-br from-gray-900 to-gray-700 rounded-2xl flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl">Premium Classic Consumer Report</CardTitle>
            <CardDescription className="text-base">
              Get comprehensive credit analysis from Credit Reference Nigeria
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Features */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Detailed Credit History</p>
                  <p className="text-sm text-gray-500">Complete payment history and account information</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Credit Score Analysis</p>
                  <p className="text-sm text-gray-500">In-depth breakdown of your credit score</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Account Details</p>
                  <p className="text-sm text-gray-500">All credit accounts and their status</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">Inquiry History</p>
                  <p className="text-sm text-gray-500">Who has accessed your credit report</p>
                </div>
              </div>
            </div>

            {/* Price */}
            <div className="bg-gray-50 rounded-xl p-6 border-2 border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">One-time payment</p>
                  <p className="text-3xl font-bold text-gray-900">₦2,500</p>
                </div>
                <FileText className="w-12 h-12 text-gray-400" />
              </div>
            </div>

            {/* CTA */}
            <Button 
              onClick={initiatePayment}
              disabled={processing || !searchId}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Pay ₦2,500 & Get Report
                </>
              )}
            </Button>

            <p className="text-xs text-center text-gray-500">
              Secure payment powered by Paystack. Report delivered instantly via email.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}