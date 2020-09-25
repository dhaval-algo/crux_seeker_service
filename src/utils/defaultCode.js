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
    },
    USER_CREATED: {
        code:"USER_CREATED",
        message:"New user created."
    },
    CALLBACK_INQUIRY_SUCCESS: {
        code:"CALLBACK_INQUIRY_SUCCESS",
        message:"Successfully placed an enquiry, Our representative will be in touch soon"
    },
    FAILED_ENQUIRY: {
        code:"FAILED_ENQUIRY",
        message:"Unable to process your request at moment. Please try in sometime."
    },
    USER_ALREADY_REGISTERED:{
        code:"USER_ALREADY_REGISTERED",
        message:"User already registered with this email."
    },
    USER_REGISTERED: {
        code:"USER_REGISTERED",
        message:"Please verify your account. We have sent a verification on your email id."
    }
}
const LOGIN_TYPES = {
    LOCAL:'local',
    GOOGLE:'google',
    LINKEDIN:'linkedin'
}

const TOKEN_TYPES = {
    SIGNIN:'signin',
    RESETPASSWORD:'reset password'
}

const OTP_TYPES = {
    SIGNIN:'signin',
    RESETPASSWORD:'reset password'
}

const FORM_TYPES = {
    ENQUIRIES: "enquiry",
    SIGNUP:"signup"
}

const FORM_TYPE_SOURCE = {
    CALLBACK:"callback"
}

const USER_TYPE = {
    GUEST:'guest',
    REGISTERED:"registered"
}
const USER_STATUS = {
    ACTIVE:'active',
    INACTIVE:'inactive'
}
module.exports = { 
    LOGIN_TYPES,
    DEFAULT_CODES,
    TOKEN_TYPES,
    OTP_TYPES,
    FORM_TYPES,
    FORM_TYPE_SOURCE,
    USER_TYPE,
    USER_STATUS
}