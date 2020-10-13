const { encryptStr, isEmail, decryptStr, getOtp, verifySocialToken, createUser, sendVerifcationLink, getLoginToken } = require("../../../utils/helper");
const { DEFAULT_CODES, LOGIN_TYPES, TOKEN_TYPES, OTP_TYPES } = require("../../../utils/defaultCode");
const { fetchFormValues } = require("../forms/enquirySubmission");
const b64 = require("base64url");
const bcrypt = require('bcrypt');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const models = require("../../../../models");
const { verifyToken } = require("../auth/auth");
const defaults = require("../defaults/defaults");
const moment = require("moment");
const { resolve } = require("path");
const { default: Axios } = require("axios");
const { stringify } = require("querystring");
const SEND_OTP = !!process.env.SEND_OTP;
const signToken = require('../auth/auth').signToken;

const SOCIAL_PROVIDER = [LOGIN_TYPES.GOOGLE, LOGIN_TYPES.LINKEDIN];


const login = async (req, res, next) => {
    try {
        const body = req.body;
        const audience = req.headers.origin;
        const { username = "", password = "" } = body;
        // validate input
        if (username.trim() == '') {
            return res.status(200).json({
                'success': false,
                'message': 'Username is required',
                'data': {}
            });
        }

        if (password.trim() == '') {
            return res.status(200).json({
                'success': false,
                'message': 'Password is required',
                'data': {}
            });
        }
        //userSigin Fuction
        console.log(typeof audience);
        const response = await signInUser({ username, password, audience, provider: LOGIN_TYPES.LOCAL });
        return res.status(200).json(response);

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            'code': 'SERVER_ERROR',
            'description': 'something went wrong, Please try again'
        });
    }
}
/* 
    {
        code:'',
        success:true/false,
        message:'',
        data:{
            otp:""
        }
    }
*/
//send otp api endpoint
const sendOtp = async (req, res, next) => {
    try {
        const body = req.body;
        const audience = req.headers.origin;
        const { username = "" } = body;
        // validate input
        console.log();
        if (!username.trim()) {
            return res.status(200).json({
                'success': false,
                'message': 'Username is required',
                'data': {}
            });

        }

        /* 
        * Check if user exists or resgistered user
        */
        const response = await generateOtp({ username, audience, provider: LOGIN_TYPES.LOCAL });
        return res.status(200).json(response);
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            'code': 'SERVER_ERROR',
            'description': 'something went wrong, Please try again'
        });
    }
}

//Verify otp 
/* 
* req.body = username , otp 

*/
/* 
    {
        code:'',
        success:true/false,
        message:'',
        data:{
            x_token:""
        }
    }
*/
const verifyOtp = async (req, res, next) => {
    try {
        const body = req.body;
        const audience = req.headers.origin;
        const { otp = "", username = "" } = body;
        // validate input
        if (!otp.trim()) {
            return res.status(200).json({
                'success': false,
                'message': 'OTP is required',
                'data': {}
            });

        }

        const response = await startVerifyOtp({ username, otp, audience, provider: LOGIN_TYPES.LOCAL });
        return res.status(200).json(response);
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            'code': DEFAULT_CODES.SYSTEM_ERROR.code,
            'message': DEFAULT_CODES.SYSTEM_ERROR.message,
            success: false
        });
    }
}

const verifyUserToken = (req, res) => {
    let resp = {
        code: DEFAULT_CODES.VALID_TOKEN.code,
        message: DEFAULT_CODES.VALID_TOKEN.message,
        success: true,
        data: {
            user: req.user
        }
    }
    return res.status(200).json(resp);
}

const signUp = async (req, res) => {
    const audience = req.headers.origin;
    const { username = "", password = "", } = req.body;
    if (username.trim() == '') {
        return res.status(200).json({
            'success': false,
            'message': 'Email is required',
            'data': {}
        });
    }

    if (password.trim() == '') {
        return res.status(200).json({
            'success': false,
            'message': 'Password is required',
            'data': {}
        });
    }
    const verificationRes = await userExist(req.body.username, LOGIN_TYPES.LOCAL);
    if (verificationRes.success) {
        verificationRes.success = false
        verificationRes.code = DEFAULT_CODES.USER_ALREADY_REGISTERED.code;
        verificationRes.message = DEFAULT_CODES.USER_ALREADY_REGISTERED.message;
        verificationRes.data = {}
        return res.status(200).json(verificationRes)
    }
    req.body.tokenPayload = req.user;
    req.body.audience = audience;
    req.body.provider = LOGIN_TYPES.LOCAL
    let userres = await createUser(req.body)
    console.log(userres);
    if (!userres.success) {
        return res.status(500).send(userres)
    }
    const tokenRes = await getLoginToken({ ...userres.data.user, audience: audience || "", provider: LOGIN_TYPES.LOCAL });
    tokenRes.code = DEFAULT_CODES.USER_REGISTERED.code
    tokenRes.message = DEFAULT_CODES.USER_REGISTERED.message
    delete userres.data.user.userId
    delete userres.data.user.id
    tokenRes.data['user'] = userres.data.user
    res.status(200).send(tokenRes)
}
/* 
    {
        code:'',
        success:true/false,
        message:'',
        data:{
            x_token:""
        }
    }
*/

const socialSignIn = async (req, res, next) => {
    const { provider = "", tokenId = "", redirectUri = "" } = req.body;
    try {
        if (!SOCIAL_PROVIDER.includes(provider)) {
            return res.status(200).json({
                code: DEFAULT_CODES.INVALID_PROVIDER.code,
                message: DEFAULT_CODES.INVALID_PROVIDER.message,
                success: false,
                data: {
                    provider
                }
            })
        }

        if (!tokenId) {
            return res.status(200).json({
                code: DEFAULT_CODES.INVALID_TOKEN.code,
                message: DEFAULT_CODES.INVALID_TOKEN.message,
                success: false,
                data: {
                    provider
                }
            })
        }

        //verify token 
        const providerRes = await verifySocialToken(req.body)
        if (!providerRes.success) {
            return res.status(200).json(providerRes)
        }

        //check if user exists
        let verificationRes = await userExist(providerRes.data.username, providerRes.data.provider);
        if (!verificationRes.success) {
            return res.status(200).json(verificationRes)
            // const newUserRes = await createUser(providerRes.data);
            // if (!newUserRes.success) {
            //     return res.status(500).json({
            //         'code': DEFAULT_CODES.SYSTEM_ERROR.code,
            //         'message': DEFAULT_CODES.SYSTEM_ERROR.message,
            //         success: false
            //     })
            // }
            // verificationRes.data.user = newUserRes.data.user;
        }

        //create token
        const tokenRes = await getLoginToken({ ...verificationRes.data.user, audience: req.headers.origin, provider: providerRes.data.provider });
        console.log(tokenRes);
        return res.status(200).json(tokenRes);

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            'code': DEFAULT_CODES.SYSTEM_ERROR.code,
            'message': DEFAULT_CODES.SYSTEM_ERROR.message,
            success: false
        });
    }
}
/* 
    {
        code:'',
        success:true/false,
        message:'',
        data:{
            x_token:""
        }
    }
*/

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
            const tokenRes = getLoginToken({ ...verificationRes.data.user, audience: resData.audience, provider: resData.provider });
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

    return new Promise(async (resolve, reject) => {
        console.log(username, provider);
        // return resolve({success:true})
        let response = {
            code: DEFAULT_CODES.INVALID_USER.code,
            message: DEFAULT_CODES.INVALID_USER.message,
            success: false,
            data: {
                user: {}
            }
        }

        try {
            let dbCol = 'email';
            // determine is username is email or phone
            if (!isEmail(username)) {
                dbCol = 'phone';
            }

            //check in db
            let userLogin = await models.user_login.findOne({ where: { [dbCol]: username, provider: provider } })
            if (userLogin != null) {
                const user = await models.user.findOne({ where: { id: userLogin.userId } });
                if (provider != LOGIN_TYPES.LOCAL && !user.verified) {

                    await models.user.update({
                        verified: true,
                    }, {
                        where: {
                            id: userLogin.userId
                        }
                    });
                }
                console.log(user);
                const { userId, email = "", password = "", phone = "" } = userLogin;
                response.success = true;
                response.code = DEFAULT_CODES.VALID_USER;
                response.message = DEFAULT_CODES.VALID_USER.message;
                response.data.user = {
                    email,
                    password,
                    phone,
                    userId,
                    userType: user.userType,
                    verified: provider != LOGIN_TYPES.LOCAL ? true : user.verified
                }
                return resolve(response)
            } else {
                return resolve(response)
            }
        } catch (error) {
            console.log(error);
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


// check if valid user
/* 
    {
        code:'',
        success:true/false,
        message:'',
        data:{
            otp: xxxxxx
        }
    }
*/
const generateOtp = async (resData) => {
    let { username } = resData;
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
            const verificationRes = await userExist(username, LOGIN_TYPES.LOCAL);
            if (!verificationRes.success) {
                return resolve(verificationRes)
            }


            // Get all otp generated for past X(10 ,mins) time span
            return models.otp.findAndCountAll({
                where: {
                    [Op.and]: [
                        {
                            username: {
                                [Op.like]: username
                            }
                        },
                        {
                            createdAt: {
                                [Op.gt]: new Date(new Date().getTime() - 1 * defaults.getValue('otpSpan') * 60 * 1000)
                            }
                        }
                    ]
                }
            })
                .then(async result => {
                    var current_date = new Date();
                    var init_time, last_time, span_time;
                    if (result.count > 0) {
                        init_time = new Date(new Date(result.rows[0].createdAt).getTime() + 1 * defaults.getValue('otpSpan') * 60 * 1000);
                        span_time = new Date(new Date(result.rows[result.count - 1].updatedAt).getTime() + 1 * defaults.getValue('otpSpan') * 60 * 1000);
                    }
                    if (result.count >= defaults.getValue('otpMaxSent')) {
                        return resolve({ "success": false, "code": "error", "message": "Too many verification SMS sent. Please try after " + Math.round((init_time.getTime() - current_date.getTime()) / (60 * 1000)) + " minutes." });
                    }

                    // else if (result.count > 0 && (result.rows[result.count - 1].attempts >= defaults.getValue('otp_invalid_tries')) && (span_time.getTime() >= current_date.getTime())) {
                    //     return resolve({ "success": false, "code": "error", "message": "Too many failed login attempts. Please try again in " + Math.round((span_time.getTime() - current_date.getTime()) / (60 * 1000)) + " minutes." });
                    // } 
                    else {
                        /* 
                            * generates otp and stores in Db
                        */
                        var otp = (SEND_OTP) ? getOtp(defaults.getValue('otpLength')) : "000000"; // generate 6 digit otp, configurable 

                        let hash = bcrypt.hashSync(otp, 10);

                        await models.otp.create({
                            username,
                            otp: hash,
                            otpType: OTP_TYPES.SIGNIN
                        });
                        return resolve({
                            success: true,
                            code: DEFAULT_CODES.OTP_SENT.code,
                            message: DEFAULT_CODES.OTP_SENT.message,
                            data: {
                                otp: otp
                            }
                        })
                    }
                }).catch((error) => {
                    console.log(error);
                    return resolve({
                        code: DEFAULT_CODES.SYSTEM_ERROR.code,
                        message: DEFAULT_CODES.SYSTEM_ERROR.message,
                        success: false,
                        data: {}
                    })
                });
        } catch (error) {
            console.log(error);
            return resolve({
                code: DEFAULT_CODES.SYSTEM_ERROR.code,
                message: DEFAULT_CODES.SYSTEM_ERROR.message,
                success: false,
                data: {}
            })
        }
    })

}
const startVerifyOtp = async (resData) => {
    return new Promise(async (resolve, reject) => {
        try {
            let { username = "", otp = "" } = resData
            let otpRes = await validateOtp(username, otp, OTP_TYPES.SIGNIN);
            if (!otpRes.success) {
                return resolve(otpRes);
            }

            //Verify 
            const verificationRes = await userExist(username, LOGIN_TYPES.LOCAL);
            if (!verificationRes.success) {
                return resolve(verificationRes)
            }
            /*
             * Generate Token for login session
             input => audience- origin(client), provider-> (google facebook or linked in or local)
             */
            const tokenRes = await getLoginToken({ ...verificationRes.data.user, audience: resData.audience, provider: resData.provider });
            console.log(tokenRes);
            return resolve(tokenRes);
        } catch (error) {
            return resolve({
                code: DEFAULT_CODES.SYSTEM_ERROR.code,
                message: DEFAULT_CODES.SYSTEM_ERROR.message,
                success: false,
                data: {}
            })
        }

    })
}

const validateOtp = async (username, otp, otpType) => {
    try {
        let result = await models.otp.findAll({
            where: {
                username: {
                    [Op.like]: username
                },
                otpType: otpType
            },
            order: [
                ['createdAt', 'DESC']
            ],
            limit: 1
        });
        if (result && result.length > 0) {
            var current_date = new Date();
            var expiry_time = new Date(new Date(result[0].createdAt).getTime() + 1 * defaults.getValue('otpExpiry') * 60 * 1000);
            // var span_time = new Date(new Date(result[0].updatedAt).getTime() + 1 * defaults.getValue('otpSpan') * 60 * 1000);
            if (expiry_time.getTime() < current_date.getTime()) {
                return { "code": DEFAULT_CODES.OTP_EXPIRED.code, "message": DEFAULT_CODES.OTP_EXPIRED.message, success: false, data: {} };
            }
            //  else if ((result[0].attempts >= defaults.getValue('otp_invalid_tries'))) {
            //     let lockout = Math.round((span_time.getTime() - current_date.getTime()) / (60 * 1000));
            //     let message = (lockout > 0) ? "Too many failed login attempts. Please try again in " + lockout + " minutes." : "Too many failed login attempts. Please try sending OTP again."
            //     return { "code": "max_failed_attempts", "message": message }
            // }
            else if (!bcrypt.compareSync(otp, result[0].otp)) {
                try {
                    let uresult = await models.otp.update({
                        attempts: result[0].attempts + 1,
                    }, {
                        where: {
                            username: {
                                [Op.like]: username,
                            },
                            otpType: otpType
                        }
                    });
                    // let code =  (defaults.getValue('otp_invalid_tries') > (result[0].attempts + 1)) ? "incorrect_otp" : "max_failed_attempts";
                    // let message = (defaults.getValue('otp_invalid_tries') > (result[0].attempts + 1)) ? "Incorrect OTP entered. Please retry again" : "Too many failed login attempts. Please try again in " + defaults.getValue('otp_span') + " minutes"
                    return { "code": DEFAULT_CODES.INVALID_OTP.code, "message": DEFAULT_CODES.INVALID_OTP.message, success: false, data: {} };
                } catch (error) {
                    return { "code": DEFAULT_CODES.INVALID_OTP.code, "message": DEFAULT_CODES.INVALID_OTP.message, success: false, data: {} };
                }
            } else {
                console.log(moment().subtract(defaults.getValue('otpSpan'), "minutes").toISOString());
                /** Clear out old otps */
                models.otp.destroy({
                    where: {
                        [Op.and]: [
                            {
                                username: {
                                    [Op.like]: username
                                }
                            }
                            ,
                            {
                                createdAt: {
                                    [Op.lt]: new Date(new Date().getTime() - 1 * defaults.getValue('otpSpan') * 60 * 1000)
                                }
                            }
                        ]
                    }
                });
                return { "code": DEFAULT_CODES.VALID_OTP.code, "message": DEFAULT_CODES.VALID_OTP.message, success: true, data: {} };

            }
        } else {
            console.log('No otp for user');
            return {
                code: DEFAULT_CODES.OTP_EXPIRED.code,
                message: DEFAULT_CODES.OTP_EXPIRED.message,
                success: false,
                data: {}

            }
        }

    } catch (error) {
        console.log('No users', error);
        return {
            code: DEFAULT_CODES.SYSTEM_ERROR.code,
            message: DEFAULT_CODES.SYSTEM_ERROR.message,
            success: false,
            data: {}

        }
    }
}

const resendVerificationLink = async (req, res) => {
    const { user } = req
    const payload = {
        requestFieldMetaType: "primary",
        requestFields: ["firstName", "lastName"],
        user
    }

    let resForm = await fetchFormValues(payload)

    let userObj = {
        ...user,
        ...resForm.data.requestFieldValues,
        audience: req.headers.origin
    }
    await sendVerifcationLink(userObj)
    return res.status(200).json({
        success: true,
        message: DEFAULT_CODES.USER_REGISTERED.message
    })
}

const verifyAccount = async (req, res) => {
    const { verification_token } = req.body;

    let options = {
        issuer: process.env.HOST,
        audience: req.headers.origin,
        algorithm: "RS256",
    }

    const verifiedToken = await require("../auth/auth").verifyToken(verification_token, options);
    if (verifiedToken) {
        let { user } = verifiedToken;
        let userres = await models.user.update({
            verified: false
        }, {
            where: {
                id: user.userId
            }
        });
        const payload = {
            requestFieldMetaType: "primary",
            requestFields: ["firstName", "lastName"],
            user
        }

        let resForm = await fetchFormValues(payload)

        let newUserObj = { ...user, userType: "registered", verified: true, ...resForm.data.requestFieldValues }
        await invalidateTokens(newUserObj)
        const tokenRes = await getLoginToken({ ...newUserObj, audience: resData.audience, provider: LOGIN_TYPES.LOCAL });
        return res.status(200).send(tokenRes)
    } else {
        return res.status(200).send({
            code: DEFAULT_CODES.VERIFICATION_FAILED.code,
            success: false,
            message: DEFAULT_CODES.VERIFICATION_FAILED.message,
            data: {}
        })
    }
    
}
const invalidateTokens = (userObj) => {
    return new Promise((resolve,reject) => {

        await models.auth_token.destroy({
            where: {
               id:userObj.userId
            }
        });
        resolve(true)
    })
}
module.exports = {
    login,
    verifyOtp,
    sendOtp,
    verifyUserToken,
    socialSignIn,
    signUp,
    resendVerificationLink,
    verifyAccount
}