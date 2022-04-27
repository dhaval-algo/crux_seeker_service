const {
    isEmail,
    decryptStr,
    getOtp,
    verifySocialToken,
    createUser,
    sendVerifcationLink,
    getLoginToken,
    invalidateTokens,
    sendWelcomeEmail ,
    sendResetPasswordLink,
    encryptStr,
    calculateProfileCompletion,
    createSocialEntryIfNotExists,
    getImgBuffer,
    getFileBuffer,
    generateSingleViewData,
    sendDataForStrapi,
    sendSuspendedEmail,
    sendActivatedEmail,
    logActvity
} = require("../../../utils/helper");
const { DEFAULT_CODES, LOGIN_TYPES, TOKEN_TYPES, OTP_TYPES } = require("../../../utils/defaultCode");
const { fetchFormValues } = require("../forms/enquirySubmission");
const bcrypt = require('bcrypt');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const models = require("../../../../models");
const { verifyToken } = require("../auth/auth");
const defaults = require("../defaults/defaults");
const moment = require("moment");
const { resolve } = require("path");
const { default: Axios } = require("axios");
const SEND_OTP = !!process.env.SEND_OTP;
const learnContentService = require("../../../api/services/learnContentService");
const learnPathService = require("../../../api/services/learnPathService");
let LearnContentService = new learnContentService();
let LearnPathService = new learnPathService();
const articleService = require("../../../api/services/articleService");
let ArticleService = new articleService();
const SOCIAL_PROVIDER = [LOGIN_TYPES.GOOGLE, LOGIN_TYPES.LINKEDIN];
const validator = require("email-validator");
const{sendSMS, sendEmail} =  require('../../../communication/v1/communication');
const validators = require("../../../utils/validators")

// note that all your subscribers must be imported somewhere in the app, so they are getting registered
// on node you can also require the whole directory using [require all](https://www.npmjs.com/package/require-all) package

const elasticService = require("../../../api/services/elasticService");
const { sequelize } = require("../../../../models");
const { getBucketNames, uploadImageToS3, deleteObject,uploadResumeToS3 } = require("../AWS");

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

        if (!validator.validate(username.trim())) {
            return res.status(200).json({
                'success': false,
                'message': 'Please enter the email in the right format',
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
        const { username = "" , otpType = ""} = body;
        // validate input
        
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
        const response = await generateOtp({ username, audience, provider: LOGIN_TYPES.LOCAL, otpType});
        if(!response.success){
            return res.status(500).json(response);
        }
        const userMeta = await models.user_meta.findOne({where:{value:username, metaType:'primary', key:'email'}})
        const userPhone = await models.user_meta.findOne({where:{userId:userMeta.userId, metaType:'primary', key:'phone'}})
        let phone = userPhone.value.substring(2, 12);
        if(userPhone.value.substring(0, 2) != '91'){
            return res.status(500).json({
                'code': 'SERVER_ERROR',
                'description': 'Only indian number are allowed'
            });
        }
        await sendSMSOTP (phone, response.data.otp);
        //await sendSMS( phone, `${response.data.otp} is the OTP to verify your Careervira account. It will expire in 10 minutes.`)
        return res.status(200).json({
            'success': 'true',
            'code': 'OTP_SENT',
            'message':'Otp has been sent.'
        });
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
        const { user } = req
        const body = req.body;
        const audience = req.headers.origin;
        let userId = user.userId
        const { otp = "", otpType, email=""} = body;
        // const { otp = "", username = "" ,otpType, email=""} = body;
        // validate input
        if (!otp.trim()) {
            return res.status(200).json({
                'success': false,
                'message': 'OTP is required',
                'data': {}
            });
        }
        if(!isEmail(email) && email){
            return res.status(200).json({
                code: "NOT AN EMAIL",
                message: "Please enter email in xyz@email.com format.",
                success: false,
                data: {}
            })
        }
        if(email){
            let email_already_exist = await models.user_meta.findOne({where:{key:'email', value:email, metaType:'primary'}})
            if(email_already_exist){
                return res.status(200).json({
                    code: "EMAIL ALREADY EXIST",
                    message: "Please enter email which is not already used.",
                    success: false,
                    data: {}
                })
            }
        }
        let providerObj = await models.user_login.findOne({where:{userId:userId}})
        const provider = providerObj.provider
        if(!provider || provider == ''){
            provider = LOGIN_TYPES.LOCAL
        }

        let userObj = await models.user_meta.findOne({where:{userId:userId, key:"email", metaType:"primary"}})
        const username = userObj.value
        
        const response = await startVerifyOtp({ username, otp, audience, provider: provider, otpType });
        if(!response.success){
            return res.status(200).json(response);
        }
        if(otpType == OTP_TYPES.PHONEVERIFICATION && response.success && response.code==DEFAULT_CODES.VALID_OTP.code)
        {
            const response = await verifyPhone( username);
            const userMeta = await models.user_meta.findOne({where:{value:username, metaType:'primary', key:'email'}})
            const userPhone = await models.user_meta.findOne({where:{userId:userMeta.userId, metaType:'primary', key:'phone'}})
            let phone = userPhone.value.substring(2, 12);
            await sendSMSWelcome(phone)
        }
        if(otpType == OTP_TYPES.EMAILVERIFICATION && response.success && response.code==DEFAULT_CODES.VALID_OTP.code)
        {
            /*
                email = new email
                Get the new email.
                Get the old email from the Database.
                Generate OTP.
                Send the OTP to the new email.
                Verify OTP.
                SEND EMAIL(Your email has been changed to the old email)
                Store Old Email in a new attribute
                Change Email.  
            */
            // const userMeta = await models.user_meta.findOne({where:{value:username, metaType:'primary', key:'email'}})
            // const oldEmail = await models.user_meta.findOne({where:{userId:userMeta.userId, metaType:'primary', key:'email'}})
            let emailPayload = {
                fromemail: process.env.FROM_EMAIL_RESET_PASSWORD_EMAIL,
                toemail: username,
                email_type: "reset_email_to_old",
                email_data: {
                    old_email: username,
                    new_email: email
                }
            }
            await sendEmail(emailPayload);
            
            const existEntry = await models.user_meta.findOne({where:{userId:userId, value:username, metaType:'primary', key:'oldEmail'}})
            if(!existEntry){
                await models.user_meta.create({userId:userId, value:username, metaType:'primary', key:'oldEmail'})
            }else{
                await models.user_meta.update({value:username},{where:{userId:userId, metaType:'primary', key:'oldEmail'}})
            }
            await models.user_meta.update({
                value:email
            }, {
                where: {
                    userId:userId,
                    metaType:'primary', 
                    key:'email'
                }
            });
            await models.user_login.update({
                email: email
            }, {
                where: {
                    userId:userId
                }
            });
            // If everything goes fine updating the verified status
            const userEntry = await models.user.findOne({where:{id:userId}})
            if(userEntry){
                if(!userEntry.verified){
                    await models.user.update(
                        {
                            verified: true 
                        },
                        {
                            where: { id: userId }
                        }
                    )
                }
            }
            let data = {old_email:username, new_email:email}
            sendDataForStrapi(data, "update-email");
        }
        return res.status(200).json(response);
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            code: DEFAULT_CODES.SYSTEM_ERROR.code,
            message: DEFAULT_CODES.SYSTEM_ERROR.message,
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
    let { username = "", password = "", provider = LOGIN_TYPES.LOCAL, email} = req.body;
    if (username.trim() == '' && provider == LOGIN_TYPES.LOCAL) {
        return res.status(200).json({
            'success': false,
            'message': 'Email is required',
            'data': {}
        });
    }

    if (password.trim() == '' &&  provider == LOGIN_TYPES.LOCAL) {
        return res.status(200).json({
            'success': false,
            'message': 'Password is required',
            'data': {}
        });
    }

    if (provider == LOGIN_TYPES.LOCAL) {

        for(let userMeta of req.body.userMeta)
        {
            if((userMeta.key=="firstName" || userMeta.key=="lastName" || userMeta.key=="phone") && userMeta.value.trim()== '')
            {
                return res.status(200).json({
                    'success': false,
                    'message': 'Mandatory fields are missing',
                    'data': {}
                });
            }
        }
    }
    
    let providerRes= {}
    //if orivude is socila login veriffy token
    if(provider !=LOGIN_TYPES.LOCAL){
        providerRes = await verifySocialToken(req.body)
        
        if (!providerRes.success) {
            return res.status(200).send(providerRes)
        }
    }
    username = username || providerRes.data.email;

    const verificationRes = await userExist(username, LOGIN_TYPES.LOCAL);
    if (verificationRes.success || (verificationRes.code ==DEFAULT_CODES.SUSPENDED_USER.code)) {
        if(verificationRes.code != DEFAULT_CODES.SUSPENDED_USER.code && provider != LOGIN_TYPES.LOCAL)
        {
            const tokenRes = await getLoginToken({provider: LOGIN_TYPES.LOCAL, ...verificationRes.data.user, audience: audience || ""});
            tokenRes.code = DEFAULT_CODES.USER_REGISTERED.code
            tokenRes.message = DEFAULT_CODES.USER_REGISTERED.message           
            tokenRes.data['user'] = verificationRes.data.user
            return res.status(200).json(verificationRes)
        }
        verificationRes.success = false
        verificationRes.code = DEFAULT_CODES.USER_ALREADY_REGISTERED.code;
        verificationRes.message = DEFAULT_CODES.USER_ALREADY_REGISTERED.message;
        verificationRes.data = {}
        return res.status(200).json(verificationRes)
    }
    req.body.tokenPayload = req.user;
    req.body.audience = audience;
    req.body.provider = req.body.provider || LOGIN_TYPES.LOCAL
    
    let userres = await createUser({...req.body,...verificationRes.data, ...providerRes.data})
 
    if (!userres.success) {
        return res.status(500).send(userres)
    }
    const tokenRes = await getLoginToken({provider: LOGIN_TYPES.LOCAL, ...userres.data.user, audience: audience || ""});
    tokenRes.code = DEFAULT_CODES.USER_REGISTERED.code
    tokenRes.message = DEFAULT_CODES.USER_REGISTERED.message
    userres.data.user.userId
    delete userres.data.user.id
    tokenRes.data['user'] = userres.data.user

    if(process.env.PHONEVERIFICATION =='true'&& userres.data.user.country =="India" && userres.data.user.phone.substring(0, 2) =='91' )
    {
        const OTP_TYPE = OTP_TYPES.PHONEVERIFICATION
        const username = userres.data.user.username
        userId = userres.data.user.userId
        const response = await generateOtp({ username, userId, provider: LOGIN_TYPES.LOCAL, otpType:OTP_TYPE });
        const userMeta = await models.user_meta.findOne({where:{userId:userId, metaType:'primary', key:'phone'}})
        let phone = userMeta.value.substring(2, 12);
        await sendSMSOTP (phone, response.data.otp);
        tokenRes.data.verifyPhone = true
    }
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
        let verificationRes = await userExist(providerRes.data.username, LOGIN_TYPES.LOCAL);
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
        const payload = {
            requestFieldMetaType: "primary",
            requestFields: ["firstName", "lastName", "profilePicture"],
            user:verificationRes.data.user
        }

        let resForm = await fetchFormValues(payload)

        // check if login type present if not create.
        const userAuth =  await createSocialEntryIfNotExists({...verificationRes.data.user,...providerRes.data},provider)
        if(!userAuth) {
            return res.status(500).json({
                'code': DEFAULT_CODES.SYSTEM_ERROR.code,
                'message': DEFAULT_CODES.SYSTEM_ERROR.message,
                success: false
            });
        }
        //create token
        const tokenRes = await getLoginToken({ ...verificationRes.data.user,...providerRes.data,...resForm.data.requestFieldValues, audience: req.headers.origin, provider: providerRes.data.provider });
        
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
            const payload = {
                requestFieldMetaType: "primary",
                requestFields: ["firstName", "lastName", "profilePicture"],
                user:verificationRes.data.user
            }

            let resForm = await fetchFormValues(payload)
            const tokenRes = getLoginToken({ ...verificationRes.data.user,...resForm.data.requestFieldValues, audience: resData.audience, provider: resData.provider });
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
            let where = {
                [Op.and]: [
                    {
                        [Op.eq]: Sequelize.where( Sequelize.fn('lower', Sequelize.col(dbCol)),Sequelize.fn('lower', username))                        
                    },
                    {
                        provider: {
                            [Op.eq]: provider
                        }
                    }
                ]
            }
            let userLogin = await models.user_login.findOne({ where: where})
            
            if (userLogin != null) {
                const user = await models.user.findOne({ where: { id: userLogin.userId } });

             //   if (provider != LOGIN_TYPES.LOCAL && !user.verified) {
                // if (!user.verified) {
                   
                //     return resolve({
                //         code: DEFAULT_CODES.UNVERIFIED_USER.code,
                //         message: DEFAULT_CODES.UNVERIFIED_USER.message,
                //         success: false,
                //         data: {
                //             user: {}
                //         }
                //     })
                    // await models.user.update({
                    //     verified: true,
                    // }, {
                    //     where: {
                    //         id: userLogin.userId
                    //     }
                    // });
                //}
                if (user.status == "suspended") {
                   
                    return resolve({
                        code: DEFAULT_CODES.SUSPENDED_USER.code,
                        message: DEFAULT_CODES.SUSPENDED_USER.message,
                        success: false,
                        data: {
                            user: {}
                        }
                    })
                }
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
            console.log('Social signin err ',error);
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
    if (userObj.password && resPwd === decryptStr(userObj.password)) {
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
    let { username, userId, provider, otpType } = resData;
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
            const verificationRes = await userExist(username, provider);
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
                            otpType: otpType
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
                            otpType: otpType,
                            userId:userId
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
            let { username = "", otp = "" ,otpType} = resData
            let otpRes = await validateOtp(username, otp, otpType);
            if (!otpRes.success) {
                return resolve(otpRes);
            }

            if(otpType == OTP_TYPES.PHONEVERIFICATION)
            {
                return resolve(otpRes);
            }

            if(otpType == OTP_TYPES.EMAILVERIFICATION)
            {
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
    try {
        const verifiedToken = await require("../auth/auth").verifyToken(verification_token, options);
        if (verifiedToken) {
            let { user } = verifiedToken;
            let userinfo = await models.user.findOne({
                where: {
                    id: user.userId
                }
            });
            if(userinfo.status=="suspended")
            {
                return res.status(200).send({
                    code: DEFAULT_CODES.VERIFICATION_FAILED.code,
                    success: false,
                    message: DEFAULT_CODES.VERIFICATION_FAILED.message,
                    data: {}
                })
            }
            let userres = await models.user.update({
                verified: true
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
            await sendWelcomeEmail(newUserObj)
            const tokenRes = await getLoginToken({ ...newUserObj, audience: req.headers.origin, provider: LOGIN_TYPES.LOCAL });
            return res.status(200).send(tokenRes)
        } else {
            return res.status(200).send({
                code: DEFAULT_CODES.VERIFICATION_FAILED.code,
                success: false,
                message: DEFAULT_CODES.VERIFICATION_FAILED.message,
                data: {}
            })
        }
    } catch (error) {
          console.log(error);
    }



}

//send forgot password link
const forgotPassword = async (req,res) => {
    const { email } = req.body
    const authHeader = req.headers.authorization;
    let options = {
        issuer: process.env.HOST,
        audience: req.headers.origin,
        algorithm: "RS256",
    }
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        const verifiedToken = await require("../auth/auth").verifyToken(token, options);
        if(verifiedToken) {
            return res.status(200).json({
                success:false,
                message:"Invalid request"
            })
        }
    }
    const userRes = await userExist(email, LOGIN_TYPES.LOCAL)
    if(!userRes.success) {
        return res.status(200).json(userRes)
    }
    //generate reset token
    userRes.data.user['audience'] = req.headers.origin || "";
    const resetLink = await sendResetPasswordLink(userRes.data.user, false)

    res.status(200).json({
        success:true
    })   
}

const resetPassword = async (req,res) => {
    const { reset_token, password } = req.body
    const authHeader = req.headers.authorization;
    const audience = req.headers.origin;
    let options = {
        issuer: process.env.HOST,
        audience: req.headers.origin,
        algorithm: "RS256",
    }
    try {
        if (authHeader) {
            const token = authHeader.split(' ')[1];
            const verifiedToken = await require("../auth/auth").verifyToken(token, options);
            if(verifiedToken) {
                return res.status(200).json({
                    success:false,
                    message:"Invalid request"
                })
            }
        }
       
        const verifiedToken = await require("../auth/auth").verifyToken(reset_token, options);
        if (verifiedToken) {
            let { user } = verifiedToken;
            const encryptedPWD = encryptStr(password);
            let userres = await models.user_login.update({
                password: encryptedPWD
            }, {
                where: {
                    userId: user.userId,
                    provider:LOGIN_TYPES.LOCAL

                }
            });
            await invalidateTokens(user)
            return res.status(200).send({
                success:true
            })
        } else {
            return res.status(200).send({
                code: DEFAULT_CODES.INVALID_TOKEN.code,
                success: false,
                message: "Token expired please generate token again",
                data: {}
            })
        }
    } catch (error) {
        console.log(error);
        return res.status(200).send({
            code: DEFAULT_CODES.INVALID_TOKEN.code,
            success: false,
            message: "Something went wrong, Please try in sometime.",
            data: {}
        })
    }  
}

const getProfileProgress = async (req,res) => {
    const { user } = req
    const profileRes = await calculateProfileCompletion(user)
    if(profileRes){
        return res.status(200).json({
            success:true,
            data: {
                profileProgress:profileRes
            }
        })

    }
    else{
        return res.status(500).json({
            success:false,
            message:"internal server error"
        })
    }
}

const getCourseWishlist = async (req,res) => {
    const { user } = req
    const { limit = 10, search, page, orderBy="DESC" } = req.query
    
    const offset = (page -1) * limit
    const order = [
        ['createdBy', orderBy.toUpperCase()]
    ]
    const payload = {
        requestFields: ["course_wishlist"],
        user,
        where: {
            order,
            limit,
            offset  
        }
    }

    let resForm = await fetchFormValues(payload)
    return res.status(200).json({
        success:true,
        data: {
            courses:resForm
        }
    })
}

const addCourseToWishList = async (req, res) => {
    try {
        const { user } = req;
        const userId = user.userId
        const courseIdsFromClient = validators.validateAddWishlistParams(req.body)
        if (!courseIdsFromClient) {

            return res.status(200).json({
                success: false,
                message: "invalid request sent"
            })
        }

        let existingIds = await models.user_meta.findAll({
            attributes: ["value"], where: {
                userId: userId,
                key: 'course_wishlist',
                value: courseIdsFromClient
            }
        });
        let courseIds = []
        existingIds = existingIds.map((course) => course.value)
        courseIdsFromClient.forEach((courseId) => {
            if (!existingIds.includes(courseId)) courseIds.push(courseId)
        });

        if (courseIds.length) {
            const dataToSave = courseIds.map((courseId) => {
                return {
                    key: "course_wishlist",
                    value: courseId,
                    userId: userId,
                }
            });

            const resMeta = await models.user_meta.bulkCreate(dataToSave)
            const numericIds = courseIds.map((courseId) => courseId.split("LRN_CNT_PUB_").pop())
            const userinfo = await models.user_meta.findOne({
                attributes: ["value"],
                where: {
                    userId: user.userId, metaType: 'primary', key: 'email'
                }
            })
            const data = { email: userinfo.value, courseIds: numericIds }
            await logActvity("COURSE_WISHLIST", userId, courseIds);
            sendDataForStrapi(data, "profile-add-wishlist");

            return res.status(200).json({
                success: true,
                data: {
                    wishlist: resMeta
                }
            })
        }
        else {
            return res.status(200).json({
                success: true,
                data: {
                    wishlist: []
                }
            })
        }

    } catch (error) {
      
        console.log(error)
        return res.status(500).json({
            success: false,
            message:"internal server error"
        })
    }
}

const addLearnPathToWishList = async (req,res) => {
    try {
        const { user } = req;
        const userId = user.userId
        const learnPathIdsFromClient = validators.validateLearnPathAddWishlist(req.body)
        if (!learnPathIdsFromClient) {

            return res.status(200).json({
                success: false,
                message: "invalid request sent"
            })
        }

        let existingIds = await models.user_meta.findAll({
            attributes: ["value"], where: {
                userId: userId,
                key: 'learnpath_wishlist',
                value: learnPathIdsFromClient
            }
        });
        let learnpathIds = []
        existingIds = existingIds.map((learnpath) => learnpath.value)
        learnPathIdsFromClient.forEach((learnpathId) => {
            if (!existingIds.includes(learnpathId)) learnpathIds.push(learnpathId)
        });

        if (learnpathIds.length) {
            const dataToSave = learnpathIds.map((learnpathId) => {
                return {
                    key: "learnpath_wishlist",
                    value: learnpathId,
                    userId: userId,
                }
            });

            const resMeta = await models.user_meta.bulkCreate(dataToSave)
            const numericIds = learnpathIds.map((learnpathId) => learnpathId.split("LRN_PTH_").pop())
            const userinfo = await models.user_meta.findOne({
                attributes: ["value"],
                where: {
                    userId: user.userId, metaType: 'primary', key: 'email'
                }
            })
            const data = { email: userinfo.value, learnpathIds: numericIds }
            await logActvity("LEARNPATH_WISHLIST", userId, learnpathIds);
            sendDataForStrapi(data, "profile-add-learnpath-wishlist");

            return res.status(200).json({
                success: true,
                data: {
                    wishlist: resMeta
                }
            })
        }
        else {
            return res.status(200).json({
                success: true,
                data: {
                    wishlist: []
                }
            })
        }

    } catch (error) {
      
        console.log(error)
        return res.status(500).json({
            success: false,
            message:"internal server error"
        })
    }
}


const addCourseToRecentlyViewed = async (req,res) => {

    let success = true;
    let message = "";
    try {

        const { user} = req;
        const {courseId} = req.body
        let unque_data = {userId: user.userId, courseId: courseId};

        //check if course exists
        const exists = await models.recently_viewed_course.findOne({ where: unque_data });
        if(exists){
            //if exists change updated at
            const update = await models.recently_viewed_course.update({courseId: unque_data.courseId }, { where: unque_data});
        } else {
    
            const {count, rows} = await models.recently_viewed_course.findAndCountAll(
                {
                    limit: 1,
                    where: {userId: user.userId},   
                    order: [['createdAt', 'ASC']],
                    attributes: { include: ['id']
                }
            });
                
            if(count > 19){
                //remove first entry
                await models.recently_viewed_course.destroy(
                    {where: {id: rows[0].id}}
                );
            }
    
            const newRecord = await models.recently_viewed_course.create(unque_data);
           
        } 

        success = true;
        message = "Course added to recently viewed";

    } catch(error){
        console.error("Add course to recently viewed error",error);
        success = false;
        message = "Unable to add course to recently viewed";
    }

    return res.status(200).json({
        success:success,
        data: {
            message: message
        }
    })
}


const getRecentlyViewedCourses = async (req,res,next,returnData=false) => {
    const { user } = req;
    let { limit = 20, page = 1, order="DESC", currency } = req.query
    
    order = order.toUpperCase();
    const query = {
        limit: limit,
        offset: (page -1) * limit,
        where: {userId: user.userId},   
        order: [['updatedAt', order == "DESC" ? order : "ASC"]],
        attributes: { include: ['id'] }
    }

    let courses = [];
    let success = true;
    let courseIds = [];
    let statusCode = 200;
    let message = "";
    try {
        let unsortedCourses = [];
        courseIds = await models.recently_viewed_course.findAll(query);
        courseIds = courseIds.map((course)=> course.courseId);

        let esQuery = {
            "ids": {
                "values": courseIds
            }
        };

        let esFields = null; //["id","title"];

        const result = await elasticService.search('learn-content', esQuery, {form: 0, size: 20}, esFields);

        if(result.hits){
            for(const hit of result.hits){
                let data = await LearnContentService.generateSingleViewData(hit._source,true,currency)
                unsortedCourses.push(data);
            }
        }

        for (var i=0; i < courseIds.length; i++) {
            for(course of unsortedCourses){
                if (course.id === courseIds[i]) {
                    courses[i] = course;
                }
            }
        }

        message = "Everyting went well!"
    } catch(error){
        //statusCode = 200; //should send a valid status code here
        console.error("Failed to fetch recently viewed courses",error);
        message = "Unable to fetch recently viewed courses";
        success = false;
    }

    if(returnData){
        return courses;
    }
    
    return res.status(statusCode).json({
        success:success,
        data: {
            courseIds: courseIds,
            courses: courses
        },
        message: message
    });
}

const removeCourseFromWishList = async (req,res) => {
    const { user} = req;
    const {courseId} = req.body
    const resMeta = await models.user_meta.destroy({ where: { key:"course_wishlist", value:courseId, userId:user.userId}})
    const userinfo = await models.user_meta.findOne({where:{userId:user.userId, metaType:'primary', key:'email'}})
    let data = {email:userinfo.value, courseId:courseId.split("LRN_CNT_PUB_").pop()}
    sendDataForStrapi(data, "profile-remove-wishlist");
    return res.status(200).json({
        success:true,
        data: {
            wishlist:resMeta
        }
    })
}

const removeLearnPathFromWishList = async (req,res) => {
    const { user} = req;
    const {learnpathId} = req.body
    const resMeta = await models.user_meta.destroy({ where: { key:"learnpath_wishlist", value:learnpathId, userId:user.userId}})
    const userinfo = await models.user_meta.findOne({where:{userId:user.userId, metaType:'primary', key:'email'}})
    let data = {email:userinfo.value, learnpathId:learnpathId.split("LRN_PTH_").pop()}
    sendDataForStrapi(data, "profile-remove-learnpath-wishlist");
    return res.status(200).json({
        success:true,
        data: {
            wishlist:resMeta
        }
    })
}


const fetchWishListIds = async (req, res) => {
    try {
        const { user } = req
        const { page, limit } = validators.validatePaginationParams({ page: req.query.page, limit: req.query.limit })

        const offset = (page - 1) * limit
        let totalCount = 0

        let where = {
            userId: user.userId,
            key: { [Op.in]: ['course_wishlist'] },
        }

        const wishlistedCourses = await models.user_meta.findAll({
            attributes: ['value'],
            where,
            order: [["id", "DESC"]]
        })

        let  totalWishedListIds = wishlistedCourses.map((rec) => rec.value)
        totalWishedListIds = totalWishedListIds.filter(x => x != null)
        const queryBody = {
            "_source": [
                "_id"
            ],
            "from": offset,
            "size": limit,
            "query": {
                "bool": {
                    "must": [
                        {
                            "term": {
                                "status.keyword": "published"
                            }
                        },
                        {
                            "ids": {
                                "values": totalWishedListIds
                            }
                        }
                    ]
                }
            }
        }
        let activeWishListIds = []

        const result = await elasticService.plainSearch('learn-content', queryBody);
        if (result && result.hits) {
            totalCount = result.hits.total.value
            if (result.hits.hits.length) {
                activeWishListIds = result.hits.hits.map((wishList) => wishList._id)
            }
        }

        return res.status(200).json({
            success: true,
            data: {
                userId: user.userId,
                courses: activeWishListIds
            },
            pagination: {
                page: page,
                limit: limit,
                total: totalCount
            }
        })

    } catch(error) {
        console.log(error);
        return res.status(500).send({ message: "internal server error", success: false });

    }
}

const fetchLearnPathWishListIds = async (req,res) => {
    try {
        const { user } = req
        const { page, limit } = validators.validatePaginationParams({ page: req.query.page, limit: req.query.limit })

        const offset = (page - 1) * limit
        let totalCount = 0

        let where = {
            userId: user.userId,
            key: { [Op.in]: ['learnpath_wishlist'] },
        }

        const wishlistedLearnPaths = await models.user_meta.findAll({
            attributes: ['value'],
            where,
            order: [["id", "DESC"]]
        })

        let  totalWishedListIds = wishlistedLearnPaths.map((rec) => rec.value)
        totalWishedListIds = totalWishedListIds.filter(x => x != null)
        const queryBody = {
            "_source": [
                "_id"
            ],
            "from": offset,
            "size": limit,
            "query": {
                "bool": {
                    "must": [
                        {
                            "term": {
                                "status.keyword": "approved"
                            }
                        },
                        {
                            "ids": {
                                "values": totalWishedListIds
                            }
                        }
                    ]
                }
            }
        }
        let activeWishListIds = []

        const result = await elasticService.plainSearch('learn-path', queryBody);
        if (result && result.hits) {
            totalCount = result.hits.total.value
            if (result.hits.hits.length) {
                activeWishListIds = result.hits.hits.map((wishList) => wishList._id)
            }
        }

        if(!activeWishListIds.length){
            activeWishListIds = totalWishedListIds
        }

        return res.status(200).json({
            success: true,
            data: {
                userId: user.userId,
                learnpaths : activeWishListIds
            },
            pagination: {
                page: page,
                limit: limit,
                total: totalCount
            }
        })

    } catch(error) {
        console.log(error);
        return res.status(500).send({ message: "internal server error", success: false });

    }
}

const wishListCourseData = async (req,res) => {
    try {
         
        const { user } = req
        const userId=user.userId
        const { page, limit } = validators.validatePaginationParams({ page: req.query.page, limit: req.query.limit })
        const offset = (page - 1) * limit
        const { queryString } = req.query
        
        let totalCount = 0
        let where = {
            userId: userId,
            key: { [Op.in]: ['course_wishlist'] },
        }

        const totalWishListOfUser = await models.user_meta.findAll({
                attributes: ['value'],
                where,
                order: [["id","DESC"]]
            })

        let totalWishedListIds = [];
        for(let wishlist of totalWishListOfUser){
            if(wishlist.value != null && wishlist.value != ''){
                totalWishedListIds.push(wishlist.value);
            }
        }

        let queryBody = {
            "from":offset,
            "size": limit,
            "query": {
                "bool": {
                    "must": [{
                        "term": { "status.keyword": "published" }
                    },
                    {
                        "match_phrase": {
                            "title": queryString
                        }
                    },
                    {
                        "ids": {
                            "values": totalWishedListIds
                        }
                    }
                    ]
                }
            }
        }

        if (!queryString) {

            delete queryBody.query.bool.must[1];
            let scores = {};
            totalWishedListIds.forEach((id, index) => {
                scores[id] = index;
            });
            queryBody["sort"] = [
                {
                    "_script": {
                        "type": "number",
                        "script": {
                            "lang": "painless",
                            "inline": "return params.scores[doc['_id'].value];",
                            "params": {
                                "scores": scores
                            }
                        }
                    }
                }
            ]
        }

        const result = await elasticService.plainSearch('learn-content', queryBody);
        
        let courses = []
        let wishListIdsFromElastic=[]
        if(result.hits){
            totalCount=result.hits.total.value
            if(result.hits.hits && result.hits.hits.length > 0){
                
                for(const hit of result.hits.hits){
                    const course = await LearnContentService.generateSingleViewData(hit._source, true, req.query.currency);
                    wishListIdsFromElastic.push(course.id)
                    courses.push(course);
                }
            }
        }

        return res.status(200).json({
            success: true,

            data: {
                userId: userId,
                ids: wishListIdsFromElastic,
                courses: courses
            },
            pagination: {
                page: page,
                limit: limit,
                total: totalCount
            }
        })
       
        
    } catch (error) {
        console.log(error);
            return res.status(500).send({error:error,success:false})
    }
}

const wishListLearnPathData = async (req,res) => {
    try {
        const { user } = req
        const userId=user.userId
        const { page, limit } = validators.validatePaginationParams({ page: req.query.page, limit: req.query.limit })
        const offset = (page - 1) * limit
        const { queryString } = req.query
        
        let totalCount = 0
        let where = {
            userId: userId,
            key: { [Op.in]: ['learnpath_wishlist'] },
        }

        const totalWishListOfUser = await models.user_meta.findAll({
                attributes: ['value'],
                where,
                order: [["id","DESC"]]
            })

        const totalWishedListIds = totalWishListOfUser.map((rec) => rec.value)

        let queryBody = {
            "from":offset,
            "size": limit,
            "query": {
                "bool": {
                    "must": [{
                        "term": { "status.keyword": "approved" }
                    },
                    {
                        "match_phrase": {
                            "title": queryString
                        }
                    },
                    {
                        "ids": {
                            "values": totalWishedListIds
                        }
                    }
                    ]
                }
            }
        }

        if (!queryString) {

            delete queryBody.query.bool.must[1];
            let scores = {};
            totalWishedListIds.forEach((id, index) => {
                scores[id] = index;
            });
            queryBody["sort"] = [
                {
                    "_script": {
                        "type": "number",
                        "script": {
                            "lang": "painless",
                            "inline": "return params.scores[doc['_id'].value];",
                            "params": {
                                "scores": scores
                            }
                        }
                    }
                }
            ]
        }

        const result = await elasticService.plainSearch('learn-path', queryBody);
        
        let learnpaths = []
        let wishListIdsFromElastic=[]
        if(result.hits){
            totalCount=result.hits.total.value
            if(result.hits.hits && result.hits.hits.length > 0){
                
                for(const hit of result.hits.hits){
                    const learnpath = await LearnPathService.generateSingleViewData(hit._source, true, req.query.currency);
                    wishListIdsFromElastic.push(learnpath.id)
                    learnpaths.push(learnpath);
                }
            }
        }

        return res.status(200).json({
            success: true,

            data: {
                userId: userId,
                ids: wishListIdsFromElastic,
                learnpaths: learnpaths
            },
            pagination: {
                page: page,
                limit: limit,
                total: totalCount
            }
        })
         
    } catch (error) {
        console.log(error);
            return res.status(500).send({error:error,success:false})
    }
}


// fetch list of the enquires
const getEnquiryList = async (req,res) => {
    try {
    const { user } = req;
    const { page, limit } = validators.validatePaginationParams({ page: req.query.page, limit: req.query.limit })
    const offset =  (page-1)* limit
    
    // const count = await models.form_submission.findAll({
	
    //     attributes: ['userId', [sequelize.fn('count', sequelize.col('userId')), 'count']],
    //     where:{
    //         userId:user.userId || user.id,
    //         targetEntityType:"course",
    //         status:'submitted'
    //     },
    //     group : ['userId'],
        
    //     raw: true,
        
    //     order: sequelize.literal('count DESC')
        
    //   });

    //Find out total enquiries
    let config = { 
    attributes: ['targetEntityId'],
    where: { userId:user.userId || user.id,status:'submitted'},
    raw: true}
    
    let courseIds = [];
    let totalEnquiryRecs = await models.form_submission.findAll(config)

    for (let key = 0; key < totalEnquiryRecs.length ; key++) {
        courseIds.push(totalEnquiryRecs[key].targetEntityId.replace(/[^0-9]+/, ''))
    }

    let query = {
        "bool": {
          "must": [           
            {
              "terms": {
                "id": courseIds
              }
            },
            {"term": { "status.keyword": 'published' }}
          ]
        }  
      }
    const totalResult = await elasticService.search('learn-content', query, {size: 1000},fields= ["_id"]);
    let totalCount = 0
    let existingIds = [];
    if(totalResult.hits){
        if(totalResult.hits && totalResult.hits.length > 0){
             for(const hit of totalResult.hits){                
                existingIds.push(hit._id)                
            }           
        }
        else
        {
            return res.status(200).send({
                success:true,
                data:{
                    enquires:[],
                    count:0
                }
            })
        }
    }
    courseIds = courseIds.map(id =>`LRN_CNT_PUB_${id}`)
    courseIds = courseIds.filter((id => existingIds.includes(id)))
    totalCount = courseIds.length
    //fetch enquiries
    let formSubConfig = { 
    attributes: ['targetEntityId','otherInfo','createdAt','targetEntityType'],
    where: { userId:user.userId || user.id,status:'submitted',targetEntityId : courseIds},
    limit,
    raw: true,
    order: sequelize.literal('"createdAt" DESC')
    }
    
    if(page>1) {
    formSubConfig.offset = offset
    }
    let enquiryRecs = await models.form_submission.findAll(formSubConfig)
      
        // no enquiries return
    if(!enquiryRecs.length) {
        return res.status(200).send({
            success:true,
            data:{
                enquires:[],
                count:0
            }
        })
    }
    let enquiriesDone = []

    for (let key = 0; key < enquiryRecs.length ; key++) {
        let enquiry = {
            sourceUrl:enquiryRecs[key].otherInfo.sourceUrl,
            courseName:'',
            categoryName:'',
            createdAt:enquiryRecs[key].createdAt,
            enquiryOn:'',
            instituteName:"" ,
            images:{},
            partnerName:""
        }
        let queryBody = {
            "_source":["title","categories","provider_name","images","partner_name"],
            "query": {
              "terms": {
                  "id": [enquiryRecs[key].targetEntityId.replace(/[^0-9]+/, '')]
              },
            }
        };
        
        if(enquiryRecs[key].targetEntityType =='course') {
            enquiry.enquiryOn = 'course';
            const result = await elasticService.plainSearch('learn-content', queryBody);
            if(result.hits){
                if(result.hits.hits && result.hits.hits.length > 0){
                    // for(const hit of result.hits.hits){
                        let hit =  result.hits.hits[0]
                        enquiry.courseName = hit._source.title
                        enquiry.categoryName = hit._source.categories? hit._source.categories.toString():""
                        enquiry.instituteName = hit._source.provider_name
                        enquiry.images=hit._source.images
                        enquiry.partnerName = hit._source.partner_name
                        
                    // }
                }
            }
            enquiriesDone.push(enquiry);
        }
        //  else if(enquiryRecs[key].targetEntityType =='provider') {
        //     enquiry.enquiryOn = 'provider';
        //     const result = await elasticService.plainSearch('provider', queryBody);
        //     console.log(result.hits.hits.length,'-------------------------------');
        //     if(result.hits){
        //         if(result.hits.hits && result.hits.hits.length > 0){
        //             for(const hit of result.hits.hits){
        //                 // enquiry.entityName = hit._source.name
        //                 enquiry.instituteName = hit._source.name
        //             }
        //         }
        //     }
        // }
    }
    //fetch course fron esatic
    enquiriesDone = enquiriesDone.filter(enquiry => enquiry.courseName ||  enquiry.instituteName);
    return res.status(200).send({
        success:true,
        data:{
            enquiries:enquiriesDone,
            count:totalCount
        }
    })
    //build res
    } catch (error) {
        console.log(error);
        return res.status(500).send({
            success:false,
            error:error
        })
    }
    
}

const getLearnPathEnquiryList = async (req,res) => {
    try {
    let { limit=10, page=1 } = req.query;
    const { user } = req;
    let offset = 0

    if(page>1) {
        offset =  (page-1)* limit
    }
    
    //Find out total enquiries
    let config = { 
    attributes: ['targetEntityId'],
    where: { userId:user.userId || user.id,status:'submitted'},
    raw: true}
    
    let learnpathIds = [];
    let totalEnquiryRecs = await models.form_submission.findAll(config)

    for (let key = 0; key < totalEnquiryRecs.length ; key++) {
        learnpathIds.push(totalEnquiryRecs[key].targetEntityId.replace(/[^0-9]+/, ''))
    }

    let query = {
        "bool": {
          "must": [           
            {
              "terms": {
                "id": learnpathIds
              }
            },
            {"term": { "status.keyword": 'approved' }}
          ]
        }  
      }
    const totalResult = await elasticService.search('learn-path', query, {size: 1000});
    let existingIds = [];
    if(totalResult.hits){
        if(totalResult.hits && totalResult.hits.length > 0){
             for(const hit of totalResult.hits){                
                existingIds.push(hit._id)                
            }           
        }
        else
        {
            return res.status(200).send({
                success:true,
                data:{
                    enquires:[],
                    count:0
                }
            })
        }
    }
    learnpathIds = learnpathIds.map(id =>`LRN_PTH_${id}`)
    learnpathIds = learnpathIds.filter((id => existingIds.includes(id)))
    //fetch enquiries
    let formSubConfig = { 
    attributes: ['targetEntityId','otherInfo','createdAt','targetEntityType'],
    where: { userId:user.userId || user.id,status:'submitted',targetEntityId : learnpathIds},
    limit,
    raw: true,
    order: sequelize.literal('"createdAt" DESC')
    }
    
    if(page>1) {
    formSubConfig.offset = offset
    }
    let enquiryRecs = await models.form_submission.findAll(formSubConfig)
      
        // no enquiries return
    if(!enquiryRecs.length) {
        return res.status(200).send({
            success:true,
            data:{
                enquires:[],
                count:0
            }
        })
    }
    let enquiriesDone = []
    for (let key = 0; key < enquiryRecs.length ; key++) {
        let enquiry = {
            learnpathUrl:enquiryRecs[key].otherInfo.learnpathUrl,
            learnpathName:'',
            categoryName:'',
            createdAt:enquiryRecs[key].createdAt,
            enquiryOn:'',
            image:'',
            courses:[]
        }
        let queryBody = {
            "query": {
              "terms": {
                  "id": [enquiryRecs[key].targetEntityId.replace(/[^0-9]+/, '')]
              },
            }
        };
        
        if(enquiryRecs[key].targetEntityType =='learnpath') {
            enquiry.enquiryOn = 'learnpath';
            const result = await elasticService.plainSearch('learn-path', queryBody);
            if(result.hits){
                if(result.hits.hits && result.hits.hits.length > 0){
                    // for(const hit of result.hits.hits){
                        let hit =  result.hits.hits[0]
                        enquiry.learnpathName = hit._source.title
                        enquiry.categoryName = hit._source.categories? hit._source.categories.toString():""
                        enquiry.image = hit._source.images
                        let courses = hit._source.courses
                        courses.sort(function (a, b) {
                            return a.position - b.position;
                        });
                        for(let course = 0;course < courses.length;course++){
                            let course_dict = {
                                course_name:'',
                                course_category:[],
                                partner_name:'',
                                images:'',
                                slug:''
                            }

                            let query = {
                                "query": {
                                  "terms": {
                                      "id": [courses[course].id.replace(/[^0-9]+/, '')]
                                  },
                                }
                            };

                            const result_course = await elasticService.plainSearch('learn-content', query);
                            if(result_course.hits){
                                if(result_course.hits.hits && result_course.hits.hits.length > 0){
                                    let h_course =  result_course.hits.hits[0]
                                    
                                    course_dict.slug = h_course._source.slug?h_course._source.slug:""
                                    course_dict.images = h_course._source.images?h_course._source.images:""
                                    course_dict.course_name = h_course._source.title?h_course._source.title.toString():""
                                    course_dict.course_category = h_course._source.categories?h_course._source.categories:[]
                                    course_dict.partner_name = h_course._source.partner_name?h_course._source.partner_name.toString():""
                                }
                            }
                            enquiry.courses.push(course_dict);
                        }
                }
            }
            enquiriesDone.push(enquiry);
        }
    }
    //fetch course fron esatic
    enquiriesDone = enquiriesDone.filter(enquiry => enquiry.learnpathName);
    return res.status(200).send({
        success:true,
        data:{
            enquiries:enquiriesDone,
            count:enquiriesDone.length
        }
    })
    //build res
    } catch (error) {
        console.log(error);
        return res.status(200).send({
            success:true,
            data:{
                enquires:[],
                count:0
            }
        })
    }
}    
    
const updateEmail =async (req,res) => {
    /*
        Get the new email.
        Get the old email from the Database.
        Generate OTP.
        Send the OTP to the new email.
        // Following is in the verify OTP API
        // Verify OTP.
        // SEND EMAIL(Your email has been changed to the old email)
        // Store Old Email in a new attribute
        // Change Email.    
    */
    const { user } = req     
    const { email } = req.body
    try
    {
        if(email.trim() == '') {
            return res.status(200).json({
                code: "EMPTY VALUES ARE NOT ACCEPTED",
                message: "Please enter email in xyz@email.com format.",
                success: false,
                data: {}
            });
        }
        if(!isEmail(email)){
            return res.status(200).json({
                code: "NOT AN EMAIL",
                message: "Please enter email in xyz@email.com format.",
                success: false,
                data: {}
            })
        }
        let email_already_exist = await models.user_meta.findOne({where:{key:'email', value:email, metaType:'primary'}})
        if(email_already_exist){
            return res.status(200).json({
                code: "EMAIL ALREADY EXIST",
                message: "Please enter email which is not already used.",
                success: false,
                data: {}
            })
        }

        let userId = user.userId
        let providerObj = await models.user_login.findOne({where:{userId:userId}})
        const provider = providerObj.provider
        if(!provider || provider == ''){
            provider = LOGIN_TYPES.LOCAL
        }

        let oldEmailObj = await models.user_meta.findOne({where:{userId:userId, key:'email',metaType:'primary'}});
        const oldEmail = oldEmailObj.value;
        const OTP_TYPE = OTP_TYPES.EMAILVERIFICATION
        const response = await generateOtp({ username:oldEmail, userId, provider: provider, otpType:OTP_TYPE });
        if(!response.success){
            return res.status(500).json(response);
        }
        let emailPayload = {
            fromemail: process.env.FROM_EMAIL_RESET_PASSWORD_EMAIL,
            toemail: email,
            email_type: "reset_email_to_new",
            email_data: {
                otp: response.data.otp
            }
        }
        await sendEmail(emailPayload);
        return res.status(200).json({
            success: true
        })
    }
    catch(err){
        console.log("updateEmail: ",err)
        return res.status(500).json(err)
    }
}

const uploadProfilePic =async (req,res) => {
    // getBucketNames()\
    const {image} =req.body
    const {user}=req
    let imageB =  getImgBuffer(image)
    let imageName = `86ab15d2${user.userId}EyroLPIJo${new Date().getTime()}`;
    let path = `images/profile-images/${imageName}.jpeg`
    let s3Path = await uploadImageToS3(path,imageB)
    const existImg = await models.user_meta.findOne({where:{userId:user.userId, metaType:'primary', key:'profilePicture'}})
    if(!existImg) {
        await models.user_meta.create({value:s3Path,key:'profilePicture',metaType:'primary',userId:user.userId})
    } else {
       // await deleteObject(existImg.value);
        await models.user_meta.update({value:s3Path},{where:{userId:user.userId, metaType:'primary', key:'profilePicture'}})
    }
    const profileRes = await calculateProfileCompletion(user)
    const userinfo = await models.user_meta.findOne({where:{userId:user.userId, metaType:'primary', key:'email'}})
    let data = {email:userinfo.value, image:s3Path}
    sendDataForStrapi(data, "update-profile-picture");
    return res.status(200).json({success:true,profilePicture:s3Path, profileProgress:profileRes})
}

const removeProfilePic = async (req,res) => {
    const {user} = req

    const existImg = await models.user_meta.findOne({where:{userId:user.userId, metaType:'primary', key:'profilePicture'}})

    if(existImg) {
      //  await deleteObject(existImg.value);
        await models.user_meta.destroy({where:{key:'profilePicture',metaType:'primary',userId:user.userId}})        
    }
    const userinfo = await models.user_meta.findOne({where:{userId:user.userId, metaType:'primary', key:'email'}})
    let data = {email:userinfo.value}
    sendDataForStrapi(data, "remove-profile-picture");
    const profileRes = await calculateProfileCompletion(user)
    return res.status(200).json({success:true, profileProgress:profileRes})
}

const uploadResumeFile = async (req,res) =>{
    const {buffer, filename, size = 0} =req.body
    const {user}=req
    let resumeB =  getFileBuffer(buffer);
    let resumeName = `86ab15d2${user.userId}EyroLPIJo`+(new Date().getTime())+filename;
    let path = `images/profile-images/${resumeName}`
    let today = new Date();
    let dd = String(today.getDate()).padStart(2, '0');
    let mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
    let yyyy = today.getFullYear();

    today = dd + '/' + mm + '/' + yyyy;
    
    // if(filename.endsWith('.doc')){
    //     contentType = 'application/msword';
    // }
    // else if(filename.endsWith('.docx')){
    //     contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingm';
    // }
    // else if(filename.endsWith('.rtf')){
    //     contentType = 'application/rtf';
    // }
    // else if(filename.endsWith('.pdf')){
    //     contentType = 'application/pdf';
    // }

    let s3Path = await uploadResumeToS3(path,resumeB)
    let fileValue = {
        filename:filename,
        filepath:s3Path,
        uploadDate:today,
        size:size
    }
    const existResume = await models.user_meta.findOne({where:{userId:user.userId, metaType:'primary', key:'resumeFile'}})
    if(!existResume) {
        await models.user_meta.create({value:JSON.stringify(fileValue),key:'resumeFile',metaType:'primary',userId:user.userId})
    } else {
        let pathObject = JSON.parse(existResume.value);
        
        // await deleteObject(pathObject.filepath);
        await models.user_meta.update({value:JSON.stringify(fileValue)},{where:{userId:user.userId, metaType:'primary', key:'resumeFile'}})
    }
    const userinfo = await models.user_meta.findOne({where:{userId:user.userId, metaType:'primary', key:'email'}})
    let data = {email:userinfo.value, resume:s3Path}
    sendDataForStrapi(data, "upload-resume");
    return res.status(200).json({success:true,resumeFile:fileValue})
}

const deleteResumeFile = async (req,res) => {
    const {user} = req
    
    const existResume = await models.user_meta.findOne({where:{userId:user.userId, metaType:'primary', key:'resumeFile'}})

    if(existResume) {
      //  await deleteObject(existImg.value);
        await models.user_meta.destroy({where:{key:'resumeFile',metaType:'primary',userId:user.userId}})
    }
    const userinfo = await models.user_meta.findOne({where:{userId:user.userId, metaType:'primary', key:'email'}})
    let data = {email:userinfo.value}
    sendDataForStrapi(data, "remove-resume");
    return res.status(200).json({success:true, resumeFile:{}})
}

const uploadPrimarySkills = async (req,res) => {
    const {data} =req.body
    const { user} = req;
    const existSkills = await models.user_meta.findOne({where:{userId:user.userId, metaType:'primary', key:'primarySkills'}})
    if(!existSkills) {
        await models.user_meta.create({value:JSON.stringify(data),key:'primarySkills',metaType:'primary',userId:user.userId})      
    } else {
        await models.user_meta.update({value:JSON.stringify(data)},{where:{userId:user.userId, metaType:'primary', key:'primarySkills'}})
    }
    const userinfo = await models.user_meta.findOne({where:{userId:user.userId, metaType:'primary', key:'email'}})
    let learn_profile = {email:userinfo.value, data:data}
    sendDataForStrapi(learn_profile, "update-learn-profile");
    return res.status(200).json({success:true,data:data})
}

const uploadSkills = async (req,res) => {
    const {data} =req.body
    const { user} = req;
    const existSkills = await models.user_meta.findOne({where:{userId:user.userId, metaType:'primary', key:'skills'}})
    if(!existSkills) {
        await models.user_meta.create({value:JSON.stringify(data),key:'skills',metaType:'primary',userId:user.userId})        
    } else {
        // await deleteObject(pathObject.filepath);
        await models.user_meta.update({value:JSON.stringify(data)},{where:{userId:user.userId, metaType:'primary', key:'skills'}})
    }
    const userinfo = await models.user_meta.findOne({where:{userId:user.userId, metaType:'primary', key:'email'}})
    let learn_profile = {email:userinfo.value, data:data}
    sendDataForStrapi(learn_profile, "update-learn-profile");
    return res.status(200).json({success:true,data:data})
}

const fetchUserMetaObjByUserId = async (id) => {
    let userData = {};
    let keys = ['firstName','lastName','email','phone'];
    for(key of keys){
        let where = {
            userId: id,
            key: key,
            metaType: 'primary'
        };
        let obj = await models.user_meta.findOne({where});
        userData[key] = obj.dataValues.value;
    }
    return userData;
}

const bookmarkArticle = async (req,res) => {
    try {
        const { user } = req;
        const userId = user.userId
        const articleIdsFromClient = validators.validateAddArticleParams(req.body)
        if (!articleIdsFromClient) {
            return res.status(200).send({
                success: false,
                message: "invalid request sent"
            })
        }

        let existingIds = await models.user_meta.findAll({
            attributes: ["value"], where: {
                userId: userId,
                key: 'article_bookmark',
                value: articleIdsFromClient
            }
        });
        let articleIds = []
        existingIds = existingIds.map((article) => article.value)
        articleIdsFromClient.forEach((articleId) => {
            if (!existingIds.includes(articleId)) articleIds.push(articleId)
        });

        if (articleIds.length) {

            const dataToSave = articleIds.map((articleId) => {
                return {
                    key: "article_bookmark",
                    value: articleId,
                    userId: userId
                }
            })

            const resMeta = await models.user_meta.bulkCreate(dataToSave)
            const numericIds = articleIds.map((articleId) => articleId.split("ARTCL_PUB_").pop())

            const userinfo = await models.user_meta.findOne({
                attributes: ["value"],
                where: {
                    userId: user.userId, metaType: 'primary', key: 'email'
                }
            })
            const data = { email: userinfo.value, articleIds: numericIds }
            sendDataForStrapi(data, "profile-bookmark-article");

            return res.status(200).json({
                success: true,
                data: {
                    bookmarks: resMeta
                }
            })
        } else {
            return res.status(200).json({
                success: true,
                data: {
                    bookmarks: []
                }
            })
        }
    } catch (error) {

        console.log(error)
        return res.status(500).json({
            success: false,
            message: "internal server error"

        })
    }
}

const removeBookmarkArticle = async (req,res) => {
    const { user} = req;
    const {articleId} = req.body
    const resMeta = await models.user_meta.destroy({ where: { key:"article_bookmark", value:articleId, userId:user.userId}})
    const userinfo = await models.user_meta.findOne({where:{userId:user.userId, metaType:'primary', key:'email'}})
    let data = {email:userinfo.value, articleId:articleId.split("ARTCL_PUB_").pop()}
    sendDataForStrapi(data, "profile-remove-bookmark-article");
    return res.status(200).json({
        success:true,
        data: {
            bookmarks:resMeta
        }
    })
}


const bookmarkArticleData = async (req,res) => {
    try {

        if (req.query.queryString) {
            req.query.q = req.query.queryString
        }

        const { user } = req
        let where = {
            userId: user.userId,
            key: { [Op.in]: ['article_bookmark'] },
        }



        let resForm = await models.user_meta.findAll({
            attributes:['value'],
            where
        })
       if(resForm && resForm.length> 0)
       {
        let bookmarkIds = resForm.map((rec) => rec.value)
        req.query.articleIds = bookmarkIds
        req.searchField =  ['title'];
        await ArticleService.getArticleList(req, (err, data) => {
             if (data) {
                 res.status(200).send(data);
             } else {
                 res.status(200).send(err);
             }
         }); 
        }
        else{
            res.status(200).send({status: 'success', message: 'No records found!', data: {list: [], pagination: {total: 0}, filters: {}}});
        }      
    } catch (error) {
        console.log(error);
            return res.status(500).send({error,success:false})
    }
}



const fetchbookmarkIds = async (req,res) => {
    const { user } = req
    
    let where = {
        userId: user.userId,
        key: { [Op.in]: ['article_bookmark'] },
    }

    let resForm = await models.user_meta.findAll({
        attributes:['value'],
        where
    })
    let bookmarks = resForm.map((rec) => rec.value)
    return res.status(200).json({
        success:true,
        data: {
            userId: user.userId,
            articles:bookmarks
        }
    })
}

const verifyPhone = async (username) =>{
    return new Promise(async (resolve, reject) => {
        try{ 
            const user = await models.user_meta.findOne({where:{value:username, metaType:'primary', key:'email'}})
            await models.user.update({
                    phoneVerified: true,
                }, {
                    where: {
                        id: user.userId
                    }
                });
            return resolve(true)
        } catch (error) {
            console.log(error);
            response.code = DEFAULT_CODES.SYSTEM_ERROR.code;
            response.message = DEFAULT_CODES.SYSTEM_ERROR.message;
            response.success = false;
            return resolve(response);
        }
    })
}


const sendSMSOTP = async (phone, otp) =>{
    return new Promise(async (resolve, reject) => {
        try{ 
            await sendSMS( phone, `${otp} is the OTP to verify your Careervira account. It will expire in ${defaults.getValue('otpExpiry')} minutes.`,process.env.MOBILE_VERIFICATION_OTP_DLT_TEMPLATE_ID)
            return resolve(true)
        } catch (error) {
            console.log(error);
            response.code = DEFAULT_CODES.SYSTEM_ERROR.code;
            response.message = DEFAULT_CODES.SYSTEM_ERROR.message;
            response.success = false;
            return resolve(response);
        }
    })
}

const sendSMSWelcome = async (phone) =>{
    return new Promise(async (resolve, reject) => {
        try{ 
            await sendSMS( phone, `Hi, welcome to Careervira. Track and manage all your learning from a single place.`, process.env.WELCOME_DLT_TEMPLATE_ID)
            return resolve(true)
        } catch (error) {
            console.log(error);
            response.code = DEFAULT_CODES.SYSTEM_ERROR.code;
            response.message = DEFAULT_CODES.SYSTEM_ERROR.message;
            response.success = false;
            return resolve(response);
        }
    })
}
const updatePhone = async (req,res) => {
    try {
        const { user } = req    
        const { phone } = req.body  
   
        let where = {
            userId: user.userId,
            metaType:'primary',
            key:'phone',
        }
        const existPhone = await models.user_meta.findOne({where:{userId:user.userId, metaType:'primary', key:'phone'}})
        if(!existPhone){
            await models.user_meta.create({
                userId: user.userId,
                metaType:'primary',
                key:'phone',
                value: phone
            });
        }else{
            await models.user_meta.update({
                value: phone,
            }, {
                where: where
            });
        }
        
        await models.user.update({
            phoneVerified: false,
        }, {
            where: {
                id: user.userId
            }
        });
        
        const userinfo = await models.user_meta.findOne({where:{userId:user.userId, metaType:'primary', key:'email'}})
        let data = {email:userinfo.value, phone:phone}
        sendDataForStrapi(data, "update-phone")
        return res.status(200).json({
            'success': true,
            'message': 'Phone is updated',
            'data': {}
        })
    } catch (error) {
        console.log(error);
        return res.status(200).json({
            'success': false,
            'message': DEFAULT_CODES.SYSTEM_ERROR.message,
            'data': {}
        })
    }
}
const suspendAccount = async (req, res) => {
    const { email } = req.body;
    try {
        let where = {
            [Op.and]: [
                {
                    [Op.eq]: Sequelize.where( Sequelize.fn('lower', Sequelize.col("email")),Sequelize.fn('lower', email))                        
                }
            ]
        }
        let userLogin = await models.user_login.findOne({ where: where})
        let user = null
        if (userLogin != null) {
            user = await models.user.findOne({ where: { id: userLogin.userId} });
        }
        let userres = await models.user.update({
            status: "suspended"
        }, {
            where: {
                id: user.id
            }
        });
               
        await sendSuspendedEmail(userLogin)
        //const tokenRes = await getLoginToken({ ...newUserObj, audience: req.headers.origin, provider: LOGIN_TYPES.LOCAL });
        return res.status(200).send({status: 'success', message: 'successfully supended!'})

    } catch (error) {
        console.log(error);
        return res.status(500).send({error,success:false})
    }
}

const reactivateAccount = async (req, res) => {
    const { email } = req.body;
    try {
        let where = {
            [Op.and]: [
                {
                    [Op.eq]: Sequelize.where( Sequelize.fn('lower', Sequelize.col("email")),Sequelize.fn('lower', email))                        
                }
            ]
        }
        
        let userLogin = await models.user_login.findOne({ where: where})
        
        let user = null
        if (userLogin != null) {
            user = await models.user.findOne({ where: { id: userLogin.userId} });
        }
        
        let userres = await models.user.update({
            status: "active"
        }, {
            where: {
                id: user.id
            }
        });
               
        await sendActivatedEmail(userLogin)
        //const tokenRes = await getLoginToken({ ...newUserObj, audience: req.headers.origin, provider: LOGIN_TYPES.LOCAL });
        return res.status(200).send({status: 'success', message: 'successfully activated!'})

    } catch (error) {
        console.log(error);
        return res.status(500).send({error,success:false})
    }
}

const getUserPendingActions = async (req, res) => {
    try {
        const { user } = req
        const userId = user.userId
        let profileProgress = 0
        let response = {

            pendingProfileActions: [
            ],
            profileProgress: null,
            verification:{}
        }

        const fields = {
            education: {
                weightage: 15,
            },
            profilePicture: {
                weightage: 10,
            },
            firstName: {
                weightage: 4,
            },
            dob: {
                weightage: 2,
            },
            gender: {
                weightage: 2,
            },
            city: {
                weightage: 2,
            },
            resumeFile: {
                weightage: 20,
            },
            skills: {
                weightage: 20,
            },
            workExp: {
                weightage: 15,
            }
            // phone: {
            //     weightage: 5,
            // }
        }

        const verificationFields = {
            verified: {
                weightage: 5
            },
            phoneVerified: {
                weightage: 5
            }
        }

        const userData = await models.user_meta.findAll({
            attributes: ["key", "value"],
            where: {
                metaType: "primary",
                key: { [Op.in]: Object.keys(fields) },
                userId: userId
            }
        })

        const userVerificationData = await models.user.findAll({
            attributes: Object.keys(verificationFields),
            where: {
                id: userId
            }
        })
        
        const availableFields = userData.filter((field) => {
            if (field.value) {
                try {
                    // verify whether field.value is an array

                    const obj = JSON.parse(field.value)
                    if (Array.isArray(obj)) return obj.length != 0

                    //check for empty object
                    if (JSON.stringify(obj) == "{}") return false
                    return true

                } catch {
                    // it is a non empty string 
                    return true
                }
            }
            else {
                return false
            }
        }).map((field) => field.key)

        
        let addPersonalDetails = false
        for (const field in fields) {

            if (availableFields.includes(field)) {
                profileProgress += fields[field].weightage;
            }
            else {

                if (["dob", "firstName", "gender", "city"].includes(field)) {
                    addPersonalDetails = true
                }
                else {
                    response.pendingProfileActions.push(field)
                }
            }
        }

        if(addPersonalDetails){
            response.pendingProfileActions.push("personalDetails")
        }

        if (userVerificationData.length) {

            if (userVerificationData[0]["verified"]) {
                
                profileProgress += verificationFields.verified.weightage
            }
            else {
                response.pendingProfileActions.push('email')
            }
        
            
            if (userVerificationData[0]["phoneVerified"]) {
                response.verification.phoneVerified = true
                profileProgress += verificationFields.phoneVerified.weightage
            }
            else {
                const phoneData = await models.user_meta.findAll({
                    attributes: ["key", "value"],
                    where: {
                        metaType: "primary",
                        key: { [Op.in]: ["phone"] },
                        userId: userId
                    }
                })

                if (phoneData.length && phoneData[0].value) {
                    if (phoneData[0].value.slice(0, 2) != '91') {
                        response.verification.phoneVerified = true
                        profileProgress += verificationFields.phoneVerified.weightage
                    }
                    else{
                        response.verification.phoneVerified=false
                        response.pendingProfileActions.push("phoneVerification")
                    }
                }else{
                    response.pendingProfileActions.push('phone') 
                }
            }
        }
        
        response.profileProgress=profileProgress
        res.send({ message: "success", data: response })
    } catch (error) {
        console.log(error)
        res.status(500).send({
            success: false,
            message: "internal server error",
            error: error
        })
    }
}

const recentlyViewedCourses = async (req, callback) => {

    try {
        const courses = await getRecentlyViewedCourses(req,null,null,true);
        callback(null, { "success": true, message: "list fetched successfully", data: { list:courses ,mlList:[],show:"logic"} });
    }
    catch (error) {
        console.log("Error occured while fetching recently viewed courses : ", error);
        callback(null, { "success": false, message: "failed to fetch", data: { list: [] } });
    }

}
const getUserLastSearch =async (req,callback) => {
        
    const { user} = req;
    let userId = user.userId

     const existSearch = await models.user_meta.findOne({where:{userId:userId, key:'last_search'}})

    let suggestionList = (existSearch!=null && existSearch.value!="") ? JSON.parse(existSearch.value) : {'learn-path':[],'learn-content':[],'provider':[],'article':[]};
    if(!suggestionList['learn-path']){
        suggestionList['learn-path'] = []
    }
    if(!suggestionList['learn-content']){
        suggestionList['learn-content'] = []
    }
    if(!suggestionList['provider']){
        suggestionList['provider'] = []
    }
    if(!suggestionList['article']){
        suggestionList['article'] = []
    }
    callback({success:true,data:suggestionList}) 

}

const recentlySearchedCourses = async (req, callback) => {

    try {

        const { currency = process.env.DEFAULT_CURRENCY, page = 1, limit = 6 } = req.query;
        const offset = (page - 1) * limit;
        let searchedCourses = [];
        await getUserLastSearch(req, (result) => {
            searchedCourses.push(...result.data['learn-content']);

        });

        const searchedCoursesSlugs = searchedCourses.map((course) => course.slug);

        const esQuery = {
            bool: {
                must: [
                    {
                        term: {
                            "status.keyword": "published"
                        }
                    },
                    {
                        terms: {
                            "slug.keyword": searchedCoursesSlugs
                        }
                    }
                ]
            }
        }
        const courses  =[];
        const result = await elasticService.search("learn-content",esQuery,{from:offset,size:limit})
        
        if (result.hits && result.hits.length) {
            for (const hit of result.hits) {
                const data = await LearnContentService.generateSingleViewData(hit._source, true, currency)
                courses.push(data);
            }
        }

        callback(null, { "success": true, message: "list fetched successfully", data: { list: courses, mlList: [], show: 'logic' } });

    } catch (error) {
        console.log("Error occured while fetching recently searched courses : ", error);
        callback(null, { "success": false, message: "failed to fetch", data: { list: [] } });
    }

}


const addCategoryToRecentlyViewed = async (req, res) => {

    try {

        const { user } = req;
        const { name, slug } = req.body;
        const unique_data = { userId: user.userId, slug: slug, name: name };

        //check if course exists
        const exists = await models.recently_viewed_categories.findOne({ where: unique_data });
        if (exists) {
            //if exists change updated at
            await models.recently_viewed_categories.update({ name: unique_data.name,slug:unique_data.slug }, { where: unique_data });
        } else {

            const { count, rows } = await models.recently_viewed_categories.findAndCountAll(
                {
                    limit: 1,
                    where: { userId: user.userId },
                    order: [['createdAt', 'ASC']],
                    attributes: {
                        include: ['id']
                    }
                });

            if (count > 2) {
                //remove first entry
                await models.recently_viewed_categories.destroy(
                    { where: { id: rows[0].id } }
                );
            }

            await models.recently_viewed_categories.create(unique_data);

        }


      return  res.status(200).json({
            success: true,
            message: "Category added to recently viewed"

        });

    } catch (error) {

        console.log("Error occured while adding category to recently viewed : ", error);
        res.status(500).json({
            success: false,
            "message": "Internal Server Error"

        });
    }
}

const peopleAreAlsoViewing = async (req, callback) => {

    try {
        const userId = req.user.userId;
        const { page = 1, limit = 6, currency = process.env.DEFAULT_CURRENCY } = req.query;
        const offset = (page - 1) * limit;
        const categories = await models.recently_viewed_categories.findAll({ where: { userId: userId } });
        const categoriesNames = categories.map((category) => category.name);
        const courses = [];
        if (categoriesNames.length) {
            const esQuery = {
                bool: {
                    must: [
                        {
                            term: {
                                "status.keyword": "published"
                            }
                        },
                        {
                            terms: {
                                "categories.keyword": categoriesNames
                            }
                        }
                    ]
                }
            }

            const sort = [{ "activity_count.all_time.course_views": "desc" }, { "ratings": "desc" }];
            const result = await elasticService.search("learn-content", esQuery, { from: offset, size: limit, sortObject: sort });

            if (result.hits && result.hits.length) {
                for (const hit of result.hits) {
                    const data = await LearnContentService.generateSingleViewData(hit._source, true, currency)
                    courses.push(data);
                }
            }

        }
        
        callback(null, { "success": true, message: "list fetched successfully", data: { list: courses, mlList: [], show: "logic" } });
    } catch (error) {

        console.log("Error occured while fetching people Are Also Viewing : ", error);
        callback(null, { "success": false, message: "failed to fetch", data: { list: [] } });
    }
}

module.exports = {
    login,
    verifyOtp,
    sendOtp,
    verifyUserToken,
    socialSignIn,
    signUp,
    resendVerificationLink,
    verifyAccount,
    resetPassword,
    forgotPassword,
    getProfileProgress,
    getCourseWishlist,
    addCourseToWishList,
    addLearnPathToWishList,
    addCourseToRecentlyViewed,
    getRecentlyViewedCourses,
    removeCourseFromWishList,
    removeLearnPathFromWishList,
    fetchWishListIds,
    fetchLearnPathWishListIds,
    wishListCourseData,
    wishListLearnPathData,
    getEnquiryList,
    getLearnPathEnquiryList,
    uploadProfilePic,
    uploadResumeFile,
    deleteResumeFile,
    removeProfilePic,
    uploadSkills,
    uploadPrimarySkills,
    fetchUserMetaObjByUserId,
    bookmarkArticle,
    removeBookmarkArticle,
    bookmarkArticleData,
    fetchbookmarkIds,
    suspendAccount,
    reactivateAccount,
    updatePhone,
    getUserPendingActions,
    updateEmail,
    recentlyViewedCourses,
    getUserLastSearch,
    recentlySearchedCourses,
    peopleAreAlsoViewing,
    addCategoryToRecentlyViewed,
    saveUserLastSearch: async (req,callback) => {
                
        const {search} =req.body
        const { user} = req;
        let userId = user.userId

         const existSearch = await models.user_meta.findOne({where:{userId:userId, key:'last_search'}})

        let suggestionList = (existSearch!=null && existSearch.value!="") ? JSON.parse(existSearch.value) : {'learn-path':[],'learn-content':[],'provider':[],'article':[]};
        if(!suggestionList[search.type]){
            suggestionList[search.type] = []
        }
        if (!suggestionList[search.type].filter(e => e.title == search.title).length || suggestionList[search.type].filter(e => e.title == search.title).length == 0) {

            if (search.type == 'learn-content') {
                if (suggestionList[search.type].length == (process.env.LAST_COURSE_SEARCH_LIMIT||20)) {
                    suggestionList[search.type].shift();

                }

            }
            else if (suggestionList[search.type].length == process.env.LAST_SEARCH_LIMIT) {
                suggestionList[search.type].shift();
            }
            suggestionList[search.type].push(search);
        } 

        if(!existSearch) {
              await models.user_meta.create({value:JSON.stringify(suggestionList),key:'last_search',userId:userId})
            callback({success:true,data:suggestionList})
        } else {
            await models.user_meta.update({value:JSON.stringify(suggestionList)},{where:{userId:userId, key:'last_search'}})
 
            callback({success:true,data:suggestionList})
        }

    },

    

    removeUserLastSearch: async (req, callback) => {

        const {search} = req.body
        const { user} = req;
        let userId = user.userId

        const existSearch = await models.user_meta.findOne({where:{userId:userId, key:'last_search'}})

        let suggestionList = (existSearch!=null && existSearch.value!="") ? JSON.parse(existSearch.value) : {'learn-path':[],'learn-content':[],'provider':[],'article':[]};
        if(!suggestionList[search.type]){
            suggestionList[search.type] = []
        }
        suggestionList[search.type] = suggestionList[search.type].filter(function (e) {
            return (e.title != search.title && e.slug != search.slug)
        });
        await models.user_meta.update({value:JSON.stringify(suggestionList)},{where:{userId:userId, key:'last_search'}})
        callback({success:true,data:suggestionList}) 

    }

}