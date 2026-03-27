import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { phone_number, email, type } = body;

        // Validate type
        if (!type || !['phone', 'email'].includes(type)) {
            return Response.json({ 
                success: false,
                error: 'Invalid type. Must be phone or email' 
            }, { status: 400 });
        }

        // Validate contact info based on type
        if (type === 'phone' && !phone_number) {
            return Response.json({ 
                success: false,
                error: 'Phone number is required for phone verification' 
            }, { status: 400 });
        }

        if (type === 'email' && !email) {
            return Response.json({ 
                success: false,
                error: 'Email is required for email verification' 
            }, { status: 400 });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Get or create KYC profile to store OTP
        let kycProfile = await base44.entities.KYCProfile.filter({ user_id: user.id });
        
        const otpData = {
            [`otp_${type}`]: otp,
            [`otp_${type}_expires`]: expiresAt.toISOString(),
            [`otp_${type}_target`]: type === 'phone' ? phone_number : email
        };

        if (kycProfile.length > 0) {
            await base44.asServiceRole.entities.KYCProfile.update(kycProfile[0].id, otpData);
        } else {
            await base44.asServiceRole.entities.KYCProfile.create({
                user_id: user.id,
                ...otpData
            });
        }

        if (type === 'phone') {
            // Send SMS via SmartSMS
            const smartSmsToken = Deno.env.get('SMARTSMS_TOKEN');
            
            if (!smartSmsToken) {
                return Response.json({ 
                    success: false,
                    error: 'SMS service not configured' 
                }, { status: 500 });
            }

            // Format phone to 0XXXXXXXXXX (local Nigerian format for SmartSMS)
            let formattedPhone = phone_number.toString().trim().replace(/\s+/g, '').replace(/[^0-9]/g, '');
            
            if (formattedPhone.startsWith('234')) {
                formattedPhone = '0' + formattedPhone.substring(3);
            }
            if (!formattedPhone.startsWith('0')) {
                formattedPhone = '0' + formattedPhone;
            }
            if (formattedPhone.length !== 11) {
                return Response.json({ 
                    success: false,
                    error: 'Invalid phone number format' 
                }, { status: 400 });
            }

            console.log('Sending SMS via SmartSMS to:', formattedPhone);

            const smsResponse = await fetch('https://smartsmssolutions.com/api/json.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: smartSmsToken,
                    sender: 'Creditze',
                    to: formattedPhone,
                    message: `Your Creditze verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`,
                    type: '0',
                    routing: '3',
                    ref_id: `OTP_${user.id}_${Date.now()}`
                })
            });

            const smsData = await smsResponse.json();
            console.log('SmartSMS response:', JSON.stringify(smsData));

            // SmartSMS returns 1001 for success
            if (!smsResponse.ok || (smsData.code && smsData.code !== 1001)) {
                return Response.json({ 
                    success: false, 
                    error: smsData.message || 'Failed to send SMS.'
                }, { status: 400 });
            }

            return Response.json({ 
                success: true, 
                message: 'OTP sent successfully'
            });

        } else {
            // Send Email OTP
            await base44.integrations.Core.SendEmail({
                to: email,
                subject: 'Your Creditze Verification Code',
                body: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #059669;">Verification Code</h2>
                        <p>Your Creditze verification code is:</p>
                        <h1 style="font-size: 36px; color: #059669; letter-spacing: 8px; margin: 20px 0;">${otp}</h1>
                        <p>This code will expire in 10 minutes.</p>
                        <p style="color: #666; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
                    </div>
                `
            });

            return Response.json({ 
                success: true, 
                message: 'OTP sent to email'
            });
        }

    } catch (error) {
        console.error('Send OTP error:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});