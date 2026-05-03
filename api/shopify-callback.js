export default async function handler(req, res) {
  const { code } = req.query

  if (!code) {
    return res.status(400).send(`
      <html><body style="font-family:sans-serif;padding:40px;max-width:600px;margin:auto">
        <h2 style="color:#8B4513">❌ No code received</h2>
        <p>The OAuth flow did not return a code. Please try the authorization URL again.</p>
      </body></html>
    `)
  }

  try {
    const response = await fetch('https://aartisanz.myshopify.com/admin/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_CLIENT_ID || 'ac39634865773d96fb43fc517280ec49',
        client_secret: process.env.SHOPIFY_CLIENT_SECRET,
        code
      })
    })

    const data = await response.json()

    if (data.access_token) {
      return res.status(200).send(`
        <html><body style="font-family:sans-serif;padding:40px;max-width:600px;margin:auto">
          <h2 style="color:#8B4513">✅ Shopify Access Token Generated!</h2>
          <p>Copy this token and add it to your Supabase Edge Function secrets as <strong>SHOPIFY_ACCESS_TOKEN</strong>:</p>
          <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin:16px 0;word-break:break-all;font-family:monospace;font-size:14px;border:1px solid #ddd">
            ${data.access_token}
          </div>
          <button onclick="navigator.clipboard.writeText('${data.access_token}');this.textContent='✅ Copied!'" 
            style="background:#8B4513;color:white;border:none;padding:10px 24px;border-radius:6px;cursor:pointer;font-size:14px">
            📋 Copy Token
          </button>
          <hr style="margin:24px 0">
          <p style="color:#666;font-size:13px">Scopes granted: ${data.scope}</p>
          <p style="color:#999;font-size:12px">⚠️ Keep this token secret. Add it to Supabase secrets, not in code.</p>
        </body></html>
      `)
    } else {
      return res.status(400).send(`
        <html><body style="font-family:sans-serif;padding:40px;max-width:600px;margin:auto">
          <h2 style="color:red">❌ Token exchange failed</h2>
          <pre style="background:#f5f5f5;padding:16px;border-radius:8px">${JSON.stringify(data, null, 2)}</pre>
        </body></html>
      `)
    }
  } catch (err) {
    return res.status(500).send(`
      <html><body style="font-family:sans-serif;padding:40px;max-width:600px;margin:auto">
        <h2 style="color:red">❌ Error</h2>
        <pre>${err.message}</pre>
      </body></html>
    `)
  }
}
