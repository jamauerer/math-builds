import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const text = readFileSync("docs/curriculum.md", "utf8");
const skills = [];
let strand = "";

const strandOf = (heading) => {
  const name = heading.toLowerCase();
  if (name.startsWith("counting")) return "counting";
  if (name.startsWith("adding")) return "adding";
  if (name.startsWith("multiplying")) return "multiplying";
  if (name.startsWith("dividing")) return "dividing";
  if (name.startsWith("fractions")) return "fractions";
  if (name.startsWith("ratios")) return "ratios";
  if (name.startsWith("measuring")) return "measuring";
  if (name.startsWith("geometry")) return "geometry";
  if (name.startsWith("algebra")) return "algebra";
  return "";
};

function cells(line) {
  if (!line.startsWith("|")) {
    return null;
  }
  const parts = line.split("|").slice(1, -1).map((part) => part.trim());
  return parts;
}

for (const line of text.split(/\r?\n/)) {
  const heading = line.match(/^## (.+)/);
  if (heading) {
    strand = strandOf(heading[1]);
    continue;
  }
  const parts = cells(line);
  if (!parts || parts.length < 8 || !strand) {
    continue;
  }
  const [levelText, id, name, notation, answer, learnPicture, kitUse, prereq] = parts;
  if (!/^\d+$/.test(levelText) || !/^[a-z]+\.\d+\.[a-z0-9-]+$/.test(id)) {
    continue;
  }
  skills.push({
    id,
    strand,
    level: Number(levelText),
    name,
    notation,
    answer,
    learnPicture,
    kitUse,
    prereqs: prereq
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  });
}

const pieces = [];
let inPieces = false;
for (const line of text.split(/\r?\n/)) {
  if (line.startsWith("## Kit pieces")) {
    inPieces = true;
    continue;
  }
  if (inPieces && line.startsWith("## ")) {
    break;
  }
  if (!inPieces) {
    continue;
  }
  const parts = cells(line);
  if (!parts || parts.length < 3) {
    continue;
  }
  const [piece, pieceStrand, questions] = parts;
  if (piece === "Kit piece" || piece.startsWith("---")) {
    continue;
  }
  pieces.push({ piece, strand: pieceStrand, questions });
}

mkdirSync("src/skills", { recursive: true });
const graph = { version: 1, source: "docs/curriculum.md", skills, pieces };
writeFileSync("src/skills/graph.json", `${JSON.stringify(graph, null, 2)}\n`);
console.log(`wrote ${skills.length} skills, ${pieces.length} kit pieces`);
