import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { jsPDF } from 'npm:jspdf@4.0.0';

// ─── PDF GENERATOR ────────────────────────────────────────────────────────────
function generateCreditReportPDF({ userName, score, searchId, reportDate, expiryDate, crcData, isTestMode }) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210;
    let y = 0;

    // Header band
    doc.setFillColor(5, 150, 105);
    doc.rect(0, 0, W, 42, 'F');

    // Logo circle
    doc.setFillColor(255, 255, 255);
    doc.circle(20, 21, 9, 'F');
    doc.setTextColor(5, 150, 105);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('C', 17.5, 25);

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text('CREDITZE', 35, 18);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Credit Bureau Report', 35, 26);
    doc.setFontSize(9);
    doc.text(isTestMode ? 'TEST MODE — Mock Data' : 'Powered by CRC Credit Bureau', 35, 34);

    y = 54;

    // Recipient
    doc.setTextColor(55, 65, 81);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Dear ${userName},`, 15, y);
    y += 7;
    doc.setFontSize(9.5);
    doc.setTextColor(107, 114, 128);
    doc.text('Your credit search has been successfully processed. Below is your credit report summary.', 15, y, { maxWidth: W - 30 });
    y += 12;

    // Score card
    const scoreRating = score >= 700 ? 'Excellent' : score >= 600 ? 'Good' : score >= 500 ? 'Fair' : 'Poor';
    const scoreR = score >= 700 ? [5,150,105] : score >= 600 ? [16,185,129] : score >= 500 ? [245,158,11] : [239,68,68];
    doc.setFillColor(...scoreR.map(c => Math.round(c * 0.12 + 243)));
    doc.roundedRect(15, y, W - 30, 36, 4, 4, 'F');
    doc.setDrawColor(...scoreR);
    doc.setLineWidth(0.8);
    doc.roundedRect(15, y, W - 30, 36, 4, 4, 'S');

    doc.setTextColor(107, 114, 128);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('YOUR CREDIT SCORE', W / 2, y + 9, { align: 'center' });

    doc.setTextColor(...scoreR);
    doc.setFontSize(32);
    doc.setFont('helvetica', 'bold');
    doc.text(score ? score.toString() : 'N/A', W / 2, y + 23, { align: 'center' });

    doc.setFontSize(10);
    doc.text(scoreRating + ' Credit Rating', W / 2, y + 31, { align: 'center' });
    y += 44;

    // Report Details table
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(15, y, W - 30, 36, 3, 3, 'F');
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Report Details', 20, y + 8);

    const details = [
        ['Report Type', 'Basic Credit Report (CRC Bureau)'],
        ['Report Date', reportDate],
        ['Valid Until', expiryDate],
        ['Reference ID', searchId.substring(0, 16) + '...'],
    ];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    let dy = y + 14;
    for (const [label, value] of details) {
        doc.setTextColor(107, 114, 128);
        doc.text(label + ':', 20, dy);
        doc.setTextColor(31, 41, 55);
        doc.setFont('helvetica', 'bold');
        doc.text(value, W - 20, dy, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        dy += 6;
    }
    y += 44;

    // Account Summary (if available)
    const body = crcData?.ConsumerHitResponse?.BODY || crcData?.ConsumerSearchResultResponse?.BODY || {};
    const accounts = body?.ACCOUNTLIST || [];
    const accountArr = Array.isArray(accounts) ? accounts : [accounts];

    if (accountArr.length > 0 && accountArr[0]?.ACCOUNT) {
        y += 4;
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Account Summary', 15, y);
        y += 6;

        // Table header
        doc.setFillColor(5, 150, 105);
        doc.rect(15, y, W - 30, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.text('Institution', 18, y + 5.5);
        doc.text('Type', 75, y + 5.5);
        doc.text('Balance (₦)', 115, y + 5.5);
        doc.text('Status', 165, y + 5.5);
        y += 8;

        let rowAlt = false;
        for (const item of accountArr.slice(0, 10)) {
            const acc = item.ACCOUNT || {};
            if (rowAlt) {
                doc.setFillColor(243, 244, 246);
                doc.rect(15, y, W - 30, 7, 'F');
            }
            doc.setTextColor(55, 65, 81);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text((acc['@INSTITUTION'] || 'N/A').substring(0, 22), 18, y + 5);
            doc.text((acc['@ACCOUNT-TYPE'] || 'N/A').substring(0, 18), 75, y + 5);
            const bal = acc['@BALANCE'] ? Number(acc['@BALANCE']).toLocaleString('en-NG') : 'N/A';
            doc.text(bal, 115, y + 5);
            const status = acc['@STATUS'] || 'N/A';
            const statusColor = status.toLowerCase() === 'active' ? [5,150,105] : [239,68,68];
            doc.setTextColor(...statusColor);
            doc.text(status, 165, y + 5);
            doc.setTextColor(55, 65, 81);
            y += 7;
            rowAlt = !rowAlt;
        }
        y += 4;
    }

    // Consumer personal info (if available)
    const consumer = body?.CONSUMER;
    if (consumer) {
        y += 2;
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Consumer Information', 15, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);

        const name = consumer?.NAME;
        if (name) {
            const fullName = [name.FIRSTNAME, name.MIDDLENAME, name.LASTNAME].filter(Boolean).join(' ');
            doc.setTextColor(107, 114, 128);
            doc.text('Name:', 15, y);
            doc.setTextColor(31, 41, 55);
            doc.text(fullName || 'N/A', 60, y);
            y += 6;
        }
        const dob = consumer?.DATE_OF_BIRTH || consumer?.DOB;
        if (dob) {
            doc.setTextColor(107, 114, 128);
            doc.text('Date of Birth:', 15, y);
            doc.setTextColor(31, 41, 55);
            doc.text(dob, 60, y);
            y += 6;
        }
    }

    // Test mode notice
    if (isTestMode) {
        y += 4;
        doc.setFillColor(254, 243, 199);
        doc.roundedRect(15, y, W - 30, 14, 3, 3, 'F');
        doc.setTextColor(146, 64, 14);
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.text('⚠ TEST MODE', 20, y + 6);
        doc.setFont('helvetica', 'normal');
        doc.text('This is a mock credit report for testing purposes only. Not a real bureau report.', 20, y + 11, { maxWidth: W - 40 });
        y += 18;
    }

    // Important note
    y = Math.max(y + 6, 240);
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(15, y, W - 30, 14, 3, 3, 'F');
    doc.setTextColor(146, 64, 14);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Important:', 20, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.text('This report is valid for 90 days and can be used for multiple loan applications within Creditze.', 20, y + 11, { maxWidth: W - 40 });

    // Footer
    doc.setFillColor(249, 250, 251);
    doc.rect(0, 280, W, 17, 'F');
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('© 2026 Creditze. All rights reserved. | support@creditze.ng', W / 2, 290, { align: 'center' });
    doc.text('This is a system-generated report. Please do not reply to this email.', W / 2, 294, { align: 'center' });

    return doc.output('arraybuffer');
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
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
        if (!testMode && !bvn) {
            return Response.json({ error: 'BVN is required' }, { status: 400 });
        }

        const existingSearch = await base44.asServiceRole.entities.CreditSearch.filter({ id: searchId });
        if (!existingSearch || existingSearch.length === 0) {
            return Response.json({ success: false, error: 'Search record not found' }, { status: 404 });
        }

        // ── Helper: upload PDF and send email ────────────────────────────────
        async function uploadPDFAndNotify({ score, crcData, expiryDate, isTestMode }) {
            const searchRecord = await base44.asServiceRole.entities.CreditSearch.filter({ id: searchId });
            if (!searchRecord[0]) return null;
            const userRecord = await base44.asServiceRole.entities.User.filter({ id: searchRecord[0].user_id });
            if (!userRecord[0]) return null;

            const reportDate = new Date().toLocaleDateString('en-NG');
            const expiryStr = expiryDate.toLocaleDateString('en-NG');

            const pdfBytes = generateCreditReportPDF({
                userName: userRecord[0].full_name || 'Valued Customer',
                score,
                searchId,
                reportDate,
                expiryDate: expiryStr,
                crcData,
                isTestMode
            });

            const pdfFile = new File([pdfBytes], `credit_report_${searchId}.pdf`, { type: 'application/pdf' });
            const { file_url } = await base44.integrations.Core.UploadFile({ file: pdfFile });

            await base44.asServiceRole.entities.CreditSearch.update(searchId, {
                report_url: file_url,
                report_emailed: true
            });

            const scoreRating = score >= 700 ? 'Excellent' : score >= 600 ? 'Good' : score >= 500 ? 'Fair' : 'Poor';
            const scoreColor = score >= 700 ? '#059669' : score >= 600 ? '#10b981' : score >= 500 ? '#f59e0b' : '#ef4444';

            await base44.integrations.Core.SendEmail({
                to: userRecord[0].email,
                subject: '✅ Your Credit Search Report - Creditze',
                body: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:20px;background:#f3f4f6;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#059669 0%,#047857 100%);padding:40px 30px;text-align:center;">
      <div style="background:white;width:60px;height:60px;border-radius:12px;margin:0 auto 20px;display:inline-flex;align-items:center;justify-content:center;">
        <span style="font-size:32px;font-weight:bold;color:#059669;">C</span>
      </div>
      <h1 style="color:white;margin:10px 0;font-size:26px;">Credit Search Complete</h1>
      <p style="color:#d1fae5;margin:0;font-size:13px;">${isTestMode ? 'TEST MODE — Mock Data' : 'Your Credit Report is Ready'}</p>
    </div>
    <div style="padding:36px 30px;">
      <p style="color:#374151;font-size:16px;margin:0 0 16px;">Dear ${userRecord[0].full_name},</p>
      <p style="color:#6b7280;line-height:1.6;margin:0 0 28px;">Your credit search has been successfully processed. Your detailed PDF report is attached — you can also download it from the button below.</p>

      <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);padding:24px;border-radius:12px;text-align:center;border:2px solid ${scoreColor};margin:0 0 28px;">
        <p style="color:#6b7280;margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Your Credit Score</p>
        <h2 style="color:${scoreColor};margin:0 0 8px;font-size:48px;font-weight:bold;">${score || 'N/A'}</h2>
        <p style="color:${scoreColor};margin:0;font-weight:600;font-size:16px;">${scoreRating} Credit Rating</p>
      </div>

      <div style="background:#f9fafb;padding:18px;border-radius:8px;margin:0 0 28px;">
        <h3 style="color:#1f2937;margin:0 0 12px;font-size:15px;">Report Details</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:7px 0;color:#6b7280;font-size:13px;">Report Date:</td><td style="padding:7px 0;color:#1f2937;font-weight:600;text-align:right;font-size:13px;">${reportDate}</td></tr>
          <tr><td style="padding:7px 0;color:#6b7280;font-size:13px;">Valid Until:</td><td style="padding:7px 0;color:#1f2937;font-weight:600;text-align:right;font-size:13px;">${expiryStr}</td></tr>
          <tr><td style="padding:7px 0;color:#6b7280;font-size:13px;">Report Type:</td><td style="padding:7px 0;color:#1f2937;font-weight:600;text-align:right;font-size:13px;">Basic Credit Report</td></tr>
        </table>
      </div>

      <div style="text-align:center;margin:0 0 28px;">
        <a href="${file_url}" style="display:inline-block;background:#059669;color:white;padding:14px 36px;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
          📄 Download PDF Report
        </a>
      </div>

      ${isTestMode ? `<div style="background:#fef3c7;padding:16px;border-radius:8px;margin:0 0 28px;border-left:4px solid #f59e0b;"><p style="color:#92400e;margin:0;font-size:13px;line-height:1.6;">⚠️ <strong>TEST MODE:</strong> This is a mock result for testing purposes only.</p></div>` : ''}

      <div style="background:linear-gradient(135deg,#1f2937,#374151);padding:22px;border-radius:12px;margin:0 0 28px;">
        <h3 style="color:white;margin:0 0 8px;font-size:17px;">Need a More Detailed Report?</h3>
        <p style="color:#d1d5db;margin:0 0 18px;font-size:13px;line-height:1.6;">Get the <strong>Premium Classic Consumer Report</strong> for comprehensive credit analysis and full account history.</p>
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <p style="color:white;margin:0;font-size:22px;font-weight:bold;">₦2,500</p>
          <a href="https://creditze.base44.app/PremiumReportPayment?search_id=${searchId}" style="background:white;color:#1f2937;padding:10px 22px;text-decoration:none;border-radius:8px;font-weight:600;font-size:13px;">Get Report</a>
        </div>
      </div>

      <div style="text-align:center;margin:0 0 28px;">
        <a href="https://creditze.base44.app/ApplyLoan" style="display:inline-block;background:#059669;color:white;padding:14px 40px;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;box-shadow:0 4px 6px rgba(5,150,105,0.3);">Apply for Loan Now →</a>
      </div>

      <div style="border-top:1px solid #e5e7eb;padding-top:16px;">
        <p style="color:#9ca3af;font-size:12px;line-height:1.6;margin:0;"><strong>Note:</strong> This report is valid for 90 days. Contact support@creditze.ng for assistance.</p>
      </div>
    </div>
    <div style="background:#f9fafb;padding:24px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="color:#6b7280;font-size:12px;margin:0 0 6px;">© 2026 Creditze. All rights reserved.</p>
      <p style="color:#9ca3af;font-size:11px;margin:0;">This is an automated email. Please do not reply directly.</p>
    </div>
  </div>
</body>
</html>`
            });

            return file_url;
        }

        // ── TEST MODE ─────────────────────────────────────────────────────────
        if (testMode === true) {
            console.log('=== TEST MODE: Using mock CRC data ===');
            const mockScore = 720;
            const mockCrcData = {
                ConsumerHitResponse: {
                    BODY: {
                        CONSUMER: { NAME: { FIRSTNAME: 'Test', LASTNAME: 'User' } },
                        CREDIT_SCORE_DETAILS: { CREDIT_SCORE_SUMMARY: { CREDIT_SCORE: mockScore, CREDIT_RATING: 'Excellent' } },
                        ACCOUNTLIST: [
                            { ACCOUNT: { '@ACCOUNT-TYPE': 'Credit Card', '@INSTITUTION': 'Test Bank Nigeria', '@BALANCE': '50000', '@STATUS': 'Active' } },
                            { ACCOUNT: { '@ACCOUNT-TYPE': 'Personal Loan', '@INSTITUTION': 'First Bank PLC', '@BALANCE': '120000', '@STATUS': 'Closed' } }
                        ]
                    }
                }
            };

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

            await uploadPDFAndNotify({ score: mockScore, crcData: mockCrcData, expiryDate, isTestMode: true });

            return Response.json({ success: true, responseType: 'single_hit', score: mockScore, testMode: true });
        }

        // ── LIVE MODE ─────────────────────────────────────────────────────────
        const CRC_USERNAME = Deno.env.get('CRC_USERNAME');
        const CRC_PASSWORD = Deno.env.get('CRC_PASSWORD');
        if (!CRC_USERNAME || !CRC_PASSWORD) {
            return Response.json({ error: 'CRC credentials not configured' }, { status: 500 });
        }

        const requestPayload = {
            Request: JSON.stringify({
                '@REQUEST_ID': '1',
                'REQUEST_PARAMETERS': {
                    'REPORT_PARAMETERS': { '@REPORT_ID': '101', '@SUBJECT_TYPE': '1', '@RESPONSE_TYPE': '5' },
                    'INQUIRY_REASON': { '@CODE': '1' },
                    'APPLICATION': { '@PRODUCT': '017', '@NUMBER': '232', '@AMOUNT': '15000', '@CURRENCY': 'NGN' }
                },
                'SEARCH_PARAMETERS': { '@SEARCH-TYPE': '4', 'BVN_NO': bvn }
            }).replace(/"/g, "'"),
            UserName: CRC_USERNAME,
            Password: CRC_PASSWORD
        };

        console.log('=== CRC API REQUEST ===', 'BVN:', bvn);

        const crcResponse = await fetch(
            'https://webserver.creditreferencenigeria.net/JsonLiveRequest/JsonService.svc/CIRRequest/ProcessRequestJson',
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestPayload) }
        );

        if (!crcResponse.ok) throw new Error(`CRC API error: ${crcResponse.status}`);
        const crcData = await crcResponse.json();
        console.log('=== CRC API RESPONSE ===', JSON.stringify(crcData, null, 2));

        if (crcData.ErrorResponse) {
            const errorCode = crcData.ErrorResponse.BODY?.ERRORLIST?.[0];
            const errorDesc = crcData.ErrorResponse.HEADER?.RESPONSETYPE?.DESCRIPTION || 'Unknown error';
            const errorMessages = {
                '36': 'BVN not found in credit bureau records.',
                '1': 'Invalid request format', '2': 'Authentication failed',
                '3': 'Service temporarily unavailable', '4': 'Invalid BVN format'
            };
            const userMessage = errorMessages[errorCode] || `Credit bureau error: ${errorDesc}`;
            await base44.asServiceRole.entities.CreditSearch.update(searchId, {
                search_date: new Date().toISOString(), search_status: 'unsuccessful',
                failure_reason: `CRC Error ${errorCode}: ${userMessage}`, bureau_response: crcData
            });
            return Response.json({ success: false, error: userMessage, errorCode, technicalDetails: errorDesc });
        }

        const consumerHit = crcData.ConsumerHitResponse;
        const consumerSearch = crcData.ConsumerSearchResultResponse;
        const responseCode = consumerSearch?.HEADER?.RESPONSETYPE?.CODE;

        // SCENARIO 1: Direct Hit
        if (consumerHit) {
            const score = consumerHit.BODY?.CREDIT_SCORE_DETAILS?.CREDIT_SCORE_SUMMARY?.CREDIT_SCORE || 0;
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 90);

            await base44.asServiceRole.entities.CreditSearch.update(searchId, {
                search_date: new Date().toISOString(), expiry_date: expiryDate.toISOString(),
                search_status: 'successful', bureau_score: score,
                crc_reference: 'direct_hit', bureau_response: crcData
            });

            await uploadPDFAndNotify({ score, crcData, expiryDate, isTestMode: false });
            return Response.json({ success: true, responseType: 'single_hit', score, fullReport: crcData });
        }

        // SCENARIO 2: No Hit
        if (responseCode === '2') {
            await base44.asServiceRole.entities.CreditSearch.update(searchId, {
                search_date: new Date().toISOString(), search_status: 'unsuccessful',
                failure_reason: 'No credit history found for this BVN'
            });
            return Response.json({ success: false, responseType: 'no_hit', message: 'No credit history found for this BVN' });
        }

        // SCENARIO 3: Multi Hit — merge
        if (responseCode === '3') {
            const referenceNo = crcData.ConsumerSearchResultResponse?.REFERENCENO;
            const searchResults = crcData.ConsumerSearchResultResponse?.BODY?.SEARCHRESULTLIST || [];
            if (!referenceNo || searchResults.length === 0) throw new Error('Invalid multi-hit response');

            const sortedResults = searchResults.sort((a, b) => parseInt(b.CONFIDENCESCORE || '0') - parseInt(a.CONFIDENCESCORE || '0'));
            const primaryBureauId = sortedResults[0].BUREAUID;
            const bureauIds = searchResults.map(r => r.BUREAUID);

            const mergePayload = {
                Request: JSON.stringify({
                    '@REQUEST_ID': '1',
                    'REQUEST_PARAMETERS': {
                        'APPLICATION': { '@AMOUNT': '15000', '@CURRENCY': 'NGN', '@NUMBER': searchId.toString(), '@PRODUCT': '017' },
                        'INQUIRY_REASON': { '@CODE': '1' },
                        'REPORT_PARAMETERS': { '@REPORT_ID': '101', '@RESPONSE_TYPE': '5', '@SUBJECT_TYPE': '1' },
                        'REQUEST_REFERENCE': {
                            '@REFERENCE-NO': referenceNo,
                            'MERGE_REPORT': { '@PRIMARY-BUREAU-ID': primaryBureauId, 'BUREAU_ID': bureauIds }
                        }
                    }
                }).replace(/"/g, "'"),
                UserName: CRC_USERNAME,
                Password: CRC_PASSWORD
            };

            const mergeResponse = await fetch(
                'https://webserver.creditreferencenigeria.net/JsonLiveRequest/JsonService.svc/CIRRequest/ProcessRequestJson',
                { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mergePayload) }
            );
            if (!mergeResponse.ok) throw new Error(`CRC merge API error: ${mergeResponse.status}`);
            const mergeData = await mergeResponse.json();
            const score = extractCreditScore(mergeData);
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 90);

            await base44.asServiceRole.entities.CreditSearch.update(searchId, {
                search_date: new Date().toISOString(), expiry_date: expiryDate.toISOString(),
                search_status: 'successful', bureau_score: score || 0,
                crc_reference: 'multi_hit_merged', bureau_response: mergeData
            });

            await uploadPDFAndNotify({ score, crcData: mergeData, expiryDate, isTestMode: false });
            return Response.json({ success: true, responseType: 'multi_hit_merged', score, matchedRecords: searchResults.length });
        }

        const errorMessage = crcData.ConsumerSearchResultResponse?.HEADER?.ERROR?.MESSAGE || crcData.error || 'Unknown error';
        await base44.asServiceRole.entities.CreditSearch.update(searchId, {
            search_date: new Date().toISOString(), search_status: 'unsuccessful',
            failure_reason: `CRC API Error: ${errorMessage} (Response Type: ${responseCode})`
        });
        return Response.json({ success: false, error: `CRC API returned unexpected response: ${errorMessage}`, responseCode });

    } catch (error) {
        console.error('Credit search error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});

function extractCreditScore(crcData) {
    try {
        return parseInt(
            crcData.ConsumerSearchResultResponse?.BODY?.SCORE?.['@SCORE'] ||
            crcData.ConsumerHitResponse?.BODY?.CREDIT_SCORE_DETAILS?.CREDIT_SCORE_SUMMARY?.CREDIT_SCORE ||
            crcData.CREDIT_SCORE_DETAILS?.CREDIT_SCORE_SUMMARY?.CREDIT_SCORE || 0
        ) || null;
    } catch (e) {
        return null;
    }
}