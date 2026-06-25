import { auth } from "../firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getUserRole } from "../firestore";
import { appState } from "./state";
import { showToast } from "./dialogs";

export function updateAuthUI() {
  const appLayout = document.querySelector<HTMLElement>(".app-layout")!;
  const appBody = document.querySelector<HTMLElement>(".app-body")!;
  const authPage = document.getElementById("auth-page")!;

  const currentUser = auth.currentUser;
  const isLoggedIn = currentUser !== null;

  if (isLoggedIn) {
    if (appLayout) appLayout.style.display = "flex";
    if (appBody) appBody.style.display = "grid";
    if (authPage) authPage.style.display = "none";

    const displayNameEl = document.getElementById("user-display-name");
    const name = currentUser.email ? currentUser.email.split("@")[0] : "Admin";
    if (displayNameEl) displayNameEl.textContent = name.charAt(0).toUpperCase() + name.slice(1);
    
    const avatarImgEl = document.getElementById("user-avatar-img") as HTMLImageElement;
    if (avatarImgEl) avatarImgEl.src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${name}`;

    const dropdownName = document.getElementById("dropdown-display-name");
    if (dropdownName) dropdownName.textContent = name.charAt(0).toUpperCase() + name.slice(1);
    const dropdownEmail = document.getElementById("dropdown-user-email");
    if (dropdownEmail) dropdownEmail.textContent = currentUser.email || "";
  } else {
    if (appLayout) appLayout.style.display = "flex";
    if (appBody) appBody.style.display = "none";
    if (authPage) authPage.style.display = "flex";
  }
}

export async function handleFirebaseLogin(e: SubmitEvent) {
  e.preventDefault();
  const emailInput = document.getElementById("fb-email") as HTMLInputElement;
  const passwordInput = document.getElementById("fb-password") as HTMLInputElement;
  const email = emailInput?.value.trim();
  const password = passwordInput?.value;

  if (!email || !password) {
    showToast("Email dan Password harus diisi!", "error");
    return;
  }

  const loadingText = document.getElementById("library-loading")?.querySelector<HTMLSpanElement>(".loading-text");
  if (loadingText) loadingText.textContent = "Menghubungkan ke Firebase...";

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    try {
      appState.currentUserRole = await getUserRole(userCredential.user.uid);
    } catch (roleErr) {
      console.error("Failed to get user role on login:", roleErr);
      appState.currentUserRole = null;
    }
    updateAuthUI();
    showToast("Berhasil masuk!", "success");
  } catch (err: any) {
    console.error("Login error:", err);
    showToast(`Gagal masuk: ${err.message}`, "error");
  }
}

export async function handleSignOut() {
  try {
    await signOut(auth);
    showToast("Berhasil keluar", "info");
  } catch (err: any) {
    showToast(`Gagal keluar: ${err.message}`, "error");
  }
}
