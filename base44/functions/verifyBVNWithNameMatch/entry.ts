import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const QOREID_BASE_URL = Deno.env.get("QOREID_BASE_URL") || "https://api.qoreid.com";

async function getQoreIdToken() {
  const response = await fetch(`${QOREID_BASE_URL}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({
      clientId: Deno.env.get("QOREID_CLIENT_ID"),
      secret: Deno.env.get("QOREID_SECRET")
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`QoreID token error: ${response.status} ${JSON.stringify(data)}`);
  }

  if (!data.accessToken) {
    throw new Error("QoreID token missing accessToken");
  }

  return data.accessToken;
}

async function qoreIdRequest(endpoint, options = {}) {
  const token = await getQoreIdToken();

  const response = await fetch(`${QOREID_BASE_URL}${endpoint}`, {
    method: options.method || "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`QoreID API error: ${response.status} ${JSON.stringify(data)}`);
  }

  return data;
}

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

    // Verify BVN with QoreID
    const qoreData = await qoreIdRequest(`/v1/ng/identities/bvn-basic/${encodeURIComponent(bvn)}`, {
      method: "POST"
    });

    const data = qoreData.data || qoreData || {};
    await base44.entities.KYCProfile.update(kyc.id, {
      bvn: bvn,
      bvn_verified: true,
      bvn_full_name: data.firstName ? `${data.firstName} ${data.lastName || ''}`.trim() : data.full_name || '',
      bvn_phone_number: data.phoneNumber || data.phone_number || '',
      bvn_date_of_birth: data.dateOfBirth || data.date_of_birth || '',
      bvn_gender: (data.gender || '').toLowerCase()
    });

    return Response.json({
      success: true,
      data: {
        full_name: data.firstName ? `${data.firstName} ${data.lastName || ''}`.trim() : data.full_name,
        phone_number: data.phoneNumber || data.phone_number,
        date_of_birth: data.dateOfBirth || data.date_of_birth,
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