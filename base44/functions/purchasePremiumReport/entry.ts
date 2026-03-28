import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { jsPDF } from 'npm:jspdf@4.0.0';

const LOGO_URL = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69864d541609ebe758aa5d6d/ea48dae69_PHOTO-2026-02-05-09-26-23.jpg';
const CRC_ENDPOINT = 'https://webserver.creditreferencenigeria.net/JsonLiveRequest/JsonService.svc/CIRRequest/ProcessRequestJson';

async function fetchImageAsBase64(url) {
    try {
        const res = await fetch(url);
        const buf = await res.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    } catch (e) {
        return null;
    }
}

async function generatePremiumPDF({ userName, score, searchId, crcData, aiAdvice }) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210;
    let y = 0;

    // Header band
    doc.setFillColor(31, 41, 55);
    doc.rect(0, 0, W, 42, 'F');
    doc.setFillColor(5, 150, 105);
    doc.rect(0, 38, W, 4, 'F');

    const logoBase64 = await fetchImageAsBase64(LOGO_URL);
    if (logoBase64) {
        doc.addImage(logoBase64, 'JPEG', 10, 8, 50, 26);
    } else {
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('CREDITZE', 15, 27);
    }

    doc.setTextColor(209, 250, 229);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('PREMIUM CLASSIC CONSUMER REPORT', W - 10, 20, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text('Powered by CRC Credit Bureau', W - 10, 28, { align: 'right' });

    y = 54;

    // Greeting
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Dear ${userName},`, 15, y);
    y += 7;
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text('Your Premium Classic Consumer Report has been prepared from CRC Credit Bureau data.', 15, y, { maxWidth: W - 30 });
    y += 12;

    // Score card
    const scoreRating = score >= 700 ? 'Excellent' : score >= 600 ? 'Good' : score >= 500 ? 'Fair' : 'Poor';
    const scoreR = score >= 700 ? [5, 150, 105] : score >= 600 ? [16, 185, 129] : score >= 500 ? [245, 158, 11] : [239, 68, 68];

    doc.setFillColor(31, 41, 55);
    doc.roundedRect(15, y, W - 30, 40, 4, 4, 'F');
    doc.setTextColor(156, 163, 175);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('YOUR CREDIT SCORE', W / 2, y + 10, { align: 'center' });
    doc.setTextColor(...scoreR);
    doc.setFontSize(34);
    doc.setFont('helvetica', 'bold');
    doc.text(score ? score.toString() : 'N/A', W / 2, y + 26, { align: 'center' });
    doc.setFontSize(11);
    doc.text(scoreRating + ' Credit Rating', W / 2, y + 35, { align: 'center' });
    y += 48;

    // Report meta
    const now = new Date();
    const reportDate = now.toLocaleDateString('en-NG');

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, y, W - 30, 28, 3, 3, 'F');
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Report Details', 20, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const metaRows = [
        ['Report Type', 'Premium Classic Consumer Report'],
        ['Report Date', reportDate],
        ['Reference ID', searchId.substring(0, 20) + '...'],
    ];
    let my = y + 14;
    for (const [label, value] of metaRows) {
        doc.setTextColor(107, 114, 128);
        doc.text(label + ':', 20, my);
        doc.setTextColor(31, 41, 55);
        doc.setFont('helvetica', 'bold');
        doc.text(value, W - 20, my, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        my += 6;
    }
    y += 34;

    // Score Reason Codes
    const body = crcData?.ConsumerHitResponse?.BODY || crcData?.ConsumerSearchResultResponse?.BODY || {};
    const scoreDetails = body?.CREDIT_SCORE_DETAILS?.CREDIT_SCORE_SUMMARY;
    if (scoreDetails) {
        y += 4;
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Credit Score Breakdown', 15, y);
        y += 6;
        const reasons = [scoreDetails.REASON_CODE1, scoreDetails.REASON_CODE2, scoreDetails.REASON_CODE3, scoreDetails.REASON_CODE4].filter(Boolean);
        for (const reason of reasons) {
            doc.setFillColor(254, 243, 199);
            doc.roundedRect(15, y, W - 30, 10, 2, 2, 'F');
            doc.setTextColor(146, 64, 14);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text('• ' + reason, 19, y + 6.5, { maxWidth: W - 38 });
            y += 12;
        }
        y += 2;
    }

    // Account Classification summary
    const classifications = body?.ClassificationInsType;
    const classArr = classifications ? (Array.isArray(classifications) ? classifications : [classifications]) : [];
    if (classArr.length > 0 && classArr[0]?.INSTITUTION_TYPE) {
        y += 2;
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Account Classification by Institution Type', 15, y);
        y += 6;

        doc.setFillColor(31, 41, 55);
        doc.rect(15, y, W - 30, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7.5);
        doc.text('Institution Type', 19, y + 5.5);
        doc.text('Accounts', 90, y + 5.5);
        doc.text('Sanctioned (NGN)', 115, y + 5.5);
        doc.text('Outstanding', 165, y + 5.5);
        y += 8;

        let alt = false;
        for (const cls of classArr) {
            if (!cls.INSTITUTION_TYPE) continue;
            if (alt) { doc.setFillColor(248, 250, 252); doc.rect(15, y, W - 30, 7, 'F'); }
            doc.setTextColor(55, 65, 81);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text((cls.INSTITUTION_TYPE || '').substring(0, 25), 19, y + 5);
            doc.text((cls.NO_OF_ACCOUNTS || '0').toString(), 90, y + 5);
            doc.text((cls.APPROVED_CREDIT_SANCTIONED || '0').toString().trim().substring(0, 20), 115, y + 5);
            doc.text((cls.OUSTANDING_BALANCE || '0').toString().trim().substring(0, 16), 165, y + 5);
            y += 7;
            alt = !alt;
        }
        y += 4;
    }

    // Individual Accounts
    const accounts = body?.ACCOUNTLIST || [];
    const accountArr = Array.isArray(accounts) ? accounts : [accounts];
    if (accountArr.length > 0 && accountArr[0]?.ACCOUNT) {
        if (y > 220) { doc.addPage(); y = 20; }
        y += 2;
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Individual Account Details', 15, y);
        y += 6;

        doc.setFillColor(5, 150, 105);
        doc.rect(15, y, W - 30, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7.5);
        doc.text('Institution', 19, y + 5.5);
        doc.text('Type', 75, y + 5.5);
        doc.text('Balance (₦)', 115, y + 5.5);
        doc.text('Overdue (₦)', 145, y + 5.5);
        doc.text('Status', 178, y + 5.5);
        y += 8;

        let rowAlt = false;
        for (const item of accountArr.slice(0, 15)) {
            const acc = item.ACCOUNT || {};
            if (y > 270) { doc.addPage(); y = 20; }
            if (rowAlt) { doc.setFillColor(243, 244, 246); doc.rect(15, y, W - 30, 7, 'F'); }
            doc.setTextColor(55, 65, 81);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.text((acc['@INSTITUTION'] || 'N/A').substring(0, 22), 19, y + 5);
            doc.text((acc['@ACCOUNT-TYPE'] || 'N/A').substring(0, 16), 75, y + 5);
            const bal = acc['@BALANCE'] ? Number(String(acc['@BALANCE']).replace(/,/g, '')).toLocaleString('en-NG') : 'N/A';
            const overdue = acc['@OVERDUE-AMOUNT'] ? Number(String(acc['@OVERDUE-AMOUNT']).replace(/,/g, '')).toLocaleString('en-NG') : '0';
            doc.text(bal, 115, y + 5);
            doc.text(overdue, 145, y + 5);
            const status = acc['@STATUS'] || 'N/A';
            doc.setTextColor(status.toLowerCase().includes('active') ? 5 : 239, status.toLowerCase().includes('active') ? 150 : 68, status.toLowerCase().includes('active') ? 105 : 68);
            doc.text(status.substring(0, 10), 178, y + 5);
            doc.setTextColor(55, 65, 81);
            y += 7;
            rowAlt = !rowAlt;
        }
        y += 4;
    }

    // Consumer info
    const consumer = body?.CONSUMER;
    if (consumer) {
        if (y > 240) { doc.addPage(); y = 20; }
        y += 2;
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Consumer Information', 15, y);
        y += 6;

        const infoRows = [];
        const name = consumer?.NAME;
        if (name) {
            const fullName = [name.FIRSTNAME, name.MIDDLENAME, name.LASTNAME].filter(Boolean).join(' ');
            if (fullName) infoRows.push(['Full Name', fullName]);
        }
        if (consumer?.DATE_OF_BIRTH || consumer?.DOB) infoRows.push(['Date of Birth', consumer.DATE_OF_BIRTH || consumer.DOB]);
        if (consumer?.GENDER) infoRows.push(['Gender', consumer.GENDER]);

        doc.setFontSize(9);
        for (const [label, value] of infoRows) {
            doc.setTextColor(107, 114, 128);
            doc.setFont('helvetica', 'normal');
            doc.text(label + ':', 20, y);
            doc.setTextColor(31, 41, 55);
            doc.setFont('helvetica', 'bold');
            doc.text(value || 'N/A', 80, y);
            y += 6;
        }
        y += 4;
    }

    // AI Credit Improvement Advice
    if (aiAdvice) {
        if (y > 210) { doc.addPage(); y = 20; }
        y += 4;
        doc.setFillColor(5, 150, 105);
        doc.roundedRect(15, y, W - 30, 8, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('🎯  Personalised Credit Improvement Advice', W / 2, y + 5.5, { align: 'center' });
        y += 12;

        doc.setTextColor(55, 65, 81);
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        const adviceLines = doc.splitTextToSize(aiAdvice, W - 34);
        for (const line of adviceLines) {
            if (y > 272) { doc.addPage(); y = 20; }
            doc.text(line, 18, y);
            y += 5.5;
        }
        y += 4;
    }

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(249, 250, 251);
        doc.rect(0, 283, W, 14, 'F');
        doc.setTextColor(107, 114, 128);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.text('© 2026 Creditze. Premium Report — Confidential | support@creditze.ng', W / 2, 289, { align: 'center' });
        doc.text(`Page ${i} of ${pageCount}`, W / 2, 293, { align: 'center' });
    }

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

        const { reference, search_id } = await req.json();

        if (!reference || !search_id) {
            return Response.json({ success: false, error: 'Payment reference and search_id are required' }, { status: 400 });
        }

        // 1. Verify payment
        const verifyResponse = await base44.functions.invoke('paystackVerifyPayment', { reference });
        if (!verifyResponse.data.success || verifyResponse.data.status !== 'success') {
            return Response.json({ success: false, error: 'Payment verification failed' }, { status: 400 });
        }

        // Amount check is optional — skip if data structure is different
        const paymentAmount = verifyResponse.data?.data?.amount ?? verifyResponse.data?.amount;
        if (paymentAmount !== undefined && paymentAmount < 250000) {
            return Response.json({ success: false, error: 'Insufficient payment amount' }, { status: 400 });
        }

        // 2. Get KYC for BVN
        const kycProfiles = await base44.entities.KYCProfile.filter({ user_id: user.id });
        if (!kycProfiles || kycProfiles.length === 0 || !kycProfiles[0].bvn) {
            return Response.json({ success: false, error: 'BVN not found. Please complete KYC first.' }, { status: 400 });
        }
        const bvn = kycProfiles[0].bvn;

        // 3. Fetch CRC report using BVN
        const CRC_USERNAME = Deno.env.get('CRC_USERNAME');
        const CRC_PASSWORD = Deno.env.get('CRC_PASSWORD');
        if (!CRC_USERNAME || !CRC_PASSWORD) {
            return Response.json({ success: false, error: 'CRC credentials not configured' }, { status: 500 });
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

        console.log('=== PREMIUM CRC REQUEST === BVN:', bvn);
        const crcResponse = await fetch(CRC_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestPayload)
        });
        if (!crcResponse.ok) throw new Error(`CRC API error: ${crcResponse.status}`);
        const crcData = await crcResponse.json();

        if (crcData.ErrorResponse) {
            const errDesc = crcData.ErrorResponse.HEADER?.RESPONSETYPE?.DESCRIPTION || 'Unknown CRC error';
            return Response.json({ success: false, error: `Credit bureau error: ${errDesc}` }, { status: 400 });
        }

        // Extract score
        const body = crcData?.ConsumerHitResponse?.BODY || {};
        const score = body?.CREDIT_SCORE_DETAILS?.CREDIT_SCORE_SUMMARY?.CREDIT_SCORE || 0;
        const scoreRating = score >= 700 ? 'Excellent' : score >= 600 ? 'Good' : score >= 500 ? 'Fair' : 'Poor';
        const reasonCodes = [
            body?.CREDIT_SCORE_DETAILS?.CREDIT_SCORE_SUMMARY?.REASON_CODE1,
            body?.CREDIT_SCORE_DETAILS?.CREDIT_SCORE_SUMMARY?.REASON_CODE2,
            body?.CREDIT_SCORE_DETAILS?.CREDIT_SCORE_SUMMARY?.REASON_CODE3,
            body?.CREDIT_SCORE_DETAILS?.CREDIT_SCORE_SUMMARY?.REASON_CODE4
        ].filter(Boolean);

        // 4. Get AI advice
        let aiAdvice = '';
        try {
            const accounts = body?.ACCOUNTLIST || [];
            const accountArr = Array.isArray(accounts) ? accounts : [accounts];
            const accountSummary = accountArr.slice(0, 5).map(a => {
                const acc = a.ACCOUNT || {};
                return `${acc['@INSTITUTION'] || ''} - ${acc['@ACCOUNT-TYPE'] || ''}, Balance: ${acc['@BALANCE'] || '0'}, Status: ${acc['@STATUS'] || 'Unknown'}`;
            }).join('\n');

            const aiResult = await base44.integrations.Core.InvokeLLM({
                prompt: `You are a Nigerian financial advisor helping someone understand and improve their credit score ethically.

The user's credit profile:
- Credit Score: ${score} (${scoreRating})
- Reason Codes from Bureau:
${reasonCodes.map(r => '  • ' + r).join('\n') || '  • No specific reason codes provided'}
- Account summary (up to 5):
${accountSummary || 'No account data available'}

Write 5-7 specific, practical, ethical, and disciplined tips to help this person improve their credit score. 
Focus on Nigerian financial context (banks, loans, repayment culture).
Be direct, encouraging, and non-judgmental. Use plain paragraphs (no markdown). 
Start with "Here are personalised steps to improve your credit score:"`,
                response_json_schema: null
            });
            aiAdvice = aiResult || '';
        } catch (e) {
            console.error('AI advice error:', e);
            aiAdvice = 'To improve your credit score: pay all loans on time, keep your outstanding balances low, avoid multiple loan applications at once, maintain your bank account in good standing, and build a consistent repayment history over time.';
        }

        // 5. Generate premium PDF
        const pdfBytes = await generatePremiumPDF({
            userName: user.full_name || 'Valued Customer',
            score,
            searchId: search_id,
            crcData,
            aiAdvice
        });

        const pdfFile = new File([pdfBytes], `premium_report_${search_id}.pdf`, { type: 'application/pdf' });
        const { file_url } = await base44.integrations.Core.UploadFile({ file: pdfFile });

        // 6. Send email
        const scoreColor = score >= 700 ? '#059669' : score >= 600 ? '#10b981' : score >= 500 ? '#f59e0b' : '#ef4444';
        await base44.integrations.Core.SendEmail({
            to: user.email,
            subject: '⭐ Your Premium Credit Report is Ready — Creditze',
            body: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:20px;background:#f3f4f6;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#1f2937 0%,#374151 100%);padding:40px 30px;text-align:center;border-bottom:4px solid #059669;">
      <h1 style="color:white;margin:0 0 8px;font-size:26px;">Premium Credit Report</h1>
      <p style="color:#d1d5db;margin:0;font-size:13px;">Classic Consumer Report — Creditze</p>
    </div>
    <div style="padding:36px 30px;">
      <p style="color:#374151;font-size:16px;margin:0 0 16px;">Dear ${user.full_name || 'Valued Customer'},</p>
      <p style="color:#6b7280;line-height:1.6;margin:0 0 28px;">Your <strong>Premium Classic Consumer Report</strong> is ready. It includes your full credit history, account details, score breakdown, and personalised AI-powered advice to help you improve your score.</p>

      <div style="background:#1f2937;padding:24px;border-radius:12px;text-align:center;margin:0 0 28px;">
        <p style="color:#9ca3af;margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Your Credit Score</p>
        <h2 style="color:${scoreColor};margin:0 0 8px;font-size:48px;font-weight:bold;">${score || 'N/A'}</h2>
        <p style="color:${scoreColor};margin:0;font-weight:600;font-size:16px;">${scoreRating} Credit Rating</p>
      </div>

      <div style="text-align:center;margin:0 0 28px;">
        <a href="${file_url}" style="display:inline-block;background:#1f2937;color:white;padding:16px 40px;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
          📄 Download Premium Report
        </a>
      </div>

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:20px;border-radius:10px;margin:0 0 28px;">
        <h3 style="color:#1f2937;margin:0 0 10px;font-size:15px;">🎯 Your Personalised Credit Advice</h3>
        <p style="color:#374151;font-size:13px;line-height:1.7;margin:0;white-space:pre-line;">${aiAdvice}</p>
      </div>

      <div style="background:#fef3c7;padding:16px;border-radius:8px;margin:0 0 28px;border-left:4px solid #f59e0b;">
        <p style="color:#92400e;margin:0;font-size:13px;line-height:1.6;"><strong>Important:</strong> This report contains sensitive financial information. Keep it secure and do not share with unauthorised parties.</p>
      </div>

      <div style="text-align:center;margin:0 0 20px;">
        <a href="https://creditze.base44.app/ApplyLoan" style="display:inline-block;background:#059669;color:white;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Apply for a Loan Now →</a>
      </div>

      <div style="border-top:1px solid #e5e7eb;padding-top:16px;">
        <p style="color:#9ca3af;font-size:12px;line-height:1.6;margin:0;">Questions? Contact us at support@creditze.ng | Payment Ref: ${reference}</p>
      </div>
    </div>
    <div style="background:#f9fafb;padding:20px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="color:#6b7280;font-size:12px;margin:0 0 4px;">© 2026 Creditze. All rights reserved.</p>
      <p style="color:#9ca3af;font-size:11px;margin:0;">This is an automated email. Please do not reply directly.</p>
    </div>
  </div>
</body>
</html>`
        });

        return Response.json({
            success: true,
            message: 'Premium report purchased successfully',
            report_url: file_url,
            score,
            ai_advice: aiAdvice
        });

    } catch (error) {
        console.error('Premium report purchase error:', error);
        return Response.json({ success: false, error: error.message || 'Failed to process premium report' }, { status: 500 });
    }
});