import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bvn } = await req.json();

    if (!bvn || bvn.length !== 11) {
      return Response.json({ success: false, error: 'Invalid BVN format' }, { status: 400 });
    }

    // Get KYC profile
    const kycData = await base44.entities.KYCProfile.filter({ user_id: user.id });
    if (!kycData[0]) {
      return Response.json({ success: false, error: 'KYC profile not found' }, { status: 400 });
    }
    const kyc = kycData[0];

    // Verify BVN directly with QoreID
    const qoreIdKey = Deno.env.get('QOREID_API_KEY');
    if (!qoreIdKey) {
      return Response.json({ success: false, error: 'QoreID not configured' }, { status: 500 });
    }

    const qoreResponse = await fetch('https://api.myidentitypass.com/api/v1/kyc/bvn', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${qoreIdKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        number: bvn
      })
    });

    if (!qoreResponse.ok) {
      return Response.json({ 
        success: false, 
        error: `QoreID API error: ${qoreResponse.statusText}`
      }, { status: 400 });
    }

    const qoreData = await qoreResponse.json();

    if (!qoreData.success) {
      return Response.json({ 
        success: false, 
        error: qoreData.message || 'BVN verification failed'
      }, { status: 400 });
    }

    // Update KYC with verified BVN data
    const data = qoreData.data || {};
    await base44.entities.KYCProfile.update(kyc.id, {
      bvn: bvn,
      bvn_verified: true,
      bvn_full_name: data.full_name || '',
      bvn_phone_number: data.phone_number || '',
      bvn_date_of_birth: data.date_of_birth || '',
      bvn_gender: (data.gender || '').toLowerCase()
    });

    return Response.json({
      success: true,
      data: {
        full_name: data.full_name,
        phone_number: data.phone_number,
        date_of_birth: data.date_of_birth,
        gender: data.gender
      }
    });

  } catch (error) {
    console.error('BVN verification error:', error);
    return Response.json({ 
      success: false, 
      error: error.message || 'BVN verification failed' 
    }, { status: 500 });
  }
});