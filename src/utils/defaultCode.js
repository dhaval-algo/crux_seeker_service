const DEFAULT_CODES = 
{
    INVALID_TOKEN: {
        code:"INAVLID_TOKEN",
        message:"You need to login."
    },
    VALID_USER: {
        code:"VALID_USER",
        message: "User is valid"
    },
    INVALID_USER: {
        code:"INVALID_USER",
        message: "The email address or phone number that you've entered does not match any account. Sign Up for an account."
    },
    SYSTEM_ERROR: {
        code: "SYSTEM_ERROR",
        message: 'Something unexpected happend, we are looking into it.'
    },
    INVALID_PASSWORD: {
        code:'INVALID_PASSWORD',
        message:"The password you've entered is incorrect."
    },
    VALID_PASSWORD: {
        code:'VALID_PASSWORD',
        message:'Password is correct.'
    },
    LOGIN_SUCCESS:{
        code:"LOGIN_SUCCESS",
        message:"Login Success"
    },
    OTP_SENT: {
        code:"OTP_SENT",
        message:"Otp has been sent."
    },
    INVALID_OTP: {
        code:"INVALID_OTP",
        message:"Incorrect OTP entered. Please retry again."
    },
    OTP_EXPIRED: {
        code:"OTP_EXPIRED",
        message:"OTP has expired. Please generate a new OTP."
    },
    MAX_OTP_ATTEMPS: {
        code:"MAX_OTP_ATTEMPS",
        message:"Otp has been sent."
    },
    VALID_OTP: {
        code:"VALID_OTP",
        message:"OTP is verifed"
    },
    VALID_TOKEN: {
        code:"VALID_TOKEN",
        message:"Token is valid",
    },
    INVALID_TOKEN: {
        code:"INVALID_TOKEN",
        message:"Token is invalid",
    },
    INVALID_PROVIDER:{
        code:"INVALID_PROVIDER",
        message:"Does not support provided social login",
    }
}
const LOGIN_TYPES = {
    LOCAL:'local',
    GOOGLE:'google',
    LINKEDID:'linkedin'
}

const TOKEN_TYPES = {
    SIGNIN:'signin',
    RESETPASSWORD:'reset password'
}

const OTP_TYPES = {
    SIGNIN:'signin',
    RESETPASSWORD:'reset password'
}

module.exports = { LOGIN_TYPES, DEFAULT_CODES, TOKEN_TYPES, OTP_TYPES}