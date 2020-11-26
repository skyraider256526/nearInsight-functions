import admin from "firebase-admin";

export interface IUser extends admin.auth.DecodedIdToken {
  displayName: string;
}

export interface IGetUserAuthInfoRequest extends Request {
  user: IUser;
}
