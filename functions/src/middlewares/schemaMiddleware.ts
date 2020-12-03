import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
export const schemaMiddleware = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);
    const valid = error == null;

    if (valid) {
      next();
    } else {
      const { details } = error;
      let message = details.map((i: any) => i.message).join(",");

      const name = message.match(/(?<=").*(?=")/);
      message = message.replace(/\"/g, "");
      console.log("error", message);
      res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({ [name]: message });
    }
  };
};
