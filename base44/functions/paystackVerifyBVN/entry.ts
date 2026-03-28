import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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

        const qoreidKey = Deno.env.get('QOREID_API_KEY');
        if (!qoreidKey) {
            return Response.json({ 
                success: false, 
                error: 'QoreID service not configured' 
            }, { status: 500 });
        }

        // Call QoreID BVN verification API
        const response = await fetch('https://api.qoreid.com/v1/identity/bvn/verify', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${qoreidKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                bvn: bvn
            })
        });

        const responseText = await response.text();
        console.log('QoreID BVN API Response:', response.status, responseText);
        
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
                error: data.message || data.error || `BVN verification failed (${response.status})` 
            }, { status: response.status });
        }
        
        if (!data.success && !data.data) {
            return Response.json({ 
                success: false, 
                error: data.message || data.error || 'BVN verification failed' 
            }, { status: 400 });
        }

        // Extract BVN data from QoreID response
        const bvnData = data.data || {};
        
        // Handle different BVN data formats
        let fullName = bvnData.full_name || bvnData.fullName ||
                       `${bvnData.first_name || bvnData.firstName || ''} ${bvnData.middle_name || bvnData.middleName || ''} ${bvnData.last_name || bvnData.lastName || ''}`.trim();
        
        // If still no full name, try combining available names
        if (!fullName) {
            fullName = [bvnData.first_name || bvnData.firstName, bvnData.middle_name || bvnData.middleName, bvnData.last_name || bvnData.lastName]
                .filter(Boolean)
                .join(' ');
        }
        
        return Response.json({ 
            success: true,
            data: {
                first_name: bvnData.first_name || bvnData.firstName || '',
                last_name: bvnData.last_name || bvnData.lastName || '',
                middle_name: bvnData.middle_name || bvnData.middleName || '',
                full_name: fullName,
                phone_number: bvnData.phone_number || bvnData.phoneNumber || bvnData.mobile || '',
                date_of_birth: bvnData.date_of_birth || bvnData.dateOfBirth || bvnData.dob || '',
                gender: (bvnData.gender || bvnData.Gender || '').toLowerCase()
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