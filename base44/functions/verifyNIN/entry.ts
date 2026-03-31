import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Reuse the same token refresh pattern as verifyBVNWithNameMatch
let cachedToken = null;
let tokenExpireAt = 0;

async function refreshQoreIDToken() {
    const clientId = Deno.env.get('QOREID_CLIENT_ID');
    const secret = Deno.env.get('QOREID_SECRET');
    if (!clientId || !secret) throw new Error('QoreID credentials not configured');

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
    cachedToken = tokenData.accessToken;
    tokenExpireAt = Math.floor(Date.now() / 1000) + expiresIn - 60;
    return cachedToken;
}

async function getQoreIDToken() {
    const currentTime = Math.floor(Date.now() / 1000);
    if (cachedToken && currentTime < tokenExpireAt) return cachedToken;
    const envApiKey = Deno.env.get('QOREID_API_KEY');
    if (envApiKey && !cachedToken) {
        cachedToken = envApiKey;
        tokenExpireAt = currentTime + 7200 - 60;
        return cachedToken;
    }
    return await refreshQoreIDToken();
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const { nin } = await req.json();

        if (!nin || nin.length !== 11) {
            return Response.json({ success: false, error: 'NIN must be 11 digits' }, { status: 400 });
        }

        // Get KYC profile for name matching
        const kycData = await base44.entities.KYCProfile.filter({ user_id: user.id });
        if (!kycData[0]) return Response.json({ success: false, error: 'KYC profile not found' }, { status: 400 });
        const kyc = kycData[0];

        // Extract first and last name from BVN data or KYC full name
        const fullName = kyc.bvn_full_name || kyc.full_name || user.full_name || '';
        const nameParts = fullName.trim().split(/\s+/);
        const firstname = nameParts[0] || 'a';
        const lastname = nameParts[nameParts.length - 1] || 'b';

        const accessToken = await getQoreIDToken();

        const callQoreID = async (token) => fetch(`https://api.qoreid.com/v1/ng/identities/nin/${nin}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            },
            body: JSON.stringify({ firstname, lastname })
        });

        let qoreIdResponse = await callQoreID(accessToken);

        if (qoreIdResponse.status === 401) {
            cachedToken = null;
            tokenExpireAt = 0;
            const newToken = await refreshQoreIDToken();
            qoreIdResponse = await callQoreID(newToken);
        }

        const qoreIdData = await qoreIdResponse.json();
        console.log('QoreID NIN response:', JSON.stringify(qoreIdData));

        if (!qoreIdResponse.ok) {
            const errMsg = qoreIdData.message || qoreIdData.error || 'NIN verification failed';
            return Response.json({ success: false, error: errMsg }, { status: 400 });
        }

        const state = qoreIdData.status?.state;
        const ninRecord = qoreIdData.nin || {};

        if (!ninRecord.nin && (!state || state !== 'complete')) {
            return Response.json({ success: false, error: 'NIN not found or could not be verified.' }, { status: 400 });
        }

        // Local name matching — 2 of 3 parts must match
        const ninFullName = [ninRecord.firstname, ninRecord.middlename, ninRecord.lastname].filter(Boolean).join(' ').trim();
        const userParts = fullName.trim().toLowerCase().split(/\s+/).filter(Boolean);
        const ninParts = ninFullName.trim().toLowerCase().split(/\s+/).filter(Boolean);
        const matchCount = userParts.filter(u => ninParts.some(n => n === u)).length;

        console.log(`NIN name match: user="${fullName}" nin="${ninFullName}" matched=${matchCount}`);

        if (matchCount < 2) {
            return Response.json({
                success: false,
                error: `NIN name mismatch. Your name (${fullName}) does not match the NIN record (${ninFullName}). Please verify your details.`
            }, { status: 400 });
        }

        // Save NIN to KYC profile (mark as verified)
        await base44.entities.KYCProfile.update(kyc.id, {
            nin: nin,
            nin_verified: true
        });

        return Response.json({
            success: true,
            message: 'NIN verified successfully.',
            ninData: {
                fullName: ninFullName,
                phone: ninRecord.phone || '',
                dateOfBirth: ninRecord.birthdate || '',
                gender: ninRecord.gender || '',
                hasPhoto: !!ninRecord.photo
            }
        });

    } catch (error) {
        console.error('NIN verification error:', error);
        return Response.json({ success: false, error: error.message || 'NIN verification failed' }, { status: 500 });
    }
});