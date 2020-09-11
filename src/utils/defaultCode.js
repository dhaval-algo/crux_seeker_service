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
        message: "Did'nt find any account registered with this username."
    },
    SYSTEM_ERROR: {
        code: "SYSTEM_ERROR",
        message: 'Something unexpected happend, we are looking into it.'
    },
    INVALID_PASSWORD: {
        code:'INVALID_PASSWORD',
        message:'Password is incorrect.'
    },
    VALID_PASSWORD: {
        code:'VALID_PASSWORD',
        message:'Password is correct.'
    },
    LOGIN_SUCCESS:{
        code:"LOGIN_SUCCESS",
        message:"Login Success"
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

module.exports = { LOGIN_TYPES, DEFAULT_CODES, TOKEN_TYPES}