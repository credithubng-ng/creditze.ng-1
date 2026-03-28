import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { jsPDF } from 'npm:jspdf@4.0.0';

const LOGO_URL = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69864d541609ebe758aa5d6d/ea48dae69_PHOTO-2026-02-05-09-26-23.jpg';

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

function addPageIfNeeded(doc, y, W) {
    if (y > 265) {
        doc.addPage();
        return 20;
    }
    return y;
}

async function generatePremiumPDF({ userName, score, searchId, reportDate, crcData }) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210;
    let y = 0;

    // Header band
    doc.setFillColor(5, 150, 105);
    doc.rect(0, 0, W, 42, 'F');

    const logoBase64 = await fetchImageAsBase64(LOGO_URL);
    if (logoBase64) {
        doc.addImage(logoBase64, 'JPEG', 10, 8, 50, 26);
    } else {
        doc.setFillColor(255, 255, 255);
        doc.circle(20, 21, 9, 'F');
        doc.setTextColor(5, 150, 105);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('C', 17.5, 25);
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.text('CREDITZE', 35, 18);
    }

    doc.setTextColor(209, 250, 229);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Premium Classic Consumer Report', W - 10, 20, { align: 'right' });
    doc.text('Powered by CRC Credit Bureau', W - 10, 28, { align: 'right' });

    y = 54;

    // Greeting
    doc.setTextColor(55, 65, 81);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Dear ${userName},`, 15, y);
    y += 7;
    doc.setFontSize(9.5);
    doc.setTextColor(107, 114, 128);
    doc.text('Your Premium Classic Consumer Credit Report has been successfully generated.', 15, y, { maxWidth: W - 30 });
    y += 12;

    // Score card
    const scoreNum = parseInt(score) || 0;
    const scoreRating = scoreNum >= 700 ? 'Excellent' : scoreNum >= 600 ? 'Good' : scoreNum >= 500 ? 'Fair' : 'Poor';
    const scoreR = scoreNum >= 700 ? [5,150,105] : scoreNum >= 600 ? [16,185,129] : scoreNum >= 500 ? [245,158,11] : [239,68,68];
    doc.setFillColor(...scoreR.map(c => Math.round(c * 0.12 + 243)));
    doc.roundedRect(15, y, W - 30, 36, 4, 4, 'F');
    doc.setDrawColor(...scoreR);
    doc.setLineWidth(0.8);
    doc.roundedRect(15, y, W - 30, 36, 4, 4, 'S');
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('CREDIT SCORE', W / 2, y + 9, { align: 'center' });
    doc.setTextColor(...scoreR);
    doc.setFontSize(32);
    doc.setFont('helvetica', 'bold');
    doc.text(scoreNum ? scoreNum.toString() : 'N/A', W / 2, y + 23, { align: 'center' });
    doc.setFontSize(10);
    doc.text(scoreRating + ' Credit Rating', W / 2, y + 31, { align: 'center' });
    y += 44;

    // Report details box
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(15, y, W - 30, 30, 3, 3, 'F');
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Report Details', 20, y + 8);
    const details = [
        ['Report Type', 'Premium Classic Consumer Report'],
        ['Report Date', reportDate],
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
    y += 38;

    const body = crcData?.ConsumerHitResponse?.BODY || crcData?.ConsumerSearchResultResponse?.BODY || {};

    // ── Consumer Information ──────────────────────────────────────────────────
    const consumer = body?.CONSUMER;
    if (consumer) {
        y = addPageIfNeeded(doc, y, W);
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Consumer Information', 15, y);
        y += 2;
        doc.setDrawColor(5, 150, 105);
        doc.setLineWidth(0.5);
        doc.line(15, y, W - 15, y);
        y += 6;

        const name = consumer?.NAME;
        const fields = [];
        if (name) {
            const fullName = [name.FIRSTNAME, name.MIDDLENAME, name.LASTNAME].filter(Boolean).join(' ');
            if (fullName) fields.push(['Full Name', fullName]);
        }
        const dob = consumer?.DATE_OF_BIRTH || consumer?.DOB;
        if (dob) fields.push(['Date of Birth', dob]);
        const gender = consumer?.GENDER;
        if (gender) fields.push(['Gender', gender]);
        const addresses = consumer?.ADDRESSES?.ADDRESS;
        if (addresses) {
            const addr = Array.isArray(addresses) ? addresses[0] : addresses;
            const addrStr = [addr?.STREET_NAME, addr?.CITY, addr?.STATE].filter(Boolean).join(', ');
            if (addrStr) fields.push(['Address', addrStr]);
        }

        doc.setFontSize(9);
        for (const [label, value] of fields) {
            y = addPageIfNeeded(doc, y, W);
            doc.setTextColor(107, 114, 128);
            doc.setFont('helvetica', 'normal');
            doc.text(label + ':', 15, y);
            doc.setTextColor(31, 41, 55);
            doc.setFont('helvetica', 'bold');
            doc.text(String(value), 70, y);
            doc.setFont('helvetica', 'normal');
            y += 6;
        }
        y += 4;
    }

    // ── Credit Score Reason Codes ─────────────────────────────────────────────
    const scoreDetails = body?.CREDIT_SCORE_DETAILS?.CREDIT_SCORE_SUMMARY;
    if (scoreDetails) {
        y = addPageIfNeeded(doc, y, W);
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Credit Score Analysis', 15, y);
        y += 2;
        doc.setDrawColor(5, 150, 105);
        doc.setLineWidth(0.5);
        doc.line(15, y, W - 15, y);
        y += 6;

        doc.setFontSize(9);
        const reasons = [scoreDetails.REASON_CODE1, scoreDetails.REASON_CODE2, scoreDetails.REASON_CODE3, scoreDetails.REASON_CODE4].filter(Boolean);
        for (let i = 0; i < reasons.length; i++) {
            y = addPageIfNeeded(doc, y, W);
            doc.setTextColor(107, 114, 128);
            doc.setFont('helvetica', 'normal');
            doc.text(`• ${reasons[i]}`, 18, y, { maxWidth: W - 36 });
            const lineCount = Math.ceil(reasons[i].length / 90);
            y += 5 * lineCount + 1;
        }
        y += 4;
    }

    // ── Account Summary Classification ────────────────────────────────────────
    const classifications = body?.ClassificationInsType || body?.ClassificationProdType;
    const classArr = classifications ? (Array.isArray(classifications) ? classifications : [classifications]) : [];
    if (classArr.length > 0) {
        y = addPageIfNeeded(doc, y, W);
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Portfolio Summary', 15, y);
        y += 2;
        doc.setDrawColor(5, 150, 105);
        doc.setLineWidth(0.5);
        doc.line(15, y, W - 15, y);
        y += 4;

        doc.setFillColor(5, 150, 105);
        doc.rect(15, y, W - 30, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.text('Type', 18, y + 5.5);
        doc.text('# Accounts', 80, y + 5.5);
        doc.text('Outstanding (₦)', 115, y + 5.5);
        doc.text('Overdue (₦)', 165, y + 5.5);
        y += 8;

        let alt = false;
        for (const row of classArr) {
            y = addPageIfNeeded(doc, y, W);
            if (alt) { doc.setFillColor(243, 244, 246); doc.rect(15, y, W - 30, 7, 'F'); }
            doc.setTextColor(55, 65, 81);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            const type = (row.INSTITUTION_TYPE || row.PRODUCT_TYPE || 'N/A').substring(0, 25);
            doc.text(type, 18, y + 5);
            doc.text(String(row.NO_OF_ACCOUNTS || '0'), 80, y + 5);
            const bal = (row.OUSTANDING_BALANCE || row.TOTAL_OUTSTANDING_BALANCE || '0').toString().trim();
            doc.text(bal.substring(0, 20), 115, y + 5);
            const od = (row.AMOUNT_OVERDUE || '0').toString().trim();
            doc.text(od.substring(0, 18), 165, y + 5);
            y += 7;
            alt = !alt;
        }
        y += 6;
    }

    // ── Account List ──────────────────────────────────────────────────────────
    const accounts = body?.ACCOUNTLIST || [];
    const accountArr = Array.isArray(accounts) ? accounts : [accounts];
    const validAccounts = accountArr.filter(a => a?.ACCOUNT);

    if (validAccounts.length > 0) {
        y = addPageIfNeeded(doc, y, W);
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Account Details', 15, y);
        y += 2;
        doc.setDrawColor(5, 150, 105);
        doc.setLineWidth(0.5);
        doc.line(15, y, W - 15, y);
        y += 4;

        doc.setFillColor(5, 150, 105);
        doc.rect(15, y, W - 30, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.text('Institution', 18, y + 5.5);
        doc.text('Type', 72, y + 5.5);
        doc.text('Balance (₦)', 115, y + 5.5);
        doc.text('Opened', 150, y + 5.5);
        doc.text('Status', 178, y + 5.5);
        y += 8;

        let rowAlt = false;
        for (const item of validAccounts.slice(0, 20)) {
            const acc = item.ACCOUNT || {};
            y = addPageIfNeeded(doc, y, W);
            if (rowAlt) { doc.setFillColor(243, 244, 246); doc.rect(15, y, W - 30, 7, 'F'); }
            doc.setTextColor(55, 65, 81);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.text((acc['@INSTITUTION'] || 'N/A').substring(0, 20), 18, y + 5);
            doc.text((acc['@ACCOUNT-TYPE'] || 'N/A').substring(0, 16), 72, y + 5);
            const bal = acc['@BALANCE'] ? Number(acc['@BALANCE'].toString().trim()).toLocaleString('en-NG') : 'N/A';
            doc.text(bal.substring(0, 14), 115, y + 5);
            const opened = acc['@DATE-OPENED'] || acc['@OPEN-DATE'] || 'N/A';
            doc.text(opened.substring(0, 10), 150, y + 5);
            const status = acc['@STATUS'] || 'N/A';
            const statusColor = status.toLowerCase().includes('active') ? [5,150,105] : [107,114,128];
            doc.setTextColor(...statusColor);
            doc.setFont('helvetica', 'bold');
            doc.text(status.substring(0, 10), 178, y + 5);
            doc.setTextColor(55, 65, 81);
            doc.setFont('helvetica', 'normal');
            y += 7;
            rowAlt = !rowAlt;
        }
        y += 6;
    }

    // ── Inquiry History ───────────────────────────────────────────────────────
    const inquiries = body?.INQUIRIES?.INQUIRY || body?.INQUIRY_HISTORY?.INQUIRY;
    const inquiryArr = inquiries ? (Array.isArray(inquiries) ? inquiries : [inquiries]) : [];
    if (inquiryArr.length > 0) {
        y = addPageIfNeeded(doc, y, W);
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Inquiry History', 15, y);
        y += 2;
        doc.setDrawColor(5, 150, 105);
        doc.setLineWidth(0.5);
        doc.line(15, y, W - 15, y);
        y += 4;

        doc.setFillColor(5, 150, 105);
        doc.rect(15, y, W - 30, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.text('Institution', 18, y + 5.5);
        doc.text('Date', 120, y + 5.5);
        doc.text('Purpose', 155, y + 5.5);
        y += 8;

        let iAlt = false;
        for (const inq of inquiryArr.slice(0, 15)) {
            y = addPageIfNeeded(doc, y, W);
            if (iAlt) { doc.setFillColor(243, 244, 246); doc.rect(15, y, W - 30, 7, 'F'); }
            doc.setTextColor(55, 65, 81);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text((inq['@INSTITUTION'] || inq.INSTITUTION || 'N/A').substring(0, 30), 18, y + 5);
            doc.text((inq['@DATE'] || inq.DATE || 'N/A').substring(0, 12), 120, y + 5);
            doc.text((inq['@PURPOSE'] || inq.PURPOSE || 'Credit').substring(0, 16), 155, y + 5);
            y += 7;
            iAlt = !iAlt;
        }
        y += 6;
    }

    // Footer on last page
    const pageCount = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFillColor(249, 250, 251);
        doc.rect(0, 280, W, 17, 'F');
        doc.setTextColor(107, 114, 128);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`Page ${p} of ${pageCount}  |  Premium Classic Consumer Report  |  © 2026 Creditze`, W / 2, 288, { align: 'center' });
        doc.text('support@creditze.ng  |  This is a system-generated report.', W / 2, 293, { align: 'center' });
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

        const { reference, search_id, testMode, bvn: overrideBvn, email: overrideEmail } = await req.json();

        if (!reference) {
            return Response.json({ success: false, error: 'Payment reference is required' }, { status: 400 });
        }

        // Skip payment verification in test mode
        if (!testMode) {
            const verifyResponse = await base44.functions.invoke('paystackVerifyPayment', { reference });
            if (!verifyResponse.data.success) {
                return Response.json({ success: false, error: 'Payment verification failed' }, { status: 400 });
            }
            const paymentData = verifyResponse.data.data;
            if (paymentData.amount < 250000) {
                return Response.json({ success: false, error: 'Insufficient payment amount' }, { status: 400 });
            }
        }

        // Get KYC for BVN
        let bvnToUse = overrideBvn;
        if (!bvnToUse) {
            const kycProfiles = await base44.entities.KYCProfile.filter({ user_id: user.id });
            if (!kycProfiles || kycProfiles.length === 0) {
                return Response.json({ success: false, error: 'KYC profile not found' }, { status: 400 });
            }
            bvnToUse = kycProfiles[0].bvn;
        }
        if (!bvnToUse) {
            return Response.json({ success: false, error: 'BVN not found' }, { status: 400 });
        }
        const emailToUse = overrideEmail || user.email;

        // Call CRC with REPORT_ID 104 (Classic Consumer Report)
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
                'SEARCH_PARAMETERS': { '@SEARCH-TYPE': '4', 'BVN_NO': bvnToUse }
            }).replace(/"/g, "'"),
            UserName: CRC_USERNAME,
            Password: CRC_PASSWORD
        };

        console.log('=== CRC PREMIUM REQUEST === BVN:', bvnToUse);

        const crcResponse = await fetch(
            'https://webserver.creditreferencenigeria.net/JsonLiveRequest/JsonService.svc/CIRRequest/ProcessRequestJson',
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestPayload) }
        );

        if (!crcResponse.ok) throw new Error(`CRC API error: ${crcResponse.status}`);
        const crcData = await crcResponse.json();
        console.log('=== CRC PREMIUM RESPONSE ===', JSON.stringify(crcData).substring(0, 2000));

        if (crcData.ErrorResponse) {
            const errorDesc = crcData.ErrorResponse.HEADER?.RESPONSETYPE?.DESCRIPTION || 'Credit bureau error';
            const errorBody = JSON.stringify(crcData.ErrorResponse.BODY || {});
            console.log('=== CRC ERROR BODY ===', errorBody);
            return Response.json({ success: false, error: errorDesc, detail: crcData.ErrorResponse }, { status: 400 });
        }

        const body = crcData?.ConsumerHitResponse?.BODY || crcData?.ConsumerSearchResultResponse?.BODY || {};
        const score = body?.CREDIT_SCORE_DETAILS?.CREDIT_SCORE_SUMMARY?.CREDIT_SCORE || 0;

        // Generate premium PDF
        const reportDate = new Date().toLocaleDateString('en-NG');
        const pdfBytes = await generatePremiumPDF({
            userName: user.full_name || 'Valued Customer',
            score,
            searchId: search_id || reference,
            reportDate,
            crcData
        });

        const pdfFile = new File([pdfBytes], `premium_report_${reference}.pdf`, { type: 'application/pdf' });
        const { file_url } = await base44.integrations.Core.UploadFile({ file: pdfFile });

        // Send email
        await base44.integrations.Core.SendEmail({
            to: emailToUse,
            subject: '📄 Your Premium Classic Consumer Report — Creditze',
            body: `
<!DOCTYPE html><html><body style="margin:0;padding:20px;background:#f3f4f6;font-family:'Segoe UI',sans-serif;">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
  <div style="background:linear-gradient(135deg,#059669,#047857);padding:40px 30px;text-align:center;">
    <h1 style="color:white;margin:0;font-size:26px;">Premium Report Ready</h1>
    <p style="color:#d1fae5;margin:8px 0 0;font-size:13px;">Classic Consumer Credit Report</p>
  </div>
  <div style="padding:36px 30px;">
    <p style="color:#374151;font-size:16px;margin:0 0 16px;">Dear ${user.full_name || 'Customer'},</p>
    <p style="color:#6b7280;line-height:1.6;margin:0 0 28px;">Your <strong>Premium Classic Consumer Report</strong> is ready. Download it below.</p>
    <div style="text-align:center;margin:0 0 28px;">
      <a href="${file_url}" style="display:inline-block;background:#059669;color:white;padding:14px 40px;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">📄 Download Premium Report</a>
    </div>
    <div style="background:#f9fafb;padding:18px;border-radius:8px;margin:0 0 28px;">
      <p style="color:#6b7280;margin:0 0 8px;font-size:13px;">Payment Reference: <strong>${reference}</strong></p>
      <p style="color:#6b7280;margin:0;font-size:13px;">Amount Paid: <strong>₦2,500</strong></p>
    </div>
    <div style="border-top:1px solid #e5e7eb;padding-top:16px;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">Questions? Contact support@creditze.ng</p>
    </div>
  </div>
  <div style="background:#f9fafb;padding:20px;text-align:center;border-top:1px solid #e5e7eb;">
    <p style="color:#9ca3af;font-size:11px;margin:0;">© 2026 Creditze. All rights reserved.</p>
  </div>
</div>
</body></html>`
        });

        return Response.json({
            success: true,
            message: 'Premium report generated successfully',
            report_url: file_url
        });

    } catch (error) {
        console.error('Premium report error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});