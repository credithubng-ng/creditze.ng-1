import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Module-level token cache (persists for the lifetime of the Deno isolate)
// On first use, try QOREID_API_KEY from env. When it expires (403), auto-generate a new one.
let cachedToken = null;
let tokenExpireAt = 0;

async function refreshQoreIDToken() {
  console.log('Fetching new QoreID token via client credentials...');
  const clientId = Deno.env.get('QOREID_CLIENT_ID');
  const secret = Deno.env.get('QOREID_SECRET');

  if (!clientId || !secret) {
    throw new Error('QoreID credentials not configured');
  }

  const tokenResponse = await fetch('https://api.qoreid.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, secret })
  });

  if (!tokenResponse.ok) {
    const err = await tokenResponse.text();
    throw new Error(`QoreID token fetch failed: ${err}`);
  }

  const tokenData = await tokenResponse.json();
  const expiresIn = tokenData.expiresIn || 7200;
  const currentTime = Math.floor(Date.now() / 1000);

  cachedToken = tokenData.accessToken;
  tokenExpireAt = currentTime + expiresIn - 60; // 60s buffer

  console.log(`New QoreID token obtained, expires in ${expiresIn}s`);
  return cachedToken;
}

async function getQoreIDToken() {
  const currentTime = Math.floor(Date.now() / 1000);

  // Use cached/generated token if still valid
  if (cachedToken && currentTime < tokenExpireAt) {
    console.log('Using cached QoreID token');
    return cachedToken;
  }

  // First time: use the API key from environment
  const envApiKey = Deno.env.get('QOREID_API_KEY');
  if (envApiKey && !cachedToken) {
    console.log('Using QOREID_API_KEY from environment');
    cachedToken = envApiKey;
    tokenExpireAt = currentTime + 7200 - 60; // assume 2hr validity
    return cachedToken;
  }

  // Token expired: auto-generate a new one
  return await refreshQoreIDToken();
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

    // Get QoreID access token (auto-refreshes every 2 hours)
    const accessToken = await getQoreIDToken();

    // Use the user's full name from KYC for local matching only — do NOT send names to QoreID
    const userFullName = kyc.full_name || user.full_name || '';

    console.log(`Calling bvn-basic for BVN: ${bvn.slice(0,4)}**** (no names sent — matching locally)`);

    // Call QoreID BVN basic endpoint — send dummy names so QoreID returns the record,
    // but we do our own matching locally (not relying on their match result)
    const callQoreID = async (token) => fetch(`https://api.qoreid.com/v1/ng/identities/bvn-basic/${bvn}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'accept': 'application/json'
      },
      body: JSON.stringify({ firstname: 'a', lastname: 'b' })
    });

    let qoreIdResponse = await callQoreID(accessToken);

    // If token expired (401), force-refresh and retry once
    if (qoreIdResponse.status === 401) {
      console.log('Token expired (401), refreshing and retrying...');
      cachedToken = null;
      tokenExpireAt = 0;
      const newToken = await refreshQoreIDToken();
      qoreIdResponse = await callQoreID(newToken);
    }

    const qoreIdData = await qoreIdResponse.json();
    console.log('QoreID BVN response:', JSON.stringify(qoreIdData));

    if (!qoreIdResponse.ok) {
      console.log('QoreID error response:', JSON.stringify(qoreIdData), 'HTTP status:', qoreIdResponse.status);
      const errMsg = qoreIdResponse.status === 403
        ? 'BVN verification service is not enabled on this account. Please contact support.'
        : (qoreIdData.message || qoreIdData.error || 'BVN verification failed with provider');
      return Response.json({ success: false, error: errMsg }, { status: 400 });
    }

    // Check that BVN data actually came back (state=complete means the BVN was found)
    const bvnState = qoreIdData.status?.state;
    if (!qoreIdData.bvn || (bvnState && bvnState !== 'complete')) {
      return Response.json({
        success: false,
        error: 'BVN not found or could not be verified. Please check your BVN and try again.'
      }, { status: 400 });
    }

    const bvnRecord = qoreIdData.bvn || {};
    const bvnFullName = [bvnRecord.firstname, bvnRecord.middlename, bvnRecord.lastname].filter(Boolean).join(' ').trim();
    const bvnPhone = bvnRecord.phone || '';
    const bvnEmail = bvnRecord.email || '';
    const bvnDob = bvnRecord.birthdate || '';
    const bvnGender = bvnRecord.gender?.toLowerCase() || '';

    // Local 2-of-3 name matching — compare individual name parts
    const userParts = userFullName.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const bvnParts = bvnFullName.trim().toLowerCase().split(/\s+/).filter(Boolean);

    // A user part matches a BVN part only on exact match (no short forms or nicknames)
    const partMatches = (uPart, bPart) => uPart === bPart;
    const matchedParts = userParts.filter(uPart => bvnParts.some(bPart => partMatches(uPart, bPart)));
    const nameMatchCount = matchedParts.length;

    console.log(`Name match: user="${userFullName}" bvn="${bvnFullName}" matched=${nameMatchCount} parts`);

    // Require at least 2 name parts to match
    if (nameMatchCount < 2) {
      return Response.json({
        success: false,
        error: `BVN name mismatch. Your name (${userFullName}) does not match the BVN record (${bvnFullName}). Please verify your details.`,
        nameMatchCount: nameMatchCount,
        details: {
          userFullName: userFullName,
          bvnFullName: bvnFullName
        }
      }, { status: 400 });
    }

    // Send OTP to BVN email if available, otherwise fall back to user's registered email
    const otpTarget = bvnEmail || user.email;
    if (!otpTarget) {
      return Response.json({ 
        success: false, 
        error: 'No email address available for OTP delivery.' 
      }, { status: 400 });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

    console.log(`Sending OTP to: ${otpTarget} (${bvnEmail ? 'BVN email' : 'user email fallback'})`);

    await base44.entities.KYCProfile.update(kyc.id, {
      bvn: bvn,
      bvn_verified: false, // Will be set to true after email OTP verification
      bvn_full_name: bvnFullName,
      bvn_phone_number: bvnPhone,
      bvn_date_of_birth: bvnDob,
      bvn_gender: bvnGender,
      bvn_name_match_score: nameMatchCount,
      otp_email: otpCode,
      otp_email_expires: expiresAt,
      otp_email_target: otpTarget
    });

    // Send email OTP
    await base44.integrations.Core.SendEmail({
      to: otpTarget,
      subject: '🔐 BVN Verification Code — Creditze',
      body: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:20px;background:#f3f4f6;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#059669 0%,#10b981 100%);padding:40px 30px;text-align:center;">
      <h1 style="color:white;margin:0;font-size:24px;">BVN Verification</h1>
    </div>
    <div style="padding:36px 30px;">
      <p style="color:#374151;font-size:16px;margin:0 0 16px;">Hi ${user.full_name || 'there'},</p>
      <p style="color:#6b7280;line-height:1.6;margin:0 0 28px;">Your BVN has been successfully verified. Use the code below to complete the verification:</p>
      <div style="background:#f0fdf4;padding:24px;border-radius:12px;text-align:center;margin:0 0 28px;border:2px solid #d1fae5;">
        <p style="color:#047857;font-size:12px;margin:0 0 8px;text-transform:uppercase;letter-spacing:2px;">Verification Code</p>
        <h2 style="color:#059669;margin:0;font-size:36px;letter-spacing:8px;font-weight:bold;">${otpCode}</h2>
        <p style="color:#6b7280;font-size:12px;margin:8px 0 0;">Valid for 15 minutes</p>
      </div>
      <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 16px;">Never share this code with anyone. We will never ask for it.</p>
      <div style="background:#fef3c7;padding:16px;border-radius:8px;margin:0 0 28px;border-left:4px solid #f59e0b;">
        <p style="color:#92400e;margin:0;font-size:13px;">⏰ This code will expire in 15 minutes. If you didn't request this, please ignore this email.</p>
      </div>
      <p style="color:#9ca3af;font-size:12px;margin:0;">Questions? Contact support@creditze.ng</p>
    </div>
  </div>
</body>
</html>`
    });

    return Response.json({
      success: true,
      message: 'BVN verified. OTP sent to your email.',
      nameMatchCount: nameMatchCount,
      bvnData: {
        fullName: bvnFullName,
        phoneNumber: bvnPhone,
        dateOfBirth: bvnDob
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