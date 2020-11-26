import Joi from "joi";
export const postSchema = Joi.object().keys({
  body: Joi.string().required(),
  displayName: Joi.string().required(),
  userImage: Joi.string().required(),
  commentCount: Joi.number().required(),
  likeCount: Joi.number().required(),
  createAt: Joi.date().required(),
});
