import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { selfie_image_url } = await req.json();

    if (!selfie_image_url) {
      return Response.json({ success: false, error: 'Selfie image is required' }, { status: 400 });
    }

    // Get KYC profile
    const kycData = await base44.entities.KYCProfile.filter({ user_id: user.id });
    if (!kycData[0]) {
      return Response.json({ success: false, error: 'KYC profile not found' }, { status: 400 });
    }
    const kyc = kycData[0];

    // Ensure BVN is verified
    if (!kyc.bvn) {
      return Response.json({ success: false, error: 'BVN must be verified first' }, { status: 400 });
    }

    // Initiate async facial recognition with QoreID
    const qoreIdKey = Deno.env.get('QOREID_API_KEY');
    if (!qoreIdKey) {
      return Response.json({ success: false, error: 'QoreID not configured' }, { status: 500 });
    }

    // Generate unique reference for webhook tracking
    const reference = `facial_${user.id}_${Date.now()}`;

    // Call QoreID for facial matching
    const facialResponse = await fetch('https://api.myidentitypass.com/api/v1/kyc/bvn-face-match', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${qoreIdKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        number: kyc.bvn,
        image: selfie_image_url,
        reference: reference
      })
    });

    if (!facialResponse.ok) {
      return Response.json({
        success: false,
        error: 'Facial recognition service unavailable',
        code: 'SERVICE_ERROR'
      }, { status: 500 });
    }

    const facialData = await facialResponse.json();

    if (!facialData.success) {
      return Response.json({
        success: false,
        error: facialData.message || 'Facial recognition failed. Please ensure good lighting and clear visibility of your face.',
        code: 'FACIAL_MATCH_FAILED'
      }, { status: 400 });
    }

    // Store reference and selfie image for webhook tracking
    await base44.entities.KYCProfile.update(kyc.id, {
      facial_recognition_image_url: selfie_image_url,
      verification_reference: reference,
      verification_status: 'pending'
    });

    return Response.json({
      success: true,
      message: 'Facial recognition initiated. You will receive updates shortly.',
      reference: reference,
      status: 'pending'
    });

  } catch (error) {
    console.error('Facial recognition verification error:', error);
    return Response.json({ 
      success: false, 
      error: error.message || 'Facial recognition verification failed' 
    }, { status: 500 });
  }
});