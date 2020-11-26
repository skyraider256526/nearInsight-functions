import express, { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { db } from "../utils";
import { schemaMiddleware } from "../middlewares";
import { postSchema } from "./schema";
import { firestore } from "firebase-admin";

export const router = express.Router();

// const mock_data = [{ from: "test" }, { from: "teeee" }];

router
  .get("/", (req: Request, res: Response) => {
    //TODO: Fetch from firebase
    let posts: FirebaseFirestore.DocumentData[] = [];
    try {
      db.collection("posts")
        .orderBy("createdAt", "desc")
        .get()
        .then(data => {
          data.forEach(doc => {
            posts.push(doc.data());
          });
        });
    } catch (error) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json(`${req.path}  /GET: ${error}`);
    }
    return res.status(StatusCodes.OK).json({ posts });
  })
  .get("/:postId", (req: Request, res: Response) => {
    let postData: FirebaseFirestore.DocumentData;
    db.doc(`/posts/${req.params.postId}`)
      .get()
      //@ts-ignore
      .then(doc => {
        const data: any = doc.data();
        if (!doc.exists && !data) {
          return res
            .status(StatusCodes.NOT_FOUND)
            .json({ error: "Post not found" });
        }
        postData = data;
        postData.postId = doc.id;
        return db
          .collection("comments")
          .orderBy("createdAt", "desc")
          .where("postId", "==", req.params.postId)
          .get();
      })
      .then(data => {
        postData.comments = [];
        //@ts-ignore
        data.forEach(doc => {
          postData.comments.push(doc.data());
        });
        return res.status(StatusCodes.OK).json(postData);
      })
      .catch(err => {
        console.error(err);
        res.status(500).json({ error: err.code });
      });
  })
  .get("/:postId/like", (req: Request, res: Response) => {
    const likeDocument = db
      .collection("likes")
      .where("displayName", "==", req.user.displayName)
      .where("postId", "==", req.params.postId)
      .limit(1);

    const postDocument = db.doc(`/posts/${req.params.postId}`);

    let postData: any;

    postDocument
      .get()
      //@ts-ignore
      .then(value => {
        console.log(value.exists);
        if (value.exists) {
          postData = value.data();
          postData.postId = value.id;
          return likeDocument.get();
        }
        // res.status(404).json({ error: "Post not found" });
        throw "Post not found";
      })
      .then(value => {
        if (value && value.empty) {
          return db
            .collection("likes")
            .add({
              postId: req.params.postId,
              displayName: req.user.displayName,
            })
            .then(() => {
              postData.likeCount++;
              return postDocument.update({ likeCount: postData.likeCount });
            })
            .then(() => {
              return res.json(postData);
            });
        } else {
          return res.status(400).json({ error: "Post already liked" });
        }
      })
      .catch(err => {
        console.error(err);
        res.status(500).json({ error: err.code });
      });
  })
  .get(":postId/unlike", (req: Request, res: Response) => {
    const likeDocument = db
      .collection("likes")
      .where("displayName", "==", req.user.displayName)
      .where("postId", "==", req.params.postId)
      .limit(1);

    const postDocument = db.doc(`/posts/${req.params.postId}`);

    let postData: any;

    postDocument
      .get()
      .then(value => {
        if (!value.exists) {
          // res.status(404).json({ error: "Post not found" });
          throw "Post not found";
        } else {
          postData = value.data();
          postData.postId = value.id;
          return likeDocument.get();
        }
      })
      .then(value => {
        if (value.empty) {
          //  res.status(400).json({ error: "Post not liked" });
          throw "Post not liked";
        } else {
          return db
            .doc(`/likes/${value.docs[0].id}`)
            .delete()
            .then(() => {
              postData.likeCount--;
              return postDocument.update({ likeCount: postData.likeCount });
            })
            .then(() => {
              res.json(postData);
            });
        }
      })
      .catch(err => {
        console.error(err);
        res.status(500).json({ error: err.code });
      });
  })
  .post("/:postId/comment/create", (req: Request, res: Response) => {
    if (req.body.body.trim() === "")
      return res.status(400).json({ comment: "Must not be empty" });

    const newComment = {
      body: req.body.body,
      createdAt: firestore.Timestamp.now(),
      postId: req.params.postId,
      displayName: req.user.displayName,
      userImage: req.user.imageUrl,
    };
    console.log(newComment);

    db.doc(`/posts/${req.params.postId}`)
      .get()
      //@ts-ignore
      .then(doc => {
        if (!doc.exists) {
          return res.status(404).json({ error: "Post not found" });
        }
        const post = doc.data();
        if (post && post.commentCount)
          return doc.ref.update({ commentCount: post.commentCount + 1 });
      })
      .then(() => {
        db.collection("comments").add(newComment);
      })
      .catch(err => {
        console.log(err);
        res.status(500).json({ error: "Something went wrong" });
      });

    return res.status(StatusCodes.CREATED).json(newComment);
  })
  .post(
    "/create",
    schemaMiddleware(postSchema),
    async (req: Request, res: Response) => {
      // const newPost = ctx.request.body;
      // console.log(req.body);
      // const newPost = {};
      const newPost = await db
        .collection("posts")
        .add(req.body)
        .then(docRef => {
          docRef.set({ postId: docRef.id }, { merge: true });
          // return docRef.ge;
        });
      return res
        .status(StatusCodes.CREATED)
        .send(`Post added succesfully: ${newPost}`);
    }
  );

export default router;
