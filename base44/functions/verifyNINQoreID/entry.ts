import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { nin } = await req.json();

    if (!nin || nin.length !== 11) {
      return Response.json({ success: false, error: 'NIN must be 11 digits' }, { status: 400 });
    }

    // Get KYC data to extract name
    const kycData = await base44.entities.KYCProfile.filter({ user_id: user.id });
    if (!kycData[0]) {
      return Response.json({ success: false, error: 'KYC profile not found' }, { status: 400 });
    }
    const kyc = kycData[0];

    // Parse full name into firstname and lastname
    const fullName = kyc.full_name || user.full_name || '';
    const nameParts = fullName.trim().split(' ');
    const firstname = nameParts[0] || '';
    const lastname = nameParts[nameParts.length - 1] || '';
    const middlename = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '';

    if (!firstname || !lastname) {
      return Response.json({ success: false, error: 'Full name required in profile' }, { status: 400 });
    }

    const clientId = Deno.env.get('QOREID_CLIENT_ID');
    const clientSecret = Deno.env.get('QOREID_SECRET');
    if (!clientId || !clientSecret) {
      return Response.json({ success: false, error: 'QoreID not configured' }, { status: 500 });
    }

    // Get access token
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
    console.log('Token response status:', tokenResponse.status, 'hasToken:', !!tokenData.accessToken);
    if (!tokenData.accessToken) {
      console.log('Token error:', JSON.stringify(tokenData));
      throw new Error('Failed to get access token');
    }

    const requestBody = {
      firstname: firstname,
      lastname: lastname,
      ...(middlename && { middlename }),
      ...(kyc.date_of_birth && { dob: kyc.date_of_birth }),
      ...(kyc.phone_number && { phone: kyc.phone_number }),
      ...(kyc.gender && { gender: kyc.gender })
    };
    console.log('Calling NIN endpoint for nin:', nin, 'body:', JSON.stringify(requestBody));

    // Call QoreID NIN verification
    const response = await fetch(`https://api.qoreid.com/v1/ng/identities/nin/${nin}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const qoreIdData = await response.json();
    console.log('NIN response status:', response.status, 'body:', JSON.stringify(qoreIdData));

    if (!response.ok || qoreIdData.status !== 'success') {
      return Response.json({
        success: false,
        error: qoreIdData.message || 'NIN verification failed'
      }, { status: 400 });
    }

    return Response.json({
      success: true,
      message: 'NIN verified successfully',
      data: {
        full_name: qoreIdData.data?.name || '',
        phone_number: qoreIdData.data?.phone_number || '',
        date_of_birth: qoreIdData.data?.date_of_birth || '',
        gender: qoreIdData.data?.gender || ''
      }
    });

  } catch (error) {
    console.error('NIN verification error:', error);
    return Response.json({ 
      success: false, 
      error: error.message || 'NIN verification failed' 
    }, { status: 500 });
  }
});