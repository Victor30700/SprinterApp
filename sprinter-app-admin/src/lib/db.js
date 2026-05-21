// lib/db.js
import { admin } from './firebase-admin'; // o como tengas configurado tu firebase admin

export async function getUsers() {
  const usersRef = admin.firestore().collection('users');
  const snapshot = await usersRef.get();
  
  const users = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));

  return users;
}
