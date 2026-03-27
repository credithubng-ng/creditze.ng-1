import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');

        if (!PAYSTACK_SECRET_KEY) {
            return Response.json({ error: 'Paystack not configured' }, { status: 500 });
        }

        // Verify webhook signature
        const signature = req.headers.get('x-paystack-signature');
        const body = await req.text();
        
        const crypto = await import('node:crypto');
        const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(body).digest('hex');
        
        if (hash !== signature) {
            return Response.json({ error: 'Invalid signature' }, { status: 401 });
        }

        const base44 = createClientFromRequest(req);
        const event = JSON.parse(body);

        // Handle different event types
        switch (event.event) {
            case 'charge.success':
                await handleChargeSuccess(base44, event.data);
                break;
            
            case 'charge.failed':
                await handleChargeFailed(base44, event.data);
                break;
            
            default:
                console.log('Unhandled event:', event.event);
        }

        return Response.json({ success: true });

    } catch (error) {
        console.error('Webhook error:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});

async function handleChargeSuccess(base44, data) {
    const metadata = data.metadata || {};
    
    // Handle different payment types based on metadata
    if (metadata.payment_type === 'credit_search') {
        await base44.asServiceRole.entities.CreditSearch.update(metadata.search_id, {
            payment_status: 'paid',
            payment_reference: data.reference
        });
    } else if (metadata.payment_type === 'loan_repayment') {
        // Create repayment record
        await base44.asServiceRole.entities.LoanRepayment.create({
            loan_id: metadata.loan_id,
            amount: data.amount / 100,
            payment_reference: data.reference,
            payment_method: 'direct_debit',
            status: 'successful'
        });
        
        // Update loan status if fully repaid
        const loan = await base44.asServiceRole.entities.LoanApplication.get(metadata.loan_id);
        // Check if loan is fully repaid and update status accordingly
    }
}

async function handleChargeFailed(base44, data) {
    const metadata = data.metadata || {};
    
    if (metadata.payment_type === 'loan_repayment') {
        // Log failed collection attempt
        await base44.asServiceRole.entities.CollectionAttempt.create({
            loan_id: metadata.loan_id,
            user_id: metadata.user_id,
            attempt_type: 'direct_debit_attempt',
            status: 'failed',
            channel: 'direct_debit',
            initiated_by: 'system'
        });
    }
}