import Joi from "joi";
export const postSchema = Joi.object().keys({
  body: Joi.string().required(),
});

export const userSignUpSchema = Joi.object().keys({
  email: Joi.string().email().required(),
  password: Joi.string()
    .regex(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{5,}$/)
    .required(),
  confirmPassword: Joi.any().valid(Joi.ref("password")).required(),
  displayName: Joi.string().alphanum().min(3).max(30).required(),
});

export const userLoginSchema = Joi.object().keys({
  email: Joi.string().email().required(),
  password: Joi.string()
    .regex(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{5,}$/)
    .required(),
});
