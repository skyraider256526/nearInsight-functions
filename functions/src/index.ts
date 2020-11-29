// @ts-nocheck
import * as functions from "firebase-functions";

import express from "express";
import cors from "cors";

import rootRouter from "./routes";
import { db } from "./utils";
import { firestore } from "firebase-admin";
const app = express();

// Middleware
app
  .use(express.json())
  .use(express.urlencoded({ extended: true }))
  .use(cors())
  // .use("/", rootRouter);
  .use("/", rootRouter);

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
console.log("⚡️[server]: Server is running");

app.on("error", error => console.error(error));

const runtimeOpts: functions.RuntimeOptions = { timeoutSeconds: 30 };

export const api = functions.runWith(runtimeOpts).https.onRequest(app);

export const createNotificationOnLike = functions.firestore
  .document("/likes/{id}")
  .onCreate(snapshot => {
    // snapshot like document with displayName who liked
    return db
      .doc(`/posts/${snapshot.data().postId}`)
      .get()
      .then(doc => {
        if (doc.exists && doc.data().userId !== snapshot.data().userId) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: firestore.Timestamp.now(),
            recipient: doc.data().displayName,
            recipientId: doc.data().userId,
            sender: snapshot.data().displayName,
            senerId: snapshot.data().userId,
            type: "like",
            read: false,
            postId: doc.id,
          });
        }
      })
      .catch(err => console.error(err));
  });

export const deleteNotificationOnUnLike = functions.firestore
  .document("likes/{id}")
  .onDelete(snapshot => {
    return db
      .doc(`/notifications/${snapshot.id}`)
      .delete()
      .catch(err => {
        console.error(err);
      });
  });

export const createNotificationOnComment = functions.firestore
  .document("comments/{id}")
  .onCreate(snapshot => {
    return db
      .doc(`/posts/${snapshot.data().postId}`)
      .get()
      .then(doc => {
        if (doc.exists && doc.data().userId !== snapshot.data().userId) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: firestore.Timestamp.now(),
            recipient: doc.data().displayName,
            recipientId: doc.data().userId,
            sender: snapshot.data().displayName,
            senerId: snapshot.data().userId,
            type: "comment",
            read: false,
            screamId: doc.id,
          });
        }
      })
      .catch(err => {
        console.error(err);
      });
  });

export const onUserImageChange = functions.firestore
  .document("/users/{userId}")
  .onUpdate(change => {
    console.log(change.before.data());
    console.log(change.after.data());
    if (change.before.data().imageUrl !== change.after.data().imageUrl) {
      console.log("image has changed");
      const batch = db.batch();
      return db
        .collection("posts")
        .where("userId", "==", change.before.data().userId)
        .get()
        .then(data => {
          data.forEach(doc => {
            const post = db.doc(`/posts/${doc.id}`);
            batch.update(post, { userImage: change.after.data().imageUrl });
          });
          return batch.commit();
        });
    } else return true;
  });

export const onPostDelete = functions.firestore
  .document("/posts/{postId}")
  .onDelete((snapshot, context) => {
    const screamId = context.params.postId;
    const batch = db.batch();
    return db
      .collection("comments")
      .where("postId", "==", postId)
      .get()
      .then(data => {
        data.forEach(doc => {
          batch.delete(db.doc(`/comments/${doc.id}`));
        });
        return db.collection("likes").where("postId", "==", postId).get();
      })
      .then(data => {
        data.forEach(doc => {
          batch.delete(db.doc(`/likes/${doc.id}`));
        });
        return db
          .collection("notifications")
          .where("postId", "==", screamId)
          .get();
      })
      .then(data => {
        data.forEach(doc => {
          batch.delete(db.doc(`/notifications/${doc.id}`));
        });
        return batch.commit();
      })
      .catch(err => console.error(err));
  });
