import express, { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import axios from "axios";
import { apiKey } from "../utils";

import { db } from "../utils";
import { schemaMiddleware } from "../middlewares";
import { postSchema } from "./schema";
import { firestore } from "firebase-admin";

export const router = express.Router();

interface HTTPError {
  statusCode: number;
}

class HTTPError extends Error implements HTTPError {
  constructor(code: number, message: string, extras?: any) {
    super(message || StatusCodes[code]);
    if (arguments.length >= 3 && extras) {
      Object.assign(this, extras);
    }
    this.name = "HTTPError";
    this.statusCode = code;
  }
}

// const mock_data = [{ from: "test" }, { from: "teeee" }];

// Base url: /api/post/
router
  // Get all posts
  .get("/", (req: Request, res: Response) => {
    //TODO: Fetch from firebase
    let posts: FirebaseFirestore.DocumentData[] = [];
    try {
      axios
        .get(`https://us1.locationiq.com/v1/reverse.php?`, {
          params: {
            key: apiKey.locationIQ_API,
            format: "json",
            lat: req.query.latitude,
            lon: req.query.longitude,
          },
        })
        .then(response => {
          db.collection("/posts/")
            .orderBy("createdAt", "desc")
            .where("state", "==", response.data.address.state)
            .get()
            .then(data => {
              data.forEach(doc => {
                posts.push(doc.data());
              });
              return res.status(StatusCodes.OK).json({ posts });
            });
        })
        .catch(err => console.error(err));
    } catch (error) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json(`${req.path}  /GET: ${error}`);
    }
    return;
  })
  // Add post
  .post(
    "/",
    schemaMiddleware(postSchema),
    async (req: Request, res: Response) => {
      // const newPost = ctx.request.body;
      // console.log(req.body);
      // const newPost = {};
      const postDoc = db.collection("posts").doc();
      console.log(req.body);
      axios
        .get(`https://us1.locationiq.com/v1/reverse.php?`, {
          params: {
            key: apiKey.locationIQ_API,
            format: "json",
            lat: req.body.position.latitude,
            lon: req.body.position.longitude,
          },
        })
        .then(response => {
          console.log(response.data.address);
          postDoc
            .create({
              body: req.body.body,
              userId: req.user.uid,
              postId: postDoc.id,
              displayName: req.user.displayName,
              userImage: req.user.imageUrl,
              createdAt: firestore.Timestamp.now(),
              likeCount: 0,
              commentCount: 0,
              location: response.data.address,
              state: response.data.address.state,
            })
            .then(writeRes => {
              res
                //@ts-ignore
                .status(StatusCodes.CREATED)
                .json({
                  body: req.body.body,
                  userId: req.user.uid,
                  postId: postDoc.id,
                  displayName: req.user.displayName,
                  userImage: req.user.imageUrl,
                  createdAt: firestore.Timestamp.now(),
                  likeCount: 0,
                  commentCount: 0,
                  location: response.data.address,
                  state: response.data.address.state,
                });
            })
            .catch(err => {
              console.log(err);
              res.status(404).json(err);
            });
        })
        .catch(err => {
          console.log(err);
          res.status(404).json(err);
        });
    }
  )
  // Delete a post
  .delete("/:postId", (req: Request, res: Response) => {
    const document = db.doc(`/posts/${req.params.postId}`);
    document
      .get()
      .then(doc => {
        const data = doc.data();
        console.log(data);
        if (!doc.exists || !data || !data.userId) {
          throw new HTTPError(404, "Post nor found");
        }
        const { userId } = data;
        if (userId !== req.user.uid) {
          throw new HTTPError(403, "Unothorized");
        } else {
          return document.delete();
        }
      })
      .then(writeRes => {
        res
          .status(StatusCodes.OK)
          .json({ message: "Post deleted successfully", writeRes });
      })
      .catch((err: HTTPError) => {
        console.error(err);
        if (err instanceof HTTPError) {
          return res
            .status(err.statusCode)
            .json({ error: err.name + err.message });
        } else {
          throw err;
        }
      });
  })
  // Get a post
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
  // Like a post
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
              userId: req.user.uid,
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
  // Unlke a post
  .get("/:postId/unlike", (req: Request, res: Response) => {
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
          throw new HTTPError(404, "Post not found");
        } else {
          postData = value.data();
          postData.postId = value.id;
          return likeDocument.get();
        }
      })
      .then(value => {
        if (value.empty) {
          //  res.status(400).json({ error: "Post not liked" });
          throw new HTTPError(400, "Post not liked");
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
      .catch((err: HTTPError) => {
        console.error(err);
        res.status(err.statusCode).json({ error: err.message });
      });
  })
  // Create a comment
  .post("/:postId/comment/", (req: Request, res: Response) => {
    if (req.body.body.trim() === "")
      return res.status(400).json({ comment: "Must not be empty" });

    const newComment = {
      body: req.body.body,
      createdAt: firestore.Timestamp.now(),
      postId: req.params.postId,
      displayName: req.user.displayName,
      userId: req.user.uid,
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
        if (post) {
          return doc.ref.update({ commentCount: post.commentCount + 1 });
        }
      })
      .then(() => {
        db.collection("comments").add(newComment);
      })
      .catch(err => {
        console.log(err);
        res.status(500).json({ error: "Something went wrong" });
      });

    return res.status(StatusCodes.CREATED).json(newComment);
  });

export default router;
