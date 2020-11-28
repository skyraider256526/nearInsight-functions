import Joi from "joi";
export const postSchema = Joi.object().keys({
  body: Joi.string().required(),
});
