//@ts-nocheck
import admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

export { admin, db, storeDataForDev };
