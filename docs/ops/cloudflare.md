---
title: Cloudflare setup
---

Reproducible steps for the Cloudflare zone that sits in front of wordavi. This is the DNS and TLS layer of the [[deployment]] architecture; once it is in place, day-to-day operation is covered by the [[runbook]].

Throughout, `<VPS_IP>` is a placeholder for the origin server's public address.

## 1. DNS records

In **DNS &rarr; Records**, create three records, all **Proxied** (orange cloud):

| Type  | Name   | Content       | Proxy    |
| ----- | ------ | ------------- | -------- |
| A     | `@`    | `<VPS_IP>`    | Proxied  |
| CNAME | `www`  | `wordavi.com` | Proxied  |
| CNAME | `docs` | `wordavi.com` | Proxied  |

The apex `A` record points at the origin; `www` and `docs` are aliases onto the apex so they resolve to the same Cloudflare edge. Routing to the right container behind the origin is the edge proxy's job (see [[deployment]]).

## 2. TLS mode

In **SSL/TLS &rarr; Overview**, set the encryption mode to **Full (strict)**. This requires the origin to present a certificate that Cloudflare trusts on the origin hop — which is exactly what the origin certificate below provides.

## 3. Always Use HTTPS

In **SSL/TLS &rarr; Edge Certificates**, enable **Always Use HTTPS** so plain-HTTP requests are redirected to HTTPS at the edge.

## 4. Origin certificate

In **SSL/TLS &rarr; Origin Server &rarr; Create Certificate**:

- Let Cloudflare generate the private key and CSR.
- Key type: **RSA (2048)**.
- Hostnames: `wordavi.com` and `*.wordavi.com` (apex plus wildcard, so `www` and `docs` are both covered).
- Validity: **15 years**.

Cloudflare returns a certificate and a private key. These are trusted only by Cloudflare on the origin hop — they are not a public CA cert, which is why the zone must stay in Full (strict) and proxied.

Conceptually, the certificate and key are installed as **secrets on the edge proxy**: the standalone Caddy deployment presents them on the origin connection for `wordavi.com` and `*.wordavi.com`. They live only on the VPS with the edge proxy and are never committed to the repository.

## 5. Lock the origin to Cloudflare

The origin certificate protects the *content* of the connection, but the origin IP can still be probed directly. Close that path at the VPS firewall: allow inbound `80`/`443` only from **Cloudflare's published IP ranges**, and drop everything else. Combined with Full (strict), this means the only way to reach the origin is a genuine, Cloudflare-proxied request.

## 6. Caching, and the one setting the origin cannot decide

The documentation site is the awkward one: Quartz emits no fingerprinted
filenames, so every build overwrites the same `/postscript.js` and
`/static/contentIndex.json` (see [[pipeline]]). Those are served `no-store`, with
`CDN-Cache-Control: no-store` alongside it, which is what keeps the edge from
holding a copy of a build that has been replaced.

Origin headers settle the edge, but **not the browser**. The zone's
**Caching &rarr; Browser Cache TTL** rewrites the `Cache-Control` a browser
receives, whatever the origin said — with a fixed value set, a visitor pins the
documentation's scripts for that long and keeps running the previous build after
a deploy. Set it to **Respect Existing Headers**, or add a Cache Rule for
`docs.wordavi.com` that does the same for that hostname alone.

After a deploy that changes the documentation's scripts, **Caching &rarr;
Configuration &rarr; Purge Everything** (or a purge by URL) clears anything the
edge is still holding from before this was in place.

The app is unaffected: it fingerprints its assets, so a stale copy of one is
simply never asked for.

## Result

- Browsers connect to Cloudflare over HTTPS; Cloudflare connects to `<VPS_IP>` over HTTPS validated against the origin certificate.
- `www` redirects to the apex and `docs` serves the documentation site, both handled past the edge proxy.
- The origin answers only to Cloudflare — see [[deployment]] for how requests flow from the edge proxy into the app and docs containers.
