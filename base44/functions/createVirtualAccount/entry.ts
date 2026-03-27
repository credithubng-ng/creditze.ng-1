import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const body = await req.json();
        const { loan_id, user_id } = body;

        if (!loan_id || !user_id) {
            return Response.json({ 
                success: false, 
                error: 'Loan ID and User ID are required' 
            }, { status: 400 });
        }

        const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
        if (!PAYSTACK_SECRET_KEY) {
            return Response.json({ 
                success: false, 
                error: 'Payment service not configured' 
            }, { status: 500 });
        }

        // Get user and loan details
        const [loanUser, loans] = await Promise.all([
            base44.asServiceRole.entities.User.filter({ id: user_id }),
            base44.asServiceRole.entities.LoanApplication.filter({ id: loan_id })
        ]);

        const borrower = loanUser[0];
        const loan = loans[0];

        if (!borrower || !loan) {
            return Response.json({ 
                success: false, 
                error: 'User or loan not found' 
            }, { status: 404 });
        }

        // Check if virtual account already exists
        const existing = await base44.asServiceRole.entities.VirtualAccount.filter({ 
            loan_id: loan_id,
            status: 'active'
        });

        if (existing.length > 0) {
            return Response.json({ 
                success: true, 
                message: 'Virtual account already exists',
                virtual_account: existing[0]
            });
        }

        // Create or retrieve Paystack customer
        let customerCode;
        const customerResponse = await fetch('https://api.paystack.co/customer', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: borrower.email,
                first_name: borrower.full_name?.split(' ')[0] || 'User',
                last_name: borrower.full_name?.split(' ').slice(1).join(' ') || 'Account',
                metadata: {
                    user_id: user_id
                }
            })
        });

        const customerData = await customerResponse.json();
        
        if (customerData.status) {
            customerCode = customerData.data.customer_code;
        } else {
            // Customer might already exist
            const existingCustomer = await fetch(`https://api.paystack.co/customer/${borrower.email}`, {
                headers: {
                    'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`
                }
            });
            const existingData = await existingCustomer.json();
            if (existingData.status) {
                customerCode = existingData.data.customer_code;
            } else {
                throw new Error('Failed to create or retrieve customer');
            }
        }

        // Create dedicated virtual account
        const vaResponse = await fetch('https://api.paystack.co/dedicated_account', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                customer: customerCode,
                preferred_bank: 'wema-bank',
                metadata: {
                    loan_id: loan_id,
                    loan_amount: loan.amount_approved,
                    total_repayment: loan.total_repayment
                }
            })
        });

        if (!vaResponse.ok) {
            const errorData = await vaResponse.json();
            throw new Error(errorData.message || 'Failed to create virtual account');
        }

        const vaData = await vaResponse.json();

        if (!vaData.status) {
            throw new Error(vaData.message || 'Virtual account creation failed');
        }

        // Store virtual account details
        const virtualAccount = await base44.asServiceRole.entities.VirtualAccount.create({
            loan_id: loan_id,
            user_id: user_id,
            account_number: vaData.data.account_number,
            account_name: vaData.data.account_name,
            bank_name: vaData.data.bank.name,
            bank_code: vaData.data.bank.id.toString(),
            provider: 'paystack',
            provider_reference: vaData.data.id.toString(),
            customer_code: customerCode,
            status: 'active'
        });

        // Update loan with virtual account reference
        await base44.asServiceRole.entities.LoanApplication.update(loan_id, {
            virtual_account_id: virtualAccount.id
        });

        // Send email to user with virtual account details
        await base44.asServiceRole.integrations.Core.SendEmail({
            to: borrower.email,
            subject: 'Your Loan Repayment Account Details',
            body: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #059669;">Virtual Account Created!</h2>
                    <p>Hi ${borrower.full_name},</p>
                    <p>A dedicated virtual account has been created for your loan repayment.</p>
                    <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Bank Name:</strong> ${vaData.data.bank.name}</p>
                        <p style="margin: 5px 0;"><strong>Account Number:</strong> <span style="font-size: 20px; color: #059669;">${vaData.data.account_number}</span></p>
                        <p style="margin: 5px 0;"><strong>Account Name:</strong> ${vaData.data.account_name}</p>
                        <p style="margin: 5px 0; padding-top: 10px; border-top: 1px solid #d1fae5;"><strong>Amount to Pay:</strong> ₦${loan.total_repayment.toLocaleString()}</p>
                    </div>
                    <p><strong>Note:</strong> Transfer exactly ₦${loan.total_repayment.toLocaleString()} to complete your repayment. Payment is automatically confirmed.</p>
                </div>
            `
        });

        return Response.json({ 
            success: true, 
            message: 'Virtual account created successfully',
            virtual_account: virtualAccount
        });

    } catch (error) {
        console.error('Create virtual account error:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});