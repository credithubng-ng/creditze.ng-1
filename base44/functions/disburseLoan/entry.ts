import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const body = await req.json();
        const { loan_id } = body;

        if (!loan_id) {
            return Response.json({ 
                success: false, 
                error: 'Loan ID is required' 
            }, { status: 400 });
        }

        // Get loan details
        const loans = await base44.asServiceRole.entities.LoanApplication.filter({ id: loan_id });
        const loan = loans[0];

        if (!loan) {
            return Response.json({ 
                success: false, 
                error: 'Loan not found' 
            }, { status: 404 });
        }

        if (loan.status !== 'approved') {
            return Response.json({ 
                success: false, 
                error: 'Only approved loans can be disbursed' 
            }, { status: 400 });
        }

        // Get user's KYC for bank details
        const kycProfiles = await base44.asServiceRole.entities.KYCProfile.filter({ 
            user_id: loan.user_id 
        });
        const kyc = kycProfiles[0];

        if (!kyc || !kyc.bank_name || !kyc.account_number) {
            return Response.json({ 
                success: false, 
                error: 'Bank details not found' 
            }, { status: 400 });
        }

        // Check if disbursement already exists
        const existingDisbursements = await base44.asServiceRole.entities.DisbursementLog.filter({ 
            loan_id: loan_id,
            status: { $in: ['successful', 'processing'] }
        });

        if (existingDisbursements.length > 0) {
            return Response.json({ 
                success: false, 
                error: 'Loan already disbursed or in progress',
                disbursement_id: existingDisbursements[0].id
            }, { status: 400 });
        }

        // Create disbursement log
        const reference = `DISB_${loan_id}_${Date.now()}`;
        const disbursementLog = await base44.asServiceRole.entities.DisbursementLog.create({
            loan_id: loan_id,
            user_id: loan.user_id,
            amount: loan.amount_approved,
            bank_name: kyc.bank_name,
            account_number: kyc.account_number,
            account_name: kyc.account_name || 'N/A',
            status: 'processing',
            payment_reference: reference,
            initiated_by: 'admin',
            admin_id: user.id,
            attempt_number: 1,
            max_retries: 3
        });

        // Initiate Paystack transfer
        const transferResult = await base44.functions.invoke('paystackTransfer', {
            amount: loan.amount_approved,
            account_number: kyc.account_number,
            account_name: kyc.account_name,
            bank_code: kyc.bank_code || '058', // Default to GTBank if missing
            reference: reference,
            reason: `Loan disbursement for ${loan.loan_type}`
        });

        if (!transferResult.data.success) {
            // Update disbursement log with failure
            await base44.asServiceRole.entities.DisbursementLog.update(disbursementLog.id, {
                status: 'failed',
                error_message: transferResult.data.error,
                provider_response: transferResult.data.provider_response
            });

            return Response.json({ 
                success: false, 
                error: transferResult.data.error,
                disbursement_id: disbursementLog.id
            }, { status: 500 });
        }

        // Update disbursement log with success
        await base44.asServiceRole.entities.DisbursementLog.update(disbursementLog.id, {
            status: 'successful',
            provider_response: transferResult.data.provider_response,
            disbursement_date: new Date().toISOString()
        });

        // Update loan status to disbursed
        await base44.asServiceRole.entities.LoanApplication.update(loan_id, {
            status: 'disbursed',
            disbursement_date: new Date().toISOString().split('T')[0]
        });

        // Send notification email
        const borrower = await base44.asServiceRole.entities.User.filter({ id: loan.user_id });
        if (borrower[0]?.email) {
            await base44.asServiceRole.integrations.Core.SendEmail({
                to: borrower[0].email,
                subject: 'Loan Disbursed Successfully! 🎉',
                body: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #059669;">Loan Disbursed!</h2>
                        <p>Great news! Your loan of <strong>₦${loan.amount_approved.toLocaleString()}</strong> has been disbursed to your account.</p>
                        <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <p><strong>Account:</strong> ${kyc.bank_name} - ${kyc.account_number}</p>
                            <p><strong>Amount:</strong> ₦${loan.amount_approved.toLocaleString()}</p>
                            <p><strong>Due Date:</strong> ${loan.due_date}</p>
                            <p><strong>Total Repayment:</strong> ₦${loan.total_repayment.toLocaleString()}</p>
                        </div>
                        <p>Please ensure repayment is made on or before the due date.</p>
                    </div>
                `
            });
        }

        // Create virtual account for repayment
        try {
            await base44.asServiceRole.functions.invoke('createVirtualAccount', {
                loan_id: loan_id,
                user_id: loan.user_id
            });
        } catch (vaError) {
            console.error('Virtual account creation error:', vaError);
            // Don't fail disbursement if virtual account creation fails
        }

        // Create audit log
        await base44.asServiceRole.entities.AuditLog.create({
            action: 'loan_disbursed',
            entity_type: 'LoanApplication',
            entity_id: loan_id,
            admin_id: user.id,
            user_id: loan.user_id,
            details: {
                amount: loan.amount_approved,
                reference: reference,
                bank: kyc.bank_name,
                account: kyc.account_number
            }
        });

        return Response.json({ 
            success: true, 
            message: 'Loan disbursed successfully',
            disbursement_id: disbursementLog.id,
            reference: reference,
            transfer_code: transferResult.data.transfer_code
        });

    } catch (error) {
        console.error('Disburse loan error:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});