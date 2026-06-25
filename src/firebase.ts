import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBfeUVrHyX0ZXefdSVedIhedVE_fnSDbck",
  authDomain: "oura-streaming.firebaseapp.com",
  projectId: "oura-streaming",
  storageBucket: "oura-streaming.firebasestorage.app",
  messagingSenderId: "1070202777265",
  appId: "1:1070202777265:web:e921ed3a0d7af068fa7c90",
  measurementId: "G-NMLSHE2175"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export default app;
