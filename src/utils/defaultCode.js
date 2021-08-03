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
        message: "The email id entered does not exist. Create a new account."
    },
    UNVERIFIED_USER: {
        code:"UNVERIFIED_USER",
        message: "Please verify your email address to proceed."
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
        message:"Please verify your account. We have sent a verification link on your email id."
    },
    VERIFICATION_FAILED: {
        code:"VERIFICATION_FAILED",
        message:"Verification link expired, Please Login to resend the verification link"
    },
    VALIDATION_FAILED: {
        code:"VALIDATION_FAILED"
    },
    ENQUIRY_PROFILE_SUCCESS: {
        code:"ENQUIRY_PROFILE_SUCCESS",
        message:"Successfully updated profile"
    },
    ENQUIRY_VALIDATION_MESSAGES: {
        DOB_REQUIRED: "This is a required field",
        DOB_FORMAT: "Please enter the right format",
        DOB_AGE: "Candidates have to be minimum 18 years of age to send enquiry",
        GRADE: "Please enter the grade in correct format",
        GRADUATION: "Please enter the right format",
        DEGREE: "This is a required field",
        SPECIALIZATION : "This is a required field",
        INSTITUTE: "This is a required field",
        JOBTITLE: "This is a required field",
        COMPANY: "This is a required field",
        INDUSTRY: "This is a required field",
        EXP_REQUIRED: "This is a required field",
        EXP_NUMERIC: "Enter numeric values only"
    }
}
const LOGIN_TYPES = {
    LOCAL:'local',
    GOOGLE:'google',
    LINKEDIN:'linkedin'
}

const TOKEN_TYPES = {
    SIGNIN:'signin',
    RESETPASSWORD:'reset_password',
    VERIFICATION:"verification"
}

const OTP_TYPES = {
    SIGNIN:'signin',
    RESETPASSWORD:'reset_password'
}

const FORM_TYPES = {
    ENQUIRIES: "enquiry",
    SIGNUP:"signup"
}

const FORM_TYPE_SOURCE = {
    CALLBACK:"callback",
    GENERAL_ENQUIRY:"general_enquiry"
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