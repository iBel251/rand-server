const firebase = require("firebase/app");
require("firebase/firestore");
require("firebase/auth");
require("firebase/database");

const firebaseConfig = {
  apiKey: "AIzaSyCG-o4XIYuKKoTvjcsrJvSxY44xsNPU_6c",
  authDomain: "randtalk-a0324.firebaseapp.com",
  projectId: "randtalk-a0324",
  storageBucket: "randtalk-a0324.appspot.com",
  messagingSenderId: "579406834347",
  appId: "1:579406834347:web:fa29d7c9df23fa1d90e5ee",
  measurementId: "G-ENDNWBSW1M",
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = require("firebase/auth").getAuth(app);
const db = require("firebase/firestore").getFirestore(app);
const database = require("firebase/database").getDatabase(app);

// Exports
module.exports = { app, auth, db, database };
