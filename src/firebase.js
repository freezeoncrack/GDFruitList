import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD60dHCiGedOpxiwzAgKrtA--HOLPwS_RU",
  authDomain: "fruitdemonlist.firebaseapp.com",
  projectId: "fruitdemonlist",
  storageBucket: "fruitdemonlist.firebasestorage.app",
  messagingSenderId: "946062780066",
  appId: "1:946062780066:web:52358adcd1bb99f82dd9fb",
  measurementId: "G-DSM1XZW9NX"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };