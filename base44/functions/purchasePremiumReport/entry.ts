import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { jsPDF } from 'npm:jspdf@4.0.0';

const LOGO_URL = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69864d541609ebe758aa5d6d/ea48dae69_PHOTO-2026-02-05-09-26-23.jpg';
const EMERALD = [5, 150, 105];
const DARK = [31, 41, 55];
const GRAY = [107, 114, 128];
const LIGHT_GRAY = [55, 65, 81];
const ROW_ALT = [248, 250, 252];
const WHITE = [255, 255, 255];
const BORDER = [229, 231, 235];

async function fetchImageAsBase64(url) {
    try {
        const res = await fetch(url);
        const buf = await res.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    } catch (e) { return null; }
}

// ─── PDF HELPERS ──────────────────────────────────────────────────────────────

function sectionHeader(doc, title, y, W) {
    // Left accent bar + title
    doc.setFillColor(...EMERALD);
    doc.rect(15, y, 3, 7, 'F');
    doc.setTextColor(...DARK);
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 21, y + 5.5);
    // Underline
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.line(15, y + 9, W - 15, y + 9);
    return y + 14;
}

function tableHeader(doc, columns, y, W, color = DARK) {
    doc.setFillColor(...color);
    doc.rect(15, y, W - 30, 8, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    for (const [text, x] of columns) doc.text(text, x, y + 5.5);
    return y + 8;
}

function checkPage(doc, y, needed = 15) {
    if (y + needed > 278) { doc.addPage(); return 20; }
    return y;
}

// ─── PDF GENERATOR ────────────────────────────────────────────────────────────

async function generatePremiumPDF({ userName, score, searchId, crcData, aiAdvice }) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210;
    let y = 0;

    // ── COVER HEADER ──────────────────────────────────────────────────────────
    doc.setFillColor(...DARK);
    doc.rect(0, 0, W, 44, 'F');
    doc.setFillColor(...EMERALD);
    doc.rect(0, 40, W, 4, 'F');

    const logoBase64 = await fetchImageAsBase64(LOGO_URL);
    if (logoBase64) {
        doc.addImage(logoBase64, 'JPEG', 12, 8, 50, 26);
    } else {
        doc.setTextColor(...WHITE);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('CREDITZE', 15, 27);
    }

    doc.setTextColor(209, 250, 229);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text('PREMIUM CLASSIC CONSUMER REPORT', W - 12, 19, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text('Powered by CRC Credit Bureau Nigeria', W - 12, 27, { align: 'right' });
    doc.text(`Generated: ${new Date().toLocaleDateString('en-NG')}`, W - 12, 34, { align: 'right' });

    y = 54;

    // ── GREETING ──────────────────────────────────────────────────────────────
    doc.setTextColor(...DARK);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Dear ${userName},`, 15, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text('Your Premium Classic Consumer Report has been prepared from CRC Credit Bureau data. Please review it carefully.', 15, y, { maxWidth: W - 30 });
    y += 10;

    // ── SCORE CARD ────────────────────────────────────────────────────────────
    const scoreRating = score >= 700 ? 'Excellent' : score >= 600 ? 'Good' : score >= 500 ? 'Fair' : 'Poor';
    const scoreColor = score >= 700 ? EMERALD : score >= 600 ? [16, 185, 129] : score >= 500 ? [245, 158, 11] : [239, 68, 68];

    // Score box left, rating info right
    doc.setFillColor(...DARK);
    doc.roundedRect(15, y, W - 30, 36, 4, 4, 'F');

    // Score number
    doc.setTextColor(...scoreColor);
    doc.setFontSize(36);
    doc.setFont('helvetica', 'bold');
    doc.text(score ? score.toString() : 'N/A', 55, y + 23, { align: 'center' });

    // Divider
    doc.setDrawColor(75, 85, 99);
    doc.setLineWidth(0.4);
    doc.line(80, y + 7, 80, y + 29);

    // Right side info
    doc.setTextColor(156, 163, 175);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text('CREDIT SCORE', 90, y + 11);
    doc.setTextColor(...scoreColor);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(scoreRating, 90, y + 20);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(156, 163, 175);
    doc.text('Credit Rating', 90, y + 27);

    // Score band indicator
    const bands = [
      { label: 'Poor', max: 499, color: [239, 68, 68] },
      { label: 'Fair', max: 599, color: [245, 158, 11] },
      { label: 'Good', max: 699, color: [16, 185, 129] },
      { label: 'Excellent', max: 850, color: EMERALD },
    ];
    let bx = 90;
    for (const band of bands) {
        const active = scoreRating === band.label;
        doc.setFillColor(...(active ? band.color : [75, 85, 99]));
        doc.roundedRect(bx, y + 29, 26, 4, 1, 1, 'F');
        bx += 28;
    }
    y += 44;

    // ── REPORT DETAILS ────────────────────────────────────────────────────────
    doc.setFillColor(...ROW_ALT);
    doc.roundedRect(15, y, W - 30, 20, 3, 3, 'F');
    const metaItems = [
        ['Report Type', 'Premium Classic Consumer Report', 20],
        ['Reference ID', searchId.substring(0, 24) + '...', 100],
    ];
    doc.setFontSize(8);
    for (const [label, val, x] of metaItems) {
        doc.setTextColor(...GRAY);
        doc.setFont('helvetica', 'normal');
        doc.text(label, x, y + 8);
        doc.setTextColor(...DARK);
        doc.setFont('helvetica', 'bold');
        doc.text(val, x, y + 14);
    }
    y += 26;

    // Pull body data
    const body = crcData?.ConsumerHitResponse?.BODY || crcData?.ConsumerSearchResultResponse?.BODY || {};

    // ── SCORE REASON CODES ────────────────────────────────────────────────────
    const scoreDetails = body?.CREDIT_SCORE_DETAILS?.CREDIT_SCORE_SUMMARY;
    const reasons = scoreDetails ? [scoreDetails.REASON_CODE1, scoreDetails.REASON_CODE2, scoreDetails.REASON_CODE3, scoreDetails.REASON_CODE4].filter(Boolean) : [];
    if (reasons.length > 0) {
        y = checkPage(doc, y, 20 + reasons.length * 10);
        y = sectionHeader(doc, 'Credit Score Reason Codes', y, W);
        for (const reason of reasons) {
            y = checkPage(doc, y, 12);
            doc.setFillColor(254, 243, 199);
            doc.roundedRect(15, y, W - 30, 9, 2, 2, 'F');
            doc.setDrawColor(253, 230, 138);
            doc.setLineWidth(0.3);
            doc.roundedRect(15, y, W - 30, 9, 2, 2, 'S');
            doc.setTextColor(146, 64, 14);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text('! ' + reason, 19, y + 6, { maxWidth: W - 38 });
            y += 11;
        }
        y += 2;
    }

    // ── CONSUMER INFORMATION ──────────────────────────────────────────────────
    const consumerSubject = body?.ConsCommDetails?.ConsCommDetails_Subject;
    if (consumerSubject) {
        y = checkPage(doc, y, 40);
        y = sectionHeader(doc, 'Consumer Information', y, W);
        const infoRows = [];
        if (consumerSubject.NAME) infoRows.push(['Full Name', consumerSubject.NAME]);
        if (consumerSubject.DATE_OF_BIRTH) infoRows.push(['Date of Birth', consumerSubject.DATE_OF_BIRTH]);
        if (consumerSubject.GENDER) infoRows.push(['Gender', consumerSubject.GENDER]);
        if (consumerSubject.NATIONALITY) infoRows.push(['Nationality', consumerSubject.NATIONALITY]);
        if (consumerSubject.PHONE_NO1) infoRows.push(['Phone', consumerSubject.PHONE_NO1]);
        if (consumerSubject.ADDRESS) infoRows.push(['Address', String(consumerSubject.ADDRESS).trim().substring(0, 60)]);

        let alt2 = false;
        for (const [label, value] of infoRows) {
            y = checkPage(doc, y, 8);
            if (alt2) { doc.setFillColor(...ROW_ALT); doc.rect(15, y - 1, W - 30, 7, 'F'); }
            doc.setTextColor(...GRAY);
            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'normal');
            doc.text(label + ':', 20, y + 4);
            doc.setTextColor(...DARK);
            doc.setFont('helvetica', 'bold');
            doc.text(String(value || 'N/A'), 75, y + 4);
            y += 7;
            alt2 = !alt2;
        }
        y += 4;
    }

    // ── ACCOUNT CLASSIFICATION BY INSTITUTION ─────────────────────────────────
    const classArr = body?.ClassificationInsType ? (Array.isArray(body.ClassificationInsType) ? body.ClassificationInsType : [body.ClassificationInsType]) : [];
    if (classArr.length > 0 && classArr[0]?.INSTITUTION_TYPE) {
        y = checkPage(doc, y, 30);
        y = sectionHeader(doc, 'Account Summary by Institution Type', y, W);
        y = tableHeader(doc, [['Institution Type', 19], ['Accounts', 95], ['Sanctioned (₦)', 120], ['Outstanding (₦)', 168]], y, W);
        let alt = false;
        for (const cls of classArr) {
            if (!cls.INSTITUTION_TYPE) continue;
            y = checkPage(doc, y, 9);
            if (alt) { doc.setFillColor(...ROW_ALT); doc.rect(15, y, W - 30, 7, 'F'); }
            doc.setTextColor(...LIGHT_GRAY);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text((cls.INSTITUTION_TYPE || '').substring(0, 28), 19, y + 5);
            doc.text((cls.NO_OF_ACCOUNTS || '0').toString(), 95, y + 5);
            doc.text(String(cls.APPROVED_CREDIT_SANCTIONED || '0').trim().substring(0, 20), 120, y + 5);
            doc.text(String(cls.OUSTANDING_BALANCE || '0').trim().substring(0, 18), 168, y + 5);
            y += 7;
            alt = !alt;
        }
        y += 4;
    }

    // ── INDIVIDUAL ACCOUNT DETAILS ────────────────────────────────────────────
    const accounts = body?.ACCOUNTLIST || [];
    const accountArr = Array.isArray(accounts) ? accounts : [accounts];
    if (accountArr.length > 0 && accountArr[0]?.ACCOUNT) {
        y = checkPage(doc, y, 30);
        y = sectionHeader(doc, 'Individual Account Details', y, W);
        y = tableHeader(doc, [['Institution', 19], ['Type', 72], ['Balance (₦)', 118], ['Overdue (₦)', 148], ['Status', 180]], y, W, EMERALD);
        let rowAlt = false;
        for (const item of accountArr.slice(0, 20)) {
            const acc = item.ACCOUNT || {};
            y = checkPage(doc, y, 9);
            if (rowAlt) { doc.setFillColor(...ROW_ALT); doc.rect(15, y, W - 30, 7, 'F'); }
            doc.setTextColor(...LIGHT_GRAY);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.text((acc['@INSTITUTION'] || 'N/A').substring(0, 24), 19, y + 5);
            doc.text((acc['@ACCOUNT-TYPE'] || 'N/A').substring(0, 18), 72, y + 5);
            const bal = acc['@BALANCE'] ? Number(String(acc['@BALANCE']).replace(/,/g, '')).toLocaleString('en-NG') : '0';
            const ovd = acc['@OVERDUE-AMOUNT'] ? Number(String(acc['@OVERDUE-AMOUNT']).replace(/,/g, '')).toLocaleString('en-NG') : '0';
            doc.text(bal, 118, y + 5);
            doc.text(ovd, 148, y + 5);
            const status = acc['@STATUS'] || 'N/A';
            const isActive = status.toLowerCase().includes('active');
            doc.setTextColor(...(isActive ? EMERALD : [239, 68, 68]));
            doc.text(status.substring(0, 12), 180, y + 5);
            doc.setTextColor(...LIGHT_GRAY);
            y += 7;
            rowAlt = !rowAlt;
        }
        y += 4;
    }

    // ── PRODUCT TYPE CLASSIFICATION ───────────────────────────────────────────
    const prodArr = body?.ClassificationProdType ? (Array.isArray(body.ClassificationProdType) ? body.ClassificationProdType : [body.ClassificationProdType]) : [];
    if (prodArr.length > 0) {
        y = checkPage(doc, y, 30);
        y = sectionHeader(doc, 'Account Classification by Product Type', y, W);
        y = tableHeader(doc, [['Product Type', 19], ['Accounts', 82], ['Active (6mo)', 110], ['Sanctioned (₦)', 140], ['Outstanding (₦)', 175]], y, W);
        let pAlt = false;
        for (const p of prodArr) {
            if (!p.PRODUCT_TYPE) continue;
            y = checkPage(doc, y, 9);
            if (pAlt) { doc.setFillColor(...ROW_ALT); doc.rect(15, y, W - 30, 7, 'F'); }
            doc.setTextColor(...LIGHT_GRAY);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            const isTotalRow = p.PRODUCT_TYPE === 'Total';
            if (isTotalRow) { doc.setFont('helvetica', 'bold'); doc.setTextColor(...DARK); }
            doc.text((p.PRODUCT_TYPE || '').substring(0, 24), 19, y + 5);
            doc.text((p.NO_OF_ACCOUNTS || '0').toString(), 82, y + 5);
            doc.text((p.NO_ACC_LAST_SIX_MON || '0').toString(), 110, y + 5);
            doc.text(String(p.SANCTIONED_AMOUNT || '0').trim().substring(0, 18), 140, y + 5);
            doc.text(String(p.TOTAL_OUTSTANDING_BALANCE || '0').trim().substring(0, 18), 175, y + 5);
            y += 7;
            pAlt = !pAlt;
        }
        y += 4;
    }

    // ── INQUIRY HISTORY ───────────────────────────────────────────────────────
    const inquiryArr = body?.InquiryHistoryDetails ? (Array.isArray(body.InquiryHistoryDetails) ? body.InquiryHistoryDetails : [body.InquiryHistoryDetails]) : [];
    if (inquiryArr.length > 0) {
        y = checkPage(doc, y, 30);
        y = sectionHeader(doc, 'Credit Inquiry History', y, W);
        y = tableHeader(doc, [['Institution', 19], ['Institution Type', 92], ['Facility Type', 148], ['Date', 184]], y, W);
        let inqAlt = false;
        for (const inq of inquiryArr.slice(0, 15)) {
            y = checkPage(doc, y, 9);
            if (inqAlt) { doc.setFillColor(...ROW_ALT); doc.rect(15, y, W - 30, 7, 'F'); }
            doc.setTextColor(...LIGHT_GRAY);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.text((inq.INSTITUTION_NAME || 'N/A').substring(0, 36), 19, y + 5);
            doc.text((inq.INSTITUTION_TYPE || 'N/A').substring(0, 20), 92, y + 5);
            doc.text((inq.FACILITY_TYPE || 'N/A').substring(0, 14), 148, y + 5);
            doc.text((inq.INQUIRY_DATE || 'N/A'), 184, y + 5);
            y += 7;
            inqAlt = !inqAlt;
        }
        y += 4;
    }

    // ── IDENTITY DOCUMENTS ON FILE ────────────────────────────────────────────
    const idDocs = body?.ConsCommDetails?.ConsCommDetails_ID;
    const idArr = Array.isArray(idDocs) ? idDocs : (idDocs ? [idDocs] : []);
    const validIds = idArr.filter(d => d.IDENTIFIERNUMBER && !['', '.', '0', 'NG', 'NI', '1'].includes(d.IDENTIFIERNUMBER.trim()));
    if (validIds.length > 0) {
        y = checkPage(doc, y, 25);
        y = sectionHeader(doc, 'Identity Documents on File', y, W);
        y = tableHeader(doc, [['Document Type', 19], ['Identifier Number', 115]], y, W);
        let idAlt = false;
        for (const id of validIds) {
            y = checkPage(doc, y, 9);
            if (idAlt) { doc.setFillColor(...ROW_ALT); doc.rect(15, y, W - 30, 7, 'F'); }
            doc.setTextColor(...LIGHT_GRAY);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text((id.ID_TYPE || 'N/A').substring(0, 45), 19, y + 5);
            doc.text((id.IDENTIFIER_NUMBER || 'N/A'), 115, y + 5);
            y += 7;
            idAlt = !idAlt;
        }
        y += 4;
    }

    // ── EMPLOYMENT HISTORY ────────────────────────────────────────────────────
    const empHistory = body?.EmploymentHistory;
    if (empHistory) {
        y = checkPage(doc, y, 25);
        y = sectionHeader(doc, 'Employment History', y, W);
        const empArr = Array.isArray(empHistory) ? empHistory : [empHistory];
        for (const emp of empArr.slice(0, 5)) {
            y = checkPage(doc, y, 12);
            doc.setFillColor(...ROW_ALT);
            doc.roundedRect(15, y, W - 30, 9, 2, 2, 'F');
            doc.setTextColor(...LIGHT_GRAY);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.text(String(emp).substring(0, 90), 20, y + 6.5, { maxWidth: W - 40 });
            y += 11;
        }
        y += 4;
    }

    // ── AI CREDIT IMPROVEMENT ADVICE ──────────────────────────────────────────
    if (aiAdvice) {
        y = checkPage(doc, y, 30);
        // Header band
        doc.setFillColor(...DARK);
        doc.roundedRect(15, y, W - 30, 10, 3, 3, 'F');
        doc.setFillColor(...EMERALD);
        doc.roundedRect(15, y, 5, 10, 1, 1, 'F');
        doc.setTextColor(...WHITE);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Personalised Credit Improvement Advice', 24, y + 6.8);
        y += 14;

        // Light background for advice text
        doc.setFillColor(240, 253, 244);
        const adviceLines = doc.splitTextToSize(aiAdvice, W - 36);
        const adviceHeight = adviceLines.length * 5.2 + 8;
        doc.roundedRect(15, y, W - 30, adviceHeight, 3, 3, 'F');
        doc.setDrawColor(...EMERALD);
        doc.setLineWidth(0.4);
        doc.roundedRect(15, y, W - 30, adviceHeight, 3, 3, 'S');

        doc.setTextColor(...DARK);
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        let ay = y + 6;
        for (const line of adviceLines) {
            ay = checkPage(doc, ay, 7);
            doc.text(line, 20, ay);
            ay += 5.2;
        }
        y = ay + 6;
    }

    // ── FOOTER ON EVERY PAGE ──────────────────────────────────────────────────
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        // Footer bar
        doc.setFillColor(249, 250, 251);
        doc.rect(0, 284, W, 13, 'F');
        doc.setDrawColor(...BORDER);
        doc.setLineWidth(0.3);
        doc.line(0, 284, W, 284);
        doc.setTextColor(...GRAY);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.text('© 2026 Creditze Nigeria. Premium Report — Strictly Confidential | support@creditze.ng', W / 2, 290, { align: 'center' });
        doc.text(`Page ${i} of ${pageCount}`, W / 2, 294, { align: 'center' });
        // Page header (except first page)
        if (i > 1) {
            doc.setFillColor(...DARK);
            doc.rect(0, 0, W, 10, 'F');
            doc.setFillColor(...EMERALD);
            doc.rect(0, 10, W, 1.5, 'F');
            doc.setTextColor(...WHITE);
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'bold');
            doc.text('CREDITZE — PREMIUM CLASSIC CONSUMER REPORT', 12, 7);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(156, 163, 175);
            doc.text(`Confidential — ${new Date().toLocaleDateString('en-NG')}`, W - 12, 7, { align: 'right' });
        }
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

        // 1. Verify payment with Paystack
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

        // ₦2,500 = 250,000 kobo
        const amountPaid = paystackData.data?.amount || 0;
        if (amountPaid < 250000) {
            return Response.json({ success: false, error: 'Insufficient payment amount' }, { status: 400 });
        }

        // 2. Get credit search record
        const creditSearches = await base44.entities.CreditSearch.filter({ id: search_id });
        if (!creditSearches || creditSearches.length === 0) {
            return Response.json({ success: false, error: 'Credit search record not found.' }, { status: 400 });
        }
        const creditSearch = creditSearches[0];
        if (!creditSearch.bureau_response) {
            return Response.json({ success: false, error: 'No bureau data found. Please run a credit search first.' }, { status: 400 });
        }
        const crcData = creditSearch.bureau_response;

        // 3. Extract core data
        const body = crcData?.ConsumerHitResponse?.BODY || {};
        const score = body?.CREDIT_SCORE_DETAILS?.CREDIT_SCORE_SUMMARY?.CREDIT_SCORE || 0;
        const scoreRating = score >= 700 ? 'Excellent' : score >= 600 ? 'Good' : score >= 500 ? 'Fair' : 'Poor';
        const reasonCodes = [
            body?.CREDIT_SCORE_DETAILS?.CREDIT_SCORE_SUMMARY?.REASON_CODE1,
            body?.CREDIT_SCORE_DETAILS?.CREDIT_SCORE_SUMMARY?.REASON_CODE2,
            body?.CREDIT_SCORE_DETAILS?.CREDIT_SCORE_SUMMARY?.REASON_CODE3,
            body?.CREDIT_SCORE_DETAILS?.CREDIT_SCORE_SUMMARY?.REASON_CODE4
        ].filter(Boolean);

        // 4. Build detailed account analysis for AI
        const accounts = body?.ACCOUNTLIST || [];
        const accountArr = Array.isArray(accounts) ? accounts : [accounts];
        const today = new Date();
        const threeYearsAgo = new Date(today.getFullYear() - 3, today.getMonth(), today.getDate());

        const accountDetails = accountArr.filter(a => a.ACCOUNT).map(a => {
            const acc = a.ACCOUNT || {};
            const balance = parseFloat(String(acc['@BALANCE'] || '0').replace(/,/g, '')) || 0;
            const overdue = parseFloat(String(acc['@OVERDUE-AMOUNT'] || '0').replace(/,/g, '')) || 0;
            const sanctioned = parseFloat(String(acc['@SANCTIONED-AMOUNT'] || acc['@CREDIT-LIMIT'] || '0').replace(/,/g, '')) || 0;
            const status = acc['@STATUS'] || 'Unknown';
            const isClosed = status.toLowerCase().includes('close') || status.toLowerCase().includes('settled') || status.toLowerCase().includes('paid');
            const staleSanctioned = isClosed && sanctioned > 0 && balance === 0;

            // Check if delinquency is older than 3 years
            const lastUpdated = acc['@LAST-UPDATED'] || acc['@DATE-CLOSED'] || '';
            let isOldDelinquency = false;
            if (overdue > 0 || isClosed) {
                const dateParts = lastUpdated.split(/[-/]/);
                if (dateParts.length >= 2) {
                    const parsed = new Date(lastUpdated);
                    if (!isNaN(parsed) && parsed < threeYearsAgo) isOldDelinquency = true;
                }
            }

            const flags = [];
            if (staleSanctioned) flags.push('⚠ STALE SANCTIONED LIMIT: paid off but limit still showing — needs formal closure at bureau');
            if (isOldDelinquency) flags.push('⚠ OLD DELINQUENCY (>3 years): this record is aged and should be disputed with the lender and bureau');

            return `  - ${acc['@INSTITUTION'] || 'Unknown'} | Type: ${acc['@ACCOUNT-TYPE'] || 'N/A'} | Balance: ₦${balance.toLocaleString()} | Overdue: ₦${overdue.toLocaleString()} | Sanctioned: ₦${sanctioned.toLocaleString()} | Status: ${status} | Last Activity: ${lastUpdated || 'N/A'}${flags.length > 0 ? '\n    ' + flags.join('\n    ') : ''}`;
        }).join('\n');

        const staleAccounts = accountArr.filter(a => {
            const acc = a.ACCOUNT || {};
            const balance = parseFloat(String(acc['@BALANCE'] || '0').replace(/,/g, '')) || 0;
            const sanctioned = parseFloat(String(acc['@SANCTIONED-AMOUNT'] || acc['@CREDIT-LIMIT'] || '0').replace(/,/g, '')) || 0;
            const status = (acc['@STATUS'] || '').toLowerCase();
            return (status.includes('close') || status.includes('settled') || status.includes('paid')) && sanctioned > 0 && balance === 0;
        }).map(a => `${a.ACCOUNT?.['@INSTITUTION']} (${a.ACCOUNT?.['@ACCOUNT-TYPE']}, Sanctioned: ₦${Number(String(a.ACCOUNT?.['@SANCTIONED-AMOUNT'] || a.ACCOUNT?.['@CREDIT-LIMIT'] || '0').replace(/,/g, '')).toLocaleString()})`);

        const oldDelinquencies = accountArr.filter(a => {
            const acc = a.ACCOUNT || {};
            const overdue = parseFloat(String(acc['@OVERDUE-AMOUNT'] || '0').replace(/,/g, '')) || 0;
            const lastUpdated = acc['@LAST-UPDATED'] || acc['@DATE-CLOSED'] || '';
            if (!lastUpdated) return false;
            const parsed = new Date(lastUpdated);
            return !isNaN(parsed) && parsed < threeYearsAgo && overdue > 0;
        }).map(a => `${a.ACCOUNT?.['@INSTITUTION']} (last activity: ${a.ACCOUNT?.['@LAST-UPDATED'] || 'N/A'}, overdue: ₦${Number(String(a.ACCOUNT?.['@OVERDUE-AMOUNT'] || '0').replace(/,/g, '')).toLocaleString()})`);

        const totalBalance = accountArr.reduce((s, a) => s + (parseFloat(String(a.ACCOUNT?.['@BALANCE'] || '0').replace(/,/g, '')) || 0), 0);
        const totalOverdue = accountArr.reduce((s, a) => s + (parseFloat(String(a.ACCOUNT?.['@OVERDUE-AMOUNT'] || '0').replace(/,/g, '')) || 0), 0);
        const activeCount = accountArr.filter(a => (a.ACCOUNT?.['@STATUS'] || '').toLowerCase().includes('active')).length;
        const closedCount = accountArr.filter(a => { const s = (a.ACCOUNT?.['@STATUS'] || '').toLowerCase(); return s.includes('close') || s.includes('settled'); }).length;

        const classArr2 = body?.ClassificationInsType ? (Array.isArray(body.ClassificationInsType) ? body.ClassificationInsType : [body.ClassificationInsType]) : [];
        const classificationSummary = classArr2.map(c => `  - ${c.INSTITUTION_TYPE}: ${c.NO_OF_ACCOUNTS} accounts, Sanctioned: ₦${c.APPROVED_CREDIT_SANCTIONED || 0}, Outstanding: ₦${c.OUSTANDING_BALANCE || 0}`).join('\n');

        // 5. Generate AI advice
        let aiAdvice = '';
        try {
            const aiResult = await base44.integrations.Core.InvokeLLM({
                prompt: `You are a Nigerian financial credit counsellor writing a personalised credit improvement plan based on a real CRC bureau report.

CRITICAL RULES:
- Base ALL advice strictly on the actual data provided. Do NOT give generic tips not supported by the data.
- If outstanding balance is ₦0, clearly state this is a positive sign.
- If delinquency reason codes appear but overdue is ₦0, explain they are likely historical and not current.
- If there are delinquent records older than 3 years, explicitly advise the person to write formally to those lenders AND to CRC Credit Bureau to have these aged records removed or updated, citing that records older than 3-5 years should not negatively impact a current credit score.
- If there are stale sanctioned limits (paid-off/closed accounts still showing a credit limit), name the institutions and advise the person to visit or write those banks/lenders requesting a formal Account Closure Notification to CRC bureau.
- Address the specific reason codes with concrete actionable steps.

--- CREDIT REPORT DATA ---
Score: ${score} (${scoreRating})
Total Accounts: ${accountArr.filter(a => a.ACCOUNT).length} | Active: ${activeCount} | Closed/Settled: ${closedCount}
Total Outstanding: ₦${totalBalance.toLocaleString()} | Total Overdue: ₦${totalOverdue.toLocaleString()}

Reason Codes:
${reasonCodes.length > 0 ? reasonCodes.map(r => '  • ' + r).join('\n') : '  • None provided'}

Individual Accounts:
${accountDetails || '  No account data'}

Institution Classification:
${classificationSummary || '  No classification data'}

Accounts with STALE SANCTIONED LIMITS (closed/paid but limit still reported):
${staleAccounts.length > 0 ? staleAccounts.map(s => '  ⚠ ' + s).join('\n') : '  None detected'}

AGED DELINQUENCIES OLDER THAN 3 YEARS (should be disputed):
${oldDelinquencies.length > 0 ? oldDelinquencies.map(d => '  ⚠ ' + d).join('\n') : '  None detected'}
--- END DATA ---

Write 5-6 warm, professional paragraphs of personalised advice. Plain paragraphs only — no bullet points, no markdown, no headers.
Start with: "Based on your credit report, here is what your data shows and how you can improve your score:"`,
                response_json_schema: null
            });
            aiAdvice = aiResult || '';
        } catch (e) {
            console.error('AI advice error:', e);
            aiAdvice = 'To improve your credit score: pay all loans on time, keep your outstanding balances low, avoid multiple loan applications at once, maintain your bank account in good standing, and build a consistent repayment history over time.';
        }

        // 6. Generate premium PDF
        const pdfBytes = await generatePremiumPDF({
            userName: user.full_name || 'Valued Customer',
            score,
            searchId: search_id,
            crcData,
            aiAdvice
        });

        const pdfFile = new File([pdfBytes], `premium_report_${search_id}.pdf`, { type: 'application/pdf' });
        const { file_url } = await base44.integrations.Core.UploadFile({ file: pdfFile });

        // 7. Send email
        const scoreColorHex = score >= 700 ? '#059669' : score >= 600 ? '#10b981' : score >= 500 ? '#f59e0b' : '#ef4444';
        await base44.integrations.Core.SendEmail({
            to: user.email,
            subject: '⭐ Your Premium Credit Report is Ready — Creditze',
            body: `<!DOCTYPE html>
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
      <p style="color:#6b7280;line-height:1.6;margin:0 0 28px;">Your <strong>Premium Classic Consumer Report</strong> is ready. It includes your full credit history, score breakdown, and personalised AI-powered advice.</p>
      <div style="background:#1f2937;padding:24px;border-radius:12px;text-align:center;margin:0 0 28px;">
        <p style="color:#9ca3af;margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Your Credit Score</p>
        <h2 style="color:${scoreColorHex};margin:0 0 8px;font-size:48px;font-weight:bold;">${score || 'N/A'}</h2>
        <p style="color:${scoreColorHex};margin:0;font-weight:600;font-size:16px;">${scoreRating} Credit Rating</p>
      </div>
      <div style="text-align:center;margin:0 0 28px;">
        <a href="${file_url}" style="display:inline-block;background:#1f2937;color:white;padding:16px 40px;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">📄 Download Premium Report</a>
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