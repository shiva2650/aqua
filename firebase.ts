import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const rtdb = getDatabase(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export async function signIn() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/unauthorized-domain') {
      console.error('DOMAIN NOT AUTHORIZED: Please add the current domain to your Firebase Console > Authentication > Settings > Authorized Domains.');
    } else if (error.code === 'auth/operation-not-allowed') {
      console.error('GOOGLE SIGN-IN NOT ENABLED: Go to your Firebase Console > Authentication > Sign-in method and enable "Google".');
    }
    console.error('Sign in error:', error);
    throw error;
  }
}
