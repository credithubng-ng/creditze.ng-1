const QOREID_BASE_URL = Deno.env.get("QOREID_BASE_URL") || "https://api.qoreid.com";

async function getQoreIdToken() {
  const response = await fetch(`${QOREID_BASE_URL}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({
      clientId: Deno.env.get("QOREID_CLIENT_ID"),
      secret: Deno.env.get("QOREID_SECRET")
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`QoreID token error: ${response.status} ${JSON.stringify(data)}`);
  }

  if (!data.accessToken) {
    throw new Error("QoreID token missing accessToken");
  }

  return data.accessToken;
}

async function qoreIdRequest(endpoint, options = {}) {
  const token = await getQoreIdToken();

  const response = await fetch(`${QOREID_BASE_URL}${endpoint}`, {
    method: options.method || "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`QoreID API error: ${response.status} ${JSON.stringify(data)}`);
  }

  return data;
}

export async function verifyNIN(nin) {
  if (!nin) throw new Error("NIN is required");

  return await qoreIdRequest(`/v1/ng/identities/nin/${encodeURIComponent(nin)}`, {
    method: "POST"
  });
}

export async function verifyBVNBasic(bvn) {
  if (!bvn) throw new Error("BVN is required");

  return await qoreIdRequest(`/v1/ng/identities/bvn-basic/${encodeURIComponent(bvn)}`, {
    method: "POST"
  });
}

export async function verifyBVNPremium(bvn) {
  if (!bvn) throw new Error("BVN is required");

  return await qoreIdRequest(`/v1/ng/identities/bvn-premium/${encodeURIComponent(bvn)}`, {
    method: "POST"
  });
}

export async function verifyNINFace({ nin, selfieImage }) {
  if (!nin) throw new Error("NIN is required");
  if (!selfieImage) throw new Error("selfieImage is required");

  return await qoreIdRequest(`/v1/ng/identities/face-verification/nin`, {
    method: "POST",
    body: {
      idNumber: nin,
      selfieImage: selfieImage
    }
  });
}