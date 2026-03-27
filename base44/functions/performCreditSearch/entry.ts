import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { bvn, searchId, testMode } = await req.json();

        if (!searchId) {
            return Response.json({ error: 'searchId is required' }, { status: 400 });
        }

        // In test mode, BVN is optional (we'll use a mock one)
        if (!testMode && !bvn) {
            return Response.json({ error: 'BVN is required' }, { status: 400 });
        }

        // Verify searchId exists
        const existingSearch = await base44.asServiceRole.entities.CreditSearch.filter({ id: searchId });
        if (!existingSearch || existingSearch.length === 0) {
            return Response.json({ success: false, error: 'Search record not found' }, { status: 404 });
        }

        // TEST MODE: Return mock data for testing
        if (testMode === true) {
            console.log('=== TEST MODE: Using mock CRC data ===');
            
            const mockScore = 720; // Good credit score
            const mockCrcData = {
                ConsumerSearchResultResponse: {
                    HEADER: {
                        RESPONSETYPE: {
                            CODE: '1',
                            DESCRIPTION: 'Single Hit - Credit report found'
                        }
                    },
                    BODY: {
                        CONSUMER: {
                            NAME: {
                                FIRSTNAME: 'Test',
                                LASTNAME: 'User'
                            }
                        },
                        SCORE: {
                            CREDITBUREAU: {
                                '@SCORE': mockScore.toString()
                            }
                        },
                        ACCOUNTLIST: [
                            {
                                ACCOUNT: {
                                    '@ACCOUNT-TYPE': 'Credit Card',
                                    '@INSTITUTION': 'Test Bank',
                                    '@BALANCE': '50000',
                                    '@STATUS': 'Active'
                                }
                            }
                        ]
                    }
                }
            };

            // Update database with mock data
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 90);
            
            await base44.asServiceRole.entities.CreditSearch.update(searchId, {
                search_date: new Date().toISOString(),
                expiry_date: expiryDate.toISOString(),
                search_status: 'successful',
                bureau_score: mockScore,
                crc_reference: 'test_mode_single_hit',
                bureau_response: mockCrcData
            });

            // Send email notification with CRC report
            const searchRecord = await base44.asServiceRole.entities.CreditSearch.filter({ id: searchId });
            if (searchRecord[0]) {
                const userRecord = await base44.asServiceRole.entities.User.filter({ id: searchRecord[0].user_id });
                if (userRecord[0]) {
                    // Create formatted CRC report
                    const reportContent = JSON.stringify(mockCrcData, null, 2);
                    const reportFile = new File([reportContent], `credit_report_${searchId}.json`, { 
                        type: 'application/json' 
                    });
                    
                    // Upload report
                    const { file_url } = await base44.integrations.Core.UploadFile({
                        file: reportFile
                    });
                    
                    // Update search record with report URL
                    await base44.asServiceRole.entities.CreditSearch.update(searchId, {
                        report_url: file_url
                    });
                    
                    await base44.integrations.Core.SendEmail({
                        to: userRecord[0].email,
                        subject: '✅ Your Credit Search Report - Creditze',
                        body: `
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <meta charset="UTF-8">
                                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            </head>
                            <body style="margin: 0; padding: 20px; background-color: #f3f4f6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                                <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                                    <!-- Header -->
                                    <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 40px 30px; text-align: center;">
                                        <div style="background: white; width: 60px; height: 60px; border-radius: 12px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                                            <span style="font-size: 32px; font-weight: bold; color: #059669;">C</span>
                                        </div>
                                        <h1 style="color: white; margin: 0 0 10px 0; font-size: 28px;">Credit Search Complete</h1>
                                        <p style="color: #d1fae5; margin: 0; font-size: 14px;">TEST MODE - Mock Data</p>
                                    </div>
                                    
                                    <!-- Content -->
                                    <div style="padding: 40px 30px;">
                                        <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">Dear ${userRecord[0].full_name},</p>
                                        
                                        <p style="color: #6b7280; line-height: 1.6; margin: 0 0 30px 0;">
                                            Your credit search has been successfully processed. Please find your credit report details below:
                                        </p>
                                        
                                        <!-- Credit Score Card -->
                                        <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 25px; border-radius: 12px; margin: 0 0 30px 0; border: 2px solid #059669;">
                                            <div style="text-align: center;">
                                                <p style="color: #6b7280; margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Your Credit Score</p>
                                                <h2 style="color: #059669; margin: 0 0 10px 0; font-size: 48px; font-weight: bold;">${mockScore}</h2>
                                                <p style="color: #10b981; margin: 0; font-weight: 600; font-size: 16px;">Excellent Credit Rating</p>
                                            </div>
                                        </div>
                                        
                                        <!-- Report Details -->
                                        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 0 0 30px 0;">
                                            <h3 style="color: #1f2937; margin: 0 0 15px 0; font-size: 16px;">Report Details</h3>
                                            <table style="width: 100%; border-collapse: collapse;">
                                                <tr>
                                                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Report Type:</td>
                                                    <td style="padding: 8px 0; color: #1f2937; font-weight: 600; text-align: right; font-size: 14px;">Basic Credit Report</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Valid Until:</td>
                                                    <td style="padding: 8px 0; color: #1f2937; font-weight: 600; text-align: right; font-size: 14px;">90 Days</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Report Date:</td>
                                                    <td style="padding: 8px 0; color: #1f2937; font-weight: 600; text-align: right; font-size: 14px;">${new Date().toLocaleDateString('en-NG')}</td>
                                                </tr>
                                            </table>
                                        </div>
                                        
                                        <!-- Download Report -->
                                        <div style="background: white; border: 2px dashed #d1d5db; padding: 20px; border-radius: 8px; text-align: center; margin: 0 0 30px 0;">
                                            <p style="color: #6b7280; margin: 0 0 15px 0; font-size: 14px;">Your full credit report has been attached</p>
                                            <a href="${file_url}" download style="display: inline-block; background: #059669; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                                                📄 Download Report
                                            </a>
                                        </div>
                                        
                                        <!-- Test Mode Warning -->
                                        <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 0 0 30px 0; border-left: 4px solid #f59e0b;">
                                            <p style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.6;">
                                                ⚠️ <strong>TEST MODE:</strong> This is a mock credit search result for testing purposes. In production, this will contain your actual credit bureau data.
                                            </p>
                                        </div>
                                        
                                        <!-- Premium Option -->
                                        <div style="background: linear-gradient(135deg, #1f2937 0%, #374151 100%); padding: 25px; border-radius: 12px; margin: 0 0 30px 0;">
                                            <h3 style="color: white; margin: 0 0 10px 0; font-size: 18px;">Need a More Detailed Report?</h3>
                                            <p style="color: #d1d5db; margin: 0 0 20px 0; font-size: 14px; line-height: 1.6;">
                                                Get the <strong>Premium Classic Consumer Report</strong> for comprehensive credit analysis, detailed payment history, and complete account information.
                                            </p>
                                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                                <div>
                                                    <p style="color: #9ca3af; margin: 0 0 5px 0; font-size: 12px;">Premium Report</p>
                                                    <p style="color: white; margin: 0; font-size: 24px; font-weight: bold;">₦2,500</p>
                                                </div>
                                                <a href="https://creditze.base44.app/PremiumReportPayment?search_id=${searchId}" style="background: white; color: #1f2937; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                                                    Get Report
                                                </a>
                                            </div>
                                        </div>
                                        
                                        <!-- CTA Button -->
                                        <div style="text-align: center; margin: 0 0 30px 0;">
                                            <a href="https://creditze.base44.app/ApplyLoan" style="display: inline-block; background: #059669; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(5, 150, 105, 0.3);">
                                                Apply for Loan Now
                                            </a>
                                        </div>
                                        
                                        <!-- Footer Note -->
                                        <div style="border-top: 1px solid #e5e7eb; padding-top: 20px;">
                                            <p style="color: #9ca3af; font-size: 13px; line-height: 1.6; margin: 0;">
                                                <strong>Note:</strong> This report is valid for 90 days from the date of issue. If you have any questions or need assistance, please contact our support team at support@creditze.ng
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <!-- Footer -->
                                    <div style="background: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                                        <p style="color: #6b7280; font-size: 13px; margin: 0 0 10px 0;">
                                            © 2026 Creditze. All rights reserved.
                                        </p>
                                        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                            This is an automated email. Please do not reply directly to this message.
                                        </p>
                                    </div>
                                </div>
                            </body>
                            </html>
                        `
                    });
                }
            }
            
            return Response.json({
                success: true,
                responseType: 'single_hit',
                score: mockScore,
                testMode: true,
                message: 'Test mode: Mock data used',
                fullReport: mockCrcData
            });
        }

        const CRC_USERNAME = Deno.env.get('CRC_USERNAME');
        const CRC_PASSWORD = Deno.env.get('CRC_PASSWORD');

        if (!CRC_USERNAME || !CRC_PASSWORD) {
            return Response.json({ error: 'CRC credentials not configured' }, { status: 500 });
        }

        // Prepare CRC request
        const requestPayload = {
            Request: JSON.stringify({
                '@REQUEST_ID': '1',
                'REQUEST_PARAMETERS': {
                    'REPORT_PARAMETERS': {
                        '@REPORT_ID': '101',
                        '@SUBJECT_TYPE': '1',
                        '@RESPONSE_TYPE': '5'
                    },
                    'INQUIRY_REASON': {
                        '@CODE': '1'
                    },
                    'APPLICATION': {
                        '@PRODUCT': '017',
                        '@NUMBER': '232',
                        '@AMOUNT': '15000',
                        '@CURRENCY': 'NGN'
                    }
                },
                'SEARCH_PARAMETERS': {
                    '@SEARCH-TYPE': '4',
                    'BVN_NO': bvn
                }
            }).replace(/"/g, "'"),
            UserName: CRC_USERNAME,
            Password: CRC_PASSWORD
        };

        // Log request details for debugging
        console.log('=== CRC API REQUEST ===');
        console.log('URL:', 'https://webserver.creditreferencenigeria.net/JsonLiveRequest/JsonService.svc/CIRRequest/ProcessRequestJson');
        console.log('BVN:', bvn);
        console.log('Username:', CRC_USERNAME ? `${CRC_USERNAME.substring(0, 3)}***` : 'NOT SET');
        console.log('Password:', CRC_PASSWORD ? '***SET***' : 'NOT SET');
        console.log('Full Payload:', JSON.stringify(requestPayload, null, 2));
        console.log('=== END REQUEST ===');

        // Call CRC API
        const crcResponse = await fetch(
            'https://webserver.creditreferencenigeria.net/JsonLiveRequest/JsonService.svc/CIRRequest/ProcessRequestJson',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestPayload)
            }
        );

        if (!crcResponse.ok) {
            throw new Error(`CRC API error: ${crcResponse.status}`);
        }

        const crcData = await crcResponse.json();
        
        // Log the full response for debugging
        console.log('=== CRC API FULL RESPONSE ===');
        console.log('Status Code:', crcResponse.status);
        console.log('Status Text:', crcResponse.statusText);
        console.log('Response Body:', JSON.stringify(crcData, null, 2));
        console.log('=== END CRC API RESPONSE ===');

        // Check for error response
        if (crcData.ErrorResponse) {
            const errorCode = crcData.ErrorResponse.BODY?.ERRORLIST?.[0];
            const errorDesc = crcData.ErrorResponse.HEADER?.RESPONSETYPE?.DESCRIPTION || 'Unknown error';
            
            // Map common CRC error codes to user-friendly messages
            const errorMessages = {
                '36': 'BVN not found in credit bureau records. This person may not have any credit history.',
                '1': 'Invalid request format',
                '2': 'Authentication failed',
                '3': 'Service temporarily unavailable',
                '4': 'Invalid BVN format'
            };
            
            const userMessage = errorMessages[errorCode] || `Credit bureau error: ${errorDesc}`;
            
            await base44.asServiceRole.entities.CreditSearch.update(searchId, {
                search_date: new Date().toISOString(),
                search_status: 'unsuccessful',
                failure_reason: `CRC Error ${errorCode}: ${userMessage}`,
                bureau_response: crcData
            });
            
            return Response.json({
                success: false,
                error: userMessage,
                errorCode: errorCode,
                technicalDetails: errorDesc,
                fullCrcResponse: crcData
            });
        }

        // Check response type - handle both ConsumerHitResponse and ConsumerSearchResultResponse
        const consumerHit = crcData.ConsumerHitResponse;
        const consumerSearch = crcData.ConsumerSearchResultResponse;
        const responseCode = consumerSearch?.HEADER?.RESPONSETYPE?.CODE;
        console.log('Response Code:', responseCode);
        console.log('Has ConsumerHitResponse:', !!consumerHit);
        console.log('Has ConsumerSearchResultResponse:', !!consumerSearch);

        // SCENARIO 1: Direct Hit (ConsumerHitResponse) - Direct credit report with score
        if (consumerHit) {
            const score = consumerHit.BODY?.CREDIT_SCORE_DETAILS?.CREDIT_SCORE_SUMMARY?.CREDIT_SCORE || 0;
            const creditRating = consumerHit.BODY?.CREDIT_SCORE_DETAILS?.CREDIT_SCORE_SUMMARY?.CREDIT_RATING || 'N/A';
            
            console.log('Credit Score Found:', score);
            console.log('Credit Rating:', creditRating);
            
            // Update database record
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 90);
            
            // Upload CRC report
            const reportContent = JSON.stringify(crcData, null, 2);
            const reportFile = new File([reportContent], `credit_report_${searchId}.json`, { 
                type: 'application/json' 
            });
            const { file_url } = await base44.integrations.Core.UploadFile({
                file: reportFile
            });
            
            await base44.asServiceRole.entities.CreditSearch.update(searchId, {
                search_date: new Date().toISOString(),
                expiry_date: expiryDate.toISOString(),
                search_status: 'successful',
                bureau_score: score,
                crc_reference: 'direct_hit',
                bureau_response: crcData,
                report_url: file_url,
                report_emailed: true
            });
            
            // Send professional email with report
            const searchRecord = await base44.asServiceRole.entities.CreditSearch.filter({ id: searchId });
            if (searchRecord[0]) {
                const userRecord = await base44.asServiceRole.entities.User.filter({ id: searchRecord[0].user_id });
                if (userRecord[0]) {
                    const scoreRating = score >= 700 ? 'Excellent' : score >= 600 ? 'Good' : score >= 500 ? 'Fair' : 'Poor';
                    const scoreColor = score >= 700 ? '#059669' : score >= 600 ? '#10b981' : score >= 500 ? '#f59e0b' : '#ef4444';
                    
                    await base44.integrations.Core.SendEmail({
                        to: userRecord[0].email,
                        subject: '✅ Your Credit Search Report - Creditze',
                        body: `
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <meta charset="UTF-8">
                                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            </head>
                            <body style="margin: 0; padding: 20px; background-color: #f3f4f6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                                <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                                    <!-- Header -->
                                    <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 40px 30px; text-align: center;">
                                        <div style="background: white; width: 60px; height: 60px; border-radius: 12px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                                            <span style="font-size: 32px; font-weight: bold; color: #059669;">C</span>
                                        </div>
                                        <h1 style="color: white; margin: 0 0 10px 0; font-size: 28px;">Credit Search Complete</h1>
                                        <p style="color: #d1fae5; margin: 0; font-size: 14px;">Your Credit Report is Ready</p>
                                    </div>
                                    
                                    <!-- Content -->
                                    <div style="padding: 40px 30px;">
                                        <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">Dear ${userRecord[0].full_name},</p>
                                        
                                        <p style="color: #6b7280; line-height: 1.6; margin: 0 0 30px 0;">
                                            Your credit search has been successfully processed. Please find your credit report details below:
                                        </p>
                                        
                                        <!-- Credit Score Card -->
                                        <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 25px; border-radius: 12px; margin: 0 0 30px 0; border: 2px solid ${scoreColor};">
                                            <div style="text-align: center;">
                                                <p style="color: #6b7280; margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Your Credit Score</p>
                                                <h2 style="color: ${scoreColor}; margin: 0 0 10px 0; font-size: 48px; font-weight: bold;">${score || 'N/A'}</h2>
                                                <p style="color: ${scoreColor}; margin: 0; font-weight: 600; font-size: 16px;">${scoreRating} Credit Rating</p>
                                            </div>
                                        </div>
                                        
                                        <!-- Report Details -->
                                        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 0 0 30px 0;">
                                            <h3 style="color: #1f2937; margin: 0 0 15px 0; font-size: 16px;">Report Details</h3>
                                            <table style="width: 100%; border-collapse: collapse;">
                                                <tr>
                                                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Report Type:</td>
                                                    <td style="padding: 8px 0; color: #1f2937; font-weight: 600; text-align: right; font-size: 14px;">Basic Credit Report</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Valid Until:</td>
                                                    <td style="padding: 8px 0; color: #1f2937; font-weight: 600; text-align: right; font-size: 14px;">${expiryDate.toLocaleDateString('en-NG')}</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Report Date:</td>
                                                    <td style="padding: 8px 0; color: #1f2937; font-weight: 600; text-align: right; font-size: 14px;">${new Date().toLocaleDateString('en-NG')}</td>
                                                </tr>
                                            </table>
                                        </div>
                                        
                                        <!-- Download Report -->
                                        <div style="background: white; border: 2px dashed #d1d5db; padding: 20px; border-radius: 8px; text-align: center; margin: 0 0 30px 0;">
                                            <p style="color: #6b7280; margin: 0 0 15px 0; font-size: 14px;">Your full credit report has been attached</p>
                                            <a href="${file_url}" download style="display: inline-block; background: #059669; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                                                📄 Download Report
                                            </a>
                                        </div>
                                        
                                        <!-- Premium Option -->
                                        <div style="background: linear-gradient(135deg, #1f2937 0%, #374151 100%); padding: 25px; border-radius: 12px; margin: 0 0 30px 0;">
                                            <h3 style="color: white; margin: 0 0 10px 0; font-size: 18px;">Need a More Detailed Report?</h3>
                                            <p style="color: #d1d5db; margin: 0 0 20px 0; font-size: 14px; line-height: 1.6;">
                                                Get the <strong>Premium Classic Consumer Report</strong> for comprehensive credit analysis, detailed payment history, and complete account information.
                                            </p>
                                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                                <div>
                                                    <p style="color: #9ca3af; margin: 0 0 5px 0; font-size: 12px;">Premium Report</p>
                                                    <p style="color: white; margin: 0; font-size: 24px; font-weight: bold;">₦2,500</p>
                                                </div>
                                                <a href="https://creditze.base44.app/PremiumReportPayment?search_id=${searchId}" style="background: white; color: #1f2937; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                                                    Get Report
                                                </a>
                                            </div>
                                        </div>
                                        
                                        <!-- CTA Button -->
                                        <div style="text-align: center; margin: 0 0 30px 0;">
                                            <a href="https://creditze.base44.app/ApplyLoan" style="display: inline-block; background: #059669; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(5, 150, 105, 0.3);">
                                                Apply for Loan Now
                                            </a>
                                        </div>
                                        
                                        <!-- Footer Note -->
                                        <div style="border-top: 1px solid #e5e7eb; padding-top: 20px;">
                                            <p style="color: #9ca3af; font-size: 13px; line-height: 1.6; margin: 0;">
                                                <strong>Note:</strong> This report is valid for 90 days from the date of issue. If you have any questions or need assistance, please contact our support team at support@creditze.ng
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <!-- Footer -->
                                    <div style="background: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                                        <p style="color: #6b7280; font-size: 13px; margin: 0 0 10px 0;">
                                            © 2026 Creditze. All rights reserved.
                                        </p>
                                        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                            This is an automated email. Please do not reply directly to this message.
                                        </p>
                                    </div>
                                </div>
                            </body>
                            </html>
                        `
                    });
                }
            }
            
            return Response.json({
                success: true,
                responseType: 'single_hit',
                score: score,
                fullReport: crcData
            });
        }

        // SCENARIO 2: No Hit (CODE=2) - No data found
        if (responseCode === '2') {
            // Update database record
            await base44.asServiceRole.entities.CreditSearch.update(searchId, {
                search_date: new Date().toISOString(),
                search_status: 'unsuccessful',
                failure_reason: 'No credit history found for this BVN'
            });
            
            return Response.json({
                success: false,
                responseType: 'no_hit',
                message: 'No credit history found for this BVN'
            });
        }

        // SCENARIO 3: Multi Hit (CODE=3) - Need to merge
        if (responseCode === '3') {
            const referenceNo = crcData.ConsumerSearchResultResponse?.REFERENCENO;
            const searchResults = crcData.ConsumerSearchResultResponse?.BODY?.SEARCHRESULTLIST || [];

            if (!referenceNo || searchResults.length === 0) {
                throw new Error('Invalid multi-hit response');
            }

            // Select primary bureau ID (highest confidence score)
            const sortedResults = searchResults.sort((a, b) => 
                parseInt(b.CONFIDENCESCORE || '0') - parseInt(a.CONFIDENCESCORE || '0')
            );
            const primaryBureauId = sortedResults[0].BUREAUID;
            const bureauIds = searchResults.map(r => r.BUREAUID);

            // Perform merge request
            const mergePayload = {
                Request: JSON.stringify({
                    '@REQUEST_ID': '1',
                    'REQUEST_PARAMETERS': {
                        'APPLICATION': {
                            '@AMOUNT': '15000',
                            '@CURRENCY': 'NGN',
                            '@NUMBER': searchId.toString(),
                            '@PRODUCT': '017'
                        },
                        'INQUIRY_REASON': {
                            '@CODE': '1'
                        },
                        'REPORT_PARAMETERS': {
                            '@REPORT_ID': '101',
                            '@RESPONSE_TYPE': '5',
                            '@SUBJECT_TYPE': '1'
                        },
                        'REQUEST_REFERENCE': {
                            '@REFERENCE-NO': referenceNo,
                            'MERGE_REPORT': {
                                '@PRIMARY-BUREAU-ID': primaryBureauId,
                                'BUREAU_ID': bureauIds
                            }
                        }
                    }
                }).replace(/"/g, "'"),
                UserName: CRC_USERNAME,
                Password: CRC_PASSWORD
            };

            const mergeResponse = await fetch(
                'https://webserver.creditreferencenigeria.net/JsonLiveRequest/JsonService.svc/CIRRequest/ProcessRequestJson',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(mergePayload)
                }
            );

            if (!mergeResponse.ok) {
                throw new Error(`CRC merge API error: ${mergeResponse.status}`);
            }

            const mergeData = await mergeResponse.json();
            const score = extractCreditScore(mergeData);

            // Update database record
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 90);
            
            // Upload merged report
            const reportContent = JSON.stringify(mergeData, null, 2);
            const reportFile = new File([reportContent], `credit_report_${searchId}.json`, { 
                type: 'application/json' 
            });
            const { file_url } = await base44.integrations.Core.UploadFile({
                file: reportFile
            });
            
            await base44.asServiceRole.entities.CreditSearch.update(searchId, {
                search_date: new Date().toISOString(),
                expiry_date: expiryDate.toISOString(),
                search_status: 'successful',
                bureau_score: score || 0,
                crc_reference: 'multi_hit_merged',
                bureau_response: mergeData,
                report_url: file_url,
                report_emailed: true
            });
            
            // Send professional email with report
            const searchRecord = await base44.asServiceRole.entities.CreditSearch.filter({ id: searchId });
            if (searchRecord[0]) {
                const userRecord = await base44.asServiceRole.entities.User.filter({ id: searchRecord[0].user_id });
                if (userRecord[0]) {
                    const scoreRating = score >= 700 ? 'Excellent' : score >= 600 ? 'Good' : score >= 500 ? 'Fair' : 'Poor';
                    const scoreColor = score >= 700 ? '#059669' : score >= 600 ? '#10b981' : score >= 500 ? '#f59e0b' : '#ef4444';
                    
                    await base44.integrations.Core.SendEmail({
                        to: userRecord[0].email,
                        subject: '✅ Your Credit Search Report - Creditze',
                        body: `
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <meta charset="UTF-8">
                                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            </head>
                            <body style="margin: 0; padding: 20px; background-color: #f3f4f6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                                <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                                    <!-- Header -->
                                    <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 40px 30px; text-align: center;">
                                        <div style="background: white; width: 60px; height: 60px; border-radius: 12px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                                            <span style="font-size: 32px; font-weight: bold; color: #059669;">C</span>
                                        </div>
                                        <h1 style="color: white; margin: 0 0 10px 0; font-size: 28px;">Credit Search Complete</h1>
                                        <p style="color: #d1fae5; margin: 0; font-size: 14px;">Your Credit Report is Ready</p>
                                    </div>
                                    
                                    <!-- Content -->
                                    <div style="padding: 40px 30px;">
                                        <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">Dear ${userRecord[0].full_name},</p>
                                        
                                        <p style="color: #6b7280; line-height: 1.6; margin: 0 0 30px 0;">
                                            Your credit search has been successfully processed. Please find your credit report details below:
                                        </p>
                                        
                                        <!-- Credit Score Card -->
                                        <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 25px; border-radius: 12px; margin: 0 0 30px 0; border: 2px solid ${scoreColor};">
                                            <div style="text-align: center;">
                                                <p style="color: #6b7280; margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Your Credit Score</p>
                                                <h2 style="color: ${scoreColor}; margin: 0 0 10px 0; font-size: 48px; font-weight: bold;">${score || 'N/A'}</h2>
                                                <p style="color: ${scoreColor}; margin: 0; font-weight: 600; font-size: 16px;">${scoreRating} Credit Rating</p>
                                            </div>
                                        </div>
                                        
                                        <!-- Report Details -->
                                        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 0 0 30px 0;">
                                            <h3 style="color: #1f2937; margin: 0 0 15px 0; font-size: 16px;">Report Details</h3>
                                            <table style="width: 100%; border-collapse: collapse;">
                                                <tr>
                                                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Report Type:</td>
                                                    <td style="padding: 8px 0; color: #1f2937; font-weight: 600; text-align: right; font-size: 14px;">Basic Credit Report</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Report Date:</td>
                                                    <td style="padding: 8px 0; color: #1f2937; font-weight: 600; text-align: right; font-size: 14px;">${new Date().toLocaleDateString('en-NG')}</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Valid Until:</td>
                                                    <td style="padding: 8px 0; color: #1f2937; font-weight: 600; text-align: right; font-size: 14px;">${expiryDate.toLocaleDateString('en-NG')}</td>
                                                </tr>
                                            </table>
                                        </div>
                                        
                                        <!-- Download Report -->
                                        <div style="background: white; border: 2px dashed #d1d5db; padding: 20px; border-radius: 8px; text-align: center; margin: 0 0 30px 0;">
                                            <p style="color: #6b7280; margin: 0 0 15px 0; font-size: 14px;">Your full credit report has been attached</p>
                                            <a href="${file_url}" download style="display: inline-block; background: #059669; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                                                📄 Download Report
                                            </a>
                                        </div>
                                        
                                        <!-- Premium Option -->
                                        <div style="background: linear-gradient(135deg, #1f2937 0%, #374151 100%); padding: 25px; border-radius: 12px; margin: 0 0 30px 0;">
                                            <h3 style="color: white; margin: 0 0 10px 0; font-size: 18px;">Need a More Detailed Report?</h3>
                                            <p style="color: #d1d5db; margin: 0 0 20px 0; font-size: 14px; line-height: 1.6;">
                                                Get the <strong>Premium Classic Consumer Report</strong> for comprehensive credit analysis, detailed payment history, and complete account information.
                                            </p>
                                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                                <div>
                                                    <p style="color: #9ca3af; margin: 0 0 5px 0; font-size: 12px;">Premium Report</p>
                                                    <p style="color: white; margin: 0; font-size: 24px; font-weight: bold;">₦2,500</p>
                                                </div>
                                                <a href="https://creditze.base44.app/PremiumReportPayment?search_id=${searchId}" style="background: white; color: #1f2937; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                                                    Get Report
                                                </a>
                                            </div>
                                        </div>
                                        
                                        <!-- CTA Button -->
                                        <div style="text-align: center; margin: 0 0 30px 0;">
                                            <a href="https://creditze.base44.app/ApplyLoan" style="display: inline-block; background: #059669; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(5, 150, 105, 0.3);">
                                                Apply for Loan Now →
                                            </a>
                                        </div>
                                        
                                        <!-- Important Note -->
                                        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                                            <p style="color: #92400e; margin: 0; font-size: 13px; line-height: 1.6;">
                                                <strong>⚠️ Important:</strong> This report is valid for 90 days and can be used for multiple loan applications during this period.
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <!-- Footer -->
                                    <div style="background: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                                        <p style="color: #6b7280; font-size: 13px; margin: 0 0 10px 0;">
                                            © 2026 Creditze. All rights reserved.
                                        </p>
                                        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                            This is an automated email. Please do not reply directly to this message.
                                        </p>
                                    </div>
                                </div>
                            </body>
                            </html>
                        `
                    });
                }
            }

            return Response.json({
                success: true,
                responseType: 'multi_hit_merged',
                score: score,
                fullReport: mergeData,
                matchedRecords: searchResults.length
            });
        }

        // Unknown response type or error in response
        const errorMessage = crcData.ConsumerSearchResultResponse?.HEADER?.ERROR?.MESSAGE || 
                           crcData.ERROR?.MESSAGE || 
                           crcData.error || 
                           'Unknown error';
        
        await base44.asServiceRole.entities.CreditSearch.update(searchId, {
            search_date: new Date().toISOString(),
            search_status: 'unsuccessful',
            failure_reason: `CRC API Error: ${errorMessage} (Response Type: ${responseCode})`
        });
        
        return Response.json({
            success: false,
            error: `CRC API returned unexpected response: ${errorMessage}`,
            responseCode: responseCode,
            fullResponse: crcData
        });

    } catch (error) {
        console.error('Credit search error:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});

// Helper function to extract credit score from CRC response
function extractCreditScore(crcData) {
    try {
        // Try multiple possible paths for the credit score
        let creditScore = null;
        
        // Path 1: ConsumerSearchResultResponse (single hit)
        creditScore = crcData.ConsumerSearchResultResponse?.BODY?.SCORE?.['@SCORE'];
        
        // Path 2: ConsumerHitResponse (merged)
        if (!creditScore) {
            creditScore = crcData.ConsumerHitResponse?.BODY?.CREDIT_SCORE_DETAILS?.CREDIT_SCORE_SUMMARY?.CREDIT_SCORE;
        }
        
        // Path 3: Direct CREDIT_SCORE
        if (!creditScore) {
            creditScore = crcData.CREDIT_SCORE_DETAILS?.CREDIT_SCORE_SUMMARY?.CREDIT_SCORE;
        }
        
        return creditScore ? parseInt(creditScore) : null;
    } catch (e) {
        console.error('Error extracting credit score:', e);
        return null;
    }
}