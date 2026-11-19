let cached = null;

const firebaseConfig = {
  apiKey: "AIzaSyDs5M-D_3MmCjj2CbeiCdpmlTTR-IHzE10",
  authDomain: "flit-ea05c.firebaseapp.com",
  projectId: "flit-ea05c",
  storageBucket: "flit-ea05c.firebasestorage.app",
  messagingSenderId: "469473343903",
  appId: "1:469473343903:web:0fc8816ab0738032bfa5aa",
  measurementId: "G-XDLSJ6RKK5"
};

export function loadFirebase() {
  if (!cached) {
    cached = (async () => {
      const [appMod, authMod] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.5.2/firebase-auth.js')
      ]);
      const app = appMod.initializeApp(firebaseConfig, 'flit');
      return { auth: authMod.getAuth(app), authMod };
    })();
    cached.catch(() => {
      cached = null;
    });
  }
  return cached;
}