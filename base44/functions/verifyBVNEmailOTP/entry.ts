import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { otp } = await req.json();

    if (!otp || otp.length !== 6) {
      return Response.json({ success: false, error: 'Invalid OTP format' }, { status: 400 });
    }

    // Get KYC profile
    const kycData = await base44.entities.KYCProfile.filter({ user_id: user.id });
    if (!kycData[0]) {
      return Response.json({ success: false, error: 'KYC profile not found' }, { status: 400 });
    }
    const kyc = kycData[0];

    // Verify OTP
    if (!kyc.otp_email || kyc.otp_email !== otp) {
      return Response.json({ success: false, error: 'Invalid OTP' }, { status: 400 });
    }

    // Check expiry
    if (new Date(kyc.otp_email_expires) < new Date()) {
      return Response.json({ success: false, error: 'OTP has expired. Please request a new one.' }, { status: 400 });
    }

    // Mark BVN email as verified
    await base44.entities.KYCProfile.update(kyc.id, {
      bvn_verified: true,
      bvn_email_verified: true,
      otp_email: null,
      otp_email_expires: null
    });

    return Response.json({
      success: true,
      message: 'BVN email verified successfully',
      bvnVerified: true
    });

  } catch (error) {
    console.error('BVN email OTP verification error:', error);
    return Response.json({ 
      success: false, 
      error: error.message || 'Verification failed' 
    }, { status: 500 });
  }
});