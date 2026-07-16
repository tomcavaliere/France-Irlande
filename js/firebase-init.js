// firebase-init.js
// En mode démo (window.DEMO_MODE), Firebase n'est JAMAIS chargé : les stubs
// _fb* sont installés par js/demo-mode.js et aucune requête réseau ne part.
// Sinon, imports dynamiques + top-level await : le module reste "en cours"
// tant que Firebase n'est pas chargé, donc DOMContentLoaded (et le timer
// 800 ms de init.js qui appelle initFirebase) attend les globales — même
// sémantique de timing que les anciens imports statiques.
if (!window.DEMO_MODE) {
  try {
    const [appMod, dbMod, authMod, storageMod] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js"),
      import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js")
    ]);
    const firebaseConfig = {
      apiKey: "AIzaSyA_1xAPK0D5_Mc_cuzJiKT04i9KzrEEDRc",
      authDomain: "france-irlande-bike.firebaseapp.com",
      databaseURL: "https://france-irlande-bike-default-rtdb.europe-west1.firebasedatabase.app",
      projectId: "france-irlande-bike",
      storageBucket: "france-irlande-bike.firebasestorage.app",
      messagingSenderId: "803737104785",
      appId: "1:803737104785:web:b2770a4d862ab90ee06a30"
    };
    const app = appMod.initializeApp(firebaseConfig);
    window._fbDb = dbMod.getDatabase(app);
    window._fbRef = dbMod.ref;
    window._fbSet = dbMod.set;
    window._fbRemove = dbMod.remove;
    window._fbOnValue = dbMod.onValue;
    window._fbGet = dbMod.get;
    window._fbAuth = authMod.getAuth(app);
    window._fbSignIn = authMod.signInWithEmailAndPassword;
    window._fbSignOut = authMod.signOut;
    window._fbOnAuth = authMod.onAuthStateChanged;
    window._fbStorage = storageMod.getStorage(app);
    window._fbStorageRef = storageMod.ref;
    window._fbUploadResumable = storageMod.uploadBytesResumable;
    window._fbGetDownloadURL = storageMod.getDownloadURL;
    window._fbDeleteObject = storageMod.deleteObject;
  } catch (err) {
    console.error('[firebase-init]', err);
  }
}
