import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { reference, search_id } = await req.json();

    if (!reference) {
      return Response.json({ 
        success: false, 
        error: 'Payment reference is required' 
      }, { status: 400 });
    }

    // Verify payment with Paystack
    const verifyResponse = await base44.functions.invoke('paystackVerifyPayment', {
      reference: reference
    });

    if (!verifyResponse.data.success) {
      return Response.json({ 
        success: false, 
        error: 'Payment verification failed' 
      }, { status: 400 });
    }

    const paymentData = verifyResponse.data.data;

    // Check payment amount (should be 2500 NGN = 250000 kobo)
    if (paymentData.amount < 250000) {
      return Response.json({ 
        success: false, 
        error: 'Insufficient payment amount' 
      }, { status: 400 });
    }

    // Get user's KYC profile for BVN
    const kycProfiles = await base44.entities.KYCProfile.filter({ 
      user_id: user.id 
    });

    if (!kycProfiles || kycProfiles.length === 0) {
      return Response.json({ 
        success: false, 
        error: 'KYC profile not found' 
      }, { status: 400 });
    }

    const kyc = kycProfiles[0];

    if (!kyc.bvn) {
      return Response.json({ 
        success: false, 
        error: 'BVN not found in KYC profile' 
      }, { status: 400 });
    }

    // Call CRC API for Classic Consumer Report
    const crcUsername = Deno.env.get('CRC_USERNAME');
    const crcPassword = Deno.env.get('CRC_PASSWORD');

    if (!crcUsername || !crcPassword) {
      return Response.json({ 
        success: false, 
        error: 'CRC credentials not configured' 
      }, { status: 500 });
    }

    // Authenticate with CRC
    const authResponse = await fetch('https://api.creditreferencenigeria.net/api/authenticate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: crcUsername,
        password: crcPassword
      })
    });

    if (!authResponse.ok) {
      return Response.json({ 
        success: false, 
        error: 'CRC authentication failed' 
      }, { status: 500 });
    }

    const authData = await authResponse.json();
    const token = authData.token;

    // Fetch Classic Consumer Report
    const reportResponse = await fetch('https://api.creditreferencenigeria.net/api/reports/classic-consumer', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bvn: kyc.bvn,
        report_format: 'pdf'
      })
    });

    if (!reportResponse.ok) {
      const errorText = await reportResponse.text();
      console.error('CRC API Error:', errorText);
      return Response.json({ 
        success: false, 
        error: 'Failed to fetch premium report from CRC' 
      }, { status: 500 });
    }

    const reportData = await reportResponse.json();

    // The report should contain a PDF URL or base64 data
    const reportUrl = reportData.report_url || reportData.pdf_url;
    const reportPdfBase64 = reportData.report_pdf || reportData.pdf_data;

    // Send email with report
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white;">
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #1f2937 0%, #374151 100%); padding: 40px 20px; text-align: center;">
                  <div style="display: inline-flex; align-items: center; gap: 12px; margin-bottom: 20px;">
                      <div style="width: 48px; height: 48px; background: white; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                          <span style="color: #1f2937; font-size: 28px; font-weight: bold;">C</span>
                      </div>
                      <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">Creditze</h1>
                  </div>
                  <p style="color: #d1d5db; font-size: 16px; margin: 0;">Premium Credit Report Ready</p>
              </div>
              
              <!-- Body -->
              <div style="padding: 40px 20px;">
                  <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 24px;">Hi ${user.full_name || 'there'},</h2>
                  
                  <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0;">
                      Your <strong>Premium Classic Consumer Report</strong> is ready! This comprehensive report includes detailed credit history, account information, and in-depth credit analysis.
                  </p>
                  
                  <!-- Report Details Card -->
                  <div style="background: #f3f4f6; border-radius: 12px; padding: 24px; margin: 0 0 30px 0;">
                      <h3 style="color: #1f2937; margin: 0 0 16px 0; font-size: 18px;">Report Details</h3>
                      <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                          <span style="color: #6b7280;">Report Type:</span>
                          <span style="color: #1f2937; font-weight: 600;">Classic Consumer Report</span>
                      </div>
                      <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                          <span style="color: #6b7280;">Amount Paid:</span>
                          <span style="color: #1f2937; font-weight: 600;">₦2,500</span>
                      </div>
                      <div style="display: flex; justify-content: space-between;">
                          <span style="color: #6b7280;">Payment Reference:</span>
                          <span style="color: #1f2937; font-weight: 600; font-size: 12px;">${reference}</span>
                      </div>
                  </div>
                  
                  ${reportUrl ? `
                  <!-- Download Button -->
                  <div style="text-align: center; margin: 0 0 30px 0;">
                      <a href="${reportUrl}" style="display: inline-block; background: #1f2937; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                          Download Your Report
                      </a>
                  </div>
                  ` : ''}
                  
                  <div style="background: #fef3c7; padding: 16px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 0 0 30px 0;">
                      <p style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.6;">
                          <strong>Important:</strong> This report contains sensitive financial information. Keep it secure and do not share it with unauthorized parties.
                      </p>
                  </div>
                  
                  <!-- Apply for Loan CTA -->
                  <div style="text-align: center; margin: 0 0 30px 0;">
                      <p style="color: #6b7280; margin: 0 0 16px 0;">Ready to get a loan?</p>
                      <a href="https://creditze.base44.app/ApplyLoan" style="display: inline-block; background: #059669; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                          Apply for Loan
                      </a>
                  </div>
                  
                  <!-- Footer Note -->
                  <div style="border-top: 1px solid #e5e7eb; padding-top: 20px;">
                      <p style="color: #9ca3af; font-size: 13px; line-height: 1.6; margin: 0;">
                          If you have any questions about your report, please contact our support team at support@creditze.ng
                      </p>
                  </div>
              </div>
              
              <!-- Footer -->
              <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
                  <p style="margin: 0 0 5px 0;">&copy; 2026 Creditze. All rights reserved.</p>
                  <p style="margin: 0;">Fast, Secure, Reliable Loans</p>
              </div>
          </div>
      </body>
      </html>
    `;

    await base44.integrations.Core.SendEmail({
      to: user.email,
      subject: '📄 Your Premium Credit Report is Ready',
      body: emailHtml
    });

    return Response.json({
      success: true,
      message: 'Premium report purchased successfully',
      report_url: reportUrl
    });

  } catch (error) {
    console.error('Premium report purchase error:', error);
    return Response.json({ 
      success: false, 
      error: error.message || 'Failed to process premium report purchase' 
    }, { status: 500 });
  }
});