#!/usr/bin/env node

/**
 * Generate SVG placeholder images for the Omena art auction site.
 *
 * Usage:  node scripts/generate-placeholders.js
 *
 * Generates:
 *   public/images/auctions/lot-{1..38}.svg   (800x800, art-themed)
 *   public/images/team/{name}.svg             (800x800, portrait silhouettes)
 *   public/images/events/{name}.svg           (800x600, event-themed)
 *   public/images/press/{name}.svg            (800x600, press-themed)
 */

const fs = require("fs");
const path = require("path");

const PUBLIC = path.resolve(__dirname, "..", "public", "images");

// ---------------------------------------------------------------------------
// Omena colour palette
// ---------------------------------------------------------------------------
const C = {
  cream: "#faf8f4",
  darkBrown: "#1f0a02",
  gold: "#aa8545",
  taupe: "#70503d",
  beige: "#e7ded3",
  beigeDark: "#e0d5c7",
  goldLight: "#c9a96e",
  goldDark: "#8a6a30",
  taupeLight: "#8f7060",
  brownMid: "#3d1f10",
};

// Seeded pseudo-random for reproducibility
function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function write(subdir, filename, content) {
  const dir = path.join(PUBLIC, subdir);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, content, "utf-8");
  console.log(`  -> ${path.relative(path.resolve(__dirname, ".."), filePath)}`);
}

// ---------------------------------------------------------------------------
// LOT IMAGES  (lots 1-38, 800x800)
// ---------------------------------------------------------------------------

function generateMalarstwoLot(n) {
  // Lots 1-12: Painting — flowing organic curves and washes
  const rand = seededRandom(n * 1337);
  const colors = [C.gold, C.taupe, C.beigeDark, C.goldLight, C.brownMid, C.taupeLight];

  let paths = "";
  // Background gradient
  const bgId = `bg-m-${n}`;
  paths += `<defs>
    <linearGradient id="${bgId}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${C.cream}"/>
      <stop offset="100%" stop-color="${C.beige}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="800" fill="url(#${bgId})"/>`;

  // Organic flowing shapes (bezier curves)
  for (let i = 0; i < 5; i++) {
    const r = rand;
    const cx1 = r() * 800;
    const cy1 = r() * 800;
    const cx2 = r() * 800;
    const cy2 = r() * 800;
    const ex = r() * 800;
    const ey = r() * 800;
    const sx = r() * 800;
    const sy = r() * 800;
    const color = colors[Math.floor(r() * colors.length)];
    const opacity = 0.15 + r() * 0.35;
    paths += `<path d="M${sx.toFixed(0)},${sy.toFixed(0)} C${cx1.toFixed(0)},${cy1.toFixed(0)} ${cx2.toFixed(0)},${cy2.toFixed(0)} ${ex.toFixed(0)},${ey.toFixed(0)}"
      stroke="${color}" stroke-width="${4 + r() * 20}" fill="none" opacity="${opacity.toFixed(2)}" stroke-linecap="round"/>`;
  }

  // Large soft circles (paint washes)
  for (let i = 0; i < 3; i++) {
    const r = rand;
    const cx = r() * 800;
    const cy = r() * 800;
    const radius = 80 + r() * 200;
    const color = colors[Math.floor(r() * colors.length)];
    const opacity = 0.08 + r() * 0.18;
    paths += `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${radius.toFixed(0)}" fill="${color}" opacity="${opacity.toFixed(2)}"/>`;
  }

  // Subtle brushstroke overlay
  for (let i = 0; i < 8; i++) {
    const r = rand;
    const x1 = r() * 800;
    const y1 = r() * 800;
    const x2 = r() * 800;
    const y2 = r() * 800;
    const color = colors[Math.floor(r() * colors.length)];
    const opacity = 0.06 + r() * 0.12;
    const w = 2 + r() * 8;
    paths += `<line x1="${x1.toFixed(0)}" y1="${y1.toFixed(0)}" x2="${x2.toFixed(0)}" y2="${y2.toFixed(0)}" stroke="${color}" stroke-width="${w.toFixed(1)}" opacity="${opacity.toFixed(2)}" stroke-linecap="round"/>`;
  }

  // Lot number
  paths += `<text x="400" y="420" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="64" fill="${C.darkBrown}" opacity="0.12">${n}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">${paths}</svg>`;
}

function generateRzezbaLot(n) {
  // Lots 13-20: Sculpture — angular geometric shapes, facets
  const rand = seededRandom(n * 2741);
  const colors = [C.gold, C.taupe, C.darkBrown, C.brownMid, C.beigeDark, C.goldDark];

  let shapes = "";
  const bgId = `bg-r-${n}`;
  shapes += `<defs>
    <linearGradient id="${bgId}" x1="0" y1="0" x2="0.5" y2="1">
      <stop offset="0%" stop-color="${C.beige}"/>
      <stop offset="100%" stop-color="${C.cream}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="800" fill="url(#${bgId})"/>`;

  // Angular faceted polygons
  for (let i = 0; i < 6; i++) {
    const r = rand;
    const cx = 200 + r() * 400;
    const cy = 200 + r() * 400;
    const sides = 3 + Math.floor(r() * 4);
    const radius = 60 + r() * 180;
    const rotation = r() * Math.PI * 2;
    let points = "";
    for (let s = 0; s < sides; s++) {
      const angle = rotation + (s / sides) * Math.PI * 2;
      const px = cx + Math.cos(angle) * radius * (0.7 + r() * 0.6);
      const py = cy + Math.sin(angle) * radius * (0.7 + r() * 0.6);
      points += `${px.toFixed(0)},${py.toFixed(0)} `;
    }
    const color = colors[Math.floor(r() * colors.length)];
    const opacity = 0.1 + r() * 0.25;
    shapes += `<polygon points="${points.trim()}" fill="${color}" opacity="${opacity.toFixed(2)}"/>`;
  }

  // Sharp intersecting lines
  for (let i = 0; i < 10; i++) {
    const r = rand;
    const x1 = r() * 800;
    const y1 = r() * 800;
    const x2 = r() * 800;
    const y2 = r() * 800;
    const color = colors[Math.floor(r() * colors.length)];
    const opacity = 0.08 + r() * 0.2;
    shapes += `<line x1="${x1.toFixed(0)}" y1="${y1.toFixed(0)}" x2="${x2.toFixed(0)}" y2="${y2.toFixed(0)}" stroke="${color}" stroke-width="${1 + r() * 3}" opacity="${opacity.toFixed(2)}"/>`;
  }

  // Central geometric cluster
  const r = rand;
  const cx = 350 + r() * 100;
  const cy = 350 + r() * 100;
  for (let i = 0; i < 3; i++) {
    const w = 40 + r() * 120;
    const h = 40 + r() * 120;
    const rot = r() * 60 - 30;
    const color = colors[Math.floor(r() * colors.length)];
    const opacity = 0.1 + r() * 0.15;
    shapes += `<rect x="${(cx - w / 2).toFixed(0)}" y="${(cy - h / 2).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="${color}" opacity="${opacity.toFixed(2)}" transform="rotate(${rot.toFixed(0)} ${cx.toFixed(0)} ${cy.toFixed(0)})"/>`;
  }

  shapes += `<text x="400" y="420" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="64" fill="${C.darkBrown}" opacity="0.12">${n}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">${shapes}</svg>`;
}

function generateFotografiaLot(n) {
  // Lots 21-30: Photography — circular/lens-like patterns
  const rand = seededRandom(n * 4219);
  const colors = [C.taupe, C.brownMid, C.darkBrown, C.gold, C.beigeDark, C.taupeLight];

  let shapes = "";
  const bgId = `bg-f-${n}`;
  const radId = `rad-f-${n}`;
  shapes += `<defs>
    <radialGradient id="${bgId}" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="${C.cream}"/>
      <stop offset="100%" stop-color="${C.beigeDark}"/>
    </radialGradient>
    <radialGradient id="${radId}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${C.cream}" stop-opacity="0.4"/>
      <stop offset="70%" stop-color="${C.taupe}" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="${C.darkBrown}" stop-opacity="0.15"/>
    </radialGradient>
  </defs>
  <rect width="800" height="800" fill="url(#${bgId})"/>`;

  // Central lens/aperture shape
  shapes += `<circle cx="400" cy="400" r="280" fill="none" stroke="${C.taupe}" stroke-width="1" opacity="0.2"/>`;
  shapes += `<circle cx="400" cy="400" r="200" fill="url(#${radId})"/>`;
  shapes += `<circle cx="400" cy="400" r="140" fill="none" stroke="${C.gold}" stroke-width="0.5" opacity="0.3"/>`;

  // Concentric circles (lens elements)
  for (let i = 0; i < 6; i++) {
    const r = rand;
    const radius = 50 + i * 45 + r() * 20;
    const opacity = 0.04 + r() * 0.1;
    const color = colors[Math.floor(r() * colors.length)];
    shapes += `<circle cx="400" cy="400" r="${radius.toFixed(0)}" fill="none" stroke="${color}" stroke-width="${0.5 + r() * 2}" opacity="${opacity.toFixed(2)}"/>`;
  }

  // Aperture blades pattern
  const blades = 6 + Math.floor(rand() * 3);
  for (let i = 0; i < blades; i++) {
    const r = rand;
    const angle = (i / blades) * Math.PI * 2;
    const x1 = 400 + Math.cos(angle) * 60;
    const y1 = 400 + Math.sin(angle) * 60;
    const x2 = 400 + Math.cos(angle) * 260;
    const y2 = 400 + Math.sin(angle) * 260;
    shapes += `<line x1="${x1.toFixed(0)}" y1="${y1.toFixed(0)}" x2="${x2.toFixed(0)}" y2="${y2.toFixed(0)}" stroke="${C.taupe}" stroke-width="0.5" opacity="0.15"/>`;
  }

  // Scattered dots (grain/bokeh)
  for (let i = 0; i < 40; i++) {
    const r = rand;
    const x = r() * 800;
    const y = r() * 800;
    const radius = 1 + r() * 6;
    const color = colors[Math.floor(r() * colors.length)];
    const opacity = 0.04 + r() * 0.1;
    shapes += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${radius.toFixed(1)}" fill="${color}" opacity="${opacity.toFixed(2)}"/>`;
  }

  // Vignette effect
  shapes += `<rect width="800" height="800" fill="url(#${radId})" opacity="0.3"/>`;

  shapes += `<text x="400" y="420" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="64" fill="${C.darkBrown}" opacity="0.12">${n}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">${shapes}</svg>`;
}

function generateMixedLot(n) {
  // Lots 31-38: Mixed — combination patterns
  const rand = seededRandom(n * 6173);
  const colors = [C.gold, C.taupe, C.darkBrown, C.brownMid, C.goldLight, C.beigeDark, C.taupeLight];

  let shapes = "";
  const bgId = `bg-x-${n}`;
  shapes += `<defs>
    <linearGradient id="${bgId}" x1="0" y1="0" x2="1" y2="0.8">
      <stop offset="0%" stop-color="${C.cream}"/>
      <stop offset="50%" stop-color="${C.beige}"/>
      <stop offset="100%" stop-color="${C.cream}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="800" fill="url(#${bgId})"/>`;

  // Mix of organic curves and geometric shapes
  // Flowing curve
  for (let i = 0; i < 3; i++) {
    const r = rand;
    const sx = r() * 200;
    const sy = 200 + r() * 400;
    const cx1 = 200 + r() * 200;
    const cy1 = r() * 800;
    const cx2 = 400 + r() * 200;
    const cy2 = r() * 800;
    const ex = 600 + r() * 200;
    const ey = 200 + r() * 400;
    const color = colors[Math.floor(r() * colors.length)];
    const opacity = 0.12 + r() * 0.2;
    shapes += `<path d="M${sx.toFixed(0)},${sy.toFixed(0)} C${cx1.toFixed(0)},${cy1.toFixed(0)} ${cx2.toFixed(0)},${cy2.toFixed(0)} ${ex.toFixed(0)},${ey.toFixed(0)}" stroke="${color}" stroke-width="${3 + r() * 12}" fill="none" opacity="${opacity.toFixed(2)}" stroke-linecap="round"/>`;
  }

  // Geometric overlapping rectangles
  for (let i = 0; i < 4; i++) {
    const r = rand;
    const x = 100 + r() * 500;
    const y = 100 + r() * 500;
    const w = 60 + r() * 200;
    const h = 60 + r() * 200;
    const rot = r() * 45 - 22.5;
    const color = colors[Math.floor(r() * colors.length)];
    const opacity = 0.06 + r() * 0.14;
    shapes += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="${color}" opacity="${opacity.toFixed(2)}" rx="2" transform="rotate(${rot.toFixed(0)} ${(x + w / 2).toFixed(0)} ${(y + h / 2).toFixed(0)})"/>`;
  }

  // Circles (lens motif)
  for (let i = 0; i < 3; i++) {
    const r = rand;
    const cx = 200 + r() * 400;
    const cy = 200 + r() * 400;
    const radius = 30 + r() * 100;
    const color = colors[Math.floor(r() * colors.length)];
    const opacity = 0.08 + r() * 0.15;
    shapes += `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${radius.toFixed(0)}" fill="none" stroke="${color}" stroke-width="${1 + r() * 3}" opacity="${opacity.toFixed(2)}"/>`;
  }

  // Fine grid overlay
  for (let x = 0; x <= 800; x += 80) {
    shapes += `<line x1="${x}" y1="0" x2="${x}" y2="800" stroke="${C.taupe}" stroke-width="0.3" opacity="0.06"/>`;
  }
  for (let y = 0; y <= 800; y += 80) {
    shapes += `<line x1="0" y1="${y}" x2="800" y2="${y}" stroke="${C.taupe}" stroke-width="0.3" opacity="0.06"/>`;
  }

  shapes += `<text x="400" y="420" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="64" fill="${C.darkBrown}" opacity="0.12">${n}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">${shapes}</svg>`;
}

function generateLot(n) {
  if (n <= 12) return generateMalarstwoLot(n);
  if (n <= 20) return generateRzezbaLot(n);
  if (n <= 30) return generateFotografiaLot(n);
  return generateMixedLot(n);
}

// ---------------------------------------------------------------------------
// TEAM MEMBER IMAGES  (800x800, portrait silhouettes)
// ---------------------------------------------------------------------------
const teamMembers = [
  "aleksandra-wisniewska",
  "andrzej-kowalski",
  "katarzyna-nowak",
  "marek-zielinski",
  "joanna-kaminska",
];

function generateTeamSvg(name, index) {
  const rand = seededRandom((index + 1) * 9973);
  const r = rand;

  // Soft gradient background
  const bgId = `bg-t-${index}`;
  const gradAngle = r() * 360;
  const bgColor1 = index % 2 === 0 ? C.beige : C.cream;
  const bgColor2 = index % 2 === 0 ? C.cream : C.beige;

  let svg = `<defs>
    <linearGradient id="${bgId}" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0%" stop-color="${bgColor1}"/>
      <stop offset="100%" stop-color="${bgColor2}"/>
    </linearGradient>
    <radialGradient id="glow-${index}" cx="50%" cy="35%" r="40%">
      <stop offset="0%" stop-color="${C.goldLight}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${C.goldLight}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="800" height="800" fill="url(#${bgId})"/>
  <rect width="800" height="800" fill="url(#glow-${index})"/>`;

  // Abstract head silhouette — ellipse + neck
  const headCx = 400;
  const headCy = 280 + r() * 30;
  const headRx = 100 + r() * 30;
  const headRy = 120 + r() * 30;
  const shoulderY = headCy + headRy + 40;
  const shoulderW = 280 + r() * 80;

  svg += `<ellipse cx="${headCx}" cy="${headCy}" rx="${headRx.toFixed(0)}" ry="${headRy.toFixed(0)}" fill="${C.taupe}" opacity="0.15"/>`;
  // Neck
  svg += `<rect x="${(headCx - 30).toFixed(0)}" y="${(headCy + headRy * 0.7).toFixed(0)}" width="60" height="${(shoulderY - headCy - headRy * 0.7 + 20).toFixed(0)}" fill="${C.taupe}" opacity="0.12" rx="20"/>`;
  // Shoulders (wide ellipse)
  svg += `<ellipse cx="${headCx}" cy="${(shoulderY + 60).toFixed(0)}" rx="${(shoulderW / 2).toFixed(0)}" ry="120" fill="${C.taupe}" opacity="0.1"/>`;

  // Subtle gold accent arcs
  for (let i = 0; i < 3; i++) {
    const arcR = 140 + i * 60 + r() * 30;
    const startAngle = -0.5 + r() * 0.3;
    const endAngle = Math.PI + 0.5 + r() * 0.3;
    const x1 = headCx + Math.cos(startAngle) * arcR;
    const y1 = headCy + Math.sin(startAngle) * arcR;
    const x2 = headCx + Math.cos(endAngle) * arcR;
    const y2 = headCy + Math.sin(endAngle) * arcR;
    svg += `<path d="M${x1.toFixed(0)},${y1.toFixed(0)} A${arcR.toFixed(0)},${arcR.toFixed(0)} 0 0,1 ${x2.toFixed(0)},${y2.toFixed(0)}" fill="none" stroke="${C.gold}" stroke-width="0.8" opacity="0.2"/>`;
  }

  // Initials from name
  const parts = name.split("-");
  const initials = parts.map((p) => p[0].toUpperCase()).join("");
  svg += `<text x="400" y="760" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="28" fill="${C.taupe}" opacity="0.3" letter-spacing="4">${initials}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">${svg}</svg>`;
}

// ---------------------------------------------------------------------------
// EVENT IMAGES  (800x600, event-themed)
// ---------------------------------------------------------------------------
const eventImages = [
  { name: "rzezba-aukcja", theme: "auction" },
  { name: "fotografia-aukcja", theme: "auction" },
  { name: "wystawa-malarstwo", theme: "exhibition" },
  { name: "wystawa-swiatlo", theme: "exhibition" },
  { name: "gala-kolekcjonerow", theme: "gala" },
  { name: "gala-charytatywna", theme: "gala" },
];

function generateEventSvg(name, theme, index) {
  const rand = seededRandom((index + 1) * 7129);
  const r = rand;

  let svg = "";
  const bgId = `bg-e-${index}`;

  if (theme === "auction") {
    // Auction: podium / gavel shapes
    svg += `<defs>
      <linearGradient id="${bgId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${C.cream}"/>
        <stop offset="100%" stop-color="${C.beige}"/>
      </linearGradient>
    </defs>
    <rect width="800" height="600" fill="url(#${bgId})"/>`;

    // Gavel shape (abstract)
    svg += `<rect x="350" y="180" width="100" height="30" rx="4" fill="${C.gold}" opacity="0.25" transform="rotate(-30 400 195)"/>`;
    svg += `<rect x="385" y="200" width="14" height="120" rx="4" fill="${C.taupe}" opacity="0.2"/>`;
    // Sound block
    svg += `<ellipse cx="400" cy="350" rx="80" ry="16" fill="${C.taupe}" opacity="0.15"/>`;
    svg += `<rect x="340" y="340" width="120" height="30" rx="6" fill="${C.brownMid}" opacity="0.12"/>`;

    // Decorative arches
    for (let i = 0; i < 5; i++) {
      const ax = 100 + i * 160;
      const aY = 450 + r() * 40;
      svg += `<path d="M${ax - 30},${aY} Q${ax},${aY - 60 - r() * 40} ${ax + 30},${aY}" fill="none" stroke="${C.gold}" stroke-width="1.5" opacity="0.15"/>`;
    }
  } else if (theme === "exhibition") {
    // Exhibition: gallery frames
    svg += `<defs>
      <linearGradient id="${bgId}" x1="0" y1="0" x2="1" y2="0.5">
        <stop offset="0%" stop-color="${C.beige}"/>
        <stop offset="100%" stop-color="${C.cream}"/>
      </linearGradient>
    </defs>
    <rect width="800" height="600" fill="url(#${bgId})"/>`;

    // Gallery wall line
    svg += `<line x1="0" y1="430" x2="800" y2="430" stroke="${C.beigeDark}" stroke-width="1" opacity="0.4"/>`;

    // Picture frames
    const frameColors = [C.gold, C.taupe, C.brownMid];
    for (let i = 0; i < 3; i++) {
      const fx = 120 + i * 230 + r() * 40;
      const fy = 140 + r() * 60;
      const fw = 120 + r() * 60;
      const fh = 100 + r() * 80;
      const fc = frameColors[i % frameColors.length];
      svg += `<rect x="${fx.toFixed(0)}" y="${fy.toFixed(0)}" width="${fw.toFixed(0)}" height="${fh.toFixed(0)}" fill="none" stroke="${fc}" stroke-width="3" opacity="0.2" rx="1"/>`;
      // Inner mat
      svg += `<rect x="${(fx + 10).toFixed(0)}" y="${(fy + 10).toFixed(0)}" width="${(fw - 20).toFixed(0)}" height="${(fh - 20).toFixed(0)}" fill="${fc}" opacity="0.06"/>`;
    }

    // Spotlights
    for (let i = 0; i < 3; i++) {
      const lx = 180 + i * 230 + r() * 40;
      svg += `<path d="M${lx.toFixed(0)},0 L${(lx - 40).toFixed(0)},${(140 + r() * 60).toFixed(0)} L${(lx + 40).toFixed(0)},${(140 + r() * 60).toFixed(0)} Z" fill="${C.goldLight}" opacity="0.06"/>`;
    }
  } else {
    // Gala: chandelier / elegance
    svg += `<defs>
      <radialGradient id="${bgId}" cx="50%" cy="30%" r="60%">
        <stop offset="0%" stop-color="${C.cream}"/>
        <stop offset="100%" stop-color="${C.beigeDark}"/>
      </radialGradient>
    </defs>
    <rect width="800" height="600" fill="url(#${bgId})"/>`;

    // Chandelier center
    svg += `<circle cx="400" cy="160" r="8" fill="${C.gold}" opacity="0.3"/>`;
    svg += `<line x1="400" y1="0" x2="400" y2="160" stroke="${C.gold}" stroke-width="1" opacity="0.2"/>`;

    // Chandelier arms
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const armLen = 80 + r() * 60;
      const ex = 400 + Math.cos(angle) * armLen;
      const ey = 160 + Math.sin(angle) * armLen * 0.6;
      svg += `<line x1="400" y1="160" x2="${ex.toFixed(0)}" y2="${ey.toFixed(0)}" stroke="${C.gold}" stroke-width="1" opacity="0.2"/>`;
      // Crystal drops
      for (let j = 0; j < 3; j++) {
        const dx = ex + (r() - 0.5) * 20;
        const dy = ey + 5 + j * 12;
        svg += `<ellipse cx="${dx.toFixed(0)}" cy="${dy.toFixed(0)}" rx="3" ry="${4 + r() * 4}" fill="${C.gold}" opacity="${(0.1 + r() * 0.15).toFixed(2)}"/>`;
      }
    }

    // Table shapes at bottom
    svg += `<ellipse cx="400" cy="520" rx="300" ry="30" fill="${C.taupe}" opacity="0.08"/>`;
    svg += `<ellipse cx="400" cy="510" rx="280" ry="6" fill="${C.gold}" opacity="0.06"/>`;

    // Wine glass shapes
    for (let i = 0; i < 5; i++) {
      const gx = 200 + i * 100 + r() * 40;
      const gy = 480 + r() * 20;
      svg += `<path d="M${gx},${gy} L${gx - 8},${gy - 30} Q${gx},${gy - 45} ${gx + 8},${gy - 30} Z" fill="none" stroke="${C.gold}" stroke-width="0.8" opacity="0.15"/>`;
      svg += `<line x1="${gx}" y1="${gy}" x2="${gx}" y2="${gy + 15}" stroke="${C.gold}" stroke-width="0.5" opacity="0.12"/>`;
      svg += `<line x1="${gx - 8}" y1="${gy + 15}" x2="${gx + 8}" y2="${gy + 15}" stroke="${C.gold}" stroke-width="0.5" opacity="0.12"/>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">${svg}</svg>`;
}

// ---------------------------------------------------------------------------
// PRESS IMAGES  (800x600, newspaper/article abstract)
// ---------------------------------------------------------------------------
const pressImages = [
  "beksinski-rekord",
  "rzezba-sezon",
  "raport-rynek",
  "wywiad-nowak",
  "mlode-talenty",
  "fotografia-rynek",
  "biennale-wenecja",
  "ranking-forbes",
];

function generatePressSvg(name, index) {
  const rand = seededRandom((index + 1) * 5437);
  const r = rand;

  const bgId = `bg-p-${index}`;
  let svg = `<defs>
    <linearGradient id="${bgId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${C.cream}"/>
      <stop offset="100%" stop-color="${C.beige}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#${bgId})"/>`;

  // Newspaper column lines
  const cols = 3;
  const colWidth = 200;
  const startX = (800 - cols * colWidth - (cols - 1) * 30) / 2;

  for (let c = 0; c < cols; c++) {
    const cx = startX + c * (colWidth + 30);
    const colY = 120 + r() * 40;

    // Column header line (thicker)
    svg += `<rect x="${cx}" y="${colY}" width="${colWidth}" height="3" fill="${C.darkBrown}" opacity="0.15" rx="1"/>`;

    // Text lines
    const lineCount = 8 + Math.floor(r() * 6);
    for (let l = 0; l < lineCount; l++) {
      const ly = colY + 20 + l * 16;
      const lw = colWidth * (0.6 + r() * 0.4);
      svg += `<rect x="${cx}" y="${ly}" width="${lw.toFixed(0)}" height="4" fill="${C.taupe}" opacity="${(0.06 + r() * 0.08).toFixed(2)}" rx="2"/>`;
    }
  }

  // Headline bar at top
  svg += `<rect x="80" y="50" width="${400 + r() * 200}" height="8" fill="${C.darkBrown}" opacity="0.12" rx="3"/>`;
  svg += `<rect x="80" y="70" width="${250 + r() * 150}" height="5" fill="${C.taupe}" opacity="0.08" rx="2"/>`;

  // Decorative image placeholder in one column
  const imgCol = Math.floor(r() * cols);
  const imgX = startX + imgCol * (colWidth + 30);
  const imgY = 200 + r() * 80;
  svg += `<rect x="${imgX}" y="${imgY.toFixed(0)}" width="${colWidth}" height="${(80 + r() * 60).toFixed(0)}" fill="${C.gold}" opacity="0.08" rx="2"/>`;
  // Small frame inside
  svg += `<rect x="${imgX + 8}" y="${(imgY + 8).toFixed(0)}" width="${colWidth - 16}" height="${(64 + r() * 44).toFixed(0)}" fill="none" stroke="${C.gold}" stroke-width="0.5" opacity="0.15" rx="1"/>`;

  // Separator line
  svg += `<line x1="80" y1="96" x2="720" y2="96" stroke="${C.taupe}" stroke-width="0.5" opacity="0.15"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">${svg}</svg>`;
}

// ===========================================================================
// MAIN
// ===========================================================================
console.log("Generating SVG placeholders for Omena...\n");

// --- Lots ---
console.log("Auction lot images:");
for (let n = 1; n <= 38; n++) {
  write("auctions", `lot-${n}.svg`, generateLot(n));
}

// --- Team ---
console.log("\nTeam member images:");
teamMembers.forEach((name, i) => {
  write("team", `${name}.svg`, generateTeamSvg(name, i));
});

// --- Events ---
console.log("\nEvent images:");
eventImages.forEach((evt, i) => {
  write("events", `${evt.name}.svg`, generateEventSvg(evt.name, evt.theme, i));
});

// --- Press ---
console.log("\nPress images:");
pressImages.forEach((name, i) => {
  write("press", `${name}.svg`, generatePressSvg(name, i));
});

console.log("\nDone! All SVG placeholders generated.");
