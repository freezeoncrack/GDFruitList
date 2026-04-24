import { auth, db } from "./firebase.js";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";

const viewAuthStateEl = document.getElementById("view-auth-state");
const viewerPanel = document.getElementById("viewer-panel");
const authNeededPanel = document.getElementById("auth-needed-panel");
const verificationsList = document.getElementById("verifications-list");
const emptyState = document.getElementById("empty-state");
const loadingEl = document.getElementById("loading");
const refreshBtn = document.getElementById("refresh-btn");
const logoutBtn = document.getElementById("logout-btn");
const toastContainer = document.getElementById("toast-container");

let currentUserUid = null;

function showToast(message, isError = false) {
  const toast = document.createElement("div");
  toast.className = `toast ${isError ? "toast-error" : "toast-success"}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.remove();
    }, 220);
  }, 3200);
}

function setSignedInUi(signedIn) {
  viewerPanel.classList.toggle("hidden", !signedIn);
  authNeededPanel.classList.toggle("hidden", signedIn);
}

async function checkAdmin(uid) {
  const adminRef = doc(db, "admins", uid);
  const adminSnap = await getDoc(adminRef);
  return adminSnap.exists();
}

function renderVerificationCard(fileName, metadata) {
  const card = document.createElement("div");
  card.className = "verification-card";

  const header = document.createElement("div");
  header.className = "verification-card-header";

  const titleDiv = document.createElement("div");
  titleDiv.className = "verification-card-title";
  titleDiv.textContent = fileName;

  header.appendChild(titleDiv);

  const levelName = metadata.level_name || "Unknown";
  const dateVerified = metadata.date_verified || "N/A";
  const verifiedBy = metadata.verified_by || "N/A";
  const discordUsername = metadata.discord_username || "";

  const metaDiv = document.createElement("p");
  metaDiv.className = "verification-card-meta";
  metaDiv.innerHTML = `
    <strong>Level:</strong> ${escapeHtml(levelName)} | 
    <strong>Date:</strong> ${escapeHtml(dateVerified)} | 
    <strong>Verifier:</strong> ${escapeHtml(verifiedBy)}${
    discordUsername ? ` | <strong>Discord:</strong> ${escapeHtml(discordUsername)}` : ""
  }
  `;

  const actionsDiv = document.createElement("div");
  actionsDiv.className = "verification-card-actions";

  const viewBtn = document.createElement("button");
  viewBtn.className = "btn-view";
  viewBtn.textContent = "View Video";
  viewBtn.onclick = () => {
    window.open(
      `https://e4104b4afa44001c802f7ae4a7108450.r2.cloudflarestorage.com/gdfruitlist/verifications/${encodeURIComponent(
        fileName
      )}`,
      "_blank"
    );
  };

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "btn-delete";
  deleteBtn.textContent = "Delete";
  deleteBtn.onclick = async () => {
    if (confirm(`Delete verification: ${fileName}?`)) {
      await deleteVerification(fileName);
    }
  };

  actionsDiv.appendChild(viewBtn);
  actionsDiv.appendChild(deleteBtn);

  card.appendChild(header);
  card.appendChild(metaDiv);
  card.appendChild(actionsDiv);

  return card;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadVerifications() {
  try {
    loadingEl.classList.remove("hidden");
    verificationsList.classList.add("hidden");
    emptyState.classList.add("hidden");

    const user = auth.currentUser;
    if (!user) {
      throw new Error("Not authenticated.");
    }

    const idToken = await user.getIdToken();

    const response = await fetch("/api/list-verifications", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${idToken}`
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Failed to load verifications.");
    }

    const data = await response.json();
    const verifications = data.verifications || [];

    loadingEl.classList.add("hidden");

    if (verifications.length === 0) {
      emptyState.classList.remove("hidden");
      return;
    }

    verificationsList.innerHTML = "";
    verifications.forEach((item) => {
      const card = renderVerificationCard(item.fileName, item.metadata || {});
      verificationsList.appendChild(card);
    });

    verificationsList.classList.remove("hidden");
  } catch (error) {
    console.error(error);
    loadingEl.classList.add("hidden");
    showToast(error.message || "Failed to load verifications.", true);
  }
}

async function deleteVerification(fileName) {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("Not authenticated.");
    }

    const idToken = await user.getIdToken();

    const response = await fetch("/api/delete-verification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({
        fileName
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Failed to delete verification.");
    }

    showToast("Verification deleted successfully.");
    await loadVerifications();
  } catch (error) {
    console.error(error);
    showToast(error.message || "Failed to delete verification.", true);
  }
}

refreshBtn.addEventListener("click", () => {
  loadVerifications();
});

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    showToast("Logged out.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "Failed to log out.", true);
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUserUid = null;
    setSignedInUi(false);
    viewAuthStateEl.textContent = "Not logged in.";
    return;
  }

  try {
    const isAdmin = await checkAdmin(user.uid);
    if (!isAdmin) {
      currentUserUid = null;
      setSignedInUi(false);
      viewAuthStateEl.textContent = "You do not have admin access.";
      return;
    }

    currentUserUid = user.uid;
    setSignedInUi(true);
    viewAuthStateEl.textContent = `Admin logged in as ${user.email || "user"}.`;

    await loadVerifications();
  } catch (error) {
    console.error(error);
    setSignedInUi(false);
    viewAuthStateEl.textContent = "Error checking admin status.";
    showToast(error.message || "Failed to verify admin status.", true);
  }
});
