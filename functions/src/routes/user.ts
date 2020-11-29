import express, { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import firebase from "firebase";
import { db, firebaseConfig, admin } from "../utils";
import { schemaMiddleware, FBAuthMiddleware } from "../middlewares";
import { userSignUpSchema, userLoginSchema } from "./schema";
import { firestore } from "firebase-admin";

firebase.initializeApp(firebaseConfig);

export const router = express.Router();

// const mock_data = [{ from: "test" }, { from: "teeee" }];
interface HTTPError {
  statusCode: number;
}
class HTTPError extends Error implements HTTPError {
  constructor(statusCode: number, message: string, extras?: any) {
    super(message);
    if (arguments.length >= 3 && extras) {
      Object.assign(this, extras);
    }
    this.name = "HTTPError";
    this.statusCode = this.statusCode;
  }
}

router
  // User Signup
  .post("/signup", schemaMiddleware(userSignUpSchema), async (req, res) => {
    const newUser = {
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        displayName: req.body.displayName,
      },
      noImg = "no-img.png";

    let token: string, userId: string;
    firebase
      .auth()
      .createUserWithEmailAndPassword(newUser.email, newUser.password)
      .then(({ user }) => {
        if (!user)
          throw new HTTPError(StatusCodes.BAD_REQUEST, "user not created");
        userId = user.uid;
        return user.getIdToken();
      })
      .then(idToken => {
        token = idToken;
        const userCredentials = {
          userId,
          displayName: newUser.displayName,
          email: newUser.email,
          createdAt: firestore.Timestamp.now(),

          //TODO Append token to imageUrl. Work around just add token from image in storage.
          imageUrl: `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${noImg}?alt=media`,
        };
        return db.doc(`/users/${userId}`).set(userCredentials);
      })
      .then(writeRes => {
        return res
          .status(StatusCodes.CREATED)
          .json({ token, createdAt: writeRes });
      })
      .catch((err: HTTPError & firebase.auth.AuthError) => {
        console.error(err);
        if (err.code && err.code === "auth/email-already-in-use") {
          return res.status(400).json({ email: "Email is already is use" });
        } else {
          return res.status(err.statusCode).json({
            general: "Something went wrong, please try again",
            message: err.message,
          });
        }
      });
  })
  // User Login
  .post("/login", schemaMiddleware(userLoginSchema), (req, res) => {
    const user = {
      email: req.body.email,
      password: req.body.password,
    };

    firebase
      .auth()
      .signInWithEmailAndPassword(user.email, user.password)
      .then(data => {
        return data.user.getIdToken();
      })
      .then(token => {
        return res.status(StatusCodes.OK).json({ token });
      })
      .catch(err => {
        console.error(err);
        // auth/wrong-password
        // auth/user-not-user
        return res
          .status(403)
          .json({ general: "Wrong credentials, please try again" });
      });
  })
  .post("/create", async (req: Request, res: Response) => {
    console.log(req.body, "body");
    const userAuth = req.body.userAuth,
      userRef = db.doc(`users/${userAuth.uid}`),
      noImg = "no-img.png",
      snapShot = await userRef.get();

    if (!snapShot.exists) {
      const { displayName, email } = userAuth,
        createdAt = new Date();
      try {
        await userRef.set({
          userId: userAuth.uid,
          displayName,
          email,
          createdAt,
          imageUrl: `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${noImg}?alt=media`,
        });
      } catch (error) {
        console.error("error creating user", error.message);
      }
    }
    return res.status(StatusCodes.OK).json(await userRef.get());
  })
  //  Get own usr detail
  .get("/detail", FBAuthMiddleware, (req: Request, res: Response) => {
    let userData: any = {};
    db.doc(`/users/${req.user.uid}`)
      .get()
      .then(doc => {
        if (doc.exists) {
          const data = doc.data();
          if (data) {
            userData.credentials = data;
            return db
              .collection("likes")
              .where("userId", "==", req.user.uid)
              .get();
          }
        }
      })
      .then(data => {
        if (data) {
          userData.likes = [];
          data.forEach(doc => {
            userData.likes.push(doc.data());
          });
          return db
            .collection("notifications")
            .where("recipientId", "==", req.user.uid)
            .orderBy("createdAt", "desc")
            .limit(10)
            .get();
        }
      })
      .then(data => {
        userData.notifications = [];
        if (data) {
          data.forEach(doc => {
            userData.notifications.push({
              recipient: doc.data().recipient,
              recipientId: doc.data().recipientId,
              sender: doc.data().sender,
              senderId: doc.data().senderId,
              createdAt: doc.data().createdAt,
              postId: doc.data().postId,
              type: doc.data().type,
              read: doc.data().read,
              notificationId: doc.id,
            });
          });
        }
        return res.status(StatusCodes.OK).json(userData);
      })
      .catch(err => {
        console.error(err);
        return res.status(500).json({ error: err.code });
      });
  })
  // Get other users detail
  .get("/:userId/detail", FBAuthMiddleware, (req: Request, res: Response) => {
    let userData: any = {};
    db.doc(`/users/${req.params.userId}`)
      .get()
      .then(doc => {
        if (doc.exists) {
          //@ts-ignore
          userData.user = doc.data();
          return db
            .collection("posts")
            .where("useriId", "==", req.params.userId)
            .orderBy("createdAt", "desc")
            .get();
        } else {
          throw new HTTPError(404, "User not found");
        }
      })
      .then(data => {
        userData.posts = [];
        data.forEach(doc => {
          userData.posts.push({
            body: doc.data().body,
            createdAt: doc.data().createdAt,
            userId: doc.data().userId,
            userImage: doc.data().userImage,
            likeCount: doc.data().likeCount,
            commentCount: doc.data().commentCount,
            postId: doc.id,
          });
        });
        return res.json(userData);
      })
      .catch((err: HTTPError) => {
        console.error(err);
        return res.status(err.statusCode).json({ error: err.message });
      });
  })
  // Upload a profile image
  .post("/image", FBAuthMiddleware, async (req: Request, res: Response) => {
    const { default: BusBoy } = await import("busboy"),
      path = await import("path"),
      os = await import("os"),
      fs = await import("fs"),
      { v4: uuidv4 } = await import("uuid");

    const busboy: busboy.Busboy = new BusBoy({ headers: req.headers });

    let imageToBeUploaded: { filepath: string; mimetype: string },
      imageFileName: string,
      // String for image token
      generatedToken: string = uuidv4();
    console.log(req.body);
    busboy.on(
      "file",
      function (
        fieldname: string,
        file: NodeJS.ReadableStream,
        filename: string,
        encoding: string,
        mimetype: string
      ) {
        console.log("Posting image");
        console.log(fieldname, file, filename, encoding, mimetype);
        if (mimetype !== "image/jpeg" && mimetype !== "image/png") {
          return res.status(400).json({ error: "Wrong file type submitted" });
        }
        // my.image.png => ['my', 'image', 'png']
        const imageExtension = filename.split(".")[
          filename.split(".").length - 1
        ];
        // 32756238461724837.png
        imageFileName = `${Math.round(
          Math.random() * 1000000000000
        ).toString()}.${imageExtension}`;
        const filepath = path.join(os.tmpdir(), imageFileName);
        imageToBeUploaded = { filepath, mimetype };
        file.pipe(fs.createWriteStream(filepath));
        return null;
      }
    );

    busboy.on("finish", () => {
      admin
        .storage()
        .bucket()
        .upload(imageToBeUploaded.filepath, {
          resumable: false,
          metadata: {
            metadata: {
              contentType: imageToBeUploaded.mimetype,
              //Generate token to be appended to imageUrl
              firebaseStorageDownloadTokens: generatedToken,
            },
          },
        })
        .then(() => {
          // Append token to url
          const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${imageFileName}?alt=media`;
          return db.doc(`/users/${req.user.uid}`).update({ imageUrl });
        })
        .then(() => {
          return res
            .status(StatusCodes.CREATED)
            .json({ message: "image uploaded successfully" });
        })
        .catch((err: any) => {
          console.error(err);
          return res.status(500).json({ error: "something went wrong" });
        });
    });
    //@ts-ignore
    busboy.end(req.rawBody);
  })
  // Mark notification read
  .post("/notifications", FBAuthMiddleware, (req, res) => {
    let batch = db.batch();
    req.body.forEach((notificationId: string) => {
      const notification: FirebaseFirestore.DocumentReference = db.doc(
        `/notifications/${notificationId}`
      );
      batch.update(notification, { read: true });
    });
    batch
      .commit()
      .then(writeRes => {
        return res.json({
          message: `Notifications marked read for ${writeRes.length} notifications`,
        });
      })
      .catch(err => {
        console.error(err);
        return res.status(500).json({ error: err.code });
      });
  });
export default router;
