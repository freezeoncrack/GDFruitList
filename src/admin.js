import { auth, db } from "./firebase.js";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  deleteDoc,
  getDocs
} from "firebase/firestore";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";

// DOM Elements
const authBox = document.getElementById("auth-box");
const adminPanel = document.getElementById("admin-panel");
const adminStatus = document.getElementById("admin-status");
const statusEl = document.getElementById("status");

const loginForm = document.getElementById("login-form");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const logoutBtn = document.getElementById("logout-btn");

// Level Form Elements
const levelForm = document.getElementById("level-form");
const levelId = document.getElementById("level-id");
const levelName = document.getElementById("level-name");
const levelRank = document.getElementById("level-rank");
const initialRank = document.getElementById("initial-rank");
const levelPoints = document.getElementById("level-points");
const levelVerifier = document.getElementById("level-verifier");
const verifierFruit = document.getElementById("verifier-fruit");
const verifyDate = document.getElementById("verify-date");
const levelImage = document.getElementById("level-image");
const showcaseUrl = document.getElementById("showcase-url");
const verificationUrl = document.getElementById("verification-url");
const victors = document.getElementById("victors");

const clearLevelBtn = document.getElementById("clear-level-btn");
const deleteLevelBtn = document.getElementById("delete-level-btn");
const levelsList = document.getElementById("levels-list");

// User Form Elements
const userForm = document.getElementById("user-form");
const userIdInput = document.getElementById("user-id");
const usernameInput = document.getElementById("username");
const levelsCheckboxesContainer = document.getElementById("levels-checkboxes");

const clearUserBtn = document.getElementById("clear-user-btn");
const deleteUserBtn = document.getElementById("delete-user-btn");
const usersList = document.getElementById("users-list");

// State
let isAdmin = false;
let cachedLevels = [];
let cachedUsers = [];
let editingLevelId = null;
let editingUserId = null;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b91c1c" : "#4b5563";
}

function showAdminPanel(show) {
  authBox.classList.toggle("hidden", show);
  adminPanel.classList.toggle("hidden", !show);
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

async function checkAdmin(uid) {
  const adminRef = doc(db, "admins", uid);
  const adminSnap = await getDoc(adminRef);
  return adminSnap.exists();
}

function clearLevelForm() {
  levelForm.reset();
  editingLevelId = null;
  levelId.disabled = false;
  deleteLevelBtn.style.display = "none";
  setStatus("");
}

function clearUserForm() {
  userForm.reset();
  editingUserId = null;
  userIdInput.disabled = false;
  deleteUserBtn.style.display = "none";
  renderLevelCheckboxes([]);
  setStatus("");
}

function loadLevelIntoForm(level) {
  levelId.value = level.id;
  levelName.value = level.name || "";
  levelPoints.value = level.points || "";
  levelRank.value = level.current_rank || "";
  initialRank.value = level.initial_rank || "";
  levelVerifier.value = level.verifier || "";
  verifierFruit.value = level.verifier_fruit || "";
  verifyDate.value = level.verify_date || "";
  levelImage.value = level.image_url || "";
  showcaseUrl.value = level.showcase_url || "";
  verificationUrl.value = level.verification_url || "";
  victors.value = Array.isArray(level.victors) ? level.victors.join(", ") : (level.victors || "");

  editingLevelId = level.id;
  levelId.disabled = true;
  deleteLevelBtn.style.display = "block";
}

function loadUserIntoForm(user) {
  userIdInput.value = user.id;
  usernameInput.value = user.username || "";

  editingUserId = user.id;
  userIdInput.disabled = true;
  deleteUserBtn.style.display = "block";

  renderLevelCheckboxes(user.completedLevels || []);
}

function resolvePublicUserDocId(userId) {
  const existing = cachedUsers.find((u) => u.id === userId);
  if (existing && typeof existing.uid === "string" && existing.uid.trim()) {
    return existing.uid.trim();
  }
  return userId;
}

async function resolveUserUid(userId) {
  const existing = cachedUsers.find((u) => u.id === userId);
  if (existing && typeof existing.uid === "string" && existing.uid.trim()) {
    return existing.uid.trim();
  }

  const userSnap = await getDoc(doc(db, "users", userId));
  if (userSnap.exists()) {
    const uid = String(userSnap.data().uid || "").trim();
    if (uid) {
      return uid;
    }
  }

  return "";
}

async function resolveUserDisplayName(userId) {
  const existing = cachedUsers.find((u) => u.id === userId);
  if (existing && typeof existing.displayName === "string" && existing.displayName.trim()) {
    return existing.displayName.trim();
  }

  const userSnap = await getDoc(doc(db, "users", userId));
  if (userSnap.exists()) {
    const displayName = String(userSnap.data().displayName || userSnap.data().username || "").trim();
    if (displayName) {
      return displayName;
    }
  }

  return "";
}

function renderLevelCheckboxes(completed = []) {
  if (!cachedLevels.length) {
    levelsCheckboxesContainer.innerHTML = "<p class='muted'>No levels available</p>";
    return;
  }

  levelsCheckboxesContainer.innerHTML = cachedLevels
    .map(
      (level) => `
    <div class="checkbox-item">
      <input 
        type="checkbox" 
        id="level-${level.id}" 
        value="${escapeHtml(level.id)}"
        ${completed.includes(level.id) ? "checked" : ""}
      />
      <label for="level-${level.id}">${escapeHtml(level.name)} (${level.points} pts)</label>
    </div>
  `
    )
    .join("");
}

function renderLevelsList(levels) {
  if (!levels.length) {
    levelsList.innerHTML = "<p class='muted'>No levels yet. Create one using the form.</p>";
    return;
  }

  levelsList.innerHTML = levels
    .map(
      (level) => `
    <div class="item-card" data-level-id="${escapeHtml(level.id)}">
      <p class="item-card-title">${escapeHtml(level.name)}</p>
      <p class="item-card-meta">
        Points: ${level.points} | 
        Rank: ${level.current_rank} | 
        Verifier: ${escapeHtml(level.verifier || "N/A")}
      </p>
    </div>
  `
    )
    .join("");

  // Add click handlers
  levelsList.querySelectorAll(".item-card").forEach((card) => {
    card.addEventListener("click", () => {
      const id = card.dataset.levelId;
      const level = levels.find((l) => l.id === id);
      if (level) {
        loadLevelIntoForm(level);
      }
    });
  });
}

function renderUsersList(users) {
  if (!users.length) {
    usersList.innerHTML = "<p class='muted'>No users yet. Create one using the form.</p>";
    return;
  }

  usersList.innerHTML = users
    .map(
      (user) => `
    <div class="item-card" data-user-id="${escapeHtml(user.id)}">
      <p class="item-card-title">${escapeHtml(user.username)}</p>
      <p class="item-card-meta">
        Display Name: ${escapeHtml(user.displayName || user.username)} |
        Points: ${user.points || 0} | 
        Completed: ${Array.isArray(user.completedLevels) ? user.completedLevels.length : 0} levels
      </p>
    </div>
  `
    )
    .join("");

  // Add click handlers
  usersList.querySelectorAll(".item-card").forEach((card) => {
    card.addEventListener("click", () => {
      const id = card.dataset.userId;
      const user = users.find((u) => u.id === id);
      if (user) {
        loadUserIntoForm(user);
      }
    });
  });
}

// Auth Events
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
    clearLevelForm();
    clearUserForm();
    setStatus("Logged out.");
  } catch (error) {
    console.error(error);
    setStatus(`Logout failed: ${error.message}`, true);
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    isAdmin = false;
    showAdminPanel(false);
    adminStatus.textContent = "Not logged in";
    return;
  }

  try {
    const allowed = await checkAdmin(user.uid);
    isAdmin = allowed;

    if (!allowed) {
      showAdminPanel(false);
      adminStatus.textContent = `Logged in: ${user.email}`;
      setStatus("This account is not in the admins collection.", true);
      return;
    }

    showAdminPanel(true);
    adminStatus.textContent = `Logged in as admin: ${user.email}`;
    setStatus("Admin access granted.");
  } catch (error) {
    console.error(error);
    setStatus(`Admin check failed: ${error.message}`, true);
  }
});

// Level Form Events
levelForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isAdmin) return;

  const id = levelId.value.trim();
  const name = levelName.value.trim();
  const currentRank = Number(levelRank.value);
  const points = Number(levelPoints.value);
  const verifier = levelVerifier.value.trim();
  const verifierFruitVal = verifierFruit.value.trim();
  const verifyDateVal = verifyDate.value.trim();
  const imageUrl = levelImage.value.trim();
  const showcaseUrlVal = showcaseUrl.value.trim();
  const verificationUrlVal = verificationUrl.value.trim();
  const victorsVal = victors.value.trim();
  const initialRankVal = initialRank.value.trim() ? Number(initialRank.value) : null;

  if (!id || !name || !currentRank) {
    setStatus("Level ID, name, and current rank are required.", true);
    return;
  }

  try {
    const levelData = {
      name,
      current_rank: currentRank,
      points,
      verifier,
      ...(verifierFruitVal && { verifier_fruit: verifierFruitVal }),
      ...(verifyDateVal && { verify_date: verifyDateVal }),
      ...(imageUrl && { image_url: imageUrl }),
      ...(showcaseUrlVal && { showcase_url: showcaseUrlVal }),
      ...(verificationUrlVal && { verification_url: verificationUrlVal }),
      ...(victorsVal && { victors: parseCsv(victorsVal) }),
      ...(initialRankVal && { initial_rank: initialRankVal })
    };

    await setDoc(doc(db, "levels", id), levelData, { merge: true });

    setStatus("Level saved successfully.");
    clearLevelForm();
  } catch (error) {
    console.error(error);
    setStatus(`Failed to save level: ${error.message}`, true);
  }
});

clearLevelBtn.addEventListener("click", clearLevelForm);

deleteLevelBtn.addEventListener("click", async () => {
  if (!editingLevelId || !isAdmin) return;

  if (!confirm(`Are you sure you want to delete level "${levelName.value}"?`)) {
    return;
  }

  try {
    setStatus("Deleting level...");
    await deleteDoc(doc(db, "levels", editingLevelId));
    setStatus("Level deleted successfully.");
    clearLevelForm();
  } catch (error) {
    console.error(error);
    setStatus(`Failed to delete level: ${error.message}`, true);
  }
});

// User Form Events
userForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isAdmin) return;

  const id = userIdInput.value.trim();
  const username = usernameInput.value.trim();

  if (!id || !username) {
    setStatus("User ID and username are required.", true);
    return;
  }

  // Get checked levels
  const checkboxes = levelsCheckboxesContainer.querySelectorAll('input[type="checkbox"]:checked');
  const completedLevels = Array.from(checkboxes).map((cb) => cb.value);
  const points = getPointsFromCompletedLevelIds(completedLevels);

  try {
    const publicUserDocId = resolvePublicUserDocId(id);
    const uid = await resolveUserUid(id);
    const displayName = await resolveUserDisplayName(id);
    const finalDisplayName = displayName || username;

    await setDoc(
      doc(db, "users", id),
      {
        username,
        completedLevels,
        points,
        ...(finalDisplayName ? { displayName: finalDisplayName } : {})
      },
      { merge: true }
    );

    await setDoc(
      doc(db, "users_public", publicUserDocId),
      {
        username,
        ...(finalDisplayName ? { displayName: finalDisplayName } : {}),
        completedLevels,
        points,
        ...(uid ? { uid } : {})
      },
      { merge: true }
    );

    setStatus("User saved successfully.");
    clearUserForm();
  } catch (error) {
    console.error(error);
    setStatus(`Failed to save user: ${error.message}`, true);
  }
});

clearUserBtn.addEventListener("click", clearUserForm);

deleteUserBtn.addEventListener("click", async () => {
  if (!editingUserId || !isAdmin) return;

  if (!confirm(`Are you sure you want to delete user "${usernameInput.value}"?`)) {
    return;
  }

  try {
    setStatus("Deleting user...");
    const publicUserDocId = resolvePublicUserDocId(editingUserId);
    await deleteDoc(doc(db, "users", editingUserId));
    await deleteDoc(doc(db, "users_public", publicUserDocId));
    setStatus("User deleted successfully.");
    clearUserForm();
  } catch (error) {
    console.error(error);
    setStatus(`Failed to delete user: ${error.message}`, true);
  }
});

// Real-time listeners
onSnapshot(
  query(collection(db, "levels"), orderBy("current_rank", "asc")),
  (snap) => {
    cachedLevels = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    renderLevelsList(cachedLevels);
    renderLevelCheckboxes(
      editingUserId
        ? cachedUsers.find((u) => u.id === editingUserId)?.completedLevels || []
        : []
    );
  },
  (error) => {
    console.error(error);
  }
);

onSnapshot(
  query(collection(db, "users"), orderBy("points", "desc")),
  (snap) => {
    cachedUsers = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    renderUsersList(cachedUsers);
  },
  (error) => {
    console.error(error);
  }
);