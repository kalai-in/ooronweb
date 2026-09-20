importScripts(
  "https://www.gstatic.com/firebasejs/11.1.0/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/11.1.0/firebase-messaging-compat.js"
);

// Must be initializeApp, not a bare config object: firebase.messaging() below
// reads the default app, and without this call it throws during script
// evaluation — which fails the whole service worker registration.
firebase.initializeApp({
  apiKey: "AIzaSyCGZWZaX_Lk0n5RgxQwmchjnBQkvNVkmaY",
  authDomain: "ooron-82352.firebaseapp.com",
  projectId: "ooron-82352",
  storageBucket: "ooron-82352.firebasestorage.app",
  messagingSenderId: "29465567254",
  appId: "1:1:29465567254:web:adca0ab08571bc39695537",
  measurementId: "G-EN841V9L8P",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.data.title;
  const notificationOptions = {
    body: payload.data.body,
    icon: payload.data.icon,
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});
