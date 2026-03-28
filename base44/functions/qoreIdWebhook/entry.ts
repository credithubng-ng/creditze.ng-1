import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import crypto from 'node:crypto';

Deno.serve(async (req) => {
  try {
    // Verify webhook signature
    const signature = req.headers.get('x-qoreid-signature');
    const body = await req.text();
    
    if (!signature) {
      return Response.json({ error: 'Missing signature' }, { status: 401 });
    }

    // Verify signature using webhook secret
    const webhookSecret = Deno.env.get('QOREID_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('QOREID_WEBHOOK_SECRET not configured');
      return Response.json({ error: 'Webhook not configured' }, { status: 500 });
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse webhook payload
    const data = JSON.parse(body);
    const base44 = createClientFromRequest(req);

    // Map QoreID verification types to our tracking
    const { reference, status, type, data: verificationData } = data;

    if (!reference) {
      return Response.json({ error: 'Missing reference' }, { status: 400 });
    }

    // Get KYC profile by reference (we'll store this when initiating verification)
    const kycProfiles = await base44.asServiceRole.entities.KYCProfile.filter({ 
      verification_reference: reference 
    });

    if (!kycProfiles[0]) {
      return Response.json({ error: 'KYC profile not found' }, { status: 404 });
    }

    const kyc = kycProfiles[0];

    // Handle different verification types
    if (type === 'BVN_VERIFICATION') {
      if (status === 'success') {
        await base44.asServiceRole.entities.KYCProfile.update(kyc.id, {
          bvn_verified: true,
          bvn_full_name: verificationData.full_name,
          bvn_phone_number: verificationData.phone_number,
          bvn_date_of_birth: verificationData.date_of_birth,
          bvn_gender: (verificationData.gender || '').toLowerCase(),
          verification_reference: null,
          verification_status: 'completed'
        });
      } else {
        await base44.asServiceRole.entities.KYCProfile.update(kyc.id, {
          bvn_verified: false,
          verification_reference: null,
          verification_status: 'failed',
          verification_error: verificationData.error || 'BVN verification failed'
        });
      }
    }

    if (type === 'FACIAL_RECOGNITION') {
      if (status === 'success') {
        await base44.asServiceRole.entities.KYCProfile.update(kyc.id, {
          facial_recognition_verified: true,
          verification_reference: null,
          verification_status: 'completed'
        });
      } else {
        await base44.asServiceRole.entities.KYCProfile.update(kyc.id, {
          facial_recognition_verified: false,
          verification_reference: null,
          verification_status: 'failed',
          verification_error: verificationData.error || 'Facial recognition failed'
        });
      }
    }

    return Response.json({ success: true, reference });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});