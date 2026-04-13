import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, set, remove, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
var firebaseConfig = {
  apiKey: "AIzaSyA_1xAPK0D5_Mc_cuzJiKT04i9KzrEEDRc",
  authDomain: "france-irlande-bike.firebaseapp.com",
  databaseURL: "https://france-irlande-bike-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "france-irlande-bike",
  storageBucket: "france-irlande-bike.firebasestorage.app",
  messagingSenderId: "803737104785",
  appId: "1:803737104785:web:b2770a4d862ab90ee06a30"
};
var app = initializeApp(firebaseConfig);
var db = getDatabase(app);
var auth = getAuth(app);
window._fbDb = db;
window._fbRef = ref;
window._fbSet = set;
window._fbRemove = remove;
window._fbOnValue = onValue;
window._fbGet = get;
window._fbAuth = auth;
window._fbSignIn = signInWithEmailAndPassword;
window._fbSignOut = signOut;
window._fbOnAuth = onAuthStateChanged;
window._fbStorage = getStorage(app);
window._fbStorageRef = storageRef;
window._fbUploadResumable = uploadBytesResumable;
window._fbGetDownloadURL = getDownloadURL;
window._fbDeleteObject = deleteObject;
