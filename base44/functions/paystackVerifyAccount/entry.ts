import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { account_number, bank_code } = await req.json();

    if (!account_number || !bank_code) {
      return Response.json({ 
        success: false, 
        error: 'Account number and bank code are required' 
      }, { status: 400 });
    }

    // Call Paystack Resolve Account API
    const response = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}`,
          'Content-Type': 'application/json',
          'X-Source': 'Base44_mvp'
        }
      }
    );

    const data = await response.json();

    if (!response.ok || !data.status) {
      return Response.json({
        success: false,
        error: data.message || 'Account verification failed'
      });
    }

    return Response.json({
      success: true,
      account_name: data.data.account_name,
      account_number: data.data.account_number
    });

  } catch (error) {
    console.error('Account verification error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to verify account'
    }, { status: 500 });
  }
});