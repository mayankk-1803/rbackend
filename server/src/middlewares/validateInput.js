import Joi from "joi";

export const validateRechargeInput = (req, res, next) => {
  const schema = Joi.object({
    operatorCode: Joi.alternatives().try(Joi.string(), Joi.number()).required().messages({
      "any.required": "Invalid Operator",
      "any.empty": "Invalid Operator"
    }),
    mobile: Joi.string().required().messages({
      "any.required": "Subscriber ID Required",
      "string.empty": "Subscriber ID Required"
    }).when("operatorCode", {
      is: Joi.alternatives().try(
        Joi.string().valid("6", "7", "8", "9", "10"),
        Joi.number().valid(6, 7, 8, 9, 10)
      ),
      then: Joi.string().pattern(/^\d{8,15}$/).messages({
        "string.pattern.base": "Invalid DTH Subscriber ID"
      }),
      otherwise: Joi.string().pattern(/^[6-9]\d{9}$/).messages({
        "string.pattern.base": "Valid 10-digit mobile number required"
      })
    }),
    amount: Joi.number().positive().required().messages({
      "number.base": "Invalid Recharge Amount",
      "number.positive": "Invalid Recharge Amount",
      "any.required": "Recharge Amount Required"
    }),
    operator: Joi.string().optional(),
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
