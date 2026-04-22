import { db } from "./firebase.js";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

const usersList = document.getElementById("users-list");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderUsers(users) {
  if (!users.length) {
    usersList.innerHTML = `<div class="empty">No users yet.</div>`;
    return;
  }

  usersList.innerHTML = users.map((user, index) => `
    <article class="card">
      <div class="card-row">
        <div class="card-title">#${index + 1} ${escapeHtml(user.username)}</div>
        <div class="rank-pill">${Number(user.points || 0).toFixed(2)} pts</div>
      </div>
      <div class="card-meta">
        Completed Levels: ${Array.isArray(user.completedLevels) ? user.completedLevels.length : 0} ·
        ID: ${escapeHtml(user.id)}
      </div>
    </article>
  `).join("");
}

onSnapshot(
  query(collection(db, "users"), orderBy("points", "desc")),
  (snap) => {
    const users = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    renderUsers(users);
  },
  (error) => {
    console.error(error);
    usersList.innerHTML = `<div class="empty">Failed to load users.</div>`;
  }
);