export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { email, landing, source, creative } = req.body || {};
    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ success: false, error: "Valid email is required" });
    }

    const cleanEmail = email.trim();
    const cleanLanding = String(landing || "tmmzc2").trim();
    const sourceRaw = String(source || "meta").trim().toLowerCase();
    const cleanSource = ["tiktok", "meta", "google", "youtube", "dv360"].includes(sourceRaw)
      ? sourceRaw
      : "unknown";
    const cleanCreative = String(creative || "unknown").trim();
    const apiKey = process.env.KLAVIYO_API_KEY || process.env.KLAVIYO_PRIVATE_API_KEY;
    const listId = process.env.KLAVIYO_LIST_ID;

    if (!apiKey || !listId) {
      console.error("Missing Klaviyo environment variables");
      return res.status(500).json({ success: false, error: "Newsletter is not configured" });
    }

    const headers = {
      Authorization: `Klaviyo-API-Key ${apiKey}`,
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Revision: "2026-07-15"
    };

    const profileResponse = await fetch("https://a.klaviyo.com/api/profile-import", {
      method: "POST",
      headers,
      body: JSON.stringify({
        data: {
          type: "profile",
          attributes: {
            email: cleanEmail,
            properties: { landing: cleanLanding, source: cleanSource, creative: cleanCreative }
          }
        }
      })
    });
    const profileText = await profileResponse.text();
    if (!profileResponse.ok) {
      console.error("Klaviyo profile error:", profileResponse.status, profileText);
      return res.status(502).json({ success: false, error: "Email profile could not be saved" });
    }

    const subscribeResponse = await fetch("https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs", {
      method: "POST",
      headers,
      body: JSON.stringify({
        data: {
          type: "profile-subscription-bulk-create-job",
          attributes: {
            profiles: {
              data: [{
                type: "profile",
                attributes: {
                  email: cleanEmail,
                  subscriptions: { email: { marketing: { consent: "SUBSCRIBED" } } }
                }
              }]
            }
          },
          relationships: { list: { data: { type: "list", id: listId } } }
        }
      })
    });
    const subscribeText = await subscribeResponse.text();
    if (!subscribeResponse.ok) {
      console.error("Klaviyo subscription error:", subscribeResponse.status, subscribeText);
      return res.status(502).json({ success: false, error: "Email subscription could not be completed" });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("TMMZC1 newsletter API error:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}
