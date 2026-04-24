import { auth, db } from "./firebase.js";
import {
	collection,
	doc,
	getDoc,
	getDocs,
	limit,
	query,
	setDoc,
	updateDoc,
	where
} from "firebase/firestore";
import {
	onAuthStateChanged,
	sendPasswordResetEmail,
	signOut,
	updateProfile
} from "firebase/auth";

const authStateEl = document.getElementById("account-auth-state");
const accountPanel = document.getElementById("account-panel");
const authNeededPanel = document.getElementById("auth-needed-panel");
const toastContainer = document.getElementById("toast-container");

const displayNameForm = document.getElementById("display-name-form");
const usernameValueEl = document.getElementById("username-value");
const displayNameInput = document.getElementById("new-display-name");
const saveDisplayNameBtn = document.getElementById("save-display-name-btn");

const completedCountEl = document.getElementById("completed-count");
const pointsTotalEl = document.getElementById("points-total");

const sendResetBtn = document.getElementById("send-reset-btn");
const openAdminBtn = document.getElementById("open-admin-btn");
const logoutBtn = document.getElementById("logout-btn");

let currentUserDocId = null;

function cleanDisplayName(value) {
	return value.trim();
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

function setSignedInUi(signedIn) {
	accountPanel.classList.toggle("hidden", !signedIn);
	authNeededPanel.classList.toggle("hidden", signedIn);
}

async function resolveUserDoc(user) {
	const storedId = localStorage.getItem("fruitUserDocId");

	if (storedId) {
		const storedRef = doc(db, "users", storedId);
		const storedSnap = await getDoc(storedRef);
		if (storedSnap.exists() && storedSnap.data().uid === user.uid) {
			return { id: storedSnap.id, data: storedSnap.data() };
		}
	}

	const usersRef = collection(db, "users");
	const userQuery = query(usersRef, where("uid", "==", user.uid), limit(1));
	const userSnap = await getDocs(userQuery);

	if (userSnap.empty) {
		return null;
	}

	const userDoc = userSnap.docs[0];
	return { id: userDoc.id, data: userDoc.data() };
}

async function loadAccount(user) {
	const resolved = await resolveUserDoc(user);

	if (!resolved) {
		throw new Error("No user profile found for this account.");
	}

	currentUserDocId = resolved.id;

	const data = resolved.data;
	const username = data.username || "";
	const displayName = data.displayName || username || "";
	const completedCount = Array.isArray(data.completedLevels)
		? data.completedLevels.length
		: 0;
	const points = Number(data.points || 0).toFixed(2);

	displayNameInput.value = displayName;
	usernameValueEl.textContent = username || "—";
	completedCountEl.textContent = String(completedCount);
	pointsTotalEl.textContent = points;

	localStorage.setItem("fruitUserDocId", currentUserDocId);
	localStorage.setItem("fruitUsername", username);
	localStorage.setItem("fruitDisplayName", displayName);
}

displayNameForm.addEventListener("submit", async (event) => {
	event.preventDefault();

	const user = auth.currentUser;
	if (!user || !currentUserDocId) {
		showToast("You must be logged in.", true);
		return;
	}

	const nextDisplayName = cleanDisplayName(displayNameInput.value);

	if (!nextDisplayName) {
		showToast("Display name cannot be empty.", true);
		return;
	}

	saveDisplayNameBtn.disabled = true;
	saveDisplayNameBtn.textContent = "Saving...";

	try {
		await updateDoc(doc(db, "users", currentUserDocId), {
			displayName: nextDisplayName
		});

		await setDoc(
			doc(db, "users_public", user.uid),
			{
				displayName: nextDisplayName
			},
			{ merge: true }
		);

		await updateProfile(user, {
			displayName: nextDisplayName
		});

		localStorage.setItem("fruitDisplayName", nextDisplayName);
		showToast("Display name updated.");
	} catch (error) {
		console.error(error);
		showToast(error.message || "Failed to update display name.", true);
	} finally {
		saveDisplayNameBtn.disabled = false;
		saveDisplayNameBtn.textContent = "Save Display Name";
	}
});

sendResetBtn.addEventListener("click", async () => {
	const user = auth.currentUser;
	const email = user?.email || "";

	if (!email) {
		showToast("No email is available for this account.", true);
		return;
	}

	sendResetBtn.disabled = true;
	sendResetBtn.textContent = "Sending...";

	try {
		await sendPasswordResetEmail(auth, email);
		showToast(`Password reset email sent to ${email}.`);
	} catch (error) {
		console.error(error);
		showToast(error.message || "Failed to send reset email.", true);
	} finally {
		sendResetBtn.disabled = false;
		sendResetBtn.textContent = "Forgot / Change Password";
	}
});

openAdminBtn.addEventListener("click", () => {
	window.location.href = "admin.html";
});

logoutBtn.addEventListener("click", async () => {
	try {
		await signOut(auth);
		localStorage.removeItem("fruitUid");
		localStorage.removeItem("fruitUserDocId");
		localStorage.removeItem("fruitUsername");
		localStorage.removeItem("fruitDisplayName");
		showToast("Logged out.");
	} catch (error) {
		console.error(error);
		showToast(error.message || "Failed to log out.", true);
	}
});

onAuthStateChanged(auth, async (user) => {
	if (!user) {
		currentUserDocId = null;
		setSignedInUi(false);
		authStateEl.textContent = "Not logged in.";
		return;
	}

	try {
		authStateEl.textContent = `Logged in as ${user.email || "user"}.`;
		setSignedInUi(true);
		await loadAccount(user);
	} catch (error) {
		console.error(error);
		setSignedInUi(false);
		authStateEl.textContent = "Could not load account details.";
		showToast(error.message || "Failed to load account.", true);
	}
});
