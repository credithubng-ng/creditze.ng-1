import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Verify admin access (scheduled automations should run as service role)
        // Allow service role or admin users only
        const user = await base44.auth.me().catch(() => null);
        if (user && user.role !== 'admin') {
            return Response.json({ 
                success: false,
                error: 'Forbidden: Admin access required' 
            }, { status: 403 });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString().split('T')[0];

        // Get collection config
        const configs = await base44.asServiceRole.entities.CollectionConfig.filter({ config_key: 'default' });
        const config = configs[0] || {
            days_to_mark_overdue: 1,
            direct_debit_retry_days: 3,
            max_direct_debit_retries: 3,
            enable_auto_direct_debit: true
        };

        if (!config.enable_auto_direct_debit) {
            return Response.json({ success: true, message: 'Auto collections disabled', processed: 0 });
        }

        // Find loans due today or overdue
        const loans = await base44.asServiceRole.entities.LoanApplication.filter({
            status: { $in: ['disbursed', 'overdue'] },
            due_date: { $lte: todayISO }
        });

        const results = {
            total: loans.length,
            attempted: 0,
            successful: 0,
            failed: 0,
            skipped: 0,
            details: []
        };

        for (const loan of loans) {
            try {
                // Find active mandate for this loan
                const mandates = await base44.asServiceRole.entities.DirectDebitMandate.filter({
                    loan_id: loan.id,
                    status: 'active'
                });

                if (mandates.length === 0) {
                    results.skipped++;
                    results.details.push({
                        loan_id: loan.id,
                        status: 'skipped',
                        reason: 'No active mandate'
                    });
                    continue;
                }

                const mandate = mandates[0];

                // Check recent attempts to avoid duplicate charges
                const recentAttempts = await base44.asServiceRole.entities.CollectionAttempt.filter({
                    loan_id: loan.id,
                    attempt_type: 'direct_debit_attempt',
                    created_date: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
                });

                const successfulToday = recentAttempts.find(a => a.status === 'paid');
                if (successfulToday) {
                    results.skipped++;
                    results.details.push({
                        loan_id: loan.id,
                        status: 'skipped',
                        reason: 'Already paid today'
                    });
                    continue;
                }

                // Check retry limit
                const failedAttempts = recentAttempts.filter(a => a.status === 'failed').length;
                if (failedAttempts >= config.max_direct_debit_retries) {
                    results.skipped++;
                    results.details.push({
                        loan_id: loan.id,
                        status: 'skipped',
                        reason: 'Max retries reached'
                    });
                    continue;
                }

                results.attempted++;

                // Get user email for charge
                const loanUser = await base44.asServiceRole.entities.User.filter({ id: loan.user_id });
                const userEmail = loanUser[0]?.email;

                if (!userEmail) {
                    results.skipped++;
                    results.details.push({
                        loan_id: loan.id,
                        status: 'skipped',
                        reason: 'User email not found'
                    });
                    continue;
                }

                // Attempt charge
                const chargeResponse = await base44.asServiceRole.functions.invoke('paystackChargeAuthorization', {
                    authorization_code: mandate.mandate_reference,
                    amount: loan.total_repayment,
                    email: userEmail,
                    metadata: {
                        loan_id: loan.id,
                        collection_type: 'auto_direct_debit'
                    }
                });

                const chargeSuccess = chargeResponse.data?.success && chargeResponse.data?.status === 'success';

                // Log collection attempt
                await base44.asServiceRole.entities.CollectionAttempt.create({
                    loan_id: loan.id,
                    user_id: loan.user_id,
                    attempt_type: 'direct_debit_attempt',
                    status: chargeSuccess ? 'paid' : 'failed',
                    channel: 'direct_debit',
                    message_content: chargeSuccess ? 'Direct debit successful' : 'Direct debit failed',
                    response_notes: JSON.stringify(chargeResponse.data),
                    initiated_by: 'system',
                    days_overdue: Math.floor((today - new Date(loan.due_date)) / (1000 * 60 * 60 * 24)),
                    amount_outstanding: loan.total_repayment
                });

                if (chargeSuccess) {
                    results.successful++;
                    
                    // Update mandate
                    await base44.asServiceRole.entities.DirectDebitMandate.update(mandate.id, {
                        last_debit_date: new Date().toISOString(),
                        last_debit_amount: loan.total_repayment,
                        total_debited: (mandate.total_debited || 0) + loan.total_repayment,
                        failed_attempts: 0
                    });

                    // Update loan to repaid
                    await base44.asServiceRole.entities.LoanApplication.update(loan.id, {
                        status: 'repaid',
                        repayment_date: new Date().toISOString()
                    });

                    // Update user credit limit
                    const creditLimits = await base44.asServiceRole.entities.UserCreditLimit.filter({ 
                        user_id: loan.user_id 
                    });
                    if (creditLimits[0]) {
                        const creditLimit = creditLimits[0];
                        const loanConfigs = await base44.asServiceRole.entities.LoanConfig.filter({ config_key: 'default' });
                        const loanConfig = loanConfigs[0];
                        const incrementPercent = loanConfig?.urgent_10k_increment_percent || 20;
                        
                        await base44.asServiceRole.entities.UserCreditLimit.update(creditLimit.id, {
                            successful_repayments: creditLimit.successful_repayments + 1,
                            current_limit: Math.round(creditLimit.current_limit * (1 + incrementPercent / 100))
                        });
                    }

                    // Send success notification
                    await base44.asServiceRole.integrations.Core.SendEmail({
                        to: loan.user_id,
                        subject: '✅ Loan Repayment Successful',
                        body: `Your loan repayment of ₦${loan.total_repayment.toLocaleString()} has been successfully processed via direct debit. Your credit limit has been increased!`
                    });

                    results.details.push({
                        loan_id: loan.id,
                        status: 'success',
                        amount: loan.total_repayment
                    });
                } else {
                    results.failed++;
                    
                    // Update mandate failed attempts
                    await base44.asServiceRole.entities.DirectDebitMandate.update(mandate.id, {
                        failed_attempts: (mandate.failed_attempts || 0) + 1
                    });

                    // Send failure notification
                    const retriesLeft = config.max_direct_debit_retries - (failedAttempts + 1);
                    await base44.asServiceRole.integrations.Core.SendEmail({
                        to: loan.user_id,
                        subject: '⚠️ Loan Repayment Failed',
                        body: `We were unable to process your loan repayment of ₦${loan.total_repayment.toLocaleString()} via direct debit. ${retriesLeft > 0 ? `We will retry in ${config.direct_debit_retry_days} days. ${retriesLeft} ${retriesLeft === 1 ? 'retry' : 'retries'} remaining.` : 'Please contact support or make a manual payment to avoid penalties.'}`
                    });

                    results.details.push({
                        loan_id: loan.id,
                        status: 'failed',
                        reason: chargeResponse.data?.message || 'Charge failed'
                    });
                }

            } catch (error) {
                results.failed++;
                results.details.push({
                    loan_id: loan.id,
                    status: 'error',
                    error: error.message
                });
                console.error(`Error processing loan ${loan.id}:`, error);
            }
        }

        return Response.json({
            success: true,
            message: 'Auto collections processed',
            timestamp: new Date().toISOString(),
            results
        });

    } catch (error) {
        console.error('Auto collections error:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});