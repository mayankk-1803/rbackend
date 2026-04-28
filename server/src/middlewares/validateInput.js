import Joi from "joi";

export const validateRechargeInput = (req, res, next) => {
  const schema = Joi.object({
    mobile: Joi.string().pattern(/^[6-9]\d{9}$/).required().messages({
      "string.pattern.base": "Invalid Indian mobile number"
    }),
    amount: Joi.number().positive().required(),
    operator: Joi.string().uppercase().valid("JIO", "AIRTEL", "VI", "BSNL").optional(),
    circle: Joi.string().allow("Unknown").optional(),
    providerCode: Joi.alternatives().try(Joi.string(), Joi.number()).optional().custom((val) => String(val)),
    type: Joi.string().optional(),
    idempotencyKey: Joi.string().optional()
  });

  const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    return res.status(400).json({ 
      success: false, 
      message: error.details[0].message 
    });
  }
  
  req.body = value; // Use validated/normalized values
  next();
};

export const validatePaymentInput = (req, res, next) => {
  const schema = Joi.object({
    amount: Joi.number().positive().required(),
    upiId: Joi.string().optional(),
    intent: Joi.string().valid("TOPUP", "RECHARGE").default("TOPUP"),
    idempotencyKey: Joi.string().optional()
  });

  const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    return res.status(400).json({ 
      success: false, 
      message: error.details[0].message 
    });
  }
  
  req.body = value;
  next();
};
