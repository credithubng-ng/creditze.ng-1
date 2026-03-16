import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const { phone_numbers, message, sender, provider } = await req.json();

        if (!phone_numbers || !Array.isArray(phone_numbers) || phone_numbers.length === 0) {
            return Response.json({ success: false, error: 'phone_numbers array is required' }, { status: 400 });
        }

        if (!message || message.trim().length === 0) {
            return Response.json({ success: false, error: 'Message is required' }, { status: 400 });
        }

        // Normalize phone numbers to 234XXXXXXXXXX format
        const normalizePhone = (phone) => {
            let p = phone.toString().trim().replace(/\s+/g, '').replace(/[^0-9]/g, '');
            if (p.startsWith('234')) p = p.substring(3);
            while (p.startsWith('0')) p = p.substring(1);
            if (p.length !== 10) return null;
            return '234' + p;
        };

        const normalized = phone_numbers.map(normalizePhone).filter(Boolean);
        const invalid = phone_numbers.length - normalized.length;

        if (normalized.length === 0) {
            return Response.json({ success: false, error: 'No valid phone numbers found' }, { status: 400 });
        }

        const selectedProvider = provider || 'smartsms';
        let result;

        if (selectedProvider === 'termii') {
            const termiiKey = Deno.env.get('TERMII_API_KEY');
            if (!termiiKey) return Response.json({ success: false, error: 'Termii API key not configured' }, { status: 500 });

            // Termii bulk SMS - send individually (their bulk endpoint)
            let sent = 0, failed = 0;
            for (const phone of normalized) {
                const resp = await fetch('https://api.ng.termii.com/api/sms/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        api_key: termiiKey,
                        to: phone,
                        from: sender || 'Creditze',
                        sms: message,
                        type: 'plain',
                        channel: 'generic'
                    })
                });
                const data = await resp.json();
                console.log(`Termii to ${phone}:`, data);
                if (data.code === 'ok' || data.message_id) sent++;
                else failed++;
            }

            result = { sent, failed, invalid, total: phone_numbers.length };

        } else {
            // SmartSMS
            const smartSmsToken = Deno.env.get('SMARTSMS_TOKEN');
            if (!smartSmsToken) return Response.json({ success: false, error: 'SmartSMS token not configured' }, { status: 500 });

            // SmartSMS supports comma-separated recipients
            const toList = normalized.join(',');
            const formData = new FormData();
            formData.append('token', smartSmsToken);
            formData.append('sender', sender || 'Creditze');
            formData.append('to', toList);
            formData.append('message', message);
            formData.append('type', '0');
            formData.append('routing', '4');

            const smsResp = await fetch('https://smartsmssolutions.com/api/json.php', {
                method: 'POST',
                body: formData
            });

            const smsData = await smsResp.json();
            console.log('SmartSMS bulk response:', smsData);

            if (smsData.code !== 1000 && smsData.code !== '1000') {
                return Response.json({
                    success: false,
                    error: smsData.comment || smsData.error || 'SmartSMS delivery failed',
                    raw: smsData
                }, { status: 400 });
            }

            result = { sent: normalized.length, failed: 0, invalid, total: phone_numbers.length };
        }

        return Response.json({ success: true, ...result, provider: selectedProvider });

    } catch (error) {
        console.error('Bulk SMS error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});