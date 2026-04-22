import { db } from "./firebase.js";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

const levelsList = document.getElementById("levels-list");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderLevels(levels) {
  if (!levels.length) {
    levelsList.innerHTML = `<div class="empty">No levels yet.</div>`;
    return;
  }

  levelsList.innerHTML = levels.map((level, index) => {
    let content = `
    <article class="card">
      <div class="card-row">
        <div class="card-title">#${index + 1} ${escapeHtml(level.name)}</div>
        <div class="rank-pill">${Number(level.points || 0).toFixed(2)} pts</div>
      </div>
      <div class="card-meta">
        Current Rank: ${escapeHtml(level.current_rank)} ·
        Verifier: ${escapeHtml(level.verifier || "Unknown")} ·
        ID: ${escapeHtml(level.id)}
      </div>`;

    // Add image if available
    if (level.image_url) {
      content += `
      <div class="card-image">
        <img src="${escapeHtml(level.image_url)}" alt="${escapeHtml(level.name)}" />
      </div>`;
    }

    // Add victors if available
    if (Array.isArray(level.victors) && level.victors.length > 0) {
      content += `
      <div class="card-section">
        <strong>Victors:</strong> ${level.victors.map(escapeHtml).join(", ")}
      </div>`;
    }

    // Add links if available
    if (level.showcase_url || level.verification_url) {
      content += `<div class="card-links">`;
      if (level.showcase_url) {
        content += `<a href="${escapeHtml(level.showcase_url)}" target="_blank" rel="noopener noreferrer">Showcase</a>`;
      }
      if (level.verification_url) {
        content += `<a href="${escapeHtml(level.verification_url)}" target="_blank" rel="noopener noreferrer">Verification</a>`;
      }
      content += `</div>`;
    }

    content += `</article>`;
    return content;
  }).join("");
}

onSnapshot(
  query(collection(db, "levels"), orderBy("current_rank", "asc")),
  (snap) => {
    const levels = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    renderLevels(levels);
  },
  (error) => {
    console.error(error);
    levelsList.innerHTML = `<div class="empty">Failed to load levels.</div>`;
  }
);