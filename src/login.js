import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc
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

const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("login-button");

function cleanUsername(username) {
  return username.trim().toLowerCase();
}

function usernameToEmail(username) {
  return `${cleanUsername(username)}@fruitlist.local`;
}

loginButton.addEventListener("click", async () => {
  const usernameId = cleanUsername(usernameInput.value);
  const password = passwordInput.value;

  if (!usernameId || !password) {
    alert("Enter username and password.");
    return;
  }

  loginButton.disabled = true;
  loginButton.textContent = "Logging in...";

  try {
    const email = usernameToEmail(usernameId);

    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    const authUid = userCredential.user.uid;

    const userRef = doc(db, "users", usernameId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      throw new Error("No Firestore user document found.");
    }

    const userData = userSnap.data();

    if (userData.uid !== authUid) {
      throw new Error("UID mismatch.");
    }

    localStorage.setItem("fruitUid", authUid);
    localStorage.setItem("fruitUserDocId", usernameId);
    localStorage.setItem("fruitUsername", userData.username || usernameId);

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