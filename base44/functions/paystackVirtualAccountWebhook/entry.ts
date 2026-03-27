import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        // Create Base44 client first
        const base44 = createClientFromRequest(req);
        
        const signature = req.headers.get('x-paystack-signature');
        const body = await req.text();
        
        const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
        
        if (!PAYSTACK_SECRET_KEY) {
            return Response.json({ error: 'Webhook not configured' }, { status: 500 });
        }

        // Verify webhook signature
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(PAYSTACK_SECRET_KEY),
            { name: 'HMAC', hash: 'SHA-512' },
            false,
            ['sign']
        );
        
        const signatureBuffer = await crypto.subtle.sign(
            'HMAC',
            key,
            encoder.encode(body)
        );
        
        const computedSignature = Array.from(new Uint8Array(signatureBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        if (computedSignature !== signature) {
            return Response.json({ error: 'Invalid signature' }, { status: 401 });
        }

        const event = JSON.parse(body);

        // Handle dedicated account transaction
        if (event.event === 'charge.success' && event.data.channel === 'dedicated_nuban') {
            const metadata = event.data.metadata || {};
            const loan_id = metadata.loan_id;
            
            if (!loan_id) {
                console.log('No loan_id in metadata, skipping');
                return Response.json({ message: 'No loan reference' });
            }

            // Get virtual account and loan
            const [virtualAccounts, loans] = await Promise.all([
                base44.asServiceRole.entities.VirtualAccount.filter({ 
                    account_number: event.data.authorization.receiver_account_number 
                }),
                base44.asServiceRole.entities.LoanApplication.filter({ id: loan_id })
            ]);

            const virtualAccount = virtualAccounts[0];
            const loan = loans[0];

            if (!virtualAccount || !loan) {
                console.log('Virtual account or loan not found');
                return Response.json({ message: 'Not found' });
            }

            const amountReceived = event.data.amount / 100; // Convert from kobo
            const totalRepayment = loan.total_repayment;

            // Update virtual account total received
            await base44.asServiceRole.entities.VirtualAccount.update(virtualAccount.id, {
                total_received: (virtualAccount.total_received || 0) + amountReceived
            });

            // Check if full repayment
            if (amountReceived >= totalRepayment && loan.status === 'disbursed') {
                // Mark loan as repaid
                await base44.asServiceRole.entities.LoanApplication.update(loan_id, {
                    status: 'repaid',
                    repayment_date: new Date().toISOString().split('T')[0]
                });

                // Update credit limit
                const creditLimits = await base44.asServiceRole.entities.UserCreditLimit.filter({ 
                    user_id: loan.user_id 
                });
                const creditLimit = creditLimits[0];

                if (creditLimit) {
                    const newLimit = Math.min(
                        creditLimit.current_limit * 1.2, // 20% increase
                        creditLimit.max_limit || 100000
                    );
                    await base44.asServiceRole.entities.UserCreditLimit.update(creditLimit.id, {
                        current_limit: Math.round(newLimit),
                        successful_repayments: (creditLimit.successful_repayments || 0) + 1,
                        last_repayment_date: new Date().toISOString()
                    });
                }

                // Deactivate virtual account
                await base44.asServiceRole.entities.VirtualAccount.update(virtualAccount.id, {
                    status: 'inactive'
                });

                // Send success email
                const users = await base44.asServiceRole.entities.User.filter({ id: loan.user_id });
                if (users[0]?.email) {
                    await base44.asServiceRole.integrations.Core.SendEmail({
                        to: users[0].email,
                        subject: 'Loan Repayment Successful! 🎉',
                        body: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <h2 style="color: #059669;">Repayment Confirmed!</h2>
                                <p>Your loan repayment of <strong>₦${amountReceived.toLocaleString()}</strong> has been received and confirmed.</p>
                                <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                    <p><strong>Loan Status:</strong> Fully Repaid ✓</p>
                                    <p><strong>New Credit Limit:</strong> ₦${Math.round(creditLimit?.current_limit * 1.2 || 0).toLocaleString()}</p>
                                </div>
                                <p>Thank you for your timely repayment! Your credit limit has been increased.</p>
                            </div>
                        `
                    });
                }

                // Create audit log
                await base44.asServiceRole.entities.AuditLog.create({
                    action: 'loan_repaid_via_virtual_account',
                    entity_type: 'LoanApplication',
                    entity_id: loan_id,
                    user_id: loan.user_id,
                    details: {
                        amount: amountReceived,
                        reference: event.data.reference,
                        account_number: virtualAccount.account_number
                    }
                });
            } else if (amountReceived < totalRepayment) {
                // Partial payment received
                console.log(`Partial payment received: ₦${amountReceived} of ₦${totalRepayment}`);
                
                // Notify user of partial payment
                const users = await base44.asServiceRole.entities.User.filter({ id: loan.user_id });
                if (users[0]?.email) {
                    await base44.asServiceRole.integrations.Core.SendEmail({
                        to: users[0].email,
                        subject: 'Partial Payment Received',
                        body: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <h2 style="color: #059669;">Payment Received</h2>
                                <p>We've received a payment of <strong>₦${amountReceived.toLocaleString()}</strong> towards your loan.</p>
                                <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                    <p><strong>Amount Received:</strong> ₦${amountReceived.toLocaleString()}</p>
                                    <p><strong>Total Due:</strong> ₦${totalRepayment.toLocaleString()}</p>
                                    <p><strong>Balance:</strong> ₦${(totalRepayment - (virtualAccount.total_received + amountReceived)).toLocaleString()}</p>
                                </div>
                                <p>Please transfer the remaining balance to complete your repayment.</p>
                            </div>
                        `
                    });
                }
            }

            return Response.json({ message: 'Webhook processed successfully' });
        }

        return Response.json({ message: 'Event not handled' });

    } catch (error) {
        console.error('Virtual account webhook error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});