import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { reference } = await req.json();

        if (!reference) {
            return Response.json({ error: 'Reference is required' }, { status: 400 });
        }

        const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');

        if (!PAYSTACK_SECRET_KEY) {
            return Response.json({ error: 'Paystack not configured' }, { status: 500 });
        }

        // Verify payment with Paystack
        const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Payment verification failed');
        }

        const data = await response.json();

        return Response.json({
            success: true,
            status: data.data.status,
            amount: data.data.amount / 100, // Convert from kobo
            customer: data.data.customer,
            paid_at: data.data.paid_at,
            authorization: data.data.authorization
        });

    } catch (error) {
        console.error('Payment verification error:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});