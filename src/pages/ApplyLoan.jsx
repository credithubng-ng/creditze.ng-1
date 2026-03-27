import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { calculateMLScore, calculateCombinedScore } from '../components/scoring/MLScoreCalculator';
import ScoreDisplay from '../components/scoring/ScoreDisplay';
import { personalizeOffer, assignABTestVariant } from '../components/loan/OfferPersonalizer';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { 
  Zap, 
  Building2, 
  ArrowLeft, 
  ArrowRight,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Calculator,
  Calendar,
  Percent
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

export default function ApplyLoan() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [kyc, setKyc] = useState(null);
  const [creditSearch, setCreditSearch] = useState(null);
  const [creditLimit, setCreditLimit] = useState(null);
  const [employmentVerification, setEmploymentVerification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loanAmount, setLoanAmount] = useState(10000);
  const [loanDetails, setLoanDetails] = useState(null);
  const [mlScoreResult, setMlScoreResult] = useState(null);
  const [mlConfig, setMlConfig] = useState(null);
  const [behaviorData, setBehaviorData] = useState(null);
  const [referralConfig, setReferralConfig] = useState(null);
  const [loanConfig, setLoanConfig] = useState(null);
  const [abTestVariant, setAbTestVariant] = useState(null);
  const [personalizedOfferData, setPersonalizedOfferData] = useState(null);
  const [selectedTenure, setSelectedTenure] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const [kycData, searchData, limitData, empData, mlConfigData, behaviorDataResult, refConfigData, loanConfigData, activeTests, activeLoans] = await Promise.all([
        base44.entities.KYCProfile.filter({ user_id: currentUser.id }),
        base44.entities.CreditSearch.filter({ user_id: currentUser.id }, '-created_date', 1),
        base44.entities.UserCreditLimit.filter({ user_id: currentUser.id }),
        base44.entities.EmploymentVerification.filter({ user_id: currentUser.id, status: 'verified' }),
        base44.entities.MLScoringConfig.filter({ config_key: 'default' }),
        base44.entities.UserBehaviorData.filter({ user_id: currentUser.id }),
        base44.entities.ReferralConfig.filter({ config_key: 'default' }),
        base44.entities.LoanConfig.filter({ config_key: 'default' }),
        base44.entities.ABTestConfig.filter({ status: 'active' }),
        base44.entities.LoanApplication.filter({ user_id: currentUser.id })
      ]);

      // Check for active loans
      const hasActiveLoan = activeLoans.some(loan => 
        ['pending', 'under_review', 'approved', 'disbursed', 'overdue'].includes(loan.status)
      );

      if (hasActiveLoan) {
        toast.error('You have an active loan. Please repay your current loan before applying for a new one.');
        navigate(createPageUrl('Dashboard'));
        return;
      }

      setKyc(kycData[0]);
      setCreditSearch(searchData[0]);
      setCreditLimit(limitData[0]);
      setEmploymentVerification(empData[0]);
      setMlConfig(mlConfigData[0]);
      setBehaviorData(behaviorDataResult[0]);
      setReferralConfig(refConfigData[0]);
      setLoanConfig(loanConfigData[0]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const isCreditSearchValid = () => {
    if (!creditSearch || creditSearch.search_status !== 'successful') return false;
    const expiry = new Date(creditSearch.expiry_date);
    return expiry > new Date();
  };

  const canApply = () => {
    // Allow users without phone verification to apply — phone OTP can be completed before disbursement
    return kyc?.kyc_status === 'verified' && isCreditSearchValid() && !creditLimit?.is_frozen;
  };

  const calculateScore = () => {
    let ruleScore = 0;
    
    // Credit bureau score (40 points)
    if (creditSearch?.bureau_score) {
      const bureauScore = creditSearch.bureau_score;
      if (bureauScore >= 700) ruleScore += 40;
      else if (bureauScore >= 600) ruleScore += 30;
      else if (bureauScore >= 500) ruleScore += 20;
      else ruleScore += 10;
    }

    // Repayment behaviour (20 points)
    if (creditLimit) {
      const successRate = creditLimit.successful_repayments / Math.max(creditLimit.total_loans_taken, 1);
      ruleScore += Math.floor(successRate * 20);
    }

    // Property stability (15 points)
    if (kyc?.property_years >= 3) ruleScore += 15;
    else if (kyc?.property_years >= 1) ruleScore += 10;
    else ruleScore += 5;

    // Identity consistency (15 points)
    if (kyc?.bvn_verified && kyc?.nin_verified) ruleScore += 15;
    else if (kyc?.bvn_verified || kyc?.nin_verified) ruleScore += 8;

    // Employment verification for Tier-1 (10 points)
    if (employmentVerification) ruleScore += 10;

    return ruleScore;
  };

  const calculateFullScore = async () => {
    const ruleScore = calculateScore();
    
    // Check if ML scoring is enabled
    if (mlConfig?.enable_ml_scoring && behaviorData) {
      const mlResult = await calculateMLScore(user.id, behaviorData, mlConfig);
      const combinedScore = calculateCombinedScore(ruleScore, mlResult.ml_score, mlConfig.ml_score_weight);
      
      const fullResult = {
        rule_based_score: ruleScore,
        ml_score: mlResult.ml_score,
        combined_score: combinedScore,
        ml_score_breakdown: mlResult.ml_score_breakdown,
        risk_flags_detected: mlResult.risk_flags_detected,
        bonus_factors_applied: mlResult.bonus_factors_applied,
        confidence_level: mlResult.confidence_level,
        recommendation: mlResult.recommendation,
        explanation: mlResult.explanation
      };
      
      setMlScoreResult(fullResult);
      return combinedScore;
    }
    
    // Fallback to rule-based only
    setMlScoreResult({
      rule_based_score: ruleScore,
      ml_score: null,
      combined_score: ruleScore,
      confidence_level: 'high',
      recommendation: ruleScore >= 75 ? 'approve' : ruleScore >= 60 ? 'review' : 'reject'
    });
    return ruleScore;
  };

  const selectProduct = async (product) => {
    setSelectedProduct(product);
    const score = await calculateFullScore();
    
    // Get active A/B tests and assign variant
    const activeTests = await base44.entities.ABTestConfig.filter({ status: 'active' });
    const variant = assignABTestVariant(user.id, activeTests, product);
    
    if (variant) {
      setAbTestVariant(variant);
      
      // Record assignment
      const existingAssignment = await base44.entities.ABTestAssignment.filter({
        user_id: user.id,
        test_key: variant.testKey,
        loan_type: product
      });
      
      if (existingAssignment.length === 0) {
        await base44.entities.ABTestAssignment.create({
          user_id: user.id,
          test_id: variant.testId,
          test_key: variant.testKey,
          variant_id: variant.variantId,
          variant_name: variant.variantName,
          assigned_date: new Date().toISOString(),
          loan_type: product
        });
        
        // Increment sample size
        const test = activeTests.find(t => t.id === variant.testId);
        if (test) {
          await base44.entities.ABTestConfig.update(variant.testId, {
            current_sample_size: (test.current_sample_size || 0) + 1
          });
        }
      }
    }
    
    if (product === 'urgent_10k') {
      const maxAmount = creditLimit?.current_limit || (loanConfig?.urgent_10k_base_amount || 10000);
      const baseRate = loanConfig?.urgent_10k_interest_rate || 15;
      const baseTenure = loanConfig?.urgent_10k_tenure_days || 30;
      
      // Apply AI personalization
      const personalized = personalizeOffer({
        loanType: product,
        baseInterestRate: baseRate,
        baseMaxAmount: maxAmount,
        baseTenureDays: baseTenure,
        mlScoreResult,
        creditLimit,
        behaviorData,
        abTestVariant: variant,
        loanConfig
      });
      
      setPersonalizedOfferData(personalized);
      setLoanAmount(Math.min(loanConfig?.urgent_10k_base_amount || 10000, personalized.personalizedAmount));
      setSelectedTenure(personalized.tenureOptions[0]);
      
      setLoanDetails({
        interestRate: personalized.personalizedRate,
        tenureDays: personalized.tenureOptions[0],
        tenureOptions: personalized.tenureOptions,
        score,
        minScore: loanConfig?.urgent_10k_min_score || 60,
        maxAmount: personalized.personalizedAmount,
        isPersonalized: true,
        adjustments: personalized.adjustments
      });
    } else {
      const configMax = loanConfig?.tier1_max_amount || 5000000;
      const scoreBasedMax = score >= 90 ? configMax : score >= 80 ? configMax * 0.6 : configMax * 0.2;
      const baseMax = Math.min(configMax, scoreBasedMax);
      const baseRate = loanConfig?.tier1_interest_rate || 12;
      const baseTenure = loanConfig?.tier1_tenure_days || 90;
      
      // Apply AI personalization
      const personalized = personalizeOffer({
        loanType: product,
        baseInterestRate: baseRate,
        baseMaxAmount: baseMax,
        baseTenureDays: baseTenure,
        mlScoreResult,
        creditLimit,
        behaviorData,
        abTestVariant: variant,
        loanConfig
      });
      
      setPersonalizedOfferData(personalized);
      setLoanAmount(loanConfig?.tier1_min_amount || 50000);
      setSelectedTenure(personalized.tenureOptions[0]);
      
      setLoanDetails({
        interestRate: personalized.personalizedRate,
        tenureDays: personalized.tenureOptions[0],
        tenureOptions: personalized.tenureOptions,
        score,
        minScore: loanConfig?.tier1_min_score || 75,
        maxAmount: personalized.personalizedAmount,
        isPersonalized: true,
        adjustments: personalized.adjustments
      });
    }
  };

  const calculateRepayment = () => {
    if (!loanDetails) return 0;
    const tenure = selectedTenure || loanDetails.tenureDays;
    const interest = (loanAmount * loanDetails.interestRate * tenure) / (365 * 100);
    return loanAmount + interest;
  };

  const submitApplication = async () => {
    if (!loanDetails || loanDetails.score < loanDetails.minScore) {
      setError(`Your score (${loanDetails.score}) is below the minimum required (${loanDetails.minScore})`);
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Get affiliate code from localStorage
      const affiliateCode = localStorage.getItem('affiliate_code');

      // Check for pending referral and convert it
      const pendingReferral = await base44.entities.UserReferral.filter({
        referred_user_id: user.id,
        status: 'pending'
      });

      // Check phone verification status
      const phoneVerified = kyc?.phone_verified === true;

      // Auto-approve urgent_10k if score meets criteria, manual review for tier1 or low scores
      const isUrgent10k = selectedProduct === 'urgent_10k';
      const meetsScoreCriteria = loanDetails.score >= loanDetails.minScore;
      const hasHighRiskFlags = mlScoreResult?.risk_flags_detected?.length > 2;
      const hasLowConfidence = mlScoreResult?.confidence_level === 'low';

      // Unverified phone forces manual review so admin can decide to waive or require OTP first
      const needsReview = !isUrgent10k || !meetsScoreCriteria || hasHighRiskFlags || hasLowConfidence || !phoneVerified;

      let reviewReason = '';
      let applicationStatus = 'approved';

      if (needsReview) {
        applicationStatus = 'pending';
        if (!phoneVerified) {
          reviewReason = 'Phone number not verified — admin must waive or user must verify before disbursement';
        } else if (!isUrgent10k) {
          reviewReason = 'Tier-1 loan requires manual review';
        } else if (!meetsScoreCriteria) {
          reviewReason = `Score ${loanDetails.score} below minimum ${loanDetails.minScore}`;
        } else if (hasLowConfidence) {
          reviewReason = 'Low ML confidence level - requires review';
        } else if (hasHighRiskFlags) {
          reviewReason = `Multiple risk flags: ${mlScoreResult.risk_flags_detected.join(', ')}`;
        }
      }

      const tenure = selectedTenure || loanDetails.tenureDays;
      
      const application = await base44.entities.LoanApplication.create({
        user_id: user.id,
        loan_type: selectedProduct,
        amount_requested: loanAmount,
        amount_approved: loanAmount,
        interest_rate: loanDetails.interestRate,
        tenure_days: tenure,
        total_repayment: calculateRepayment(),
        status: applicationStatus,
        score: loanDetails.score,
        score_breakdown: {
          bureau: creditSearch?.bureau_score,
          repayment_history: creditLimit?.successful_repayments || 0,
          property_years: kyc?.property_years,
          employment_verified: !!employmentVerification,
          ml_score: mlScoreResult?.ml_score,
          ml_breakdown: mlScoreResult?.ml_score_breakdown,
          risk_flags: mlScoreResult?.risk_flags_detected,
          bonus_factors: mlScoreResult?.bonus_factors_applied
        },
        manual_review_required: needsReview,
        manual_review_reason: reviewReason,
        original_score: loanDetails.score,
        affiliate_code: affiliateCode
      });
      
      // Save personalized offer
      if (personalizedOfferData) {
        await base44.entities.PersonalizedOffer.create({
          user_id: user.id,
          loan_type: selectedProduct,
          base_interest_rate: selectedProduct === 'urgent_10k' 
            ? (loanConfig?.urgent_10k_interest_rate || 15)
            : (loanConfig?.tier1_interest_rate || 12),
          personalized_interest_rate: loanDetails.interestRate,
          base_max_amount: selectedProduct === 'urgent_10k'
            ? (creditLimit?.current_limit || 10000)
            : (loanConfig?.tier1_max_amount || 5000000),
          personalized_max_amount: loanDetails.maxAmount,
          base_tenure_days: selectedProduct === 'urgent_10k' 
            ? (loanConfig?.urgent_10k_tenure_days || 30)
            : (loanConfig?.tier1_tenure_days || 90),
          personalized_tenure_options: loanDetails.tenureOptions,
          personalization_factors: personalizedOfferData.personalizationFactors,
          adjustments_applied: personalizedOfferData.adjustments,
          ab_test_variant: abTestVariant?.variantName,
          offer_accepted: true,
          loan_id: application.id
        });
      }
      
      // Update A/B test conversion
      if (abTestVariant) {
        const assignments = await base44.entities.ABTestAssignment.filter({
          user_id: user.id,
          test_key: abTestVariant.testKey,
          loan_type: selectedProduct
        });
        
        if (assignments[0]) {
          await base44.entities.ABTestAssignment.update(assignments[0].id, {
            converted: true,
            conversion_date: new Date().toISOString(),
            loan_id: application.id
          });
        }
      }

      // Save ML score result
      if (mlScoreResult) {
        await base44.entities.MLScoreResult.create({
          user_id: user.id,
          loan_id: application.id,
          ...mlScoreResult
        });
      }

      // Update or create credit limit
      if (!creditLimit) {
        await base44.entities.UserCreditLimit.create({
          user_id: user.id,
          current_limit: 10000,
          total_loans_taken: 1
        });
      } else {
        await base44.entities.UserCreditLimit.update(creditLimit.id, {
          total_loans_taken: (creditLimit.total_loans_taken || 0) + 1
        });
      }

      // Process referral conversion and rewards
      if (pendingReferral[0] && referralConfig?.enable_referral_program && loanAmount >= (referralConfig.min_loan_amount_for_conversion || 0)) {
        const referral = pendingReferral[0];
        const cashReward = referralConfig.referrer_cash_reward || 1000;
        const discountPercent = referralConfig.referred_interest_discount || 2;
        const cashBonus = referralConfig.referred_cash_bonus || 0;
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + (referralConfig.reward_expiry_days || 90));
        
        // Update referral status
        await base44.entities.UserReferral.update(referral.id, {
          status: 'converted',
          conversion_date: new Date().toISOString(),
          reward_issued: true,
          reward_amount: cashReward
        });

        // Create rewards for both referrer and referred user
        const rewardPromises = [
          base44.entities.ReferralReward.create({
            user_id: referral.referrer_id,
            referral_id: referral.id,
            reward_type: 'cash',
            reward_value: cashReward,
            description: `Referral bonus - friend took first loan`,
            status: 'active',
            expires_at: expiryDate.toISOString()
          })
        ];

        if (discountPercent > 0) {
          rewardPromises.push(
            base44.entities.ReferralReward.create({
              user_id: user.id,
              referral_id: referral.id,
              reward_type: 'interest_discount',
              reward_value: discountPercent,
              description: `Welcome bonus - ${discountPercent}% interest discount`,
              status: 'active',
              applied_to_loan_id: application.id
            })
          );

          // Apply interest discount to this loan
          const discountedRate = Math.max(0, loanDetails.interestRate - discountPercent);
          const newInterest = (loanAmount * discountedRate * loanDetails.tenureDays) / (365 * 100);
          const newTotal = loanAmount + newInterest;
          
          await base44.entities.LoanApplication.update(application.id, {
            interest_rate: discountedRate,
            total_repayment: newTotal
          });
        }

        if (cashBonus > 0) {
          rewardPromises.push(
            base44.entities.ReferralReward.create({
              user_id: user.id,
              referral_id: referral.id,
              reward_type: 'cash',
              reward_value: cashBonus,
              description: `Welcome cash bonus`,
              status: 'active',
              expires_at: expiryDate.toISOString()
            })
          );
        }

        await Promise.all(rewardPromises);
      }

      // Navigate based on approval status
      if (needsReview) {
        setSuccessMessage('Application submitted for review. You will be notified via email once reviewed.');
        setProcessing(false);
        setTimeout(() => navigate(createPageUrl('Dashboard')), 3000);
      } else {
        // Auto-approved - proceed to direct debit setup
        navigate(createPageUrl(`SetupDirectDebit?loan_id=${application.id}`));
      }

    } catch (err) {
      setError('Failed to submit application. Please try again.');
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

  if (!canApply()) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b px-4 py-4">
          <div className="max-w-lg mx-auto flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Dashboard'))}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-semibold text-gray-900">Apply for Loan</h1>
          </div>
        </div>
        <div className="max-w-lg mx-auto px-4 py-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {kyc?.kyc_status !== 'verified' && 'Please complete KYC verification first.'}
              {!isCreditSearchValid() && 'Please complete a credit search first.'}
              {creditLimit?.is_frozen && 'Your account is frozen due to missed payments.'}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Dashboard'))}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold text-gray-900">Apply for Loan</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Product Selection */}
        {!selectedProduct && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold text-gray-900">Select Loan Product</h2>
            
            {/* Urgent 10k */}
            <Card 
              className={`border-2 cursor-pointer transition hover:border-emerald-300 ${
                selectedProduct === 'urgent_10k' ? 'border-emerald-500' : 'border-gray-200'
              }`}
              onClick={() => selectProduct('urgent_10k')}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <Zap className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">Urgent ₦10,000</h3>
                    <p className="text-sm text-gray-500 mb-2">Credit limit builder</p>
                    <div className="flex gap-2">
                      <Badge variant="outline">15% interest</Badge>
                      <Badge variant="outline">30 days</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tier-1 */}
            <Card 
              className={`border-2 cursor-pointer transition ${
                employmentVerification 
                  ? 'hover:border-emerald-300' 
                  : 'opacity-60 cursor-not-allowed'
              } ${selectedProduct === 'tier1_personal' ? 'border-emerald-500' : 'border-gray-200'}`}
              onClick={() => employmentVerification && selectProduct('tier1_personal')}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">Tier-1 Personal</h3>
                      {!employmentVerification && (
                        <Badge variant="secondary">Verify employer first</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mb-2">Up to ₦5,000,000</p>
                    <div className="flex gap-2">
                      <Badge variant="outline">12% interest</Badge>
                      <Badge variant="outline">90 days</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Loan Configuration */}
        {selectedProduct && loanDetails && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <Button 
              variant="ghost" 
              className="mb-2"
              onClick={() => setSelectedProduct(null)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Change product
            </Button>

            {/* Score Card */}
            <Card className={`border-0 shadow-md ${
              loanDetails.score >= loanDetails.minScore 
                ? 'border-l-4 border-l-emerald-500' 
                : 'border-l-4 border-l-red-500'
            }`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Your Loan Score</p>
                    <p className="text-2xl font-bold text-gray-900">{loanDetails.score}/100</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Minimum Required</p>
                    <p className="text-lg font-semibold text-gray-700">{loanDetails.minScore}/100</p>
                  </div>
                </div>
                {loanDetails.score < loanDetails.minScore && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Your score is below the minimum. Improve your credit history to qualify.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Amount Slider */}
            {loanDetails.score >= loanDetails.minScore && (
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg">Loan Amount</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center">
                    <span className="text-4xl font-bold text-emerald-600">
                      ₦{loanAmount.toLocaleString()}
                    </span>
                  </div>
                  
                  <Slider
                    value={[loanAmount]}
                    onValueChange={([v]) => setLoanAmount(v)}
                    min={selectedProduct === 'urgent_10k' ? 5000 : 50000}
                    max={loanDetails.maxAmount}
                    step={selectedProduct === 'urgent_10k' ? 1000 : 10000}
                    className="py-4"
                  />
                  
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>₦{selectedProduct === 'urgent_10k' ? '5,000' : '50,000'}</span>
                    <span>₦{loanDetails.maxAmount.toLocaleString()}</span>
                  </div>

                  {/* Personalization Notice */}
                  {loanDetails.isPersonalized && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Zap className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-emerald-900 text-sm mb-1">Personalized for You</p>
                          <p className="text-xs text-emerald-700 mb-2">AI-optimized offer based on your profile</p>
                          {loanDetails.adjustments && loanDetails.adjustments.length > 0 && (
                            <div className="space-y-1">
                              {loanDetails.adjustments.slice(0, 3).map((adj, i) => (
                                <div key={i} className="text-xs text-emerald-600">
                                  <span className="font-medium">{adj.adjustment}</span> - {adj.impact}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tenure Selection */}
                  {loanDetails.tenureOptions && loanDetails.tenureOptions.length > 1 && (
                    <div>
                      <Label className="text-sm text-gray-600 mb-2 block">Select Repayment Period</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {loanDetails.tenureOptions.map((tenure) => (
                          <button
                            key={tenure}
                            type="button"
                            onClick={() => setSelectedTenure(tenure)}
                            className={`px-4 py-3 rounded-xl border-2 transition ${
                              (selectedTenure || loanDetails.tenureDays) === tenure
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="font-semibold">{tenure}</div>
                            <div className="text-xs text-gray-500">days</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ML Score Display */}
                  {mlScoreResult && (
                    <ScoreDisplay scoreResult={mlScoreResult} showBreakdown={true} />
                  )}

                  {/* Loan Summary */}
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Percent className="w-4 h-4" />
                        Interest Rate
                      </div>
                      <span className="font-semibold">{loanDetails.interestRate}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="w-4 h-4" />
                        Tenure
                      </div>
                      <span className="font-semibold">{loanDetails.tenureDays} days</span>
                    </div>
                    <div className="flex items-center justify-between border-t pt-3">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calculator className="w-4 h-4" />
                        Total Repayment
                      </div>
                      <span className="font-bold text-lg text-emerald-600">
                        ₦{Math.round(calculateRepayment()).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <Button 
                    className="w-full bg-emerald-600 hover:bg-emerald-700 py-6"
                    onClick={submitApplication}
                    disabled={processing}
                  >
                    {processing ? (
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                    )}
                    Apply Now
                  </Button>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert className="bg-emerald-50 border-emerald-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-emerald-800">{successMessage}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}