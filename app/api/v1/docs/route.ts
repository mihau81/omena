/**
 * GET /api/v1/docs
 * Returns an HTML documentation page describing all public API v1 endpoints.
 */

import { NextResponse } from 'next/server';

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Omena Auction API v1 — Documentation</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#faf9f7;color:#2d2417;line-height:1.6}
    .container{max-width:900px;margin:0 auto;padding:2rem 1.5rem}
    h1{font-size:2rem;font-weight:700;color:#1a160e;margin-bottom:.5rem}
    .subtitle{color:#7c6e5e;font-size:1rem;margin-bottom:2.5rem}
    h2{font-size:1.25rem;font-weight:700;color:#1a160e;margin:2.5rem 0 .75rem;border-bottom:2px solid #e8e0d6;padding-bottom:.5rem}
    h3{font-size:1rem;font-weight:600;color:#1a160e;margin:1.5rem 0 .5rem}
    p{margin-bottom:.75rem;color:#4a3f33}
    code{background:#f0ebe4;border:1px solid #ddd5c8;border-radius:3px;padding:.1em .35em;font-size:.875em;font-family:'SF Mono',Menlo,monospace}
    pre{background:#1a160e;color:#f0ebe4;border-radius:8px;padding:1.25rem 1.5rem;overflow-x:auto;margin:1rem 0;font-size:.85rem;line-height:1.7}
    pre code{background:none;border:none;padding:0;color:inherit}
    .endpoint{background:#fff;border:1px solid #e8e0d6;border-radius:10px;padding:1.25rem 1.5rem;margin-bottom:1.25rem}
    .method{display:inline-block;background:#c8a96e;color:#fff;font-size:.75rem;font-weight:700;padding:.2em .55em;border-radius:4px;letter-spacing:.05em;margin-right:.5rem;vertical-align:middle}
    .path{font-family:'SF Mono',Menlo,monospace;font-size:.95rem;font-weight:600;vertical-align:middle}
    table{width:100%;border-collapse:collapse;margin:1rem 0;font-size:.9rem}
    th{background:#f0ebe4;text-align:left;padding:.5rem .75rem;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;color:#7c6e5e;border-bottom:1px solid #e8e0d6}
    td{padding:.5rem .75rem;border-bottom:1px solid #f0ebe4;vertical-align:top}
    tr:last-child td{border-bottom:none}
    .badge{display:inline-block;font-size:.7rem;font-weight:600;padding:.15em .45em;border-radius:3px;letter-spacing:.03em}
    .badge-get{background:#e8f4ec;color:#2e7d32}
    .badge-req{background:#fff3e0;color:#e65100}
    .badge-opt{background:#f3f3f3;color:#555}
    .note{background:#fffbf0;border-left:3px solid #c8a96e;padding:.75rem 1rem;border-radius:0 6px 6px 0;margin:1rem 0;font-size:.9rem}
    .toc{background:#fff;border:1px solid #e8e0d6;border-radius:10px;padding:1.25rem 1.5rem;margin-bottom:2rem}
    .toc li{margin:.3rem 0}
    .toc a{color:#c8a96e;text-decoration:none}
    .toc a:hover{text-decoration:underline}
    footer{margin-top:3rem;padding-top:1.5rem;border-top:1px solid #e8e0d6;font-size:.875rem;color:#9c8e7e;text-align:center}
  </style>
</head>
<body>
<div class="container">
  <h1>Omena Auction — Public API v1</h1>
  <p class="subtitle">Read-only API for third-party auction aggregators (Invaluable, Artnet, Barnebys, etc.)</p>

  <div class="toc">
    <h3 style="margin-top:0">Table of Contents</h3>
    <ol style="padding-left:1.25rem">
      <li><a href="#authentication">Authentication</a></li>
      <li><a href="#rate-limiting">Rate Limiting</a></li>
      <li><a href="#response-format">Response Format</a></li>
      <li><a href="#endpoints">Endpoints</a>
        <ul style="padding-left:1.25rem;margin-top:.25rem">
          <li><a href="#list-auctions">List Auctions</a></li>
          <li><a href="#get-auction">Get Single Auction</a></li>
          <li><a href="#list-lots">List Lots for Auction</a></li>
          <li><a href="#get-lot">Get Single Lot</a></li>
          <li><a href="#search-lots">Search Lots</a></li>
        </ul>
      </li>
      <li><a href="#data-model">Data Model Notes</a></li>
    </ol>
  </div>

  <!-- Authentication -->
  <h2 id="authentication">Authentication</h2>
  <p>All API requests require an API key passed in the <code>Authorization</code> header:</p>
  <pre><code>Authorization: Bearer YOUR_API_KEY</code></pre>
  <p>API keys are issued by the auction house admin panel. Contact the auction house to request a key for your platform.</p>
  <div class="note">
    <strong>Security:</strong> API keys are single-use secrets shown only once at creation time. Store your key securely. If a key is compromised, contact the auction house to revoke it.
  </div>

  <!-- Rate Limiting -->
  <h2 id="rate-limiting">Rate Limiting</h2>
  <p>Each API key has a per-hour request limit (default: 1,000 requests/hour). The following headers are returned on every response:</p>
  <table>
    <tr><th>Header</th><th>Description</th></tr>
    <tr><td><code>X-RateLimit-Remaining</code></td><td>Requests remaining in the current window</td></tr>
  </table>
  <p>When the limit is exceeded, the API returns <code>429 Too Many Requests</code>. Contact the auction house if you need a higher limit.</p>

  <!-- Response Format -->
  <h2 id="response-format">Response Format</h2>
  <p>All successful responses use the structure:</p>
  <pre><code>{
  "data": &lt;object or array&gt;,
  "meta": {
    "total": 42,
    "limit": 20,
    "offset": 0
  }
}</code></pre>
  <p>Error responses:</p>
  <pre><code>{
  "error": "Human-readable error message"
}</code></pre>
  <p>HTTP status codes follow standard conventions: <code>200</code> OK, <code>400</code> Bad Request, <code>401</code> Unauthorized, <code>404</code> Not Found, <code>429</code> Too Many Requests, <code>500</code> Server Error.</p>
  <p>All monetary values are in <strong>PLN (Polish Zloty), expressed in whole units</strong> (e.g., 5000 = 5,000 PLN).</p>
  <p>Timestamps are in <strong>ISO 8601 format with timezone offset</strong>.</p>

  <!-- Endpoints -->
  <h2 id="endpoints">Endpoints</h2>
  <p>Base URL: <code>https://&lt;host&gt;/api/v1</code></p>
  <p>Only data with <code>visibility_level = "0"</code> (Public) and appropriate status is returned. Draft and private content is never exposed.</p>

  <!-- List Auctions -->
  <div class="endpoint" id="list-auctions">
    <div style="margin-bottom:.75rem"><span class="method">GET</span><span class="path">/api/v1/auctions</span></div>
    <p>Returns a paginated list of public auctions. Only auctions with status <code>preview</code>, <code>live</code>, or <code>archive</code> are returned.</p>
    <h3>Query Parameters</h3>
    <table>
      <tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr>
      <tr><td><code>status</code></td><td>string</td><td><span class="badge badge-opt">optional</span></td><td>Comma-separated status filter. Values: <code>preview</code>, <code>live</code>, <code>archive</code>. Default: all three.</td></tr>
      <tr><td><code>limit</code></td><td>integer</td><td><span class="badge badge-opt">optional</span></td><td>Max results per page (1–100). Default: <code>20</code>.</td></tr>
      <tr><td><code>offset</code></td><td>integer</td><td><span class="badge badge-opt">optional</span></td><td>Pagination offset. Default: <code>0</code>.</td></tr>
    </table>
    <h3>Example Request</h3>
    <pre><code>GET /api/v1/auctions?status=live,archive&amp;limit=10&amp;offset=0
Authorization: Bearer YOUR_API_KEY</code></pre>
    <h3>Example Response</h3>
    <pre><code>{
  "data": [
    {
      "id": "uuid",
      "slug": "spring-auction-2025",
      "title": "Spring Auction 2025",
      "description": "...",
      "category": "mixed",
      "startDate": "2025-04-10T10:00:00+02:00",
      "endDate": "2025-04-10T18:00:00+02:00",
      "location": "Warsaw, Poland",
      "curator": "Anna Kowalska",
      "status": "archive",
      "visibilityLevel": "0",
      "buyersPremiumRate": "0.2000",
      "createdAt": "2025-01-15T09:00:00+01:00",
      "updatedAt": "2025-04-11T10:00:00+02:00",
      "lotCount": 84
    }
  ],
  "meta": { "total": 12, "limit": 10, "offset": 0 }
}</code></pre>
  </div>

  <!-- Get Single Auction -->
  <div class="endpoint" id="get-auction">
    <div style="margin-bottom:.75rem"><span class="method">GET</span><span class="path">/api/v1/auctions/:slug</span></div>
    <p>Returns a single public auction by its slug, including lot count.</p>
    <h3>Path Parameters</h3>
    <table>
      <tr><th>Parameter</th><th>Description</th></tr>
      <tr><td><code>slug</code></td><td>The auction's URL slug (e.g., <code>spring-auction-2025</code>)</td></tr>
    </table>
    <h3>Example Request</h3>
    <pre><code>GET /api/v1/auctions/spring-auction-2025
Authorization: Bearer YOUR_API_KEY</code></pre>
  </div>

  <!-- List Lots for Auction -->
  <div class="endpoint" id="list-lots">
    <div style="margin-bottom:.75rem"><span class="method">GET</span><span class="path">/api/v1/auctions/:slug/lots</span></div>
    <p>Returns all lots for a specific public auction with primary image URLs and estimates.</p>
    <h3>Path Parameters</h3>
    <table>
      <tr><th>Parameter</th><th>Description</th></tr>
      <tr><td><code>slug</code></td><td>The auction's URL slug</td></tr>
    </table>
    <h3>Query Parameters</h3>
    <table>
      <tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr>
      <tr><td><code>status</code></td><td>string</td><td><span class="badge badge-opt">optional</span></td><td>Comma-separated lot status filter. Values: <code>published</code>, <code>active</code>, <code>sold</code>, <code>passed</code>. Default: all four.</td></tr>
      <tr><td><code>limit</code></td><td>integer</td><td><span class="badge badge-opt">optional</span></td><td>Max results per page (1–100). Default: <code>50</code>.</td></tr>
      <tr><td><code>offset</code></td><td>integer</td><td><span class="badge badge-opt">optional</span></td><td>Pagination offset. Default: <code>0</code>.</td></tr>
    </table>
    <h3>Example Request</h3>
    <pre><code>GET /api/v1/auctions/spring-auction-2025/lots?status=sold&amp;limit=50
Authorization: Bearer YOUR_API_KEY</code></pre>
  </div>

  <!-- Get Single Lot -->
  <div class="endpoint" id="get-lot">
    <div style="margin-bottom:.75rem"><span class="method">GET</span><span class="path">/api/v1/lots/:id</span></div>
    <p>Returns a single lot with full details: all images (multiple resolutions), estimates, current bid/hammer price, provenance, exhibitions, and literature references.</p>
    <h3>Path Parameters</h3>
    <table>
      <tr><th>Parameter</th><th>Description</th></tr>
      <tr><td><code>id</code></td><td>The lot's UUID (obtained from the auction lots list)</td></tr>
    </table>
    <h3>Response Fields</h3>
    <table>
      <tr><th>Field</th><th>Type</th><th>Description</th></tr>
      <tr><td><code>estimateMin</code> / <code>estimateMax</code></td><td>integer</td><td>Estimate range in PLN</td></tr>
      <tr><td><code>startingBid</code></td><td>integer | null</td><td>Opening bid in PLN (null = no override)</td></tr>
      <tr><td><code>hammerPrice</code></td><td>integer | null</td><td>Final sale price in PLN (null if not sold yet)</td></tr>
      <tr><td><code>currentBid</code></td><td>integer | null</td><td>Highest active bid in PLN (null if no bids)</td></tr>
      <tr><td><code>bidCount</code></td><td>integer</td><td>Total number of valid bids placed</td></tr>
      <tr><td><code>images</code></td><td>array</td><td>All media for the lot (images and YouTube)</td></tr>
      <tr><td><code>images[].url</code></td><td>string</td><td>Original image URL</td></tr>
      <tr><td><code>images[].thumbnailUrl</code></td><td>string | null</td><td>400px thumbnail URL</td></tr>
      <tr><td><code>images[].mediumUrl</code></td><td>string | null</td><td>800px medium URL</td></tr>
      <tr><td><code>images[].largeUrl</code></td><td>string | null</td><td>1600px large URL</td></tr>
      <tr><td><code>provenance</code></td><td>string[]</td><td>Provenance history entries</td></tr>
      <tr><td><code>exhibitions</code></td><td>string[]</td><td>Exhibition history entries</td></tr>
      <tr><td><code>literature</code></td><td>string[]</td><td>Bibliography/literature references</td></tr>
    </table>
    <h3>Example Request</h3>
    <pre><code>GET /api/v1/lots/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer YOUR_API_KEY</code></pre>
  </div>

  <!-- Search Lots -->
  <div class="endpoint" id="search-lots">
    <div style="margin-bottom:.75rem"><span class="method">GET</span><span class="path">/api/v1/lots/search</span></div>
    <p>Search for lots across all public auctions by title, artist name, or year range. Results include primary image and auction context.</p>
    <h3>Query Parameters</h3>
    <table>
      <tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr>
      <tr><td><code>q</code></td><td>string</td><td><span class="badge badge-opt">optional</span></td><td>Search term (min 2 chars). Searches title and artist fields.</td></tr>
      <tr><td><code>artist</code></td><td>string</td><td><span class="badge badge-opt">optional</span></td><td>Filter by artist name (partial match, case-insensitive).</td></tr>
      <tr><td><code>yearMin</code></td><td>integer</td><td><span class="badge badge-opt">optional</span></td><td>Minimum creation year (inclusive).</td></tr>
      <tr><td><code>yearMax</code></td><td>integer</td><td><span class="badge badge-opt">optional</span></td><td>Maximum creation year (inclusive).</td></tr>
      <tr><td><code>status</code></td><td>string</td><td><span class="badge badge-opt">optional</span></td><td>Comma-separated lot status filter. Values: <code>published</code>, <code>active</code>, <code>sold</code>, <code>passed</code>.</td></tr>
      <tr><td><code>limit</code></td><td>integer</td><td><span class="badge badge-opt">optional</span></td><td>Max results per page (1–100). Default: <code>20</code>.</td></tr>
      <tr><td><code>offset</code></td><td>integer</td><td><span class="badge badge-opt">optional</span></td><td>Pagination offset. Default: <code>0</code>.</td></tr>
    </table>
    <h3>Example Request</h3>
    <pre><code>GET /api/v1/lots/search?q=Picasso&amp;yearMin=1900&amp;yearMax=1973&amp;status=sold
Authorization: Bearer YOUR_API_KEY</code></pre>
  </div>

  <!-- Data Model Notes -->
  <h2 id="data-model">Data Model Notes</h2>
  <table>
    <tr><th>Auction Status</th><th>Meaning</th></tr>
    <tr><td><code>preview</code></td><td>Catalog visible, bidding not open yet</td></tr>
    <tr><td><code>live</code></td><td>Bidding is active</td></tr>
    <tr><td><code>archive</code></td><td>Auction concluded, read-only results</td></tr>
  </table>
  <table style="margin-top:1rem">
    <tr><th>Lot Status</th><th>Meaning</th></tr>
    <tr><td><code>published</code></td><td>Visible in catalog, not yet biddable</td></tr>
    <tr><td><code>active</code></td><td>Open for bidding</td></tr>
    <tr><td><code>sold</code></td><td>Hammer price achieved</td></tr>
    <tr><td><code>passed</code></td><td>Did not meet reserve / no bids</td></tr>
  </table>
  <div class="note" style="margin-top:1.25rem">
    <strong>Buyer's Premium:</strong> The <code>buyersPremiumRate</code> field on auctions is a decimal (e.g., <code>"0.2000"</code> = 20%). The total buyer cost is <code>hammerPrice × (1 + buyersPremiumRate)</code>. Some auctions may use sliding-scale tiers — contact the auction house for tier details if needed.
  </div>

  <footer>
    Omena Auction CMS &mdash; API v1 &mdash; All data is read-only and represents public catalog information.
  </footer>
</div>
</body>
</html>`;

export async function GET() {
  return new NextResponse(HTML, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
