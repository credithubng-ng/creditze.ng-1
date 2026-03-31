import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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

        const { photoBase64 } = await req.json();

        if (!photoBase64) {
            return Response.json({ success: false, error: 'Selfie photo is required' }, { status: 400 });
        }

        // Get KYC profile — need NIN for face verification
        const kycData = await base44.entities.KYCProfile.filter({ user_id: user.id });
        if (!kycData[0]) return Response.json({ success: false, error: 'KYC profile not found' }, { status: 400 });
        const kyc = kycData[0];

        if (!kyc.nin) {
            return Response.json({ success: false, error: 'NIN must be verified before liveness check.' }, { status: 400 });
        }

        // Upload selfie for storage
        const byteString = atob(photoBase64.replace(/^data:image\/[a-z]+;base64,/, ''));
        const byteArray = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) byteArray[i] = byteString.charCodeAt(i);
        const selfieFile = new File([byteArray], 'selfie.jpg', { type: 'image/jpeg' });
        const { file_url: selfieUrl } = await base44.integrations.Core.UploadFile({ file: selfieFile });

        const accessToken = await getQoreIDToken();

        // Strip data URI prefix if present
        const cleanBase64 = photoBase64.replace(/^data:image\/[a-z]+;base64,/, '');

        const callQoreID = async (token) => fetch(`https://api.qoreid.com/v1/ng/identities/face-verification/nin`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            },
            body: JSON.stringify({
                idNumber: kyc.nin,
                photoBase64: cleanBase64
            })
        });

        let qoreIdResponse = await callQoreID(accessToken);

        if (qoreIdResponse.status === 401) {
            cachedToken = null;
            tokenExpireAt = 0;
            const newToken = await refreshQoreIDToken();
            qoreIdResponse = await callQoreID(newToken);
        }

        const qoreIdData = await qoreIdResponse.json();
        console.log('QoreID Liveness response:', JSON.stringify(qoreIdData));

        if (!qoreIdResponse.ok) {
            const errMsg = qoreIdData.message || qoreIdData.error || 'Liveness check failed';
            return Response.json({ success: false, error: errMsg }, { status: 400 });
        }

        // Check face match result
        const faceMatch = qoreIdData.faceVerification || qoreIdData.face_verification || {};
        const confidence = faceMatch.confidence || faceMatch.matchScore || faceMatch.score || 0;
        const matched = faceMatch.matched ?? (confidence >= 0.7);
        const state = qoreIdData.status?.state;

        console.log(`Liveness face match: matched=${matched}, confidence=${confidence}, state=${state}`);

        if (!matched && state !== 'complete') {
            return Response.json({
                success: false,
                error: 'Face does not match your NIN photo. Please take a clear selfie in good lighting.'
            }, { status: 400 });
        }

        // Mark facial recognition as verified
        await base44.entities.KYCProfile.update(kyc.id, {
            facial_recognition_verified: true,
            facial_recognition_image_url: selfieUrl
        });

        return Response.json({
            success: true,
            message: 'Liveness check passed.',
            confidence,
            matched
        });

    } catch (error) {
        console.error('Liveness verification error:', error);
        return Response.json({ success: false, error: error.message || 'Liveness check failed' }, { status: 500 });
    }
});