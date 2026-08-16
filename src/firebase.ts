import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, doc, getDocFromServer } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

// Connection test as required by Firebase skill
export async function testFirebaseConnection() {
  try {
    await getDocFromServer(doc(db, "status", "connection"));
    console.log("Firebase Firestore connection validated successfully.");
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("offline")) {
        console.error("Firebase client is offline. Check configuration.");
      } else if (error.message.includes("Quota") || error.message.includes("RESOURCE_EXHAUSTED")) {
        console.warn("Firestore daily quota reached. Local persistence remains active.");
      }
    }
  }
}
