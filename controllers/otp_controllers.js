const joi = require("joi");
const axios = require("axios");
const { RateLimiterMemory } = require("rate-limiter-flexible");

const resendLimiter = new RateLimiterMemory({
  points: 3,
  duration: 60 * 60, // 1 hour
});

const AUTH_KEY = process.env.MSG91_AUTH_KEY;
const TEMP_ID = process.env.MSG91_TEMP_ID;
const SENDER_ID = process.env.MSG91_SENDER_ID;

const send_otp = async (req, res) => {
    const { phone } = req.body;
    
    const schema = joi.object({
        phone: joi.string()
            .pattern(/^[0-9]{10,15}$/) 
            .required()
            .messages({
                'string.pattern.base': 'Phone number must be 10-15 digits',
                'any.required': 'Phone number is required'
            })
    });
    
    const { error } = schema.validate({ phone });
    if (error) return res.status(400).json({ 
        success: false,
        message: error.details[0].message 
    });

    try {
        const internationalPhone = `91${phone}`; 
        
        const response = await axios.get(
            `https://api.msg91.com/api/v5/otp`,
            {
                params: {
                    template_id: TEMP_ID,
                    mobile: internationalPhone,
                    authkey: AUTH_KEY,
                    sender: SENDER_ID,
                    otp_expiry: 5, 
                    otp_length: 6, 
                },
                timeout: 5000 
            }
        );

        if (response.status === 200) {
            return res.status(200).json({ 
                success: true,
                response: response.data,
                message: "OTP sent successfully"
            });
        } else {
            return res.status(400).json({
                success: false,
                message: response.data
            });
        }
    } catch (err) {
        console.error("MSG91 API error:", err.response?.data || err.message);
        
        const errorMessage = err.response?.data?.message || 
                           err.message || 
                           "Failed to communicate with OTP service";
        
        return res.status(500).json({
            success: false,
            message: errorMessage
        });
    }
};

const verify_otp = async (req, res) => {
    const { phone, otp } = req.body;
    
    const schema = joi.object({
        phone: joi.string()
            .pattern(/^[0-9]{10,15}$/)
            .required()
            .messages({
                'string.pattern.base': 'Phone must be 10-15 digits',
                'any.required': 'Phone is required'
            }),
        otp: joi.string()
            .pattern(/^[0-9]{4,6}$/) 
            .required()
            .messages({
                'string.pattern.base': 'OTP must be 4-6 digits',
                'any.required': 'OTP is required'
            })
    });

    const { error } = schema.validate({ phone, otp });
    if (error) return res.status(400).json({ 
        success: false,
        message: error.details[0].message
    });

    try {
        const internationalPhone = `91${phone}`; 
        
        const response = await axios.get(
            `https://api.msg91.com/api/v5/otp/verify`,
            {
                params: {
                    mobile: internationalPhone,
                    otp: otp,
                    authkey: AUTH_KEY
                },
                timeout: 5000 
            }
        );

        if (response.data.type === "success") {
            return res.status(200).json({
                success: true,
                message: "OTP verified successfully"
            });
        } else {
            return res.status(400).json({
                success: false,
                message: response.data.message || "Invalid OTP"
            });
        }
    } catch (err) {
        const errorData = err.response?.data || {};
        
        console.error("OTP verification failed:", {
            error: errorData.message || err.message,
            phone: phone, // Log masked in production
            status: err.response?.status
        });

        let errorMessage;
        if (err.code === 'ECONNABORTED') {
            errorMessage = "Verification timeout. Please try again.";
        } else {
            errorMessage = errorData.message || "OTP verification service unavailable";
        }

        return res.status(500).json({
            success: false,
            message: errorMessage
        });
    }
};

const resend_otp = async (req, res) => {
  const { phone } = req.body;

  const schema = joi.object({
    phone: joi.string()
      .pattern(/^[0-9]{10,15}$/)
      .required()
      .messages({
        'string.pattern.base': 'Phone must be 10-15 digits',
        'any.required': 'Phone is required'
      })
  });

  const { error } = schema.validate({ phone });
  if (error) return res.status(400).json({ 
    success: false,
    message: error.details[0].message
  });

  try {
    await resendLimiter.consume(phone);
  } catch (rateLimiterRes) {
    return res.status(429).json({
      success: false,
      message: "Too many attempts. Please try again later."
    });
  }

  try {
    const internationalPhone = `91${phone}`;
    
    const response = await axios.get(
      "https://api.msg91.com/api/v5/otp/retry",
      {
        params: {
          mobile: internationalPhone,
          authkey: AUTH_KEY,
          retrytype: "text" 
        },
        timeout: 5000
      }
    );

    if (response.data.type === "success") {
      return res.status(200).json({
        success: true,
        message: "OTP resent successfully",
        requestId: response.data.request_id
      });
    } else {
      return res.status(400).json({
        success: false,
        message: response.data.message || "Failed to resend OTP"
      });
    }
  } catch (err) {
    const errorData = err.response?.data || {};
    
    console.error("Resend OTP failed:", {
      error: errorData || err,
      phone: `******${phone.slice(-4)}`, 
      status: err.response?.status
    });

    let errorMessage;
    if (err.code === 'ECONNABORTED') {
      errorMessage = "Request timeout. Please try again.";
    } else if (err.response?.status === 429) {
      errorMessage = "Maximum resend attempts reached";
    } else {
      errorMessage = errorData.message || "OTP service unavailable";
    }

    return res.status(err.response?.status || 500).json({
      success: false,
      message: errorMessage
    });
  }
};

module.exports = { send_otp,verify_otp,resend_otp};