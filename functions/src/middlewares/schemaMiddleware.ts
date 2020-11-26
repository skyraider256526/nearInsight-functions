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
      const message = details.map((i: any) => i.message).join(",");

      console.log("error", message);
      res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({ error: message });
    }
  };
};
