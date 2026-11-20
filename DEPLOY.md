# PDFToolKit - Production Deployment Runbook

PDFToolKit is designed with a **dual deployment architecture**. Because 100% of PDF processing runs directly in user browser memory, you can deploy it either as a **$0/mo static website** on Cloudflare Pages (or GitHub Pages) or as a **classic PHP application** on shared Apache cPanel hosting.

---

## Architecture Summary

| Deployment Model | Monthly Hosting Cost | Server Requirements | Scalability |
| :--- | :---: | :--- | :--- |
| **Option A: Cloudflare Pages** *(Recommended)* | **$0 / month** | None (Static HTML/CSS/WASM edge hosting) | Unlimited bandwidth, global edge CDN, DDOS mitigation |
| **Option B: Shared PHP Hosting** | $1 – $5 / month | PHP 8.1+ & Apache `mod_rewrite` | Standard cPanel/Hostinger/Namecheap limits |

---

## Option A: Deploying to Cloudflare Pages ($0/mo — Recommended)

Cloudflare Pages provides unlimited bandwidth, instant global asset delivery, and free automatic SSL certificates.

### Step 1: Compile CSS & Generate the Static Build
From the repository root on your local machine, run:

```powershell
# 1. Compile production minified Tailwind CSS v4
npm run build:css
# Alternatively: .\scripts\build-css.ps1

# 2. Export clean static pages into dist/
php scripts/build-static.php --base-url=https://yourdomain.com --ad-mode=off
```

This generates a fully self-contained static release inside the **`dist/`** directory:
- `dist/index.html` (Homepage with all 15 active tools)
- `dist/merge-pdf/index.html` ... `dist/ocr-pdf/index.html` (All 15 tool views)
- `dist/about/`, `dist/contact/`, `dist/licenses/`, `dist/privacy-policy/`, `dist/terms/`
- `dist/404.html`
- `dist/sitemap.xml`, `dist/robots.txt`, `dist/ads.txt`, `dist/site.webmanifest`
- `dist/_headers` (Pre-configured security headers, caching policies, and `application/wasm` MIME)
- `dist/_redirects` (Clean canonical rewrites)
- `dist/assets/` (Including `assets/vendor/qpdf/qpdf.wasm` and `assets/css/tailwind.min.css`)

### Step 2: Deploy to Cloudflare Pages

#### Method 1: Git Integration (Continuous Deployment)
1. Push your repository to GitHub or GitLab.
2. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/) and navigate to **Workers & Pages** &rarr; **Create application** &rarr; **Pages** &rarr; **Connect to Git**.
3. Select your `PDFToolKit` repository.
4. Configure Build Settings:
   - **Framework preset:** `None`
   - **Build command:** `npx @tailwindcss/cli -i assets/css/tailwind.input.css -o assets/css/tailwind.min.css --minify && php scripts/build-static.php --base-url=https://yourdomain.com --ad-mode=off`
   - **Build output directory:** `dist`
5. Click **Save and Deploy**.

#### Method 2: Direct Upload via Wrangler CLI
```bash
npm install -g wrangler
wrangler pages deploy dist --project-name=pdftoolkit
```

### Step 3: Custom Domain & SSL
1. In Cloudflare Pages, go to **Custom domains** &rarr; **Set up a domain**.
2. Enter your apex domain (`yourdomain.com`) or subdomain. Cloudflare will automatically provision a free universal SSL certificate with HTTP/3 and automated HTTPS redirection.

---

## Option B: Deploying to Shared PHP Hosting (cPanel / Hostinger / Namecheap)

If you already own shared cPanel hosting running Apache and PHP:

### Step 1: Compile Production CSS Locally
```powershell
npm run build:css
```

### Step 2: Upload Files to `public_html`
Upload all project files to your server's `public_html` root directory, **excluding**:
- `dist/`
- `node_modules/`
- `scripts/`
- `.git/`

Ensure the following critical files are in place:
- `.htaccess` (Ensures clean URLs, compression, security headers, and `.wasm` MIME type)
- `index.php`, `router.php`, `sitemap.php`, `robots.txt`, `ads.txt`, `site.webmanifest`
- `includes/`
- `pages/`
- `tools/`
- `assets/` (Including `assets/vendor/qpdf/qpdf.wasm` and `assets/css/tailwind.min.css`)

### Step 3: Configure Host Overrides
Create `includes/config.local.php` in your hosting directory:

```php
<?php
declare(strict_types=1);

define('SITE_URL', 'https://yourdomain.com');
define('CONTACT_EMAIL', 'support@yourdomain.com');

// Start with ad mode 'off' while submitting for AdSense review
define('AD_MODE', 'off');
define('ADSENSE_PUBLISHER_ID', 'ca-pub-0000000000000000');
```

---

## Google AdSense & Search Console Launch Sequence

To ensure high-probability approval without "Low Value Content" or "Site Under Construction" policy rejections:

### Phase 1: Pre-Submission Setup
1. **Set `AD_MODE = 'off'`**:
   Ensure `AD_MODE` is set to `'off'` in `config.php` (or `config.local.php`). This prevents empty gray placeholder boxes from appearing during reviewer evaluation.
2. **Verify Required Pages**:
   Confirm all trust pages are live and accessible:
   - `https://yourdomain.com/about`
   - `https://yourdomain.com/contact`
   - `https://yourdomain.com/licenses`
   - `https://yourdomain.com/privacy-policy`
   - `https://yourdomain.com/terms`
3. **Submit Sitemap in Google Search Console**:
   - Add your property to [Google Search Console](https://search.google.com/search-console).
   - Submit `https://yourdomain.com/sitemap.xml`.
   - Verify that all 15 tools and pages index properly.

### Phase 2: AdSense Application
1. Sign in to [Google AdSense](https://adsense.google.com/) and submit your site for review.
2. Update **`ads.txt`** at your domain root with your real Publisher ID:
   ```
   google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
   ```
3. Wait for AdSense domain verification and approval email (typically 2–7 business days).

### Phase 3: Activating Live Ad Units
Once approved:
1. In `includes/config.local.php` (or re-exporting with `build-static.php --ad-mode=adsense`):
   ```php
   define('AD_MODE', 'adsense');
   define('ADSENSE_PUBLISHER_ID', 'ca-pub-XXXXXXXXXXXXXXXX');
   define('ADSENSE_SLOTS', [
       'top-banner'    => '1111111111',
       'in-tool'       => '2222222222',
       'bottom-banner' => '3333333333',
   ]);
   ```
2. Ad slots will automatically populate responsive, CLS-safe Google ad units separated cleanly from tool action buttons.

---

## Security & Maintenance Checklist

- [x] **No File Uploads**: Zero server storage or temp uploads.
- [x] **CSP Compliance**: Content Security Policy allows `'wasm-unsafe-eval'`, `blob:` workers, and `data:` canvases.
- [x] **MIME Type**: `.wasm` files served with `Content-Type: application/wasm` for streaming WebAssembly instantiation.
- [x] **Cookie Consent**: Google Consent Mode v2 integrated with denied defaults until user acceptance.
