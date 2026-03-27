import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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
                error: 'Missing required fields: amount, account_number, bank_code, reference' 
            }, { status: 400 });
        }

        const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY');
        if (!paystackSecret) {
            return Response.json({ 
                success: false, 
                error: 'Payment service not configured' 
            }, { status: 500 });
        }

        // Step 1: Create transfer recipient
        console.log('Creating transfer recipient for account:', account_number, 'bank:', bank_code);
        const recipientResponse = await fetch('https://api.paystack.co/transferrecipient', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${paystackSecret}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'nuban',
                name: account_name || 'Loan Recipient',
                account_number: account_number,
                bank_code: bank_code,
                currency: 'NGN'
            })
        });

        const recipientData = await recipientResponse.json();
        console.log('Recipient creation response:', JSON.stringify(recipientData));

        if (!recipientResponse.ok || !recipientData.status) {
            return Response.json({ 
                success: false, 
                error: recipientData.message || 'Failed to create transfer recipient',
                provider_response: recipientData
            }, { status: 500 });
        }

        const recipientCode = recipientData.data.recipient_code;
        console.log('Recipient code created:', recipientCode);

        // Step 2: Initiate transfer using recipient code
        const transferResponse = await fetch('https://api.paystack.co/transfer', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${paystackSecret}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                source: 'balance',
                amount: Math.round(amount * 100), // Convert to kobo
                recipient: recipientCode,
                reason: reason || 'Loan disbursement',
                reference: reference,
                currency: 'NGN'
            })
        });

        const transferData = await transferResponse.json();
        console.log('Transfer response:', JSON.stringify(transferData));

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
            recipient_code: recipientCode,
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