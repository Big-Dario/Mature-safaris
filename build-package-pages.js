// ═══════════════════════════════════════════════════════════
//  build-package-pages.js
//  Generates a standalone, static, SEO-indexable HTML page for every
//  safari package in PACKAGES (read out of script.js) into /packages/.
//
//  WHY THIS EXISTS:
//  The main site is a single-page app — all 37 packages share one URL,
//  one <title>, one meta description. Google can never rank an individual
//  package (e.g. "3 day Maasai Mara safari") as its own distinct result
//  under that structure, no matter how good that package's content is.
//  Each generated page here gets its own URL, unique title/description,
//  Product + BreadcrumbList structured data, and the full itinerary/
//  includes content present as real static HTML — not injected by JS —
//  so it's reliably crawlable by every search engine, not just Google.
//
//  HOW TO RUN:
//    node build-package-pages.js
//  (requires Node.js — no npm packages needed, uses only built-ins)
//
//  Re-run this any time PACKAGES changes in script.js, then commit the
//  regenerated files in /packages/ along with the updated sitemap.xml.
// ═══════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://mothernaturesafaris.com';
const IMAGE_BASE = 'https://raw.githubusercontent.com/Big-Dario/Mature-safaris/main/Images/';

// ── Load PACKAGES straight out of script.js so this can never drift
//    out of sync with the live data ──────────────────────────────
const scriptSrc = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
eval(scriptSrc.match(/var PACKAGES = \[[\s\S]*?\n\];/)[0]);

function slugify(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function truncate(str, max) {
  str = String(str);
  if (str.length <= max) return str;
  return str.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

const outDir = path.join(__dirname, 'packages');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

const sitemapEntries = [
  `  <url>\n    <loc>${SITE_URL}/</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>`
];

PACKAGES.forEach(p => {
  const slug = slugify(p.name);
  const pageUrl = `${SITE_URL}/packages/${slug}.html`;
  const imgUrl = IMAGE_BASE + p.image;
  const metaDesc = truncate(p.desc, 155);
  const oneYear = new Date(); oneYear.setFullYear(oneYear.getFullYear() + 1);
  const priceValidUntil = oneYear.toISOString().split('T')[0];

  const highlightsHtml = p.highlights.map(h =>
    `<span class="pkg-hl" style="font-size:.8rem">${escapeHtml(h)}</span>`
  ).join('');

  const itineraryHtml = p.itinerary.map(d => `
        <div class="itin-day">
          <div class="itin-day-n">${escapeHtml(d.day.replace('Day ', '').replace('Days ', ''))}</div>
          <div class="itin-day-info">
            <div class="itin-day-title">${escapeHtml(d.title)}</div>
            <div class="itin-day-desc">${escapeHtml(d.desc)}</div>
          </div>
        </div>`).join('');

  const includesHtml = p.includes.map(inc =>
    `<div class="modal-inc-item">${escapeHtml(inc)}</div>`
  ).join('');

  const encodedName = encodeURIComponent(p.name);

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.desc,
    image: imgUrl,
    url: pageUrl,
    category: 'Safari Tour Package',
    offers: {
      '@type': 'Offer',
      price: p.price,
      priceCurrency: p.currency,
      availability: 'https://schema.org/InStock',
      url: pageUrl,
      priceValidUntil: priceValidUntil
    }
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Safari Packages', item: `${SITE_URL}/#packages` },
      { '@type': 'ListItem', position: 3, name: p.name, item: pageUrl }
    ]
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${escapeHtml(p.name)} (${escapeHtml(p.duration)}) | Mother Nature Safaris</title>
<meta name="description" content="${escapeHtml(metaDesc)}"/>
<link rel="canonical" href="${pageUrl}"/>

<meta property="og:type" content="product"/>
<meta property="og:site_name" content="Mother Nature Safaris"/>
<meta property="og:title" content="${escapeHtml(p.name)} | Mother Nature Safaris"/>
<meta property="og:description" content="${escapeHtml(metaDesc)}"/>
<meta property="og:image" content="${imgUrl}"/>
<meta property="og:url" content="${pageUrl}"/>

<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(p.name)} | Mother Nature Safaris"/>
<meta name="twitter:description" content="${escapeHtml(metaDesc)}"/>
<meta name="twitter:image" content="${imgUrl}"/>

<script type="application/ld+json">${JSON.stringify(productSchema)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>

<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet"/>
<link rel="stylesheet" href="../styles.css"/>
</head>
<body>

<nav class="navbar scrolled" style="position:relative">
  <div class="nav-inner">
    <a href="../index.html" style="display:flex;align-items:center;gap:10px;text-decoration:none">
      <div class="nav-logo-icon"><span class="fallback-emoji">🌿</span></div>
      <div class="nav-logo-text">Mother Nature Safaris<span>East Africa's Finest</span></div>
    </a>
    <ul class="nav-links" style="display:flex">
      <li><a class="nav-a" href="../index.html">Home</a></li>
      <li><a class="nav-a" href="../index.html#destinations">Destinations</a></li>
      <li><a class="nav-a active" href="../index.html#packages">Packages</a></li>
      <li><a class="nav-a" href="../index.html#gallery">Gallery</a></li>
      <li><a class="nav-a" href="../index.html#about">About</a></li>
      <li><a class="nav-a" href="../index.html#contact">Contact</a></li>
    </ul>
    <a class="nav-cta" href="../index.html?package=${encodedName}#contact" style="text-decoration:none">Book a Safari</a>
  </div>
</nav>

<div style="max-width:1280px;margin:16px auto 0;padding:0 28px;font-size:.8rem;color:var(--muted)">
  <a href="../index.html" style="color:var(--muted)">Home</a> / <a href="../index.html#packages" style="color:var(--muted)">Packages</a> / <span style="color:var(--clay)">${escapeHtml(p.name)}</span>
</div>

<section class="section" style="padding-top:20px">
  <div class="section-inner">
    <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:48px;align-items:start">
      <div>
        <div style="border-radius:var(--r);overflow:hidden;aspect-ratio:16/10;background:linear-gradient(135deg,#2C1810,#3a2a0a);margin-bottom:28px">
          <img src="${imgUrl}" alt="${escapeHtml(p.name)}" style="width:100%;height:100%;object-fit:cover" loading="eager"/>
        </div>
        <div class="section-label">${escapeHtml(p.dest)} · ${escapeHtml(p.duration)}</div>
        <h1 class="section-title" style="font-size:2.4rem">${escapeHtml(p.name)}</h1>
        <p style="font-size:1rem;color:var(--muted);line-height:1.8;margin:20px 0">${escapeHtml(p.desc)}</p>

        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:36px">${highlightsHtml}</div>

        <h2 style="font-family:var(--font-serif);font-size:1.5rem;color:var(--earth);margin-bottom:16px;font-weight:400">Itinerary</h2>
        <div class="modal-itinerary" style="margin-bottom:36px">${itineraryHtml}</div>

        <h2 style="font-family:var(--font-serif);font-size:1.5rem;color:var(--earth);margin-bottom:16px;font-weight:400">What's Included</h2>
        <div class="modal-includes">${includesHtml}</div>
      </div>

      <div style="position:sticky;top:100px">
        <div style="background:var(--white);border:1px solid var(--border);border-radius:var(--r);padding:28px">
          <div class="modal-price-block" style="margin-bottom:20px">
            <span class="modal-price-label">From per person</span>
            <div class="modal-price">${escapeHtml(p.currency)} ${p.price.toLocaleString()}</div>
          </div>
          <div style="font-size:.85rem;color:var(--muted);line-height:2.2;margin-bottom:24px">
            <div>Destination: ${escapeHtml(p.dest)}</div>
            <div>Duration: ${escapeHtml(p.duration)}</div>
            <div>Accommodation: ${escapeHtml(p.accom.charAt(0).toUpperCase() + p.accom.slice(1))} level</div>
          </div>
          <a href="../index.html?package=${encodedName}#contact" class="btn-primary" style="display:block;text-align:center;text-decoration:none">Book This Safari →</a>
          <a href="../index.html#packages" style="display:block;text-align:center;margin-top:14px;font-size:.85rem;color:var(--muted);text-decoration:none">← Back to All Safaris</a>
        </div>
      </div>
    </div>
  </div>
</section>

<footer>
  <div class="footer-inner">
    <div class="footer-grid">
      <div class="footer-brand">
        <h3><span class="fallback-emoji">🌿</span> Mother Nature Safaris</h3>
        <p>Crafting unforgettable East African safari experiences since 2004. KATO and KTB certified, conservation-focused, and deeply passionate about sharing Africa's wild beauty.</p>
        <div class="certifications">
          <span class="cert-badge">KATO Certified</span>
          <span class="cert-badge">KTB Member</span>
          <span class="cert-badge">Eco Safari</span>
        </div>
      </div>
      <div class="footer-col">
        <h4>Destinations</h4>
        <ul>
          <li><a href="../index.html#kenya-destinations">Kenya Safaris</a></li>
          <li><a href="../index.html#tanzania-destinations">Tanzania & Serengeti</a></li>
          <li><a href="../index.html#uganda-destinations">Uganda Gorilla Treks</a></li>
          <li><a href="../index.html#zanzibar-destinations">Zanzibar & Coast</a></li>
          <li><a href="../index.html#packages">Multi-Country Tours</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Company</h4>
        <ul>
          <li><a href="../index.html#about">About Us</a></li>
          <li><a href="../index.html#gallery">Guest Reviews</a></li>
          <li><a href="../index.html#contact">Contact Us</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <p>© 2026 Mother Nature Safaris. All rights reserved. | <a href="https://mothernaturesafaris.com" style="color:rgba(245,230,200,.4)">mothernaturesafaris.com</a></p>
    </div>
  </div>
</footer>

</body>
</html>
`;

  fs.writeFileSync(path.join(outDir, `${slug}.html`), html);
  sitemapEntries.push(`  <url>\n    <loc>${pageUrl}</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`);
});

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries.join('\n')}\n</urlset>\n`;
fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), sitemap);

console.log(`Generated ${PACKAGES.length} package pages in /packages/`);
console.log(`Updated sitemap.xml with ${sitemapEntries.length} URLs total`);
