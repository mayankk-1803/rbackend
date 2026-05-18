import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

const envSchema = Joi.object({
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
  REDIS_URL: Joi.string().required(),
  FRONTEND_URL: Joi.string().uri().required(),
  PORT: Joi.number().default(5000),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
}).unknown();

export const validateEnv = () => {
  const { error, value } = envSchema.validate(process.env);
  
  if (error) {
    console.error(`[Env Validation Error] ${error.message}`);
    process.exit(1);
  }
  
  return value;
};
