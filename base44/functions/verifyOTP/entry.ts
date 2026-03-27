import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { otp, type } = body;

        if (!type || !['phone', 'email'].includes(type)) {
            return Response.json({ 
                success: false, 
                error: 'Invalid type. Must be phone or email' 
            }, { status: 400 });
        }

        if (!otp || otp.length !== 6) {
            return Response.json({ 
                success: false, 
                error: 'OTP must be 6 digits' 
            }, { status: 400 });
        }

        // Get stored OTP from KYC profile
        const kycProfile = await base44.entities.KYCProfile.filter({ user_id: user.id });
        
        if (kycProfile.length === 0) {
            return Response.json({ 
                success: false, 
                error: 'No OTP found. Please request a new one.' 
            }, { status: 400 });
        }

        const kyc = kycProfile[0];
        const storedOTP = kyc[`otp_${type}`];
        const expiresAt = kyc[`otp_${type}_expires`];

        if (!storedOTP || !expiresAt) {
            return Response.json({ 
                success: false, 
                error: 'No OTP found. Please request a new one.' 
            }, { status: 400 });
        }

        // Check expiry
        if (new Date(expiresAt) < new Date()) {
            return Response.json({ 
                success: false, 
                error: 'OTP has expired. Please request a new one.' 
            }, { status: 400 });
        }

        // Verify OTP
        if (storedOTP !== otp) {
            return Response.json({ 
                success: false, 
                error: 'Invalid OTP. Please try again.' 
            }, { status: 400 });
        }

        // Store verified value before clearing
        const verifiedValue = kyc[`otp_${type}_target`];
        
        // Clear OTP after successful verification
        await base44.asServiceRole.entities.KYCProfile.update(kyc.id, {
            [`otp_${type}`]: null,
            [`otp_${type}_expires`]: null,
            [`otp_${type}_target`]: null
        });

        return Response.json({ 
            success: true, 
            message: 'OTP verified successfully',
            verified_value: verifiedValue
        });

    } catch (error) {
        console.error('Verify OTP error:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});