import "./../style.css";
import { db, auth } from "./firebase.js";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  orderBy,
  onSnapshot
} from "firebase/firestore";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth";

const aboutContent = document.getElementById("about-content");
const levelsList = document.getElementById("levels-list");
const usersList = document.getElementById("users-list");
const statusEl = document.getElementById("status");

const authBox = document.getElementById("auth-box");
const adminPanel = document.getElementById("admin-panel");
const adminStatus = document.getElementById("admin-status");

const loginForm = document.getElementById("login-form");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const logoutBtn = document.getElementById("logout-btn");

const aboutForm = document.getElementById("about-form");
const aboutTitle = document.getElementById("about-title");
const aboutBody = document.getElementById("about-body");

const levelForm = document.getElementById("level-form");
const levelId = document.getElementById("level-id");
const levelName = document.getElementById("level-name");
const levelRank = document.getElementById("level-rank");
const levelPoints = document.getElementById("level-points");
const levelVerifier = document.getElementById("level-verifier");

const userForm = document.getElementById("user-form");
const userIdInput = document.getElementById("user-id");
const usernameInput = document.getElementById("username");
const completedLevelsInput = document.getElementById("completed-levels");

let cachedLevels = [];
let isAdmin = false;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#ff9b9b" : "#b7c5dc";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseCsv(raw) {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getPointsFromCompletedLevelIds(ids) {
  let total = 0;

  for (const id of ids) {
    const match = cachedLevels.find((level) => level.id === id);
    if (match) {
      total += Number(match.points || 0);
    }
  }

  return Number(total.toFixed(2));
}

function renderAbout(data) {
  if (!data) {
    aboutContent.innerHTML = `<div class="empty">No about content yet.</div>`;
    return;
  }

  const title = escapeHtml(data.title || "About");
  const body = escapeHtml(data.body || "");

  aboutContent.innerHTML = `
    <div class="card">
      <div class="card-title">${title}</div>
      <div class="card-meta">${body.replaceAll("\n", "<br>")}</div>
    </div>
  `;

  aboutTitle.value = data.title || "";
  aboutBody.value = data.body || "";
}

function renderLevels(levels) {
  if (!levels.length) {
    levelsList.innerHTML = `<div class="empty">No levels yet.</div>`;
    return;
  }

  levelsList.innerHTML = levels
    .map((level, index) => `
      <article class="card">
        <div class="card-row">
          <div class="card-title">#${index + 1} ${escapeHtml(level.name)}</div>
          <div class="rank-pill">${Number(level.points || 0).toFixed(2)} pts</div>
        </div>
        <div class="card-meta">
          Current Rank: ${escapeHtml(level.current_rank)} ·
          Verifier: ${escapeHtml(level.verifier || "Unknown")} ·
          ID: ${escapeHtml(level.id)}
        </div>
      </article>
    `)
    .join("");
}

function renderUsers(users) {
  if (!users.length) {
    usersList.innerHTML = `<div class="empty">No users yet.</div>`;
    return;
  }

  usersList.innerHTML = users
    .map((user, index) => `
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
    `)
    .join("");
}

async function checkAdmin(uid) {
  const adminRef = doc(db, "admins", uid);
  const adminSnap = await getDoc(adminRef);
  return adminSnap.exists();
}

function showAdminPanel(show) {
  authBox.classList.toggle("hidden", show);
  adminPanel.classList.toggle("hidden", !show);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    setStatus("Logging in...");
    await signInWithEmailAndPassword(auth, loginEmail.value, loginPassword.value);
    loginForm.reset();
  } catch (error) {
    console.error(error);
    setStatus(`Login failed: ${error.message}`, true);
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    setStatus("Logged out.");
  } catch (error) {
    console.error(error);
    setStatus(`Logout failed: ${error.message}`, true);
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    isAdmin = false;
    adminStatus.textContent = "Not logged in";
    showAdminPanel(false);
    return;
  }

  try {
    const allowed = await checkAdmin(user.uid);
    isAdmin = allowed;

    if (allowed) {
      adminStatus.textContent = `Logged in as admin: ${user.email}`;
      showAdminPanel(true);
      setStatus("Admin access granted.");
    } else {
      adminStatus.textContent = `Logged in: ${user.email}`;
      showAdminPanel(false);
      setStatus("This account is not in the admins collection.", true);
    }
  } catch (error) {
    console.error(error);
    setStatus(`Admin check failed: ${error.message}`, true);
  }
});

aboutForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isAdmin) return;

  try {
    await setDoc(doc(db, "siteContent", "about"), {
      title: aboutTitle.value.trim(),
      body: aboutBody.value.trim()
    }, { merge: true });

    setStatus("About section saved.");
  } catch (error) {
    console.error(error);
    setStatus(`Failed to save about section: ${error.message}`, true);
  }
});

levelForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isAdmin) return;

  const id = levelId.value.trim();
  const name = levelName.value.trim();
  const currentRank = Number(levelRank.value);
  const points = Number(levelPoints.value);
  const verifier = levelVerifier.value.trim();

  if (!id || !name) {
    setStatus("Level ID and level name are required.", true);
    return;
  }

  try {
    await setDoc(doc(db, "levels", id), {
      name,
      current_rank: currentRank,
      points,
      verifier
    }, { merge: true });

    levelForm.reset();
    setStatus("Level saved.");
  } catch (error) {
    console.error(error);
    setStatus(`Failed to save level: ${error.message}`, true);
  }
});

userForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isAdmin) return;

  const id = userIdInput.value.trim();
  const username = usernameInput.value.trim();
  const completedLevels = parseCsv(completedLevelsInput.value);
  const points = getPointsFromCompletedLevelIds(completedLevels);

  if (!id || !username) {
    setStatus("User ID and username are required.", true);
    return;
  }

  try {
    await setDoc(doc(db, "users", id), {
      username,
      completedLevels,
      points
    }, { merge: true });

    userForm.reset();
    setStatus("User saved and points recalculated.");
  } catch (error) {
    console.error(error);
    setStatus(`Failed to save user: ${error.message}`, true);
  }
});

onSnapshot(doc(db, "siteContent", "about"), (snap) => {
  renderAbout(snap.exists() ? snap.data() : null);
}, (error) => {
  console.error(error);
  setStatus(`About load failed: ${error.message}`, true);
});

onSnapshot(query(collection(db, "levels"), orderBy("current_rank", "asc")), (snap) => {
  cachedLevels = snap.docs.map((d) => ({
    id: d.id,
    ...d.data()
  }));

  renderLevels(cachedLevels);
}, (error) => {
  console.error(error);
  setStatus(`Levels load failed: ${error.message}`, true);
});

onSnapshot(query(collection(db, "users"), orderBy("points", "desc")), (snap) => {
  const users = snap.docs.map((d) => ({
    id: d.id,
    ...d.data()
  }));

  renderUsers(users);
}, (error) => {
  console.error(error);
  setStatus(`Users load failed: ${error.message}`, true);
});