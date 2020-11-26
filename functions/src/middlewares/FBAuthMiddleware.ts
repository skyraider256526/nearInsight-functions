import { NextFunction, Response, Request } from "express";
import { admin, db } from "../utils";
import { StatusCodes, ReasonPhrases } from "http-status-codes";

export function FBAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  let idToken;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    idToken = req.headers.authorization.split("Bearer ")[1];
  } else {
    console.error("ERROR: No token found!");
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ error: ReasonPhrases.UNAUTHORIZED });
  }

  admin
    .auth()
    .verifyIdToken(idToken)
    .then(decodedToken => {
      //@ts-ignore
      req.user = decodedToken;
      // console.log(req.user);

      return db.doc(`users/${req.user.uid}`).get();
    })
    .then(docSnap => {
      const user = docSnap.data();
      if (user) {
        req.user.displayName = user.displayName;
        req.user.imageUrl = user.imageUrl;
      }
      return next();
    })
    .catch(error => {
      console.error("Error while verifying", error);
      return res.status(StatusCodes.FORBIDDEN).json(error);
    });

  return null;
}
