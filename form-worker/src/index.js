import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const REV = "no-phone-v1";

/**
 * Allow your main domains + Pages stable domain + Pages preview subdomains.
 * If you don't care about CORS at all, you can just set Allow-Origin: "*" like before,
 * but this keeps it working while not being totally open.
 */
function isAllowedOrigin(origin) {
  if (!origin) return true; // non-browser calls
  if (origin === "https://raduhhr.xyz") return true;
  if (origin === "https://www.raduhhr.xyz") return true;
  if (origin === "https://cf-form-page.pages.dev") return true;

  // Pages preview deploys look like https://<hash>.cf-form-page.pages.dev
  try {
    const u = new URL(origin);
    return u.hostname.endsWith(".cf-form-page.pages.dev");
  } catch {
    return false;
  }
}

function isAllowedTurnstileHostname(hostname) {
  if (!hostname) return false;
  if (hostname === "raduhhr.xyz") return true;
  if (hostname === "www.raduhhr.xyz") return true;
  if (hostname === "cf-form-page.pages.dev") return true;

  // Allow Pages preview hostnames too
  return hostname.endsWith(".cf-form-page.pages.dev");
}

function corsHeadersFor(origin) {
  // If the request has an Origin and we allow it, echo it back.
  // If no Origin (curl), omit Allow-Origin.
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
    "X-Worker-Rev": REV,
  };

  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return c;
    }
  });
}

async function validateTurnstileToken(token, secretKey, remoteip) {
  const formData = new FormData();
  formData.append("secret", secretKey);
  formData.append("response", token);
  if (remoteip) formData.append("remoteip", remoteip);

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: formData,
  });

  return response.json();
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (!isAllowedOrigin(origin)) {
      // Browser will block anyway; give a clean error.
      return json({ error: "Forbidden origin", rev: REV }, 403, corsHeadersFor(origin));
    }

    const corsHeaders = corsHeadersFor(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return json({ error: "Method Not Allowed", rev: REV }, 405, corsHeaders);
    }

    try {
      const { name, email, message, turnstileToken } = await request.json();

      const n = (name || "").trim();
      const e = (email || "").trim();
      const m = (message || "").trim();
      const t = (turnstileToken || "").trim();

      // Remove phone requirement: only these 4 matter.
      const missing = [];
      if (!n) missing.push("name");
      if (!e) missing.push("email");
      if (!m) missing.push("message");
      if (!t) missing.push("turnstileToken");

      if (missing.length) {
        // Keep your UI string, but also return what’s missing for debugging in DevTools.
        return json({ error: "All fields are required", missing, rev: REV }, 400, corsHeaders);
      }

      // Validate Turnstile
      const ip = request.headers.get("CF-Connecting-IP") || "";
      const turnstile = await validateTurnstileToken(t, env.TURNSTILE_SECRET_KEY, ip);

      if (!turnstile?.success) {
        return json({ error: "Invalid Turnstile token", rev: REV }, 400, corsHeaders);
      }

      // Optional but important: ensure token was solved on your domain (or Pages preview)
      const hostname = turnstile.hostname || "";
      if (!isAllowedTurnstileHostname(hostname)) {
        return json({ error: "Invalid Turnstile context", hostname, rev: REV }, 400, corsHeaders);
      }

      // SES client
      const sesClient = new SESClient({
        region: env.AWS_REGION || "eu-north-1",
        credentials: {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        },
      });

      const now = new Date().toISOString();
      const ua = request.headers.get("User-Agent") || "";

      // Keep addresses exactly as-is
      const params = {
        Source: "raduhrr@gmail.com",
        Destination: { ToAddresses: ["vladdulgher@yahoo.com"] },
        Message: {
          Subject: { Data: "New Contact Form Submission" },
          Body: {
            Text: {
              Data:
                `New submission from: ${n}\n` +
                `Email: ${e} (Unverified)\n` +
                `Message: ${m}\n\n` +
                `Meta: time=${now} ip=${ip} ua=${ua}\n`,
            },
            Html: {
              Data:
                `<h3>New Contact Submission</h3>` +
                `<p><b>Name:</b> ${escapeHtml(n)}</p>` +
                `<p><b>Email:</b> ${escapeHtml(e)} (Unverified)</p>` +
                `<p><b>Message:</b></p>` +
                `<pre style="white-space:pre-wrap;font-family:ui-monospace,Menlo,Consolas,monospace;">${escapeHtml(m)}</pre>` +
                `<hr/>` +
                `<small>Meta: time=${escapeHtml(now)} ip=${escapeHtml(ip)} ua=${escapeHtml(ua)}</small>`,
            },
          },
        },
        ReplyToAddresses: ["raduhhr@yahoo.com"],
      };

      await sesClient.send(new SendEmailCommand(params));

      return json({ success: "Email sent successfully!", rev: REV }, 200, corsHeaders);
    } catch (error) {
      console.error("Worker/SES error:", error);
      return json({ error: "Failed to send email", rev: REV }, 500, corsHeaders);
    }
  },
};
