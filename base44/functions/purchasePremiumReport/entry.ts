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

    // Consumer info — pulled from ConsCommDetails_Subject
    const consumerSubject = body?.ConsCommDetails?.ConsCommDetails_Subject;
    if (consumerSubject) {
        if (y > 240) { doc.addPage(); y = 20; }
        y += 2;
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Consumer Information', 15, y);
        y += 6;

        const infoRows = [];
        if (consumerSubject.NAME) infoRows.push(['Full Name', consumerSubject.NAME]);
        if (consumerSubject.DATE_OF_BIRTH) infoRows.push(['Date of Birth', consumerSubject.DATE_OF_BIRTH]);
        if (consumerSubject.GENDER) infoRows.push(['Gender', consumerSubject.GENDER]);
        if (consumerSubject.NATIONALITY) infoRows.push(['Nationality', consumerSubject.NATIONALITY]);
        if (consumerSubject.PHONE_NO1) infoRows.push(['Phone', consumerSubject.PHONE_NO1]);

        doc.setFontSize(9);
        for (const [label, value] of infoRows) {
            doc.setTextColor(107, 114, 128);
            doc.setFont('helvetica', 'normal');
            doc.text(label + ':', 20, y);
            doc.setTextColor(31, 41, 55);
            doc.setFont('helvetica', 'bold');
            doc.text(String(value || 'N/A'), 80, y);
            y += 6;
        }
        y += 4;
    }

    // Product Type Classification
    const prodTypes = body?.ClassificationProdType;
    const prodArr = Array.isArray(prodTypes) ? prodTypes : (prodTypes ? [prodTypes] : []);
    if (prodArr.length > 0) {
        if (y > 230) { doc.addPage(); y = 20; }
        y += 4;
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Account Classification by Product Type', 15, y);
        y += 6;

        doc.setFillColor(31, 41, 55);
        doc.rect(15, y, W - 30, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7.5);
        doc.text('Product Type', 19, y + 5.5);
        doc.text('Accounts', 80, y + 5.5);
        doc.text('Active (6mo)', 110, y + 5.5);
        doc.text('Sanctioned (₦)', 140, y + 5.5);
        doc.text('Outstanding (₦)', 175, y + 5.5);
        y += 8;

        let pAlt = false;
        for (const p of prodArr) {
            if (!p.PRODUCT_TYPE) continue;
            if (y > 270) { doc.addPage(); y = 20; }
            if (pAlt) { doc.setFillColor(248, 250, 252); doc.rect(15, y, W - 30, 7, 'F'); }
            doc.setTextColor(55, 65, 81);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.text((p.PRODUCT_TYPE || '').substring(0, 22), 19, y + 5);
            doc.text((p.NO_OF_ACCOUNTS || '0').toString(), 80, y + 5);
            doc.text((p.NO_ACC_LAST_SIX_MON || '0').toString(), 110, y + 5);
            doc.text(String(p.SANCTIONED_AMOUNT || '0').trim().substring(0, 18), 140, y + 5);
            doc.text(String(p.TOTAL_OUTSTANDING_BALANCE || '0').trim().substring(0, 18), 175, y + 5);
            y += 7;
            pAlt = !pAlt;
        }
        y += 4;
    }

    // Inquiry History
    const inquiryHistory = body?.InquiryHistoryDetails;
    const inquiryArr = Array.isArray(inquiryHistory) ? inquiryHistory : (inquiryHistory ? [inquiryHistory] : []);
    if (inquiryArr.length > 0) {
        if (y > 230) { doc.addPage(); y = 20; }
        y += 4;
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Credit Inquiry History (Who Checked Your Credit)', 15, y);
        y += 6;

        doc.setFillColor(31, 41, 55);
        doc.rect(15, y, W - 30, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7.5);
        doc.text('Institution', 19, y + 5.5);
        doc.text('Institution Type', 95, y + 5.5);
        doc.text('Facility Type', 148, y + 5.5);
        doc.text('Date', 183, y + 5.5);
        y += 8;

        let inqAlt = false;
        for (const inq of inquiryArr.slice(0, 15)) {
            if (y > 270) { doc.addPage(); y = 20; }
            if (inqAlt) { doc.setFillColor(248, 250, 252); doc.rect(15, y, W - 30, 7, 'F'); }
            doc.setTextColor(55, 65, 81);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.text((inq.INSTITUTION_NAME || 'N/A').substring(0, 35), 19, y + 5);
            doc.text((inq.INSTITUTION_TYPE || 'N/A').substring(0, 18), 95, y + 5);
            doc.text((inq.FACILITY_TYPE || 'N/A').substring(0, 14), 148, y + 5);
            doc.text((inq.INQUIRY_DATE || 'N/A'), 183, y + 5);
            y += 7;
            inqAlt = !inqAlt;
        }
        y += 4;
    }

    // Inquiry by Product Summary
    const inqProduct = body?.Inquiry_Product;
    const inqProdArr = Array.isArray(inqProduct) ? inqProduct : (inqProduct ? [inqProduct] : []);
    if (inqProdArr.length > 0) {
        if (y > 240) { doc.addPage(); y = 20; }
        y += 4;
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Total Inquiries by Product Type', 15, y);
        y += 6;

        doc.setFillColor(31, 41, 55);
        doc.rect(15, y, W - 30, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7.5);
        doc.text('Product', 19, y + 5.5);
        doc.text('Banks', 80, y + 5.5);
        doc.text('Micro Lenders', 100, y + 5.5);
        doc.text('Mortgage', 140, y + 5.5);
        doc.text('NBFC', 163, y + 5.5);
        doc.text('Total', 185, y + 5.5);
        y += 8;

        let ipAlt = false;
        for (const ip of inqProdArr) {
            if (!ip.PRODUCT_TYPE) continue;
            if (y > 270) { doc.addPage(); y = 20; }
            if (ipAlt) { doc.setFillColor(248, 250, 252); doc.rect(15, y, W - 30, 7, 'F'); }
            doc.setTextColor(55, 65, 81);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            const isBold = ip.PRODUCT_TYPE === 'Total';
            doc.setFont('helvetica', isBold ? 'bold' : 'normal');
            doc.text((ip.PRODUCT_TYPE || '').substring(0, 22), 19, y + 5);
            doc.text((ip.BANK || '0').toString(), 80, y + 5);
            doc.text((ip.MICRO || '0').toString(), 100, y + 5);
            doc.text((ip.MORTGAGE || '0').toString(), 140, y + 5);
            doc.text((ip.NBFC || '0').toString(), 163, y + 5);
            doc.setTextColor(isBold ? 5 : 55, isBold ? 150 : 65, isBold ? 105 : 81);
            doc.text((ip.TOTAL || '0').toString(), 185, y + 5);
            doc.setTextColor(55, 65, 81);
            y += 7;
            ipAlt = !ipAlt;
        }
        y += 4;
    }

    // Consumer Address (from ConsCommDetails)
    const consComm = body?.ConsCommDetails?.ConsCommDetails_Subject;
    if (consComm?.ADDRESS) {
        if (y > 250) { doc.addPage(); y = 20; }
        y += 4;
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Registered Address', 15, y);
        y += 6;
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(15, y, W - 30, 12, 2, 2, 'F');
        doc.setTextColor(55, 65, 81);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(consComm.ADDRESS.trim(), 20, y + 8, { maxWidth: W - 40 });
        y += 16;
    }

    // ID Documents on File
    const idDocs = body?.ConsCommDetails?.ConsCommDetails_ID;
    const idArr = Array.isArray(idDocs) ? idDocs : (idDocs ? [idDocs] : []);
    const validIds = idArr.filter(d => d.IDENTIFIERNUMBER && d.IDENTIFIERNUMBER.trim() !== '.' && d.IDENTIFIERNUMBER.trim() !== '0' && d.IDENTIFIERNUMBER.trim() !== '' && !['NG','NI','1'].includes(d.IDENTIFIERNUMBER.trim()));
    if (validIds.length > 0) {
        if (y > 240) { doc.addPage(); y = 20; }
        y += 4;
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Identity Documents on File', 15, y);
        y += 6;

        doc.setFillColor(31, 41, 55);
        doc.rect(15, y, W - 30, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7.5);
        doc.text('Document Type', 19, y + 5.5);
        doc.text('Identifier Number', 110, y + 5.5);
        y += 8;

        let idAlt = false;
        for (const id of validIds) {
            if (y > 270) { doc.addPage(); y = 20; }
            if (idAlt) { doc.setFillColor(248, 250, 252); doc.rect(15, y, W - 30, 7, 'F'); }
            doc.setTextColor(55, 65, 81);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text((id.ID_TYPE || 'N/A').substring(0, 40), 19, y + 5);
            doc.text((id.IDENTIFIER_NUMBER || 'N/A'), 110, y + 5);
            y += 7;
            idAlt = !idAlt;
        }
        y += 4;
    }

    // Employment History (EmploymentHistory field)
    const empHistory = body?.EmploymentHistory;
    if (empHistory && empHistory !== null) {
        if (y > 240) { doc.addPage(); y = 20; }
        y += 4;
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Employment History', 15, y);
        y += 6;
        const empArr = Array.isArray(empHistory) ? empHistory : [empHistory];
        for (const emp of empArr.slice(0, 5)) {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(15, y, W - 30, 10, 2, 2, 'F');
            doc.setTextColor(55, 65, 81);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.text(String(emp).substring(0, 80), 20, y + 7, { maxWidth: W - 40 });
            y += 13;
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

        // 1. Verify payment directly with Paystack
        const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
        if (!PAYSTACK_SECRET_KEY) {
            return Response.json({ success: false, error: 'Paystack not configured' }, { status: 500 });
        }

        const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: { 'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}` }
        });
        const paystackData = await paystackRes.json();

        if (!paystackData.status || paystackData.data?.status !== 'success') {
            return Response.json({ success: false, error: 'Payment not successful' }, { status: 400 });
        }

        // Amount is in kobo — ₦2,500 = 250,000 kobo
        const amountPaid = paystackData.data?.amount || 0;
        if (amountPaid < 250000) {
            return Response.json({ success: false, error: 'Insufficient payment amount' }, { status: 400 });
        }

        // 2. Get existing credit search record with bureau data
        const creditSearches = await base44.entities.CreditSearch.filter({ id: search_id });
        if (!creditSearches || creditSearches.length === 0) {
            return Response.json({ success: false, error: 'Credit search record not found.' }, { status: 400 });
        }
        const creditSearch = creditSearches[0];
        if (!creditSearch.bureau_response) {
            return Response.json({ success: false, error: 'No bureau data found for this search. Please run a credit search first.' }, { status: 400 });
        }
        const crcData = creditSearch.bureau_response;

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

            // Build a detailed, accurate account picture
            const accountDetails = accountArr.filter(a => a.ACCOUNT).map(a => {
                const acc = a.ACCOUNT || {};
                const balance = parseFloat(String(acc['@BALANCE'] || '0').replace(/,/g, '')) || 0;
                const overdue = parseFloat(String(acc['@OVERDUE-AMOUNT'] || '0').replace(/,/g, '')) || 0;
                const sanctioned = parseFloat(String(acc['@SANCTIONED-AMOUNT'] || acc['@CREDIT-LIMIT'] || '0').replace(/,/g, '')) || 0;
                const status = acc['@STATUS'] || 'Unknown';
                const isClosed = status.toLowerCase().includes('close') || status.toLowerCase().includes('settled') || status.toLowerCase().includes('paid');
                const staleSanctioned = isClosed && sanctioned > 0 && balance === 0;
                return `  - ${acc['@INSTITUTION'] || 'Unknown'} | Type: ${acc['@ACCOUNT-TYPE'] || 'N/A'} | Balance: ₦${balance.toLocaleString()} | Overdue: ₦${overdue.toLocaleString()} | Sanctioned Limit: ₦${sanctioned.toLocaleString()} | Status: ${status} | Opened: ${acc['@DATE-OPENED'] || 'N/A'} | Last Activity: ${acc['@LAST-UPDATED'] || 'N/A'}${staleSanctioned ? ' ⚠ STALE: Paid off but sanctioned limit still showing — needs closure update' : ''}`;
            }).join('\n');

            // Identify stale accounts specifically
            const staleAccounts = accountArr.filter(a => {
                const acc = a.ACCOUNT || {};
                const balance = parseFloat(String(acc['@BALANCE'] || '0').replace(/,/g, '')) || 0;
                const sanctioned = parseFloat(String(acc['@SANCTIONED-AMOUNT'] || acc['@CREDIT-LIMIT'] || '0').replace(/,/g, '')) || 0;
                const status = (acc['@STATUS'] || '').toLowerCase();
                const isClosed = status.includes('close') || status.includes('settled') || status.includes('paid');
                return isClosed && sanctioned > 0 && balance === 0;
            }).map(a => `${a.ACCOUNT?.['@INSTITUTION']} (${a.ACCOUNT?.['@ACCOUNT-TYPE']}, Sanctioned: ₦${Number(String(a.ACCOUNT?.['@SANCTIONED-AMOUNT'] || a.ACCOUNT?.['@CREDIT-LIMIT'] || '0').replace(/,/g, '')).toLocaleString()})`);

            // Total balances and overdue amounts
            const totalBalance = accountArr.reduce((sum, a) => sum + (parseFloat(String(a.ACCOUNT?.['@BALANCE'] || '0').replace(/,/g, '')) || 0), 0);
            const totalOverdue = accountArr.reduce((sum, a) => sum + (parseFloat(String(a.ACCOUNT?.['@OVERDUE-AMOUNT'] || '0').replace(/,/g, '')) || 0), 0);
            const activeAccounts = accountArr.filter(a => (a.ACCOUNT?.['@STATUS'] || '').toLowerCase().includes('active')).length;
            const closedAccounts = accountArr.filter(a => (a.ACCOUNT?.['@STATUS'] || '').toLowerCase().includes('close') || (a.ACCOUNT?.['@STATUS'] || '').toLowerCase().includes('settled')).length;

            // Classification summary
            const classArr2 = body?.ClassificationInsType ? (Array.isArray(body.ClassificationInsType) ? body.ClassificationInsType : [body.ClassificationInsType]) : [];
            const classificationSummary = classArr2.map(c => `  - ${c.INSTITUTION_TYPE}: ${c.NO_OF_ACCOUNTS} accounts, Sanctioned: ₦${c.APPROVED_CREDIT_SANCTIONED || 0}, Outstanding: ₦${c.OUSTANDING_BALANCE || 0}`).join('\n');

            const aiResult = await base44.integrations.Core.InvokeLLM({
                prompt: `You are a Nigerian financial credit counsellor writing a personalised credit improvement plan for a real person based on their actual CRC bureau report data.

IMPORTANT: Your advice MUST be grounded strictly in the actual data below. Do NOT give generic advice. Address what is actually in the report — if outstanding balance is zero, say so and explain why that's good. If there are delinquency reason codes but zero overdue, clarify that the codes may refer to historical events and advise accordingly.

--- ACTUAL CREDIT REPORT DATA ---
Credit Score: ${score} (${scoreRating})
Total Accounts: ${accountArr.filter(a => a.ACCOUNT).length}
Active Accounts: ${activeAccounts}
Closed/Settled Accounts: ${closedAccounts}
Total Outstanding Balance: ₦${totalBalance.toLocaleString()}
Total Overdue Amount: ₦${totalOverdue.toLocaleString()}

Bureau Reason Codes (why the score is at this level):
${reasonCodes.length > 0 ? reasonCodes.map(r => '  • ' + r).join('\n') : '  • No specific reason codes provided'}

Individual Accounts:
${accountDetails || '  No account data available'}

Institution Classification:
${classificationSummary || '  No classification data'}

Accounts with STALE SANCTIONED LIMITS (paid off but not formally closed at the bureau — this drags the score down):
${staleAccounts.length > 0 ? staleAccounts.map(s => '  ⚠ ' + s).join('\n') : '  None detected'}
--- END OF DATA ---

Write 5-6 paragraphs of personalised, practical credit improvement advice directly addressing what is shown in this report. 
- If total overdue is ₦0, acknowledge this positively and clarify that delinquency reason codes may refer to historical events.
- If there are stale sanctioned limits (paid-off accounts still showing a limit), explicitly call them out by institution name and advise the user to visit or write to those banks/lenders to request a formal account closure update at the credit bureau. Explain that until this is done, the bureau still counts those limits against them, which suppresses their score unnecessarily.
- Comment on the mix of account types and what it means for their credit profile.
- Address the specific reason codes and what the person can concretely do about each one.
- Use plain paragraphs only (no bullet points, no markdown, no headers).
- Write in a warm, encouraging but professional tone suitable for a Nigerian audience.
- Start with: "Based on your credit report, here is what your data shows and how you can improve your score:"`,
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