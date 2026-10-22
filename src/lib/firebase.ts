import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyAD2QUIcv7v1Bsa8yRQTsauoFA9vq9dTWs',
  authDomain: 'shrifragrance.firebaseapp.com',
  projectId: 'shrifragrance',
  storageBucket: 'shrifragrance.firebasestorage.app',
  messagingSenderId: '224075929646',
  appId: '1:224075929646:web:52239bcaa08d1a5a47a7bf',
}

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)
export const auth: Auth = getAuth(app)
export default app
