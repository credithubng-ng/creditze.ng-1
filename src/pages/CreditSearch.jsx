import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { 
  FileText, 
  ArrowLeft, 
  CheckCircle2, 
  XCircle,
  Loader2,
  AlertCircle,
  CreditCard,
  Clock,
  Mail,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

const CREDIT_SEARCH_FEE = 850;

export default function CreditSearch() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [kyc, setKyc] = useState(null);
  const [existingSearch, setExistingSearch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [error, setError] = useState(null);
  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
    loadData();
    checkPaymentCallback();
  }, []);

  const checkPaymentCallback = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const reference = urlParams.get('reference');
    
    if (reference) {
      setProcessing(true);
      setError(null);
      
      try {
        // Ensure user is loaded first
        const currentUser = await base44.auth.me();
        setUser(currentUser);

        // Also load KYC so performCreditSearch can access it
        const kycData = await base44.entities.KYCProfile.filter({ user_id: currentUser.id });
        if (kycData[0]) setKyc(kycData[0]);

        // Verify payment
        const verifyResponse = await base44.functions.invoke('paystackVerifyPayment', {
          reference: reference
        });

        if (verifyResponse.data.success && verifyResponse.data.status === 'success') {
          // Find the search record by reference
          const searches = await base44.entities.CreditSearch.filter({ 
            payment_reference: reference 
          });

          if (searches.length > 0) {
            const search = searches[0];
            
            // Update payment status
            await base44.entities.CreditSearch.update(search.id, {
              payment_status: 'paid'
            });

            // Perform credit search
            await performCreditSearch(search.id, kycData[0]);
          } else {
            setError('Payment record not found');
            setProcessing(false);
          }
        } else {
          setError('Payment verification failed');
          setProcessing(false);
        }
      } catch (err) {
        console.error('Payment verification error:', err);
        setError('Payment verification failed: ' + (err.message || 'Unknown error'));
        setProcessing(false);
      }
      
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const [kycData, searchData] = await Promise.all([
        base44.entities.KYCProfile.filter({ user_id: currentUser.id }),
        base44.entities.CreditSearch.filter({ user_id: currentUser.id }, '-created_date', 1)
      ]);

      setKyc(kycData[0]);
      
      if (searchData[0]) {
        // Show any recent search result (successful or failed)
        if (searchData[0].payment_status === 'paid') {
          const expiry = new Date(searchData[0].expiry_date);
          if (searchData[0].search_status === 'successful' && expiry > new Date()) {
            setExistingSearch(searchData[0]);
          } else if (searchData[0].search_status === 'unsuccessful') {
            // Show failed search result
            setSearchResult(searchData[0]);
          } else if (searchData[0].search_status === 'successful') {
            // Expired but show it
            setExistingSearch(searchData[0]);
          }
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const initiatePayment = async () => {
    setProcessing(true);
    setError(null);
    
    try {
      // Create credit search record
      const search = await base44.entities.CreditSearch.create({
        user_id: user.id,
        fee_paid: CREDIT_SEARCH_FEE,
        payment_status: 'pending',
        search_status: 'pending'
      });

      // Initialize Paystack payment
      const response = await base44.functions.invoke('paystackInitializePayment', {
        amount: CREDIT_SEARCH_FEE,
        email: user.email,
        metadata: {
          payment_type: 'credit_search',
          search_id: search.id,
          user_id: user.id
        },
        callback_url: window.location.href
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Payment initialization failed');
      }

      // Store reference for verification
      await base44.entities.CreditSearch.update(search.id, {
        payment_reference: response.data.reference
      });

      // Redirect to Paystack payment page
      window.location.href = response.data.authorization_url;

    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed. Please try again.');
      setProcessing(false);
    }
  };

  const performCreditSearch = async (searchId, kycOverride) => {
    try {
      // Use passed-in kyc or fall back to state
      let currentKyc = kycOverride || kyc;
      if (!currentKyc) {
        const currentUser = await base44.auth.me();
        const kycData = await base44.entities.KYCProfile.filter({ user_id: currentUser.id });
        if (!kycData[0] || !kycData[0].bvn) {
          throw new Error('BVN not found. Please complete KYC first.');
        }
        currentKyc = kycData[0];
        setKyc(currentKyc);
      }

      if (!currentKyc.bvn) {
        throw new Error('BVN not found. Please complete KYC first.');
      }

      // Call CRC Credit Bureau API
      const response = await base44.functions.invoke('performCreditSearch', {
        bvn: currentKyc.bvn,
        searchId: searchId,
        testMode: testMode
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Credit search failed');
      }

      // Backend already updated the record, just fetch it
      const searches = await base44.entities.CreditSearch.list();
      const result = searches.find(s => s.id === searchId);
      
      if (!result) {
        throw new Error('Failed to retrieve search results');
      }
      const expiryDate = new Date(result.expiry_date || new Date());

      // Note: the backend (performCreditSearch function) already sends a formatted HTML email with download link.
      // Show result immediately
      setSearchResult(result);
      setProcessing(false);

      // Redirect to KYC after showing result briefly
      if (result.search_status === 'successful') {
        setTimeout(() => {
          navigate(createPageUrl('KYC'));
        }, 4000);
      }

    } catch (err) {
      console.error('Credit search error:', err);
      
      // Check if this is a backend error response with details
      const errorData = err.response?.data || err;
      
      // Log full error details for debugging
      if (errorData?.fullCrcResponse) {
        console.log('=== COPY THIS FOR CRC SUPPORT ===');
        console.log(JSON.stringify(errorData.fullCrcResponse, null, 2));
        console.log('=== END CRC RESPONSE ===');
      }
      
      // User-friendly error message based on specific error types
      let userMessage = '';
      
      if (err.message?.includes('test environment') || err.message?.includes('test mode')) {
        userMessage = 'Our credit bureau is currently in test mode. Please try again later or contact support.';
      } else if (err.message?.includes('No credit history') || err.message?.includes('no hit')) {
        userMessage = 'No credit history was found for your BVN. You may still be eligible for starter loans.';
      } else if (err.message?.includes('BVN')) {
        userMessage = 'Please ensure your BVN is correct and verified in your KYC profile.';
      } else if (err.message?.includes('Invalid request') || err.message?.includes('Authentication failed')) {
        userMessage = 'There was an issue connecting to the credit bureau. Our team has been notified. Please try again later.';
      } else {
        // Generic error message - include the actual error for context
        userMessage = err.message || 'We could not complete your credit search at this time. Please try again or contact our support team for assistance.';
      }
      
      setError(userMessage);
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  // Check if BVN is available — if not, redirect directly to BVN step in KYC (step 3)
  if (!kyc || !kyc.bvn) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b px-4 py-4">
          <div className="max-w-lg mx-auto flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Dashboard'))}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-semibold text-gray-900">Credit Search</h1>
          </div>
        </div>
        <div className="max-w-lg mx-auto px-4 py-6">
          <Card className="border-0 shadow-md">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">BVN Required</h3>
              <p className="text-sm text-gray-500 mb-6">
                We need your BVN to run a credit search. It only takes a minute to verify.
              </p>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                onClick={() => navigate(createPageUrl('KYC') + '?step=bvn')}
              >
                Enter BVN <ArrowLeft className="ml-2 w-4 h-4 rotate-180" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Dashboard'))}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold text-gray-900">Credit Search</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Existing valid search */}
        {existingSearch && !searchResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-0 shadow-md border-l-4 border-l-emerald-500">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">Valid Credit Report</h3>
                    <p className="text-sm text-gray-500 mb-2">
                      Your credit search is valid until {new Date(existingSearch.expiry_date).toLocaleDateString()}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-100 text-emerald-700">
                        Score: {existingSearch.bureau_score}
                      </Badge>
                    </div>
                  </div>
                </div>
                {existingSearch.report_url && (
                  <a
                    href={existingSearch.report_url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full mt-4 py-2 px-4 border border-emerald-600 text-emerald-600 rounded-md font-medium text-sm hover:bg-emerald-50 transition"
                  >
                    <Download className="w-4 h-4" />
                    Download Credit Report
                  </a>
                )}
                <Button 
                  className="w-full mt-3 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => navigate(createPageUrl('ApplyLoan'))}
                >
                  Apply for Loan
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Search result */}
        {searchResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card className={`border-0 shadow-md ${
              searchResult.search_status === 'successful' 
                ? 'border-l-4 border-l-emerald-500' 
                : 'border-l-4 border-l-red-500'
            }`}>
              <CardContent className="p-6 text-center">
                {searchResult.search_status === 'successful' ? (
                  <>
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Search Successful!</h3>
                    <p className="text-gray-500 mb-4">Your credit score: <span className="font-bold text-emerald-600">{searchResult.bureau_score}</span></p>
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-6">
                      <Clock className="w-4 h-4" />
                      Valid until {new Date(searchResult.expiry_date).toLocaleDateString()}
                    </div>
                    <div className="flex items-center justify-center gap-2 text-sm text-emerald-600 mb-6">
                      <Mail className="w-4 h-4" />
                      Report sent to {user.email}
                    </div>
                    {searchResult.report_url && (
                      <a
                        href={searchResult.report_url}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full mb-3 py-2 px-4 border border-emerald-600 text-emerald-600 rounded-md font-medium text-sm hover:bg-emerald-50 transition"
                      >
                        <Download className="w-4 h-4" />
                        Download Credit Report
                      </a>
                    )}
                    <Button 
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => navigate(createPageUrl('KYC'))}
                    >
                      Back to KYC
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <XCircle className="w-10 h-10 text-red-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Search Unsuccessful</h3>
                    <p className="text-gray-500 mb-4">{searchResult.failure_reason}</p>
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-6">
                      <Mail className="w-4 h-4" />
                      Report sent to {user.email}
                    </div>
                    <Button 
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate(createPageUrl('Dashboard'))}
                    >
                      Back to Dashboard
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Payment prompt */}
        {!existingSearch && !searchResult && !processing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-0 shadow-md">
              <CardHeader className="text-center">
                <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-10 h-10 text-amber-600" />
                </div>
                <CardTitle>Credit Bureau Search</CardTitle>
                <CardDescription>
                  A credit search is required to verify your eligibility for loans
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Search Fee</span>
                    <span className="font-semibold">₦{CREDIT_SEARCH_FEE.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Validity Period</span>
                    <span className="font-semibold">90 Days</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Report Delivery</span>
                    <span className="font-semibold">Email</span>
                  </div>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    The search fee is non-refundable. A copy of your credit report will be emailed to you regardless of the outcome.
                  </AlertDescription>
                </Alert>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={testMode}
                    onChange={(e) => setTestMode(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span className="text-sm text-gray-600">Test Mode (Skip payment & use mock data)</span>
                </label>

                {testMode ? (
                  <Button 
                    className="w-full bg-blue-500 hover:bg-blue-600 py-6"
                    onClick={async () => {
                      setProcessing(true);
                      setError(null);
                      try {
                        const search = await base44.entities.CreditSearch.create({
                          user_id: user.id,
                          fee_paid: 0,
                          payment_status: 'paid',
                          search_status: 'pending',
                          payment_reference: 'TEST_MODE_' + Date.now()
                        });
                        await performCreditSearch(search.id);
                      } catch (err) {
                        setError(err.message);
                        setProcessing(false);
                      }
                    }}
                  >
                    🧪 Run Test Search (Mock Data)
                  </Button>
                ) : (
                  <Button 
                    className="w-full bg-amber-500 hover:bg-amber-600 py-6"
                    onClick={initiatePayment}
                  >
                    <CreditCard className="w-5 h-5 mr-2" />
                    Pay ₦{CREDIT_SEARCH_FEE.toLocaleString()} & Search
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Processing */}
        {processing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Card className="border-0 shadow-md">
              <CardContent className="p-8 text-center">
                <Loader2 className="w-16 h-16 animate-spin text-emerald-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Processing...</h3>
                <p className="text-gray-500 text-sm">
                  Please wait while we search your credit history
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}