import express, { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { db, firebaseConfig, admin } from "../utils";

export const router = express.Router();

// const mock_data = [{ from: "test" }, { from: "teeee" }];

// Upload a profile image
router
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
  .post("/image", async (req: Request, res: Response) => {
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
  });

export default router;
