import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Phone, 
  CreditCard, 
  MapPin, 
  Banknote,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  AlertCircle,
  User as UserIcon,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { STATES, getLGAsForState } from '@/components/utils/nigeriaStatesLgas';
import NINStep from '@/components/kyc/NINStep';
import LivenessStep from '@/components/kyc/LivenessStep';

// Steps: 0=Personal, 1=Phone, 2=Pay, 3=BVN, 4=NIN, 5=Liveness, 6=Address, 7=Bank
// CRC runs automatically after BVN is verified (no separate step)
const STEPS = [
  { id: 'personal', title: 'Personal', icon: UserIcon },
  { id: 'phone', title: 'Phone', icon: Phone },
  { id: 'pay', title: 'Pay', icon: TrendingUp },
  { id: 'bvn', title: 'BVN', icon: CreditCard },
  { id: 'nin', title: 'NIN', icon: CreditCard },
  { id: 'liveness', title: 'Liveness', icon: UserIcon },
  { id: 'address', title: 'Address', icon: MapPin },
  { id: 'bank', title: 'Bank', icon: Banknote }
];





export default function KYC() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [kyc, setKyc] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [banks, setBanks] = useState([]);
  const [verifyingAccount, setVerifyingAccount] = useState(false);
  const [isDndBlocked, setIsDndBlocked] = useState(false);

  const [formData, setFormData] = useState({
    full_name: '',
    date_of_birth: '',
    gender: '',
    phone_number: '',
    bvn: '',
    residential_address: '',
    city: '',
    residential_state: '',
    residential_lga: '',
    property_address: '',
    property_type: '',
    property_years: '',
    bank_name: '',
    account_number: '',
    account_name: ''
  });

  useEffect(() => {
    loadData();
    loadBanks();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const kycData = await base44.entities.KYCProfile.filter({ user_id: currentUser.id });
      if (kycData[0]) {
        setKyc(kycData[0]);
        setFormData(prev => ({
          ...prev,
          ...kycData[0]
        }));
        // Allow deep-linking to BVN step (takes priority over auto-detection)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('step') === 'nin') {
          setCurrentStep(4);
        } else if (urlParams.get('step') === 'bvn') {
          setCurrentStep(3);
        } else {
          // Find the first incomplete step
          // Order: 0=Personal, 1=Phone, 2=Credit, 3=BVN, 4=NIN, 5=Liveness, 6=Address, 7=Bank
          const hasPaidCreditSearch = async () => {
            const searches = await base44.entities.CreditSearch.filter({ user_id: currentUser.id, payment_status: 'paid' });
            return searches.length > 0;
          };
          if (!kycData[0].full_name || !kycData[0].date_of_birth || !kycData[0].gender) {
            setCurrentStep(0);
          } else if (!kycData[0].phone_verified && !kycData[0].phone_number) {
            setCurrentStep(1);
          } else {
            const creditPaid = await hasPaidCreditSearch();
            if (!creditPaid) setCurrentStep(2);
            else if (!kycData[0].bvn_verified) setCurrentStep(3);
            else if (!kycData[0].nin_verified) setCurrentStep(4);
            else if (!kycData[0].facial_recognition_verified) setCurrentStep(5);
            else if (!kycData[0].residential_address) setCurrentStep(6);
            else if (!kycData[0].account_number) setCurrentStep(7);
            else navigate(createPageUrl('Dashboard'));
          }
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBanks = async () => {
    try {
      const response = await base44.functions.invoke('paystackGetBanks');
      if (response.data.success) {
        setBanks(response.data.banks);
      }
    } catch (error) {
      console.error('Error loading banks:', error);
    }
  };

  const verifyAccount = async () => {
    if (!formData.account_number || formData.account_number.length !== 10) {
      return;
    }
    if (!formData.bank_name) {
      return;
    }

    const selectedBank = banks.find(b => b.name === formData.bank_name);
    if (!selectedBank) {
      return;
    }

    setVerifyingAccount(true);
    setError(null);

    try {
      const response = await base44.functions.invoke('paystackVerifyAccount', {
        account_number: formData.account_number,
        bank_code: selectedBank.code
      });

      if (response.data.success) {
        handleChange('account_name', response.data.account_name);
      } else {
        setError(response.data.error || 'Could not verify account');
      }
    } catch (err) {
      setError('Account verification failed');
    } finally {
      setVerifyingAccount(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  // Auto-verify account when both bank and account number are set
  useEffect(() => {
    if (formData.bank_name && formData.account_number && formData.account_number.length === 10) {
      verifyAccount();
    }
  }, [formData.bank_name, formData.account_number]);

  const savePersonalInfo = async () => {
    if (!formData.full_name || !formData.date_of_birth || !formData.gender) {
      setError('Please fill in all personal information');
      return;
    }
    setSaving(true);
    try {
      const kycUpdate = {
        user_id: user.id,
        full_name: formData.full_name,
        date_of_birth: formData.date_of_birth,
        gender: formData.gender
      };

      if (kyc) {
        await base44.entities.KYCProfile.update(kyc.id, kycUpdate);
      } else {
        const newKyc = await base44.entities.KYCProfile.create(kycUpdate);
        setKyc(newKyc);
      }
      // Update user's full_name so Dashboard greeting reflects immediately
      await base44.auth.updateMe({ full_name: formData.full_name });
      setUser(prev => ({ ...prev, full_name: formData.full_name }));
      setCurrentStep(1);
      setError(null);
    } catch (err) {
      setError('Failed to save personal information. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const sendOTP = async () => {
    if (!formData.phone_number || formData.phone_number.length < 10) {
      setError('Please enter a valid phone number');
      return;
    }
    setSaving(true);
    setIsDndBlocked(false);
    try {
      const response = await base44.functions.invoke('sendOTP', {
        phone_number: formData.phone_number,
        type: 'phone'
      });

      if (!response.data.success) {
        // Check if it's a DND error
        if (response.data.error?.toLowerCase().includes('dnd')) {
          setIsDndBlocked(true);
        }
        throw new Error(response.data.error || 'Failed to send OTP');
      }

      setOtpSent(true);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const skipPhoneVerification = async () => {
    setSaving(true);
    try {
      const kycUpdate = {
        user_id: user.id,
       phone_number: formData.phone_number,
        phone_verified: false
      };

      if (kyc) {
        await base44.entities.KYCProfile.update(kyc.id, kycUpdate);
      } else {
        const newKyc = await base44.entities.KYCProfile.create(kycUpdate);
        setKyc(newKyc);
      }
      setCurrentStep(2); // Move to Credit Search
      setError(null);
    } catch (err) {
      setError('Failed to save phone number. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const verifyOTP = async () => {
    if (otp.length !== 6) {
      setError('Please enter the 6-digit OTP');
      return;
    }
    setSaving(true);
    try {
      const response = await base44.functions.invoke('verifyOTP', {
        otp: otp,
        type: 'phone'
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Invalid OTP');
      }

      // Check if phone number is already used by another user
      const existingKyc = await base44.entities.KYCProfile.filter({ 
        phone_number: formData.phone_number,
        phone_verified: true
      });

      if (existingKyc.length > 0 && existingKyc[0].user_id !== user.id) {
        throw new Error('This phone number is already registered to another account. Please use a different number.');
      }

      const kycUpdate = {
        user_id: user.id,
        phone_number: formData.phone_number,
        phone_verified: true
      };

      if (kyc) {
        await base44.entities.KYCProfile.update(kyc.id, kycUpdate);
      } else {
        const newKyc = await base44.entities.KYCProfile.create(kycUpdate);
        setKyc(newKyc);
      }
      setCurrentStep(2); // Move to Credit Search
      setError(null);
      } catch (err) {
      setError(err.message || 'Verification failed. Please try again.');
      } finally {
      setSaving(false);
      }
      };

  const verifyBVN = async () => {
    if (!formData.bvn || formData.bvn.length !== 11) {
      setError('BVN must be 11 digits');
      return;
    }
    setSaving(true);
    try {
      const response = await base44.functions.invoke('verifyBVNWithNameMatch', {
        bvn: formData.bvn
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'BVN verification failed');
      }

      // OTP sent to BVN email, move to OTP verification
      setOtpSent(true);
      setCurrentStep('bvn-otp'); // handled separately
      setError(null);
    } catch (err) {
      setError(err.message || 'BVN verification failed. Please check and try again.');
    } finally {
      setSaving(false);
    }
  };



  const saveAddress = async () => {
      if (!formData.residential_address || !formData.city || !formData.residential_state || !formData.residential_lga) {
        setError('Please fill in all address fields');
        return;
      }
      setSaving(true);
      try {
        await base44.entities.KYCProfile.update(kyc.id, {
          residential_address: formData.residential_address,
          city: formData.city,
          residential_state: formData.residential_state,
          residential_lga: formData.residential_lga
        });
        setCurrentStep(7); // Move to bank (step 7)
        setError(null);
      } catch (err) {
        setError('Failed to save address. Please try again.');
      } finally {
        setSaving(false);
      }
    };



  const saveBank = async () => {
    if (!formData.bank_name || !formData.account_number || !formData.account_name) {
      setError('Please fill in all bank details');
      return;
    }
    if (formData.account_number.length !== 10) {
      setError('Account number must be 10 digits');
      return;
    }
    setSaving(true);
    try {
      await base44.entities.KYCProfile.update(kyc.id, {
        bank_name: formData.bank_name,
        account_number: formData.account_number,
        account_name: formData.account_name,
        kyc_status: 'verified',
        kyc_completed_date: new Date().toISOString()
      });

      // Sync to user entity
      await base44.auth.updateMe({
        phone_number: kyc.phone_number,
        date_of_birth: kyc.date_of_birth,
        gender: kyc.gender,
        residential_address: kyc.residential_address,
        city: kyc.city,
        state: kyc.residential_state,
        lga: kyc.residential_lga
      });

      navigate(createPageUrl('Dashboard'));
    } catch (err) {
      setError('Failed to save bank details. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Dashboard'))}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-semibold text-gray-900">KYC Verification</h1>
            <p className="text-sm text-gray-500">Step {typeof currentStep === 'number' ? currentStep + 1 : '—'} of {STEPS.length}</p>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white px-4 py-3 border-b">
        <div className="max-w-lg mx-auto flex gap-2">
          {STEPS.map((step, i) => {
            const stepNum = typeof currentStep === 'number' ? currentStep : 3;
            return (
              <div
                key={step.id}
                className={`flex-1 h-1.5 rounded-full transition-colors ${
                  i < stepNum ? 'bg-emerald-500' : 
                  i === stepNum ? 'bg-emerald-300' : 'bg-gray-200'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            {/* Personal Information */}
            {currentStep === 0 && (
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4">
                    <UserIcon className="w-7 h-7 text-emerald-600" />
                  </div>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Tell us about yourself</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Email Address</Label>
                    <Input
                      value={user?.email || ''}
                      disabled
                      className="mt-1 bg-gray-50 text-gray-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">This is your registered email and cannot be changed</p>
                  </div>
                  <div>
                    <Label>Full Name</Label>
                    <Input
                      placeholder="Enter your full name"
                      value={formData.full_name}
                      onChange={(e) => handleChange('full_name', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Date of Birth</Label>
                    <Input
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(e) => handleChange('date_of_birth', e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      min="1940-01-01"
                      className="mt-1"
                      placeholder="Select your date of birth"
                    />
                  </div>
                  <div>
                    <Label>Gender</Label>
                    <Select value={formData.gender} onValueChange={(v) => handleChange('gender', v)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={savePersonalInfo}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Continue <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Phone Verification */}
            {currentStep === 1 && (
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4">
                    <Phone className="w-7 h-7 text-emerald-600" />
                  </div>
                  <CardTitle>Verify Your Phone</CardTitle>
                  <CardDescription>We'll send a verification code to your number</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!otpSent ? (
                    <>
                      <div className="text-center mb-4">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-lg">
                          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-lg">C</span>
                          </div>
                          <span className="font-bold text-xl text-gray-900">Creditze</span>
                        </div>
                      </div>
                      <div>
                        <Label>Phone Number</Label>
                        <div className="flex gap-2 mt-1">
                          <div className="flex items-center px-3 bg-gray-100 rounded-lg text-gray-600 font-medium">
                            +234
                          </div>
                          <Input
                            type="tel"
                            placeholder="8012345678"
                            value={formData.phone_number}
                            onChange={(e) => handleChange('phone_number', e.target.value.replace(/\D/g, '').slice(0, 10))}
                            className="flex-1"
                          />
                        </div>
                      </div>
                      <Button 
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                        onClick={sendOTP}
                        disabled={saving}
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Send OTP
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="text-center mb-4">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-lg">
                          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-lg">C</span>
                          </div>
                          <span className="font-bold text-xl text-gray-900">Creditze</span>
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-500 mb-4">
                          Enter the 6-digit code sent to +234{formData.phone_number}
                        </p>
                        <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                          <InputOTPGroup className="gap-2 justify-center">
                            {[0,1,2,3,4,5].map(i => (
                              <InputOTPSlot key={i} index={i} className="w-12 h-12 text-lg" />
                            ))}
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                      <Button 
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                        onClick={verifyOTP}
                        disabled={saving}
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Verify <ArrowRight className="ml-2 w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        className="w-full"
                        onClick={() => {
                          setOtpSent(false);
                          setIsDndBlocked(false);
                        }}
                      >
                        Change Number
                      </Button>
                      <Button 
                        variant="outline"
                        className="w-full mt-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                        onClick={skipPhoneVerification}
                        disabled={saving}
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Didn't Receive OTP? Continue Without Verification
                      </Button>
                    </>
                  )}

                  {isDndBlocked && !otpSent && (
                    <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800 mb-3">
                        Your number is on DND. You can continue without verification now and verify later.
                      </p>
                      <Button 
                        variant="outline"
                        className="w-full border-amber-300 text-amber-700 hover:bg-amber-100"
                        onClick={skipPhoneVerification}
                        disabled={saving}
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Continue Without Verification
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}



            {/* NIN Verification - Step 4 */}
            {currentStep === 4 && (
              <NINStep
                onComplete={() => { setCurrentStep(5); setError(null); }}
                onSkip={() => setCurrentStep(5)}
              />
            )}

            {/* BVN OTP - Step after verifyBVN */}
            {currentStep === 'bvn-otp' && (
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4">
                    <CreditCard className="w-7 h-7 text-emerald-600" />
                  </div>
                  <CardTitle>Verify BVN Email OTP</CardTitle>
                  <CardDescription>Enter the 6-digit code sent to your BVN email address</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                      <InputOTPGroup className="gap-2 justify-center">
                        {[0,1,2,3,4,5].map(i => (
                          <InputOTPSlot key={i} index={i} className="w-12 h-12 text-lg" />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={async () => {
                      if (otp.length !== 6) { setError('Please enter the 6-digit OTP'); return; }
                      setSaving(true);
                      try {
                        const res = await base44.functions.invoke('verifyBVNEmailOTP', { otp });
                        if (!res.data.success) throw new Error(res.data.error || 'Invalid OTP');

                        // BVN now verified — run CRC credit search immediately
                        const kycProfile = await base44.entities.KYCProfile.filter({ user_id: user.id });
                        const bvn = kycProfile[0]?.bvn;
                        const paidSearches = await base44.entities.CreditSearch.filter({ user_id: user.id, payment_status: 'paid', search_status: 'pending' });
                        if (paidSearches.length > 0 && bvn) {
                          // Run CRC via redirect to CreditSearch page with run=true param
                          setError(null);
                          setSaving(false);
                          navigate(createPageUrl('CreditSearch') + '?run=true&search_id=' + paidSearches[0].id + '&next=nin');
                          return;
                        }

                        setCurrentStep(4); // Move to NIN
                        setError(null);
                      } catch (err) {
                        setError(err.message || 'OTP verification failed');
                      } finally { setSaving(false); }
                    }}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Verify OTP <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => setCurrentStep(2)}>
                    Back
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* BVN Verification - Step 3 */}
             {currentStep === 3 && (
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4">
                    <CreditCard className="w-7 h-7 text-emerald-600" />
                  </div>
                  <CardTitle>BVN Verification</CardTitle>
                  <CardDescription>Enter your 11-digit Bank Verification Number</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>BVN</Label>
                    <Input
                      type="text"
                      placeholder="22123456789"
                      value={formData.bvn}
                      onChange={(e) => handleChange('bvn', e.target.value.replace(/\D/g, '').slice(0, 11))}
                      className="mt-1 text-lg tracking-wider"
                    />
                    <p className="text-xs text-gray-500 mt-1">Dial *565*0# on your registered line to get your BVN</p>
                  </div>
                  <Button 
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={verifyBVN}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Verify BVN <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>

                </CardContent>
              </Card>
            )}

            {/* Credit Search - Step 2 (must pay before any API calls) */}
            {currentStep === 2 && (
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
                    <TrendingUp className="w-7 h-7 text-blue-600" />
                  </div>
                  <CardTitle>Credit Search Required</CardTitle>
                  <CardDescription>A one-time fee of ₦850 is required to proceed with identity verification.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                    <p className="text-sm text-blue-900 font-medium">Why is this required first?</p>
                    <p className="text-sm text-blue-800">
                      The ₦850 credit search fee covers the cost of BVN, NIN, and liveness verification — all of which access external paid APIs. Payment must be confirmed before we proceed.
                    </p>
                    <p className="text-sm text-blue-700">✓ Valid for 90 days &nbsp; ✓ Credit report emailed to you</p>
                  </div>
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700 py-6 text-base"
                    onClick={() => navigate(createPageUrl('CreditSearch'))}
                  >
                    Pay ₦850 & Continue <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Liveness Check - Step 5 */}
            {currentStep === 5 && (
              <LivenessStep
                onComplete={() => { setCurrentStep(6); setError(null); }}
                onSkip={() => setCurrentStep(6)}
              />
            )}

            {/* Address & Property - Step 6 */}
             {currentStep === 6 && (
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4">
                    <MapPin className="w-7 h-7 text-emerald-600" />
                  </div>
                  <CardTitle>Residential Address</CardTitle>
                  <CardDescription>Where do you currently live?</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Street Address</Label>
                    <Input
                      placeholder="123 Main Street, Lekki"
                      value={formData.residential_address}
                      onChange={(e) => handleChange('residential_address', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>City/Town</Label>
                    <Input
                      placeholder="e.g., Lagos, Abuja, Kano"
                      value={formData.city}
                      onChange={(e) => handleChange('city', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>State</Label>
                    <Select value={formData.residential_state} onValueChange={(v) => {
                      handleChange('residential_state', v);
                      handleChange('residential_lga', '');
                    }}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATES.map(state => (
                          <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>LGA</Label>
                    <Select 
                      value={formData.residential_lga} 
                      onValueChange={(v) => handleChange('residential_lga', v)}
                      disabled={!formData.residential_state}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={formData.residential_state ? "Select LGA" : "Select state first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {formData.residential_state && getLGAsForState(formData.residential_state).map(lga => (
                          <SelectItem key={lga} value={lga}>{lga}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button 
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={saveAddress}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Continue <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Bank Details - Step 7 */}
             {currentStep === 7 && (
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4">
                    <Banknote className="w-7 h-7 text-emerald-600" />
                  </div>
                  <CardTitle>Bank Account</CardTitle>
                  <CardDescription>Where should we send your funds?</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Bank</Label>
                    <Select value={formData.bank_name} onValueChange={(v) => handleChange('bank_name', v)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select bank" />
                      </SelectTrigger>
                      <SelectContent>
                        {banks.map(bank => (
                          <SelectItem key={bank.code} value={bank.name}>{bank.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Account Number</Label>
                    <Input
                      type="text"
                      placeholder="0123456789"
                      value={formData.account_number}
                      onChange={(e) => handleChange('account_number', e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Account Name</Label>
                    <div className="relative">
                      <Input
                        placeholder="Account name will appear here"
                        value={formData.account_name}
                        onChange={(e) => handleChange('account_name', e.target.value)}
                        className="mt-1"
                        disabled={verifyingAccount}
                      />
                      {verifyingAccount && (
                        <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600" />
                      )}
                    </div>
                    {formData.account_name && !verifyingAccount && (
                      <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Account verified
                      </p>
                    )}
                  </div>
                  <Button 
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={saveBank}
                    disabled={saving || verifyingAccount || !formData.account_name}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Complete Verification <CheckCircle2 className="ml-2 w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </AnimatePresence>

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