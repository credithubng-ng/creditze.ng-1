import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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

        const qoreidKey = Deno.env.get('QOREID_API_KEY');
        if (!qoreidKey) {
            return Response.json({ 
                success: false, 
                error: 'QoreID service not configured' 
            }, { status: 500 });
        }

        // Call QoreID NIN verification API
        const response = await fetch('https://api.qoreid.com/v1/identity/nin/verify', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${qoreidKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nin: nin
            })
        });

        const responseText = await response.text();
        console.log('QoreID NIN API Response:', response.status, responseText);
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Failed to parse QoreID response:', responseText);
            return Response.json({ 
                success: false, 
                error: 'Invalid response from verification service' 
            }, { status: 500 });
        }

        if (!response.ok) {
            return Response.json({ 
                success: false, 
                error: data.message || data.error || `NIN verification failed (${response.status})` 
            }, { status: response.status });
        }
        
        if (!data.success && !data.data) {
            return Response.json({ 
                success: false, 
                error: data.message || data.error || 'NIN verification failed' 
            }, { status: 400 });
        }

        const ninData = data.data || {};
        
        const fullName = ninData.full_name || ninData.fullName ||
                         [ninData.first_name || ninData.firstName, ninData.middle_name || ninData.middleName, ninData.last_name || ninData.lastName]
                             .filter(Boolean).join(' ');
        
        return Response.json({ 
            success: true,
            data: {
                first_name: ninData.first_name || ninData.firstName || '',
                last_name: ninData.last_name || ninData.lastName || '',
                middle_name: ninData.middle_name || ninData.middleName || '',
                full_name: fullName,
                phone_number: ninData.phone || ninData.phoneNumber || ninData.phone_number || ninData.mobile || '',
                date_of_birth: ninData.birthday || ninData.date_of_birth || ninData.dateOfBirth || ninData.dob || '',
                gender: (ninData.gender || ninData.Gender || '').toLowerCase()
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