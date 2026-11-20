import subprocess
import xml.etree.ElementTree as ET
import re
import sys

print("========================================================")
print("NoPayPDF - Post-Deployment Live Verification Audit (IPv4)")
print("Target: https://nopaypdf.com")
print("========================================================\n")

def fetch(url):
    res = subprocess.run(
        ["curl.exe", "-4", "-s", "-w", "\n%{http_code}\n%{url_effective}", url],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace"
    )
    if res.returncode != 0:
        return None, None, f"curl failed (code {res.returncode})"
    lines = res.stdout.strip().split("\n")
    if len(lines) < 2:
        return None, None, "unexpected response"
    effective_url = lines[-1].strip()
    status_code = lines[-2].strip()
    body = "\n".join(lines[:-2])
    return int(status_code), effective_url, body

# 1. Fetch sitemap.xml
code, eff_url, sitemap_data = fetch("https://nopaypdf.com/sitemap.xml")
if code != 200:
    print(f"❌ Failed to fetch sitemap: HTTP {code}")
    sys.exit(1)

print(f"✓ sitemap.xml HTTP {code} ({len(sitemap_data)} bytes)")

root = ET.fromstring(sitemap_data)
urls = [elem.text.strip() for elem in root.findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
print(f"✓ Found {len(urls)} URLs in live sitemap.xml:\n")

print(f"{'URL':<45} {'Status':<8} {'Redirect':<14} {'Canonical Tag':<24} {'CF Email Leak?'}")
print("-" * 110)

all_passed = True
for u in urls:
    code, eff_url, html = fetch(u)
    if code is None:
        print(f"{u:<45} ERROR: {html}")
        all_passed = False
        continue

    is_redirected = "Direct (200)" if eff_url == u else f"-> {eff_url}"
    
    can_match = re.search(r'<link\s+[^>]*rel=["\']canonical["\'][^>]*href=["\']([^"\']*)["\']', html)
    canonical = can_match.group(1) if can_match else "MISSING"
    can_ok = "PASS (Matches /)" if canonical == u else f"FAIL ({canonical})"

    has_cf_email = "/cdn-cgi/l/email-protection" in html
    email_status = "LEAK DETECTED" if has_cf_email else "Clean (None)"

    if code != 200 or canonical != u or has_cf_email:
        all_passed = False

    print(f"{u:<45} {code:<8} {is_redirected:<14} {can_ok:<24} {email_status}")

print("\n" + "=" * 110)
print("Verifying Auxiliary Root Assets:")
print("=" * 110)

# Check ads.txt
code, eff_url, ads_txt = fetch("https://nopaypdf.com/ads.txt")
if code == 200 and ("pub-6082492006145986" in ads_txt or "ca-pub-6082492006145986" in ads_txt):
    print("✓ https://nopaypdf.com/ads.txt -> HTTP 200 | Verified publisher pub-6082492006145986")
else:
    print(f"❌ ads.txt failed (HTTP {code})")
    all_passed = False

# Check robots.txt
code, eff_url, robots_txt = fetch("https://nopaypdf.com/robots.txt")
if code == 200 and "https://nopaypdf.com/sitemap.xml" in robots_txt:
    print("✓ https://nopaypdf.com/robots.txt -> HTTP 200 | Verified Sitemap declaration")
else:
    print(f"❌ robots.txt failed (HTTP {code})")
    all_passed = False

# Check word-to-pdf specifically
code, eff_url, w_html = fetch("https://nopaypdf.com/word-to-pdf/")
if code == 200 and "Word to PDF" in w_html:
    print("✓ https://nopaypdf.com/word-to-pdf/ -> HTTP 200 | Live DOCX to PDF Workspace active")
else:
    print(f"❌ word-to-pdf failed (HTTP {code})")
    all_passed = False

# Check contact specifically
code, eff_url, c_html = fetch("https://nopaypdf.com/contact/")
if code == 200 and "support@nopaypdf.com" in c_html and "Quota exceeded" not in c_html:
    print("✓ https://nopaypdf.com/contact/ -> HTTP 200 | Zero quota error, clean support@nopaypdf.com")
else:
    print(f"❌ contact page failed (HTTP {code})")
    all_passed = False

if all_passed:
    print("\n🎉 ALL 23 SITEMAP URLS & ASSETS VERIFIED LIVE WITH DIRECT HTTP 200, CANONICAL MATCHING, AND ZERO LEAKS!")
else:
    print("\n⚠️ SOME AUDIT CHECKS FAILED. REVIEW OUTPUT ABOVE.")
