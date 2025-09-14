# secure-contact-form

A **secure contact form + portfolio landing**:
- **Frontend:** Cloudflare Pages (private repo)
- **Backend:** Cloudflare Worker → **AWS SES**
- **Bot protection:** Cloudflare **Turnstile**
- **CV download:** hosted from a **separate public GitHub Pages** repo

**Production:** https://raduhhr.xyz  
**Public asset page (for CV):** https://raduhhr.github.io/secure-contact-form/  
**Direct CV:** https://raduhhr.github.io/secure-contact-form/cv%20baza.pdf

---

## Why two repos?

1) **Private (CF Pages source):** full site used in production (includes real form endpoint).  
2) **Public (GitHub Pages):** sanitized code for viewers **and** a simple page that publishes the CV file so it can be hot-linked from the prod site.

This keeps sensitive details out of the public repo while giving a stable, public download URL.

---

## Architecture

```
User (raduhhr.xyz on Cloudflare Pages)
   │
   ├─ Submits form (Name, Email, Phone, Message + Turnstile token)
   │             JSON POST
   └──────────────► Cloudflare Worker
                      • Verifies Turnstile token
                      • Sends email via AWS SES
                      • Returns success/error

CV Download Button
   └──────────────► GitHub Pages (public repo)
                      /cv%20baza.pdf
```

- The **UI and Turnstile** run on **Cloudflare Pages**.
- The form **POSTs** to a **Cloudflare Worker** (e.g., `https://form-worker.<account>.workers.dev`).
- The Worker validates the Turnstile token and calls **AWS SES** to deliver the email.
- The **CV file** is served from **GitHub Pages** in the public repo.

---

## Repo layout (conceptual)

```
private-cf-pages-repo/          # production site (Cloudflare Pages)
├── index.html                  # portfolio + contact form + Turnstile
├── (assets ...)
└── (no secrets committed)

public-gh-pages-repo/           # public-facing code + hosted CV
├── index.html                  # minimal page (download button)
├── cv baza.pdf                 # downloadable CV
└── (GitHub Pages enabled)
```

---

## Frontend (Cloudflare Pages)

- `index.html` renders the portfolio + **Download CV** button pointing to:  
  `https://raduhhr.github.io/secure-contact-form/cv%20baza.pdf`
- The contact form includes **Turnstile**; the Turnstile token is sent to the Worker in the JSON body.
- **Do not** change the form’s endpoint unless you redeploy the Worker to a new URL.

### Recommended meta
Add Open Graph/Twitter tags for better previews (title/description/URL).

---

## Backend (Cloudflare Worker)

The Worker:
1. Accepts **POST** with `{name, email, phone, message, turnstileToken}`
2. Verifies `turnstileToken` with Cloudflare
3. Sends an email using **AWS SES**
4. Returns an OK/ERROR JSON response

### Deploy (example)
```bash
npm install
# Wrangler secrets (example names):
npx wrangler secret put AWS_ACCESS_KEY_ID
npx wrangler secret put AWS_SECRET_ACCESS_KEY
npx wrangler secret put TURNSTILE_SECRET_KEY

# Deploy
npm run deploy
# or
npx wrangler deploy
```

**Configure in code / `wrangler.toml`:**
- SES region (e.g., `eu-north-1`)
- Sender/recipient addresses (SES-verified)
- Allowed origins (if you enforce CORS)

> Ensure the Worker’s URL in `index.html` matches the deployed Worker (e.g., `https://form-worker.<account>.workers.dev`).

---

## AWS SES

- Verify the **sending domain** and the **from** address.
- Ensure **SPF/DKIM/DMARC** are correctly set for deliverability.
- If your SES account is in sandbox, verify the **to** address(es) as well.

---

## GitHub Pages (public repo)

- Put `cv baza.pdf` at the repo root (or `/docs` if you use that setting).
- Enable GitHub Pages → you’ll get a public URL (used in the **Download CV** button).
- You can keep a minimal `index.html` (download button) or none—only the file hosting is required.

---

## Usage

1. Visit **https://raduhhr.xyz**  
2. Click **Download CV** → served from the **public GitHub Pages** repo.  
3. Submit the contact form → Worker verifies Turnstile → SES sends your message to the inbox.

---

## Notes

- **Turnstile and form logic remain unchanged** from the original implementation.
- The public repo intentionally **removes private email addresses** and only exposes what’s safe.
- You can later consolidate the asset hosting under your own domain (CF Pages) via a static path if desired; GH Pages is used here for convenience and stability.

---

## License

MIT
