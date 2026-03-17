import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const { amount, account_number, account_name, bank_code, reference, reason } = await req.json();

        if (!amount || !account_number || !bank_code || !reference) {
            return Response.json({ 
                success: false, 
                error: 'Missing required fields' 
            }, { status: 400 });
        }

        const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY');

        if (!paystackSecret) {
            return Response.json({ 
                success: false, 
                error: 'Payment service not configured' 
            }, { status: 500 });
        }

        // Initiate transfer
        const transferResponse = await fetch('https://api.paystack.co/transfer', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${paystackSecret}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                source: 'balance',
                amount: amount * 100, // Convert to kobo
                recipient: account_number,
                reason: reason || 'Loan disbursement',
                reference: reference,
                currency: 'NGN'
            })
        });

        const transferData = await transferResponse.json();

        if (!transferResponse.ok || !transferData.status) {
            console.error('Paystack transfer error:', transferData);
            return Response.json({ 
                success: false, 
                error: transferData.message || 'Transfer failed',
                provider_response: transferData
            }, { status: 500 });
        }

        return Response.json({ 
            success: true, 
            transfer_code: transferData.data.transfer_code,
            reference: transferData.data.reference,
            status: transferData.data.status,
            provider_response: transferData.data
        });

    } catch (error) {
        console.error('Paystack transfer error:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});