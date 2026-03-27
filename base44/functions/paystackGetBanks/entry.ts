import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Call Paystack List Banks API
    const response = await fetch(
      'https://api.paystack.co/bank?currency=NGN',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json();

    if (!response.ok || !data.status) {
      return Response.json({
        success: false,
        error: data.message || 'Failed to fetch banks'
      });
    }

    return Response.json({
      success: true,
      banks: data.data.map(bank => ({
        name: bank.name,
        code: bank.code
      }))
    });

  } catch (error) {
    console.error('Get banks error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Failed to fetch banks'
    }, { status: 500 });
  }
});