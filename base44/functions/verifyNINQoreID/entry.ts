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

    const qoreIdKey = Deno.env.get('QOREID_API_KEY');
    if (!qoreIdKey) {
      return Response.json({ success: false, error: 'QoreID not configured' }, { status: 500 });
    }

    // Call QoreID NIN verification
    const response = await fetch('https://api.qoreid.com/api/v1/verification/nin', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${qoreIdKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        nin: nin
      })
    });

    const qoreIdData = await response.json();

    if (!qoreIdData.success) {
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