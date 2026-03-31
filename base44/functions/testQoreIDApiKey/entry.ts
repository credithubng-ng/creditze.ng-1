import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = Deno.env.get('QOREID_API_KEY');
    if (!apiKey) return Response.json({ error: 'QOREID_API_KEY not set' }, { status: 500 });

    const { bvn, firstname, lastname } = await req.json();

    const response = await fetch(`https://api.qoreid.com/v1/ng/identities/bvn-basic/${bvn}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'accept': 'application/json'
      },
      body: JSON.stringify({ firstname, lastname })
    });

    const data = await response.json();
    console.log('HTTP status:', response.status);
    console.log('Response:', JSON.stringify(data));

    return Response.json({ httpStatus: response.status, data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});