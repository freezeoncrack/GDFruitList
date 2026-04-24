import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  limit,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD60dHCiGedOpxiwzAgKrtA--HOLPwS_RU",
  authDomain: "fruitdemonlist.firebaseapp.com",
  projectId: "fruitdemonlist",
  storageBucket: "fruitdemonlist.firebasestorage.app",
  messagingSenderId: "946062780066",
  appId: "1:946062780066:web:52358adcd1bb99f82dd9fb"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("login-button");

function cleanEmail(email) {
  return email.trim().toLowerCase();
}

loginButton.addEventListener("click", async () => {
  const email = cleanEmail(emailInput.value);
  const password = passwordInput.value;

  if (!email || !password) {
    alert("Enter email and password.");
    return;
  }

  loginButton.disabled = true;
  loginButton.textContent = "Logging in...";

  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    const authUid = userCredential.user.uid;

    const usersRef = collection(db, "users");
    const userQuery = query(usersRef, where("uid", "==", authUid), limit(1));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      throw new Error("No user profile found for this account.");
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();
    const userDocId = userDoc.id;

    if (userData.uid !== authUid) {
      throw new Error("UID mismatch.");
    }

    localStorage.setItem("fruitUid", authUid);
    localStorage.setItem("fruitUserDocId", userDocId);
    localStorage.setItem("fruitUsername", userData.username || userDocId);
    localStorage.setItem("fruitDisplayName", userData.displayName || userData.username || userDocId);

    window.location.href = "users.html";
  } catch (error) {
    console.error("Login error:", error);
    alert(error.message);
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Log In";
  }
});

passwordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loginButton.click();
  }
});