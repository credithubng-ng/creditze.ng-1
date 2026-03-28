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
    if (!kyc.bvn_verified) {
      return Response.json({ success: false, error: 'BVN must be verified first' }, { status: 400 });
    }

    // Get QoreID access token
    const clientId = Deno.env.get('QOREID_CLIENT_ID');
    const clientSecret = Deno.env.get('QOREID_SECRET');
    if (!clientId || !clientSecret) {
      return Response.json({ success: false, error: 'QoreID not configured' }, { status: 500 });
    }

    const tokenResponse = await fetch('https://api.qoreid.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clientId: clientId,
        secret: clientSecret
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.accessToken) {
      throw new Error('Failed to get access token');
    }

    // QoreID facial matching endpoint
    const facialResponse = await fetch(`https://api.qoreid.com/v1/ng/identities/face-verification/nin`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        nin: kyc.nin,
        selfie_image_url: selfie_image_url
      })
    });

    const facialData = await facialResponse.json();

    if (!facialResponse.ok || facialData.status !== 'success') {
      return Response.json({
        success: false,
        error: facialData.message || 'Facial recognition failed. Please ensure good lighting and clear visibility of your face.',
        code: 'FACIAL_MATCH_FAILED'
      }, { status: 400 });
    }

    // Check match confidence
    const matchScore = facialData.data?.match_score || 0;
    const isMatch = matchScore >= 0.8; // 80% confidence threshold

    if (!isMatch) {
      return Response.json({
        success: false,
        error: 'Face does not match BVN record. Please try again with a clear, well-lit photo.',
        matchScore: matchScore,
        code: 'LOW_MATCH_CONFIDENCE'
      }, { status: 400 });
    }

    // Update KYC with successful facial recognition
    await base44.entities.KYCProfile.update(kyc.id, {
      facial_recognition_verified: true,
      facial_recognition_image_url: selfie_image_url
    });

    return Response.json({
      success: true,
      message: 'Facial recognition verified successfully',
      matchScore: matchScore,
      facialVerified: true
    });

  } catch (error) {
    console.error('Facial recognition verification error:', error);
    return Response.json({ 
      success: false, 
      error: error.message || 'Facial recognition verification failed' 
    }, { status: 500 });
  }
});