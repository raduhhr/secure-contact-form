# secure-contact-form

A **secure contact form system** built with **Cloudflare Pages + Cloudflare Worker + AWS SES**.  
It allows static websites to handle reliable form submissions without exposing mail servers directly, and includes bot protection via **Cloudflare Turnstile**.

---

## Overview

- **Frontend (`index.html`)**
  - Static HTML contact form.
  - Collects: Name, Email, Phone, Message.
  - Includes **Cloudflare Turnstile CAPTCHA** for spam/bot protection.
  - Deployed on **Cloudflare Pages**: https://raduhhr.xyz/

- **Backend (`form-worker/`)**
  - Cloudflare Worker handles form submissions (`fetch` handler).
  - Supports `POST` (with CORS).
  - Validates Turnstile token using secret key.
  - On success → sends the form data via **AWS SES**.
  - Returns JSON responses (errors or success).

- **Email Delivery**
  - Uses **AWS Simple Email Service (SES)**.
  - Relies on configured IAM credentials, region, and verified domain.
  - DNS records (SPF, DKIM, DMARC) ensure proper mail authentication.

**Result:**  
A secure, reliable pipeline for handling contact form submissions on static sites — no dedicated backend server required.

---

## How It Works

```
User submits form (index.html)
 ├─ POST → Cloudflare Worker (/form-worker)
 │    ├─ Validate Turnstile token
 │    ├─ If invalid → reject (400)
 │    └─ If valid → SendEmailCommand (AWS SES)
 └─ SES delivers email to configured recipient
```

---

## Repo Layout

```
secure-contact-form/
├── index.html                 # Frontend contact form
└── form-worker/               # Cloudflare Worker backend
    ├── src/index.js           # Worker code (validation + SES)
    ├── test/index.spec.js     # Vitest test
    ├── package.json           # Dependencies
    ├── wrangler.toml          # Worker config (AWS_REGION etc.)
    └── ...
```

---

## Installation

### Prerequisites
- Cloudflare account (Pages + Workers)
- AWS SES account (verified domain + credentials)
- Turnstile site + secret keys

### Setup
1. **Frontend (Pages)**
   - Deploy `index.html` via Cloudflare Pages.
   - Add your Turnstile **site key** in the form.

2. **Backend (Worker)**
   - In `form-worker/`, install deps:
     ```bash
     npm install
     ```
   - Set required secrets:
     ```bash
     npx wrangler secret put AWS_ACCESS_KEY_ID
     npx wrangler secret put AWS_SECRET_ACCESS_KEY
     npx wrangler secret put TURNSTILE_SECRET_KEY
     ```
   - Deploy:
     ```bash
     npm run deploy
     ```

3. **AWS SES**
   - Verify your sending domain.
   - Configure SES region (`wrangler.toml` → `AWS_REGION`).
   - Set up DNS (SPF, DKIM, DMARC) for deliverability.

---

## Usage

- Visit the deployed Cloudflare Pages site (`raduhhr.xyz`).
- Fill out the form + solve the Turnstile CAPTCHA.
- On submit:
  - Worker validates CAPTCHA.
  - SES sends the email to your configured address.
- Response is shown as JSON or in-page confirmation.

---

## Why I Built It

Most static site hosts don’t offer secure, customizable form handling.  
This project provides a **serverless, reliable, and secure contact form** without needing a full backend stack.  

---

## License

MIT
