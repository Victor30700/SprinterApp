// scripts/setAdmin.js

const serviceAccount =  require('../lib/firebase-adminsdk.json');// assert { type: 'json' };
const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

admin
  .auth()
  .getUserByEmail("admin@admin.com")
  .then((user) => admin.auth().setCustomUserClaims(user.uid, { admin: true }))
  .then(() => console.log("✅ Admin claim asignado correctamente"))
  .catch((error) => console.error("❌ Error:", error));

  