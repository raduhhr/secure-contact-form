import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

// Cloudflare Worker Handler
export default {
  async fetch(request, env) {
    // CORS Headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
        status: 405,
        headers: corsHeaders,
      });
    }

    try {
      const { name, email, phone, message, turnstileToken } = await request.json();

      // Validate Turnstile token
      const turnstileResponse = await validateTurnstileToken(turnstileToken, env.TURNSTILE_SECRET_KEY);
      if (!turnstileResponse.success) {
        return new Response(JSON.stringify({ error: "Invalid Turnstile token" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      if (!name || !email || !phone || !message) {
        return new Response(JSON.stringify({ error: "All fields are required" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const sesClient = new SESClient({
        region: env.AWS_REGION || "eu-north-1",
        credentials: {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        },
      });

      const params = {
        Source: "no-reply@example.com", // ✅ Placeholder for SES source
        Destination: {
          ToAddresses: ["contact@example.com"], // ✅ Placeholder recipient
        },
        Message: {
          Subject: { Data: "New Contact Form Submission" },
          Body: {
            Text: {
              Data: `New submission from: ${name}
              Email: ${email} (Unverified)
              Phone: ${phone}
              Message: ${message}`,
            },
            Html: {
              Data: `<h3>New Contact Submission</h3>
                     <p><b>Name:</b> ${name}</p>
                     <p><b>Email:</b> ${email} (Unverified)</p>
                     <p><b>Phone:</b> ${phone}</p>
                     <p><b>Message:</b> ${message}</p>`,
            },
          },
        },
        ReplyToAddresses: ["replyto@example.com"], // ✅ Placeholder reply-to
      };

      // Send Email
      await sesClient.send(new SendEmailCommand(params));

      return new Response(JSON.stringify({ success: "Email sent successfully!" }), {
        status: 200,
        headers: corsHeaders,
      });
    } catch (error) {
      console.error("SES Error:", error);
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  },
};

// Validate Turnstile token
async function validateTurnstileToken(token, secretKey) {
  const formData = new FormData();
  formData.append("secret", secretKey);
  formData.append("response", token);

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: formData,
  });

  return response.json();
}

