# Cloudflare + Vercel Setup Guide

## Arsitektur

```
drifee.briga.id (Cloudflare DNS + CDN + SSL)
    ↓
Vercel (Next.js Hosting + API Routes)
    ↓
OSRM Public Server (Routing)
```

---

## Step 1: Deploy ke Vercel

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Login
vercel login

# 3. Deploy
vercel

# 4. Set environment variables
vercel env add NEXT_PUBLIC_APP_URL
vercel env add ALLOWED_ORIGINS
vercel env add OSRM_URL
```

---

## Step 2: Setup DNS di Cloudflare

### 2.1 Login ke Cloudflare Dashboard
- Buka https://dash.cloudflare.com
- Pilih domain `briga.id`

### 2.2 Add DNS Record
```
Type:    CNAME
Name:    drivee
Target:  cname.vercel-dns.com
Proxy:   ✅ Enabled (Orange Cloud)
TTL:     Auto
```

### 2.3 Verify DNS
```bash
# Check DNS propagation
nslookup drifee.briga.id
# Should return: cname.vercel-dns.com
```

---

## Step 3: Setup SSL/TLS di Cloudflare

### 3.1 SSL/TLS Overview
```
SSL/TLS → Overview
Mode: Full (strict)
```

### 3.2 Edge Certificates
```
SSL/TLS → Edge Certificates
✅ Always Use HTTPS
✅ Automatic HTTPS Rewrites
Minimum TLS Version: 1.2
```

### 3.3 Origin Server (Optional)
Jika ingin origin certificate:
```
SSL/TLS → Origin Server
✅ Create Certificate
```

---

## Step 4: Setup Caching di Cloudflare

### 4.1 Caching Configuration
```
Caching → Configuration
Caching Level: Standard
Browser Cache TTL: 4 hours
Always Online: ✅ Enabled
```

### 4.2 Page Rules (Optional)
```
Caching → Configuration → Page Rules

Rule 1: drifee.briga.id/_next/static/*
  → Cache Level: Cache Everything
  → Edge Cache TTL: 1 month

Rule 2: drifee.briga.id/api/*
  → Cache Level: Bypass

Rule 3: drifee.briga.id/sw.js
  → Cache Level: Bypass
```

---

## Step 5: Setup Security di Cloudflare

### 5.1 Security Level
```
Security → Settings
Security Level: Medium
Challenge Passage: 30 minutes
```

### 5.2 WAF (Web Application Firewall)
```
Security → WAF
✅ Managed rules (Cloudflare Free)
```

### 5.3 Bot Fight Mode
```
Security → Bots
✅ Bot Fight Mode
```

---

## Step 6: Setup Speed Optimization

### 6.1 Auto Minify
```
Speed → Optimization → Auto Minify
✅ JavaScript
✅ CSS
✅ HTML
```

### 6.2 Brotli
```
Speed → Optimization → Brotli
✅ Enabled
```

### 6.3 Early Hints
```
Speed → Optimization → Early Hints
✅ Enabled
```

---

## Step 7: Verify Setup

### 7.1 Check DNS
```bash
dig drifee.briga.id +short
# Should return: cname.vercel-dns.com
```

### 7.2 Check SSL
```bash
curl -I https://drifee.briga.id
# Should return: HTTP/2 200
```

### 7.3 Check CORS
```bash
curl -I -X OPTIONS https://drifee.briga.id/api/trips/verify \
  -H "Origin: https://drifee.briga.id" \
  -H "Access-Control-Request-Method: POST"
# Should return: Access-Control-Allow-Origin: https://drifee.briga.id
```

### 7.4 Check Service Worker
```bash
curl -I https://drifee.briga.id/sw.js
# Should return: 200 OK
```

---

## Environment Variables di Vercel

```
NEXT_PUBLIC_APP_URL=https://drifee.briga.id
ALLOWED_ORIGINS=https://drifee.briga.id
OSRM_URL=https://router.project-osrm.org
```

---

## Troubleshooting

### Domain tidak bisa diakses
1. Check DNS propagation: `nslookup drifee.briga.id`
2. Check Cloudflare proxy status (orange cloud)
3. Check Vercel domain settings

### SSL error
1. Set SSL mode ke Full (strict)
2. Wait 5-10 minutes for certificate provisioning
3. Check Edge Certificates status

### CORS error
1. Check ALLOWED_ORIGINS env var
2. Check next.config.js headers
3. Check Cloudflare WAF rules

### Service Worker tidak jalan
1. Check sw.js accessible: `curl -I https://drifee.briga.id/sw.js`
2. Check Cache-Control headers
3. Check HTTPS (SW requires HTTPS)

---

## Production Checklist

- [ ] DNS record CNAME → cname.vercel-dns.com
- [ ] Cloudflare proxy enabled (orange cloud)
- [ ] SSL/TLS mode: Full (strict)
- [ ] Always Use HTTPS: enabled
- [ ] Environment variables set in Vercel
- [ ] CORS headers working
- [ ] Service Worker registered
- [ ] PWA installable
- [ ] API endpoint responding
- [ ] OSRM routing working
