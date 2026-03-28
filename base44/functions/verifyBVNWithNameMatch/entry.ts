import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Simple name matching: check if names are similar (handles variations)
function normalizeAndMatchName(name1, name2) {
  if (!name1 || !name2) return false;
  
  const normalize = (n) => n.trim().toLowerCase().replace(/\s+/g, ' ');
  const n1 = normalize(name1);
  const n2 = normalize(name2);
  
  // Exact match
  if (n1 === n2) return true;
  
  // Check if one contains the other (handles partial names)
  if (n1.includes(n2) || n2.includes(n1)) return true;
  
  return false;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bvn, search_id } = await req.json();

    if (!bvn || bvn.length !== 11) {
      return Response.json({ success: false, error: 'Invalid BVN format' }, { status: 400 });
    }

    // Get KYC profile
    const kycData = await base44.entities.KYCProfile.filter({ user_id: user.id });
    if (!kycData[0]) {
      return Response.json({ success: false, error: 'KYC profile not found' }, { status: 400 });
    }
    const kyc = kycData[0];

    // Verify BVN via QoreID
    const qoreIdKey = Deno.env.get('QOREID_API_KEY');
    if (!qoreIdKey) {
      return Response.json({ success: false, error: 'QoreID not configured' }, { status: 500 });
    }

    const qoreResponse = await fetch('https://api.qore.inc/api/v1/bvn/details', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${qoreIdKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ bvn: bvn })
    });

    const qoreData = await qoreResponse.json();

    if (!qoreData.RequestStatus) {
      return Response.json({ 
        success: false, 
        error: qoreData.ResponseMessage || 'BVN verification failed with provider'
      }, { status: 400 });
    }

    const bvnDetails = qoreData.bvnDetails || {};
    const bvnFullName = `${bvnDetails.FirstName || ''} ${bvnDetails.OtherNames || ''} ${bvnDetails.LastName || ''}`.trim();
    const bvnPhone = bvnDetails.phoneNumber || '';
    const bvnEmail = bvnDetails.email || '';
    const bvnDob = bvnDetails.DOB || '';
    const bvnGender = '';

    // Check name matches (2 of 3 required)
    let nameMatchCount = 0;
    const userFullName = kyc.full_name || user.full_name || '';
    
    // Match 1: Full name vs BVN full name
    if (normalizeAndMatchName(userFullName, bvnFullName)) {
      nameMatchCount++;
    }

    // Match 2: Full name contains BVN last name (if detectable)
    const bvnLastName = bvnFullName.split(' ').pop();
    if (bvnLastName && normalizeAndMatchName(userFullName, bvnLastName)) {
      nameMatchCount++;
    }

    // Match 3: First name match
    const userFirstName = userFullName.split(' ')[0];
    const bvnFirstName = bvnFullName.split(' ')[0];
    if (userFirstName && bvnFirstName && normalizeAndMatchName(userFirstName, bvnFirstName)) {
      nameMatchCount++;
    }

    // Require at least 2 matches
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

    // BVN is valid, send email OTP to BVN email on record
    if (!bvnEmail) {
      return Response.json({ 
        success: false, 
        error: 'No email found on BVN record. Please contact support.' 
      }, { status: 400 });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

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
      otp_email_target: bvnEmail
    });

    // Send email OTP to BVN email on record
    await base44.integrations.Core.SendEmail({
      to: bvnEmail,
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