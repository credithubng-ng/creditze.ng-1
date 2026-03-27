import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { bvn } = body;

        if (!bvn || bvn.length !== 11) {
            return Response.json({ 
                success: false, 
                error: 'BVN must be 11 digits' 
            }, { status: 400 });
        }

        const paystackKey = Deno.env.get('PAYSTACK_SECRET_KEY');
        if (!paystackKey) {
            return Response.json({ 
                success: false, 
                error: 'Payment service not configured' 
            }, { status: 500 });
        }

        // Test Mode: Return mock data
        if (paystackKey.startsWith('sk_test_')) {
            console.log('Test mode detected - returning mock BVN data');
            
            // Get phone number from KYC profile
            const kycData = await base44.entities.KYCProfile.filter({ user_id: user.id });
            const phoneNumber = kycData[0]?.phone_number || '08012345678';
            
            return Response.json({ 
                success: true,
                data: {
                    first_name: user.full_name?.split(' ')[0] || 'John',
                    last_name: user.full_name?.split(' ').slice(-1)[0] || 'Doe',
                    middle_name: user.full_name?.split(' ')[1] || 'Middle',
                    full_name: user.full_name || 'John Middle Doe',
                    phone_number: phoneNumber,
                    date_of_birth: '1990-01-01',
                    gender: 'male'
                }
            });
        }

        // Call Paystack BVN verification API
        const response = await fetch(`https://api.paystack.co/bank/resolve_bvn/${bvn}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${paystackKey}`,
                'Content-Type': 'application/json'
            }
        });

        const responseText = await response.text();
        console.log('Paystack BVN API Response:', response.status, responseText);
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Failed to parse Paystack response:', responseText);
            return Response.json({ 
                success: false, 
                error: 'Invalid response from verification service' 
            }, { status: 500 });
        }

        if (!response.ok) {
            return Response.json({ 
                success: false, 
                error: data.message || `BVN verification failed (${response.status})` 
            }, { status: response.status });
        }
        
        if (!data.status) {
            return Response.json({ 
                success: false, 
                error: data.message || 'BVN verification failed' 
            }, { status: 400 });
        }

        // Extract BVN data
        const bvnData = data.data;
        
        // Handle different BVN data formats
        let fullName = bvnData.full_name || 
                       `${bvnData.first_name || ''} ${bvnData.middle_name || ''} ${bvnData.last_name || ''}`.trim();
        
        // If still no full name, try combining available names
        if (!fullName) {
            fullName = [bvnData.first_name, bvnData.middle_name, bvnData.last_name]
                .filter(Boolean)
                .join(' ');
        }
        
        return Response.json({ 
            success: true,
            data: {
                first_name: bvnData.first_name || '',
                last_name: bvnData.last_name || '',
                middle_name: bvnData.middle_name || '',
                full_name: fullName,
                phone_number: bvnData.phone_number || bvnData.mobile || '',
                date_of_birth: bvnData.date_of_birth || bvnData.dob || '',
                gender: bvnData.gender?.toLowerCase() || ''
            }
        });

    } catch (error) {
        console.error('BVN verification error:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});