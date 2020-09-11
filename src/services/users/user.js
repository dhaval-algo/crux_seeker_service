const { encryptStr, isEmail, decryptStr } = require("../../utils/helper");
const { DEFAULT_CODES, LOGIN_TYPES, TOKEN_TYPES } = require("../../utils/defaultCode");
const b64 = require("base64url");

const models = require("../../../models");
const { verifyToken } = require("../auth/auth");
const defaults = require("../defaults/defaults");
const moment = require("moment");
const signToken = require('../../services/auth/auth').signToken;
const login = async (req, res, next) => {
    try {
        const body = req.body;
        const audience = req.headers.origin;
        const { username="", password="" } = body;
        // validate input
        if (username.trim() == '') {
            res.status(200).json({
                'success': false,
                'message': 'Username is required',
                'data': {}
            });
        }

        if (password.trim() == '') {
            res.status(200).json({
                'success': false,
                'message': 'Password is required',
                'data': {}
            });
        }
        //userSigin Fuction
        console.log(typeof audience);
        const response = await signInUser({ username, password,audience, provider:LOGIN_TYPES.LOCAL });
        return res.status(200).json(response);

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            'code': 'SERVER_ERROR',
            'description': 'something went wrong, Please try again'
        });
    }
}

const sendOtp = async (req, res, next) => {
    try {
        return res.status(200).json({
            'message': 'Successful login',
            'data': {}
        });

    } catch (error) {
        return res.status(500).json({
            'code': 'SERVER_ERROR',
            'description': 'something went wrong, Please try again'
        });
    }
}


const verifyOtp = async (req, res, next) => {
    try {
        return res.status(200).json({
            'message': 'Successful login',
            'data': {}
        });

    } catch (error) {
        return res.status(500).json({
            'code': 'SERVER_ERROR',
            'description': 'something went wrong, Please try again'
        });
    }
}

const signInUser = async (resData) => {
    const response = {
        code: DEFAULT_CODES.LOGIN_SUCCESS.code,
        success: true,
        message: DEFAULT_CODES.LOGIN_SUCCESS.message,
        data: {
        }

    }
    return new Promise(async (resolve, reject) => {
        try {
            // check if valid user
            /* 
                {
                    code:'',
                    success:true/false,
                    message:'',
                    data:{
                        user: {}
                    }
                }
            */
            const verificationRes = await userExist(resData.username, LOGIN_TYPES.LOCAL);
            if (!verificationRes.success) {
                return resolve(verificationRes)
            }


            //verify credential
            /* 
                {
                    code:'',
                    success:true/false,
                    message:'',
                    data:{
                        user: {}
                    }
                }
            */
            const credVerificationRes = checkPassword(verificationRes.data.user, resData.password);
            if (!credVerificationRes.success) {
                return resolve(credVerificationRes);
            }
            console.log(resData);
            const tokenRes = getLoginToken({...verificationRes.data.user ,audience: resData.audience, provider:resData.provider});
            return resolve(tokenRes);
        } catch (error) {
            console.log(error);
            response.code = DEFAULT_CODES.SYSTEM_ERROR.code;
            response.message = DEFAULT_CODES.SYSTEM_ERROR.message;
            response.success = false;
            return resolve(response);
        }
    })

}
const userExist = (username, provider) => {
    return new Promise((resolve, reject) => {

        let response = {
            code: DEFAULT_CODES.INVALID_USER.code,
            message: DEFAULT_CODES.INVALID_USER.message,
            success: false,
            data: {
                user: {}
            }
        }

        try {
            let dbCol = 'phone';
            // determine is username is email or phone
            if (isEmail(username)) {
                dbCol = 'email';
            }
            //check in db
            models.user_login.findOne({ where: { [dbCol]: username, provider: provider } }).then(async function (userLogin) {
                if (userLogin != null) {
                    const { userId, email = "", password, phone = "" } = userLogin;
                    response.success = true;
                    response.code = DEFAULT_CODES.VALID_USER;
                    response.message = DEFAULT_CODES.VALID_USER.message;
                    response.data.user = {
                        email,
                        password,
                        phone,
                        userId
                    }
                    return resolve(response)
                } else {
                    return resolve(response)
                }
            });
        } catch (error) {
            response = {
                code: DEFAULT_CODES.INVALID_USER.code,
                message: DEFAULT_CODES.INVALID_USER.message,
                success: false,
                data: {
                    user: {}
                }
            }
            return resolve(response)
        }
    })
};

const checkPassword = (userObj, resPwd) => {
    let response = {
        code: DEFAULT_CODES.VALID_PASSWORD.code,
        success: true,
        message: DEFAULT_CODES.VALID_PASSWORD.message,
        data: {
        }
    }
    if (resPwd === decryptStr(userObj.password)) {
        return response
    } else {
        response.success = false;
        response.code = DEFAULT_CODES.INVALID_PASSWORD.code;
        response.message = DEFAULT_CODES.INVALID_PASSWORD.message;
        return response
    }
};

const getLoginToken = async (userObj) => {
    try {       
        const signOptions = {
            audience:userObj.audience,
            issuer:process.env.HOST,
            expiresIn:parseInt(defaults.getValue('tokenExpiry'))
        }
        const payload ={
            user: {
                email:userObj.email || "",
                phone:userObj.phone || "",
                userId: userObj.userId,
                provider:userObj.provider
            }
        }
        const token = signToken(payload,signOptions);
        let validTill = moment().format("YYYY/MM/DD HH:mm:ss");
        validTill = moment().add(defaults.getValue('tokenExpiry'), "seconds").format("YYYY/MM/DD HH:mm:ss");
        let userAuthToken = {
            tokenId: b64.encode(JSON.stringify(verifyToken(token,signOptions))),
            userId: userObj.userId,
            tokenType: TOKEN_TYPES.SIGNIN,
            inValid: false,
            validTill: validTill
        };
        await models.auth_token.create(userAuthToken);

        return {
            code:DEFAULT_CODES.LOGIN_SUCCESS.code,
            message:DEFAULT_CODES.LOGIN_SUCCESS.message,
            success:true,
            data :{
                x_token:token
            }
        }

    } catch (error) {
        console.log(error);
        return {
            code:DEFAULT_CODES.SYSTEM_ERROR.code,
            message:DEFAULT_CODES.SYSTEM_ERROR.message,
            success:false,
            data :{}
        }
    }
}

const generateOtp = async (userObj) => {

}



module.exports = {
    login,
    verifyOtp,
    sendOtp
}