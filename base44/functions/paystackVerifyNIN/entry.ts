import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { nin } = body;

        if (!nin || nin.length !== 11) {
            return Response.json({ 
                success: false, 
                error: 'NIN must be 11 digits' 
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
            console.log('Test mode detected - returning mock NIN data');
            return Response.json({ 
                success: true,
                data: {
                    first_name: user.full_name?.split(' ')[0] || 'John',
                    last_name: user.full_name?.split(' ').slice(-1)[0] || 'Doe',
                    middle_name: user.full_name?.split(' ')[1] || 'Middle',
                    full_name: user.full_name || 'John Middle Doe',
                    phone_number: '08012345678',
                    date_of_birth: '1990-01-01',
                    gender: 'male'
                }
            });
        }

        // Call Paystack Identity API for NIN verification (correct endpoint)
        const response = await fetch('https://api.paystack.co/identity', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${paystackKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'nin',
                value: nin,
                country: 'NG',
                first_name: '',
                last_name: ''
            })
        });

        const responseText = await response.text();
        console.log('Paystack NIN Identity API Response:', response.status, responseText);
        
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
                error: data.message || `NIN verification failed (${response.status})` 
            }, { status: response.status });
        }
        
        if (!data.status) {
            return Response.json({ 
                success: false, 
                error: data.message || 'NIN verification failed' 
            }, { status: 400 });
        }

        const ninData = data.data || {};
        
        const fullName = ninData.full_name || 
                         [ninData.first_name, ninData.middle_name, ninData.last_name]
                             .filter(Boolean).join(' ');
        
        return Response.json({ 
            success: true,
            data: {
                first_name: ninData.first_name || '',
                last_name: ninData.last_name || '',
                middle_name: ninData.middle_name || '',
                full_name: fullName,
                phone_number: ninData.phone || ninData.phone_number || ninData.mobile || '',
                date_of_birth: ninData.birthday || ninData.date_of_birth || ninData.dob || '',
                gender: ninData.gender?.toLowerCase() || ''
            }
        });

    } catch (error) {
        console.error('NIN verification error:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});