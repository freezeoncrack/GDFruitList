import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
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
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const signupButton = document.getElementById("signup-button");

function cleanUsername(username) {
  return username.trim().toLowerCase();
}

function cleanEmail(email) {
  return email.trim().toLowerCase();
}

signupButton.addEventListener("click", async () => {
  const usernameId = cleanUsername(usernameInput.value);
  const displayUsername = usernameInput.value.trim();
  const email = cleanEmail(emailInput.value);
  const password = passwordInput.value;

  if (!usernameId || !email || !password) {
    alert("Enter username, email, and password.");
    return;
  }

  if (!email.includes("@")) {
    alert("Enter a valid email.");
    return;
  }

  if (password.length < 6) {
    alert("Password must be at least 6 characters.");
    return;
  }

  signupButton.disabled = true;
  signupButton.textContent = "Signing up...";

  try {
    const userRef = doc(db, "users", usernameId);
    const existingUser = await getDoc(userRef);

    if (existingUser.exists()) {
      throw new Error("Username already taken.");
    }

    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    const uid = userCredential.user.uid;
    const displayName = displayUsername;

    await setDoc(userRef, {
      username: displayUsername,
      displayName: displayName,
      email: email,
      uid: uid,
      completedLevels: [],
      points: 0
    });

    await setDoc(doc(db, "users_public", uid), {
      username: displayUsername,
      displayName: displayName,
      uid: uid,
      completedLevels: [],
      points: 0
    });

    localStorage.setItem("fruitUid", uid);
    localStorage.setItem("fruitUserDocId", usernameId);
    localStorage.setItem("fruitUsername", displayUsername);
    localStorage.setItem("fruitDisplayName", displayName);

    window.location.href = "users.html";
  } catch (error) {
    console.error("Signup error:", error);
    alert(error.message);
  } finally {
    signupButton.disabled = false;
    signupButton.textContent = "Sign Up";
  }
});

passwordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    signupButton.click();
  }
});