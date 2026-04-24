import { auth } from "./firebase.js";
import { onAuthStateChanged } from "firebase/auth";

const uploadAuthStateEl = document.getElementById("upload-auth-state");
const uploadPanel = document.getElementById("upload-panel");
const authNeededPanel = document.getElementById("auth-needed-panel");
const verificationForm = document.getElementById("verification-form");
const levelNameInput = document.getElementById("level-name");
const dateVerifiedInput = document.getElementById("date-verified");
const verifiedByInput = document.getElementById("verified-by");
const discordUsernameInput = document.getElementById("discord-username");
const verificationVideoInput = document.getElementById("verification-video");
const uploadBtn = document.getElementById("upload-btn");
const toastContainer = document.getElementById("toast-container");

function setSignedInUi(signedIn) {
  uploadPanel.classList.toggle("hidden", !signedIn);
  authNeededPanel.classList.toggle("hidden", signedIn);
}

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

function getSelectedVideoFile() {
  const fileCount = verificationVideoInput.files ? verificationVideoInput.files.length : 0;

  if (fileCount !== 1) {
    throw new Error("Please select exactly one video file.");
  }

  const file = verificationVideoInput.files[0];
  if (!file.type.startsWith("video/")) {
    throw new Error("Selected file must be a video.");
  }

  return file;
}

verificationForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const user = auth.currentUser;
  if (!user) {
    showToast("You must be logged in.", true);
    return;
  }

  const levelName = levelNameInput.value.trim();
  const dateVerified = dateVerifiedInput.value.trim();
  const verifiedBy = verifiedByInput.value.trim();
  const discordUsername = discordUsernameInput.value.trim();

  if (!levelName || !dateVerified || !verifiedBy) {
    showToast("Level name, date verified, and verified by are required.", true);
    return;
  }

  let file;
  try {
    file = getSelectedVideoFile();
  } catch (error) {
    showToast(error.message || "Invalid video file.", true);
    return;
  }

  uploadBtn.disabled = true;
  uploadBtn.textContent = "Uploading...";

  try {
    const idToken = await user.getIdToken();

    const presignRes = await fetch("/api/create-verification-upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({
        levelName,
        dateVerified,
        verifiedBy,
        discordUsername,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size
      })
    });

    if (!presignRes.ok) {
      const failure = await presignRes.json().catch(() => ({}));
      throw new Error(failure.error || "Could not create upload URL.");
    }

    const { uploadUrl } = await presignRes.json();

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream"
      },
      body: file
    });

    if (!uploadRes.ok) {
      throw new Error("Upload to storage failed.");
    }

    verificationForm.reset();
    showToast("Verification uploaded successfully.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "Upload failed.", true);
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = "Upload Verification";
  }
});

onAuthStateChanged(auth, (user) => {
  if (!user) {
    setSignedInUi(false);
    uploadAuthStateEl.textContent = "Not logged in.";
    return;
  }

  setSignedInUi(true);
  uploadAuthStateEl.textContent = `Logged in as ${user.email || "user"}.`;
});
