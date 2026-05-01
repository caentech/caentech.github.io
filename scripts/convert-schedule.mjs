#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, extname } from "node:path";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node scripts/convert-schedule.mjs <input.json>");
  process.exit(1);
}

const data = JSON.parse(readFileSync(resolve(inputPath), "utf-8"));

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function mapLevel(level) {
  const map = {
    BEGINNER: "débutant",
    INTERMEDIATE: "intermédiaire",
    ADVANCED: "avancé",
  };
  return map[level] || "débutant";
}

function mapTrack(track) {
  const map = { Conference: "conference", Amphi: "auditorium", Amphithéâtre: "auditorium" };
  return map[track] || "conference";
}

function detectType(formats) {
  if (!formats || formats.length === 0) return "conférence";
  const fmt = formats[0].toLowerCase();
  if (fmt.includes("atelier") || fmt.includes("workshop")) return "atelier";
  return "conférence";
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(text) {
  let out = escapeHtml(text);
  // Links: [label](url) — emit before bold/italic so we don't eat * inside URLs
  out = out.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_m, label, url) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`,
  );
  // Bold: **text**
  out = out.replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>");
  // Italic: *text* (avoid matching ** by requiring non-* on each side)
  out = out.replace(
    /(^|[^*])\*([^*\n]+?)\*(?!\*)/g,
    "$1<em>$2</em>",
  );
  return out;
}

function markdownToHtml(text) {
  if (!text) return "";
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      // Shift down by one so headings nest under the modal's h2 title
      const level = Math.min(6, heading[1].length + 1);
      blocks.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        let item = lines[i].replace(/^\s*[-*]\s+/, "");
        i++;
        // Continuation lines (indented, no list marker)
        while (
          i < lines.length &&
          lines[i].trim() !== "" &&
          /^\s+\S/.test(lines[i]) &&
          !/^\s*[-*]\s+/.test(lines[i])
        ) {
          item += " " + lines[i].trim();
          i++;
        }
        items.push(item);
      }
      blocks.push(
        `<ul>${items.map((it) => `<li>${renderInline(it)}</li>`).join("")}</ul>`,
      );
      continue;
    }

    const paraLines = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^#{1,6}\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push(`<p>${renderInline(paraLines.join(" "))}</p>`);
  }

  return blocks.join("\n");
}

function markdownToPlainText(text) {
  if (!text) return "";
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function mapCategories(categories) {
  if (!categories || categories.length === 0) return "Autres";
  return categories[0];
}

function toLocalTime(isoString) {
  // Conference Hall times are stored with Z suffix but represent local times
  return isoString.replace(/\.000Z$/, "").replace(/Z$/, "");
}

// Event-wide fixed entries
const EVENT_DATE = "2026-06-09";
const OUVERTURE_DES_PORTES = {
  id: "ouverture-des-portes",
  title: "Ouverture des portes — Accueil café",
  description: "",
  speakerIds: [],
  startTime: `${EVENT_DATE}T08:00:00.000+02:00`,
  endTime: `${EVENT_DATE}T09:00:00.000+02:00`,
  roomId: "all",
  theme: "Networking",
  level: "débutant",
  type: "conférence",
};

// Extract unique speakers
const speakersMap = new Map();
for (const session of data.sessions) {
  if (!session.proposal) continue;
  for (const speaker of session.proposal.speakers) {
    if (speaker.name === "TODO") continue;
    const id = slugify(speaker.name);
    if (!speakersMap.has(id)) {
      speakersMap.set(id, {
        id,
        name: speaker.name,
        role: "",
        company: speaker.company || "",
        bio: markdownToPlainText(speaker.bio) || "",
        ...(speaker.picture ? { photo: speaker.picture } : {}),
      });
    }
  }
}

// Build program entries
const program = [];
for (const session of data.sessions) {
  if (!session.title) continue;
  const speakerIds = [];
  let level = "débutant";
  let type = "conférence";
  let description = session.title;
  let theme = "Événement";

  if (session.proposal) {
    for (const speaker of session.proposal.speakers) {
      if (speaker.name !== "TODO") {
        speakerIds.push(slugify(speaker.name));
      }
    }
    level = mapLevel(session.proposal.level);
    type = detectType(session.proposal.formats);
    description = markdownToHtml(session.proposal.abstract) || session.title;
    theme = mapCategories(session.proposal.categories);
  }

  const roomId = mapTrack(session.track);

  program.push({
    id: slugify(session.title),
    title: session.title,
    description,
    speakerIds,
    startTime: toLocalTime(session.start),
    endTime: toLocalTime(session.end),
    roomId,
    theme,
    level,
    type,
  });
}

// Add fixed event entries
program.push(OUVERTURE_DES_PORTES);

// Sort by start time, then by room
program.sort((a, b) => {
  const t = a.startTime.localeCompare(b.startTime);
  if (t !== 0) return t;
  return a.roomId.localeCompare(b.roomId);
});

// Detect gaps between sessions and insert breaks
const LUNCH_THRESHOLD_MIN = 60;
const BREAK_THRESHOLD_MIN = 15;

// Get unique sorted start times
const uniqueStarts = [...new Set(program.map((p) => p.startTime))].sort();

for (let i = 0; i < uniqueStarts.length - 1; i++) {
  // Latest endTime string for current slot — preserve original timezone offset
  const currentSlotEndStr = program
    .filter((p) => p.startTime === uniqueStarts[i])
    .map((p) => p.endTime)
    .sort()
    .pop();
  const nextSlotStartStr = uniqueStarts[i + 1];
  const gapMin =
    (new Date(nextSlotStartStr).getTime() - new Date(currentSlotEndStr).getTime()) / 60000;

  if (gapMin >= BREAK_THRESHOLD_MIN) {
    const isLunch = gapMin >= LUNCH_THRESHOLD_MIN;
    const idTime = currentSlotEndStr.slice(11, 16).replace(":", "h");

    program.push({
      id: isLunch ? "pause-dejeuner" : `pause-${idTime}`,
      title: isLunch ? "Pause déjeuner" : "Pause",
      description: isLunch ? "Buffet et networking." : "",
      speakerIds: [],
      startTime: currentSlotEndStr,
      endTime: nextSlotStartStr,
      roomId: "all",
      theme: "Networking",
      level: "débutant",
      type: "conférence",
    });
  }
}

// Re-sort after adding breaks
program.sort((a, b) => {
  const t = a.startTime.localeCompare(b.startTime);
  if (t !== 0) return t;
  return a.roomId.localeCompare(b.roomId);
});

const speakers = Array.from(speakersMap.values());

const SPEAKERS_IMAGES_DIR = resolve("public/images/speakers");
const SPEAKERS_PUBLIC_PATH = "/images/speakers";
const CONTENT_TYPE_TO_EXT = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
};

function pickExtension(url, contentType) {
  try {
    const pathnameExt = extname(new URL(url).pathname).toLowerCase();
    if (/^\.(jpg|jpeg|png|webp|gif|avif)$/.test(pathnameExt)) {
      return pathnameExt === ".jpeg" ? ".jpg" : pathnameExt;
    }
  } catch {}
  const base = (contentType || "").split(";")[0].trim().toLowerCase();
  return CONTENT_TYPE_TO_EXT[base] || ".jpg";
}

async function downloadSpeakerPhoto(speaker) {
  if (!speaker.photo) return;
  const url = speaker.photo;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = pickExtension(url, res.headers.get("content-type"));
    const filename = `${speaker.id}${ext}`;
    writeFileSync(resolve(SPEAKERS_IMAGES_DIR, filename), buffer);
    speaker.photo = `${SPEAKERS_PUBLIC_PATH}/${filename}`;
  } catch (err) {
    console.warn(
      `Failed to download photo for ${speaker.id} (${url}): ${err.message}`,
    );
  }
}

mkdirSync(SPEAKERS_IMAGES_DIR, { recursive: true });
await Promise.all(speakers.map(downloadSpeakerPhoto));

writeFileSync(
  "src/data/program.json",
  JSON.stringify(program, null, 2) + "\n",
);
writeFileSync(
  "src/data/speakers.json",
  JSON.stringify(speakers, null, 2) + "\n",
);

console.log(
  `Generated ${program.length} program entries → src/data/program.json`,
);
console.log(`Generated ${speakers.length} speakers → src/data/speakers.json`);
