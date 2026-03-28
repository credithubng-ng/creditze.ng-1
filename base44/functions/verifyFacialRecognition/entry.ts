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

    // Ensure NIN is verified or available
    if (!kyc.nin) {
      return Response.json({ success: false, error: 'NIN must be verified first' }, { status: 400 });
    }

    // Verify facial recognition with QoreID
    const facialData = await qoreIdRequest(`/v1/ng/identities/face-verification/nin`, {
      method: "POST",
      body: {
        idNumber: kyc.nin,
        selfieImage: selfie_image_url
      }
    });

    // Update KYC with facial recognition result
    await base44.entities.KYCProfile.update(kyc.id, {
      facial_recognition_verified: true,
      facial_recognition_image_url: selfie_image_url
    });

    return Response.json({
      success: true,
      message: 'Facial recognition verified successfully',
      data: facialData
    });

  } catch (error) {
    console.error('Facial recognition error:', error);
    return Response.json({ 
      success: false, 
      error: error.message || 'Facial recognition failed' 
    }, { status: 500 });
  }
});