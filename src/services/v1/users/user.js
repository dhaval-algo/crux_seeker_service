const {
    validateIdsFromElastic,
    isEmail,
    decryptStr,
    getOtp,
    verifySocialToken,
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
    logActvity,
    encryptUserId
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
const crypto = require("crypto")
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
const {saveSessionKPIs}=require("../../../utils/sessionActivity");

const login = async (req, res, next) => {
    try {
        const body = req.body;
        const audience = req.headers.origin;
        const { email = "", password = "" } = body;
        // validate input
        if (email.trim() == '' || !validator.validate(email.trim()) || password.trim() == '') {
            return res.status(200).json({
                'success': false,
                'message': 'Mandatory fields are missing',
                'data': {}
            });
        }
        
        // check if user exist
        const verificationRes = await userExist(email,LOGIN_TYPES.LOCAL);
        if (!verificationRes.success) {
            return res.status(200).json(verificationRes);
        }
           
        const credVerificationRes = checkPassword(verificationRes.data.user, password);
        if (!credVerificationRes.success) {
            return res.status(200).json(credVerificationRes);            
        }

        //create token
        const payload = {           
            email,
            name:  verificationRes.data.user.fullName || "",
            userId: verificationRes.data.user.userId,
            provider: LOGIN_TYPES.LOCAL,
            userType: verificationRes.data.user.userType,
            isVerified: verificationRes.data.user.verified || false,
            profilePicture: verificationRes.data.user.profilePicture,
            audience: req.headers.origin
            
        }
        const tokenRes = await getLoginToken(payload);

        //Add entry in login activity table 
        models.user_login_activity.create({userId: verificationRes.data.user.userId, provider: LOGIN_TYPES.LOCAL})

        return res.status(200).json(tokenRes);
       

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
        const response = await generateOtp({ username, audience, provider: null, otpType});
        if(!response.success){
            return res.status(500).json(response);
        }
        email = username
        let where = {
            [Op.and]: [
                {
                    [Op.eq]: Sequelize.where( Sequelize.fn('lower', Sequelize.col('email')),Sequelize.fn('lower', email))                        
                }
            ]
        }
    
        let user = await models.user.findOne({ where: where})        
        let countryCode =  user.phone.split(" ")[0];    
        let phoneWithoutcode =  user.phone.split(" ")[1];
        if(process.env.PHONEVERIFICATION =='true' && countryCode =='+91' )
        {
            await sendSMSOTP (phoneWithoutcode, response.data.otp);
            //await sendSMS( phone, `${response.data.otp} is the OTP to verify your Careervira account. It will expire in 10 minutes.`)
            return res.status(200).json({
                'success': true,
                'code': 'OTP_SENT',
                'message':'Otp has been sent.'
            });
        }
        else{
            return res.status(500).json({
                'code': 'SERVER_ERROR',
                'description': 'Only indian number are allowed'
            });   
        }        
        
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
        if(email & otpType!= OTP_TYPES.MAINEMAILVERIFICATION){
            let where = {
                [Op.and]: [
                    {
                        [Op.eq]: Sequelize.where( Sequelize.fn('lower', Sequelize.col('email')),Sequelize.fn('lower', email))                        
                    }
                ]
            }
        
            let email_already_exist = await models.user.findOne({ where: where})
            
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
    
        let userObj = await models.user.findOne({where:{id:userId}})
        const username = userObj.email
        
        const response = await startVerifyOtp({ username, otp, audience, provider: provider, otpType });
        if(!response.success){
            return res.status(200).json(response);
        }
        if(otpType == OTP_TYPES.PHONEVERIFICATION && response.success && response.code==DEFAULT_CODES.VALID_OTP.code)
        {
            const response = await verifyPhone( username);
            let phone = userObj.phone.substring(2, 12);
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
            await models.user.update({
                email:email
            }, {
                where: {
                    id:userId
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
            await invalidateTokens({userId},'verification');
           // let data = {old_email:username, new_email:email}
            //sendDataForStrapi(data, "update-email");
        }
        if(otpType == OTP_TYPES.MAINEMAILVERIFICATION && response.success && response.code==DEFAULT_CODES.VALID_OTP.code)
        {
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

const verifyUserToken = async (req, res) => {
    
    let user_login_obj = await models.user_login.findOne({where:{userId:req.user.userId}})
    let user_obj = await models.user.findOne({where:{id:req.user.userId}})

    const response_obj = {
        email: user_login_obj.email || "",
        userId: req.user.userId,
        provider: user_login_obj.provider || "",
        userType: user_obj.userType,
        isVerified: user_obj.verified ||  false
    }

    let resp = {
        code: DEFAULT_CODES.VALID_TOKEN.code,
        message: DEFAULT_CODES.VALID_TOKEN.message,
        success: true,
        data: {
            user: response_obj
        }
    }
    return res.status(200).json(resp);
}

const signUp = async (req, res) => {
    try {

        const audience = req.headers.origin;
        // check if input fields are now empty
        let { fullName = "", password = "", phone = "", email = "", country = "" } = req.body;
        if (fullName.trim() == '' || password.trim() == '' || phone.trim() == '' || email.trim() == '' || country == "") {
            return res.status(200).json({
                'success': false,
                'message': 'Mandatory fields are missing',
                'data': {}
            });
        }

        //check if email is already exist
        let where = {
            [Op.and]: [
                {
                    [Op.eq]: Sequelize.where(Sequelize.fn('lower', Sequelize.col('email')), Sequelize.fn('lower', email))
                }
            ]
        }

        let isEmailExist = await models.user.findOne({ where: where })

        if (isEmailExist != null) {
            return res.status(200).json({
                'success': false,
                'message': DEFAULT_CODES.USER_ALREADY_REGISTERED.message,
                'code': DEFAULT_CODES.USER_ALREADY_REGISTERED.code,
                'data': {}
            });

        }

        //Create new user 
        let user = await models.user.create({
            fullName: fullName,
            email: email,
            phone: phone,
            verified: false,
            phoneVerified: false,
            status: "active",
            userType: "registered",
            country: country
        });
        //Hash password
        const { userSalt, passwordHash } = await hashPassword(password);

        //create login for user
        let user_login = await models.user_login.create({
            userId: user.id,
            provider: LOGIN_TYPES.LOCAL,
            password: passwordHash,
            passwordSalt: userSalt
        });

        //create token
        const payload = {
            email: user.email || "",
            name: user.fullName || "",
            userId: user.id,
            provider: LOGIN_TYPES.LOCAL,
            userType: user.userType,
            isVerified: false,
            profilePicture: user.profilePicture,
            audience: req.headers.origin

        }
        const tokenRes = await getLoginToken(payload);
        tokenRes.code = DEFAULT_CODES.USER_REGISTERED.code
        tokenRes.message = DEFAULT_CODES.USER_REGISTERED.message

        // send OTP for phone verification
        // if (phone) {
        //     let countryCode = phone.split(" ")[0];
        //     let phoneWithoutcode = phone.split(" ")[1];
        //     if (process.env.PHONEVERIFICATION == 'true' && country == "India" && countryCode == '+91') {
        //         const OTP_TYPE = OTP_TYPES.PHONEVERIFICATION
        //         let userId = user.id
        //         const response = await generateOtp({ username: email, userId, provider: LOGIN_TYPES.LOCAL, otpType: OTP_TYPE });
        //         await sendSMSOTP(phoneWithoutcode, response.data.otp);
        //         tokenRes.data.verifyPhone = true
        //     }
        // }

        // send email varification link
       // await sendVerifcationLink(payload)


    //    let userId = user.id
    //    const OTP_TYPE = OTP_TYPES.MAINEMAILVERIFICATION
    //    const response = await generateOtp({ username:email, userId, provider: LOGIN_TYPES.LOCAL, otpType:OTP_TYPE });
    //    if(!response.success){
    //        return res.status(500).json(response);
    //    }
    //    let emailPayload = {
    //        fromemail: process.env.FROM_EMAIL_RESET_PASSWORD_EMAIL,
    //        toemail: email,
    //        email_type: "email_verification_otp",
    //        email_data: {
    //            otp: response.data.otp
    //        }
    //    }   

    //    await sendEmail(emailPayload);

        res.status(200).send(tokenRes)
    } catch (error) {
        console.log(error)
         return res.status(200).json({
                'success': false,
                'message': DEFAULT_CODES.USER_ALREADY_REGISTERED.message,
                'code': DEFAULT_CODES.USER_ALREADY_REGISTERED.code,
                'data': {}
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

        //check if user with email exists
        let where = {
            [Op.and]: [
                {
                    [Op.eq]: Sequelize.where( Sequelize.fn('lower', Sequelize.col("email")),Sequelize.fn('lower', providerRes.data.email))                        
                }
            ]
        }
        let user = await models.user.findOne({ where: where})
        
        
        //check if user with email is suspended
        if(user && user.status=="suspended")
        {
            res.status(200).json({
                code: DEFAULT_CODES.SUSPENDED_USER.code,
                message: DEFAULT_CODES.SUSPENDED_USER.message,
                success: false,
                data: {
                    user: {}
                }
            })
        }

        
        //check if user with email and requested soacial provider exists
        let user_login = null
        if(user !=null)
        {

            user_login = await models.user_login.findOne({ where: {userId:user.id, provider:provider}})

            if(user_login !=null)
            {
                //create login for requested social provider
                await models.user_login.create({
                    userId: user.id,
                    provider: provider,
                });
                
            }
        }
        else{
            //crete new user

            user = await models.user.create({
                fullName: providerRes.data.firstName+' '+ providerRes.data.lastName,
                email: providerRes.data.email,
                verified: true,
                status: "active",
                userType: "registered"
            });

             //create login for requested social provider
             user_login=  await models.user_login.create({
                userId: user.id,
                provider: provider,
            });
            await sendWelcomeEmail(user)
        }     
        
        //create token
        const payload = {           
            email: user.email || "",
            name:  user.fullName || "",
            userId: user.id,
            provider: provider || "",
            userType: user.userType,
            isVerified: user.verified || false,
            profilePicture: user.profilePicture,
            audience: req.headers.origin
            
        }
        const tokenRes = await getLoginToken(payload);
        
        //Add entry in login activity table 
        models.user_login_activity.create({userId: user.id, provider: provider})
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

const userExist = (email, provider = null) => {

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
            let where = {
                [Op.and]: [
                    {
                        [Op.eq]: Sequelize.where( Sequelize.fn('lower', Sequelize.col("email")),Sequelize.fn('lower', email))                        
                    }
                ]
            }
            let user = await models.user.findOne({ where: where})

            if (user != null) {
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
                let where = { userId: user.id} 
                if(provider){
                    where = { userId: user.id, provider: provider} 
                }
                const user_login = await models.user_login.findOne({ where: where});
          
               if(user_login)
               {
                    response.success = true;
                    response.code = DEFAULT_CODES.VALID_USER;
                    response.message = DEFAULT_CODES.VALID_USER.message;
                    
                    response.data.user = {                        
                        email,
                        fullName:user.fullName,
                        userId: user.id,
                        status:user.status,
                        userType: user.userType,
                        verified: user.verified,
                        password: user_login.password,
                        profilePicture: user.profilePicture,
                        passwordSalt:user_login.passwordSalt
                        
                    }
                    return resolve(response)
                }
                else {
                    return resolve(response)
                }
                
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

const hashPassword = async (password) => {
    const userSalt = crypto.randomBytes(16).toString('hex');
    const finalSalt = process.env.PASSWORD_SALT + userSalt
    const passwordHash = crypto.pbkdf2Sync(password, finalSalt, 
       parseInt(process.env.PASSWORD_HASH_ITERATION), 64, `sha512`).toString(`hex`);
    return {userSalt, passwordHash}
};

const checkPassword = (userObj, resPwd) => {
    let response = {
        code: DEFAULT_CODES.VALID_PASSWORD.code,
        success: true,
        message: DEFAULT_CODES.VALID_PASSWORD.message,
        data: {
        }
    }
    
    const finalSalt = process.env.PASSWORD_SALT + userObj.passwordSalt
    const passwordHash = crypto.pbkdf2Sync(resPwd, finalSalt, 
       parseInt(process.env.PASSWORD_HASH_ITERATION), 64, `sha512`).toString(`hex`);
    if (userObj.password && passwordHash == userObj.password) {
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
            if(otpType == OTP_TYPES.MAINEMAILVERIFICATION)
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
        
    let userData = await models.user.findOne({ where: {id:user.userId}})
    let userObj = {
        ...user,
        fullName:userData.fullName,
        email:userData.email,
        audience: req.headers.origin
    }
    await invalidateTokens(userObj,'verification')
    await sendVerifcationLink(userObj)
    return res.status(200).json({
        success: true,
        message: DEFAULT_CODES.USER_REGISTERED.message
    })
}

const resendEmailVerificationOPT = async (req, res) => {
    const { user } = req
        
    let userData = await models.user.findOne({ where: {id:user.userId}})

    let userId = user.userId
    const OTP_TYPE = OTP_TYPES.MAINEMAILVERIFICATION
    const response = await generateOtp({ username:userData.email, userId, provider: LOGIN_TYPES.LOCAL, otpType:OTP_TYPE });
    if(!response.success){
        return res.status(500).json(response);
    }
    let emailPayload = {
        fromemail: process.env.FROM_EMAIL_RESET_PASSWORD_EMAIL,
        toemail: userData.email,
        email_type: "email_verification_otp",
        email_data: {
            otp: response.data.otp
        }
    }        
    await sendEmail(emailPayload);
    res.status(200).send({
        "success": true,
        "code": "OTP_SENT",
        "message": "Otp has been sent."        
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
          
            let userObj = await models.user.findOne({where:{id: user.userId}})
            let newUserObj = { ...user, userType: userObj.userType, verified: true, fullName: userObj.fullName }
            await invalidateTokens(newUserObj,'verification')
            await sendWelcomeEmail(userObj)
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
    const userRes = await userExist(email)
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
            const {userSalt, passwordHash} = await hashPassword(password);

            //check if local type is present 
           let user_login =  await models.user_login.findOne({
                where: {
                    userId: user.userId,
                    provider:LOGIN_TYPES.LOCAL

                }
            });
            if(user_login){
                let userres = await models.user_login.update({
                    password: passwordHash,
                    passwordSalt: userSalt
                }, {
                    where: {
                        userId: user.userId,
                        provider:LOGIN_TYPES.LOCAL

                    }
                });
            }
            else{
                await models.user_login.create({
                    userId: user.userId,
                    provider: LOGIN_TYPES.LOCAL,
                    password: passwordHash,
                    passwordSalt: userSalt
                });  
            }
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

const getProfileProgress = async (req,res =null) => {
    const { user } = req
    const profileRes = await calculateProfileCompletion(user)
    if(profileRes){
        if (res) {
            return res.status(200).json({
                success: true,
                data: {
                    profileProgress: profileRes
                }
            })
        } else {
            return profileRes
        }


    }
    else{
        if (res) {
            return res.status(500).json({
                success: false,
                message: "internal server error"
            })
        }else{
            return null
        }
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
          
            await logActvity("COURSE_WISHLIST", userId, courseIds);
            //sendDataForStrapi(data, "profile-add-wishlist");
            saveSessionKPIs(userId,{courseIds:courseIds},'wishlist');

            return res.status(200).json({
                success: true,
                message: "Wishlisted Succesfully!"
            })
        }
        else {
            return res.status(200).json({
                success: true,
                message: "Wishlisted Succesfully!"
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

const getGoals = async (req, res=null) => {
    try {
        const { user } = req;
        const userId = user.userId
        if(!user){
            return res.status(200).json({
                success: false,
                message: "invalid user"
            })
        }
        
        let goalList = [];
        const goalObj = await models.goal.findAll({where : {
            userId: userId
        }
        })
        /**
         * Life Stage Options : [career_change, new_career, upskill]
         */
        for(let goal of goalObj){
            let obj = {};
            obj["id"] = goal.id
            obj["lifeStage"] = goal.lifeStage
            if(goal.lifeStage == "career_change"){
                obj["currentRole"] = goal.currentRole
                obj["preferredRole"] = goal.preferredRole
                obj["industryChoice"] = goal.industryChoice
            }else if(goal.lifeStage == "new_career"){
                obj["industryChoice"] = goal.industryChoice
                obj["preferredRole"] = goal.preferredRole
            }else{
                obj["currentRole"] = goal.currentRole
                const skills = await models.skill.findAll({ where:{
                    goalId: goal.id
                }
                });
                let skillList = []
                for(let skill of skills){
                    skillList.push(skill.name)
                }
                obj["preferredSkills"] = skillList
            }
            obj["highestDegree"] = goal.highestDegree
            obj["specialization"] = goal.specialization
            obj["workExperience"] = goal.workExperience
            goalList.push(obj);
        }

        if(res)
        {
            return res.status(200).json({
                success: true,
                result: goalList
            })
        }
        else{
            return goalList
        }
        
    } catch (error) {
        console.log(error)
        if(res)
        {
            return res.status(500).json({
                success: false,
                message:"internal server error"
            })
        }else{
            return null
        }
        
    }
}

const removeGoal = async (req, res) => {
    try {
        const { user } = req;
        const userId = user.userId
        const { goalId } = req.body
        if(!user){
            return res.status(200).json({
                success: false,
                message: "invalid user"
            })
        }
        if (!goalId) {
            return res.status(200).json({
                success: false,
                message: "invalid request sent"
            })
        }
        
        const goalObj = await models.goal.findOne({ where: {id: goalId, userId: userId}})
        if(goalObj){
            await models.skill.destroy({where: {goalId: goalId}})
            await models.goal.destroy({where:{id: goalId}})
        }else{
            return res.status(200).json({
                success: false,
                message: "Invalid Request"
            })
        }
        return res.status(200).json({
            success: true,
            message: "Goal is Removed"
        })
        
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            success: false,
            message:"internal server error"
        })
    }
}

const addGoals = async (req, res) => {
    try {
        const { user } = req;
        const userId = user.userId
        const { lifeStage, currentRole = "", preferredRole = "", industryChoice = "",preferredSkills=[], highestDegree="", specialization="", workExperience=0} = req.body
        if(!user){
            return res.status(200).json({
                success: false,
                message: "invalid user"
            })
        }
        if (!lifeStage) {
            return res.status(200).json({
                success: false,
                message: "invalid request sent"
            })
        }
        /**
         * Life Stage Options : [career_change, new_career, upskill]
         */
        if(lifeStage != 'career_change' && lifeStage != 'new_career' && lifeStage != 'upskill'){
            return res.status(200).json({
                success: false,
                message: "Please choose valid options."
            })
        }
        let preferredSkillList = [];
        if(preferredSkills){
            preferredSkillList = preferredSkills;
        }

        const goalObj = await models.goal.create(
            {
                userId:userId, 
                lifeStage:lifeStage, 
                currentRole: currentRole, 
                preferredRole: preferredRole, 
                industryChoice: industryChoice,
                highestDegree: highestDegree, 
                specialization: specialization, 
                workExperience: workExperience
            }
        )
        
        if(preferredSkillList.length > 0){
            for(let name of preferredSkillList){
                await models.skill.create({goalId: goalObj.id, name:name});
            }
        }

        return res.status(200).json({
            success: true,
            message: "Data is successfully saved."
        })
        
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            success: false,
            message:"internal server error"
        })
    }
}

const editGoal = async (req, res) => {
    try {
        const { user } = req;
        const userId = user.userId
        const { goalId, lifeStage, currentRole = "", preferredRole = "", industryChoice = "",preferredSkills=[], highestDegree="", specialization="", workExperience=0} = req.body
        if(!user){
            return res.status(200).json({
                success: false,
                message: "invalid user"
            })
        }
        if (!goalId || !lifeStage) {
            return res.status(200).json({
                success: false,
                message: "invalid request sent"
            })
        }
        /**
         * Life Stage Options : [career_change, new_career, upskill]
         */
        if(lifeStage != 'career_change' && lifeStage != 'new_career' && lifeStage != 'upskill'){
            return res.status(200).json({
                success: false,
                message: "Please choose valid options."
            })
        }
        let preferredSkillList = [];
        if(preferredSkills){
            preferredSkillList = preferredSkills;
        }

        const goalObj = await models.goal.findOne({where:{userId:userId, id:goalId}})
        let newgoalObj
        if(goalObj){
            newgoalObj = await models.goal.update({
                lifeStage:lifeStage, 
                currentRole: currentRole, 
                preferredRole: preferredRole, 
                industryChoice: industryChoice,
                highestDegree: highestDegree, 
                specialization: specialization, 
                workExperience: workExperience
            }, {
                where:{
                    userId:userId,
                    id: goalId
                }
            })
            await models.skill.destroy({where:{goalId: goalId}})
            if(preferredSkillList.length > 0){
                for(let name of preferredSkillList){
                    await models.skill.create({goalId: goalId, name:name});
                }
            }
        }else{
            newgoalObj = await models.goal.create(
                {
                    userId:userId, 
                    lifeStage:lifeStage, 
                    currentRole: currentRole, 
                    preferredRole: preferredRole, 
                    industryChoice: industryChoice,
                    highestDegree: highestDegree, 
                    specialization: specialization, 
                    workExperience: workExperience
                }
            )
            
            if(preferredSkillList.length > 0){
                for(let name of preferredSkillList){
                    await models.skill.create({goalId: newgoalObj.id, name:name});
                }
            }
        }
        
        return res.status(200).json({
            success: true,
            message: "Data is successfully edited",
            data: newgoalObj
        })
        
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
           
            await logActvity("LEARNPATH_WISHLIST", userId, learnpathIds);

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

const addCourseToShare = async (req, res) => {
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
                key: 'course_share',
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
                    key: "course_share",
                    value: courseId,
                    userId: userId,
                }
            });

            const resMeta = await models.user_meta.bulkCreate(dataToSave)
            // const numericIds = courseIds.map((courseId) => courseId.split("LRN_CNT_PUB_").pop())
            // const userinfo = await models.user_meta.findOne({
            //     attributes: ["value"],
            //     where: {
            //         userId: user.userId, metaType: 'primary', key: 'email'
            //     }
            // })
            // const data = { email: userinfo.value, courseIds: numericIds }
            await logActvity("COURSE_SHARE", userId, courseIds);
            // sendDataForStrapi(data, "profile-add-wishlist");

            return res.status(200).json({
                success: true,
                data: {
                    share: resMeta
                }
            })
        }
        else {
            return res.status(200).json({
                success: true,
                data: {
                    share: []
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


const addLearnPathToShare = async (req,res) => {
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
                key: 'learnpath_share',
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
                    key: "learnpath_share",
                    value: learnpathId,
                    userId: userId,
                }
            });

            const resMeta = await models.user_meta.bulkCreate(dataToSave)
            // const numericIds = learnpathIds.map((learnpathId) => learnpathId.split("LRN_PTH_").pop())
            // const userinfo = await models.user_meta.findOne({
            //     attributes: ["value"],
            //     where: {
            //         userId: user.userId, metaType: 'primary', key: 'email'
            //     }
            // })
            // const data = { email: userinfo.value, learnpathIds: numericIds }
            await logActvity("LEARNPATH_SHARE", userId, learnpathIds);
            // sendDataForStrapi(data, "profile-add-learnpath-wishlist");

            return res.status(200).json({
                success: true,
                data: {
                    share: resMeta
                }
            })
        }
        else {
            return res.status(200).json({
                success: true,
                data: {
                    share: []
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

const addArticleToShare = async (req,res) => {
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
                key: 'article_share',
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
                    key: "article_share",
                    value: articleId,
                    userId: userId
                }
            })

            const resMeta = await models.user_meta.bulkCreate(dataToSave)
            await logActvity("ARTICLE_SHARE", userId, articleIds);
            return res.status(200).json({
                success: true,
                data: {
                    share: resMeta
                }
            })
        } else {
            return res.status(200).json({
                success: true,
                data: {
                    share: []
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
        success,
        data: { courseIds, courses},
        message
    });
}

const removeCourseFromWishList = async (req,res) => {
    const { user} = req;
    const {courseId} = req.body
    const resMeta = await models.user_meta.destroy({ where: { key:"course_wishlist", value:courseId, userId:user.userId}})
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
        if (req.query.queryString)
            req.query.q = req.query.queryString;

        if(totalWishedListIds.length > 0){

            req.query.courseIds = totalWishedListIds.join(',');
            await LearnContentService.getLearnContentList(req, (err, data) => {
                if(data)
                {
                    let response = { success: true,
                            data: {userId, courses: data.data.list, ids: []},
                            pagination: {page, limit, total : totalCount} };
                    return res.status(200).send(response);
                }
                else
                    return res.status(200).send({success: false,
                            message: "something went wrong wishlist Course ",
                            data: {list: [], pagination: {total: 0}, filters: {}} });
            });
        }
        else
            return res.status(200).send({ success: true, message: 'No records found!',
                                          data: {list: [], pagination: {total: 0}, filters: {}}});
        
    } catch (error) {
        console.log(error);
        return res.status(500).send({error:error, success:false});
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

        if (req.query.queryString)
            req.query.q = req.query.queryString
       
        if(totalWishedListIds.length > 0)
        {
         req.query.learnPathIds = totalWishedListIds.join(',');
         await LearnPathService.getLearnPathList(req, (err, data) => {
              if(data){
                let response = {
                            success: true,
                            data: { userId, learnpaths: data.data.list, ids: [] },
                            pagination: {page, limit, total : totalCount} };
                return res.status(200).send(response);

              }
              else
                  return res.status(200).send({ success: false,
                                                message: "something went wrong wish List learnpath ",
                                                data: {list: [], pagination: {total: 0}, filters: {} } });
          });
         }
         else
             return res.status(200).send({success: true, message: 'No records found!', data: {list: [], pagination: {total: 0}, filters: {}}});
         
    } catch (error) {
        console.log(error);
        return res.status(500).send({error:error, success:false});
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
        let where = {
            [Op.and]: [
                {
                    [Op.eq]: Sequelize.where( Sequelize.fn('lower', Sequelize.col('email')),Sequelize.fn('lower', email))                        
                }
            ]
        }
        let email_already_exist = await models.user.findOne({where:where})
        if(email_already_exist != null){
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

        let oldEmailObj = await models.user.findOne({where:{id:userId}})
        const oldEmail = oldEmailObj.email;
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
  
    await models.user.update({profilePicture:s3Path},{where:{id:user.userId}})
    
    const profileRes = await calculateProfileCompletion(user)
    return res.status(200).json({success:true,profilePicture:s3Path, profileProgress:profileRes})
}

const removeProfilePic = async (req,res) => {
    const {user} = req

    await models.user.update({profilePicture:null},{where:{id:user.userId}})
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
    await models.user.update({resumeFile: JSON.stringify(fileValue)},{where:{id:user.userId}})
    return res.status(200).json({success:true,resumeFile:fileValue})
}

const deleteResumeFile = async (req,res) => {
    const {user} = req
    
    await models.user.update({resumeFile:null},{where:{id:user.userId}})
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
    return res.status(200).json({success:true,data:data})
}

const addSkills = async (req,res) => {
    const {data} =req.body
    const { user} = req;
    let responseData = null;
    try {
        const userData = await models.user_topic.findAll({
            where: {
                userId:req.user.userId
            },
            include: [
                {
                    model: models.user_skill,
                    attributes: ['skill','isPrimary']
                }
            ],
            attributes: ['id','topic']

        })
        if(userData )
        {
            for(let topicData of userData)
            {
                await models.user_skill.destroy({where: {userTopicId: topicData.id}})
            }
        }
        
        await models.user_topic.destroy({where: {userId: user.userId}})

        for (const [key, value] of Object.entries(data)) {
            const userTopic  = await models.user_topic.create({
                 userId: user.userId,
                 topic: key
             })
     
             for(let skill of value)
             {
                 await models.user_skill.create({
                     userTopicId:userTopic.id,
                     skill:skill.skill,
                     isPrimary: skill.isPrimary
                 })
             }
             
        }
         return res.status(200).json({success:true,data:data})
    } catch (error) {
        console.log("add skill", error)
        return res.status(200).json({success:false,data:{}, message:"Error updating Skills"})
    }
    
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

        
            //const data = { email: userinfo.value, articleIds: numericIds }
            await logActvity("ARTICLE_WISHLIST", userId, articleIds);
           // sendDataForStrapi(data, "profile-bookmark-article");
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
            res.status(200).send({success: true, message: 'No records found!', data: {list: [], pagination: {total: 0}, filters: {}}});
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

const verifyPhone = async (email) =>{
    return new Promise(async (resolve, reject) => {
        try{           
            await models.user.update({
                    phoneVerified: true,
                }, {
                    where: {
                        email: email
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
      
        await models.user.update({
            phone: phone,
            phoneVerified: false,
        }, {
            where: {
                id: user.userId
            }
        });

       let userData =  await models.user.findOne({where: {id: user.userId}});
        if(phone){
            let countryCode =  phone.split(" ")[0];    
            let phoneWithoutcode =  phone.split(" ")[1];
            if(process.env.PHONEVERIFICATION =='true' && countryCode =='+91' )
            {
                const OTP_TYPE = OTP_TYPES.PHONEVERIFICATION
                let userId = user.id
                let email = userData.email
                const response = await generateOtp({ username:email, userId, provider: null, otpType:OTP_TYPE });
                await sendSMSOTP (phoneWithoutcode, response.data.otp);
               
            }
        }
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
        let userres = await models.user.update({
            status: "suspended"
        }, {
            where: {
                email: email
            }
        });
               
        await sendSuspendedEmail({email: email})
        //const tokenRes = await getLoginToken({ ...newUserObj, audience: req.headers.origin, provider: LOGIN_TYPES.LOCAL });
        return res.status(200).send({success: true, message: 'successfully supended!'})

    } catch (error) {
        console.log(error);
        return res.status(500).send({error,success:false})
    }
}

const reactivateAccount = async (req, res) => {
    const { email } = req.body;
    try {      
        
        let userres = await models.user.update({
            status: "active"
        }, {
            where: {
                email: email
            }
        });
               
        await sendActivatedEmail({email:email})
        //const tokenRes = await getLoginToken({ ...newUserObj, audience: req.headers.origin, provider: LOGIN_TYPES.LOCAL });
        return res.status(200).send({success: true, message: 'successfully activated!'})

    } catch (error) {
        console.log(error);
        return res.status(500).send({error,success:false})
    }
}

const getUserPendingActions = async (req, res = null) => {
    try {
        const { user } = req
        const userId = user.userId
        let profileProgress = 0
        let response = {

            pendingProfileActions: [
            ],
            profileProgress: null,
            verification:{ phoneVerified: false, emailVerified : false}
        }

        const fields = {
            education: {
                weightage: 10,
            },
            profilePicture: {
                weightage: 10,
            },
            fullName: {
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
                weightage: 10,
            },
            goal: {
                weightage: 10,
            }
        }

        const verificationFields = {
            verified: {
                weightage: 5
            },
            phoneVerified: {
                weightage: 5
            }
        }

        const userData = await models.user.findOne({
            where: {
                id: userId
            }
        })

        if(userData.fullName!= null){
            profileProgress += fields.fullName.weightage;
        }
        else {
            response.pendingProfileActions.push("personalDetails")
        }

        if(userData.dob!= null){
            profileProgress += fields.dob.weightage;
        }
        else {
            response.pendingProfileActions.push("personalDetails")
        }

        if(userData.gender!= null){
            profileProgress += fields.gender.weightage;
        }
        else {
            response.pendingProfileActions.push("personalDetails")
        }

        if(userData.city!= null){
            profileProgress += fields.city.weightage;
        }
        else {
            response.pendingProfileActions.push("personalDetails")
        }

        if(userData.resumeFile!= null){
            profileProgress += fields.resumeFile.weightage;
        }
        else {
            response.pendingProfileActions.push("resumeFile")
        }
        if(userData.profilePicture!= null){
            profileProgress += fields.profilePicture.weightage;
        }
        else {
            response.pendingProfileActions.push("profilePicture")
        }
        const education = await models.user_education.findAll({
            where: {
                userId: userId
            }
        })
        if(education && education.length > 0){
            profileProgress += fields.education.weightage;
        }
        else {
            response.pendingProfileActions.push("education")
        }

        const workExp = await models.user_experience.findAll({
            where: {
                userId: userId
            }
        })
        if(workExp && workExp.length > 0){
            profileProgress += fields.workExp.weightage;
        }
        else {
            response.pendingProfileActions.push("workExp")
        }

        if (userData.verified) {
                
            profileProgress += verificationFields.verified.weightage
            response.verification.emailVerified = true
        }
        else {
            response.verification.emailVerified = false
            response.pendingProfileActions.push("emailVerification")
        }

        if (userData.phoneVerified) {
            response.verification.phoneVerified = true
            profileProgress += verificationFields.phoneVerified.weightage
        }
        else {
            if (userData.phone !=null) {
                let countryCode =  userData.phone.split(" ")[0];  
       
                if (countryCode != '+91') {
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

         /**
         * Adding profile progress for profile Actions : 10%
        */
          const goalObj = await models.goal.findAll({
            where:{
                userId: userId
            }
        })

        if(!goalObj.length){
            response.pendingProfileActions.push('goal') 
        }else{
            profileProgress += fields.goal.weightage;
        }

         /**
         * Adding profile progress for profile Actions : 10%
        */
          const user_topic = await models.user_topic.findAll({
            where:{
                userId: userId
            }
        })

        if(!user_topic.length){
            response.pendingProfileActions.push('skills') 
        }else{
            profileProgress += fields.skills.weightage
        }

        response.profileProgress=profileProgress
        if(response.pendingProfileActions && response.pendingProfileActions.length > 0)
        {
            response.pendingProfileActions = response.pendingProfileActions.filter((v, i, a) => a.indexOf(v) === i)
        } 
        if(res){
            res.send({ success: true, data: response })
        } 
        else
        {
            return response
        } 
        
    } catch (error) {
        console.log(error)
        if(res)
        {
            res.status(500).send({
                success: false,
                message: "internal server error",
                error: error
            })
        }
        else
        {
            return null
        }
    }
}

const isUserEmailExist = async (req, res) => {  
        
    let username = req.body.email
        
    let response = {
        code: DEFAULT_CODES.INVALID_USER.code,
        message: DEFAULT_CODES.INVALID_USER.message,
        success: true,
        data: {
            isUserExist : false
        }
    }

    try {
        let where = {
            [Op.and]: [
                {
                    [Op.eq]: Sequelize.where( Sequelize.fn('lower', Sequelize.col('email')),Sequelize.fn('lower', username))                        
                }
            ]
        }

        let user = await models.user.findOne({ where: where})
            
        if (user != null) {            


            const { email } = user;
            response.success = true;
            response.code = DEFAULT_CODES.VALID_USER;
            response.message = DEFAULT_CODES.VALID_USER.message;
            response.data.isUserExist = true
            response.data.user = {
                email: user.email,
                userType: user.userType
            }            
            res.status(200).send(response)
        } else {
            res.status(200).send(response)
        }
    } catch (error) {
        console.log('isUserEmailExist err ',error);
        response = {
            code: DEFAULT_CODES.INVALID_USER.code,
            message: DEFAULT_CODES.INVALID_USER.message,
            success: false,
            data: {
                user: {}
            }
        }
        res.status(200).send(response)
    }
}

const getPersonalDetails = async (req, res) => {
    
    try {       
        const user = await models.user.findOne({ where: { id: req.user.userId }, attributes: ['fullName', 'email', 'verified', 'phone', 'phoneVerified', 'status', 'gender', 'dob', 'city', 'country'] })
        if (user.phone) {
            let countryCode = user.phone.split(" ")[0];
            if (countryCode != '+91') {
                user.phoneVerified = true
            }
        }

        res.status(200).send({
            message: "personal details updated successfully",
            data: user,
            success: true
        })
    } catch (error) {
        console.log('getPersonalDetails err ',error);
        res.status(200).send({
            message: "Error getting personal details",
            success: false
        })
    }
}

const editPersonalDetails = async (req, res) => {
    let {fullName, city, dob, gender } = req.body
    try {        
        
        if(calcAge(dob) < 16)
            return res.status(200).send({
                message: "Age must be atleast 16 years",
                success: false
            })
        city = (city == "")? null: city;
        dob = (dob == "")? null: dob;
        gender = (gender == "")? null: gender;
        await models.user.update({
            fullName,
            city,
            dob,
            gender
        }, {
            where: {
                id: req.user.userId
            }
        });
        
        res.status(200).send({
            message: "personal details updated successfully",
            success: true
        })
    } catch (error) {
        console.log('editPersonalDetails err ',error);
        res.status(200).send({
            message: "Error updating personal details",
            success: false
        })
    }
}

const addEducation = async (req, res) => {
    let {instituteName, degree, specialization, graduationYear, gradeType, grade } = req.body
    try {        
        
        const user_education = await models.user_education.create({
            userId: req.user.userId,
            instituteName,
            degree,
            specialization,
            graduationYear,
            gradeType,
            grade
        })

        res.status(200).send({
            message: "Education added successfully",
            success: true,
            data: {
                id: user_education.id,
                instituteName,
                degree,
                specialization,
                graduationYear,
                gradeType,
                grade
            }
        })
    } catch (error) {
        console.log('addEducation err ',error);
        res.status(200).send({
            message: "Error adding Education",
            success: false,
            data: {}
        })
    }
}

const editEducation = async (req, res) => {
    let {id, instituteName, degree, specialization, graduationYear, gradeType, grade } = req.body
    try {        
        const user_education = await models.user_education.update(
            {            
                instituteName,
                degree,
                specialization,
                graduationYear,
                gradeType,
                grade
            },
            {
                where: {userId:req.user.userId, id:id}
            }
        )

        res.status(200).send({
            message: "Education updated successfully",
            success: true,
            data: {
                id: user_education.id,
                instituteName,
                degree,
                specialization,
                graduationYear,
                gradeType,
                grade

            }
        })

    } catch (error) {
        console.log('editEducation err ',error);
        res.status(200).send({
            message: "Error updating Education",
            success: false,
            data: {}
        })
    }
}

const deleteEducation = async (req, res) => {
    let {id} = req.body
    try {        
        
        await models.user_education.destroy({
            where: {
                id:id,
                userId:req.user.userId
            }
        })

        res.status(200).send({
            message: "Education deleted successfully",
            success: true            
        })
    } catch (error) {
        console.log('deleteEducation err ',error);
        res.status(200).send({
            message: "Error deleting Education",
            success: false
        })
    }
}
const getEducations = async (req, res) => {    
    try {        
        
        const user_educations = await models.user_education.findAll({
            where: {
                userId:req.user.userId
            },
            attributes: ["id",'instituteName', 'degree','specialization','graduationYear','gradeType','grade']
        })

        res.status(200).send({
            message: "Education fetched successfully",
            success: true,
            data: user_educations             
        })
    } catch (error) {
        console.log('getEducations err ',error);
        res.status(200).send({
            message: "Error fetching Education",
            success: false
        })
    }
}

const addWorkExperience = async (req, res) => {
    let {jobTitle, industry, company, currentCompany, experience } = req.body
    try {        
        
        const user_Work_experience = await models.user_experience.create({
            userId: req.user.userId,
            jobTitle,
            industry,
            company,
            currentCompany,
            experience
        })

        res.status(200).send({
            message: "Work experience added successfully",
            success: true,
            data: {
                id: user_Work_experience.id,
                jobTitle,
                industry,
                company,
                currentCompany,
                experience
            }
        })
    } catch (error) {
        console.log('addWorkExperience err ',error);
        res.status(200).send({
            message: "Error adding Work experience",
            success: false,
            data: {}
        })
    }
}

const editWorkExperience = async (req, res) => {
    let {id, jobTitle, industry, company, currentCompany, experience  } = req.body
    try {        
        
        const user_experience = await models.user_experience.update(
            {            
                jobTitle,
                industry,
                company,
                currentCompany,
                experience
            },
            {
                where: {userId:req.user.userId, id:id}
            }
        )

        res.status(200).send({
            message: "Work experience updated successfully",
            success: true,
            data: {
                id: user_experience.id,
                jobTitle,
                industry,
                company,
                currentCompany,
                experience
            }
        })
    } catch (error) {
        console.log('editWorkExperience err ',error);
        res.status(200).send({
            message: "Error adding Work experience",
            success: false,
            data: {}
        })
    }
}

const deleteWorkExperience = async (req, res) => {
    let {id} = req.body
    try {        
        
        await models.user_experience.destroy({
            where: {
                id:id,
                userId:req.user.userId
            }
        })

        res.status(200).send({
            message: "Work Experience deleted successfully",
            success: true            
        })
    } catch (error) {
        console.log('WorkExperience err ',error);
        res.status(200).send({
            message: "Error deleting Education",
            success: false
        })
    }
}

const getWorkExperiences = async (req, res) => {    
    try {        
        
        const user_experiences = await models.user_experience.findAll({
            where: {
                userId:req.user.userId
            },
            attributes: ["id",'jobTitle', 'industry','company','currentCompany','experience']
        })

        res.status(200).send({
            message: "Work Experiences fetched successfully",
            success: true,
            data: user_experiences             
        })
    } catch (error) {
        console.log('getWorkExperiences err ',error);
        res.status(200).send({
            message: "Error fetching Education",
            success: false
        })
    }
}

const getUserProfile = async (req, res) => {    
    try {        
        
        const user = await models.user.findOne({
            where: {
                id:req.user.userId
            },
            include: [
                {
                    model: models.user_education,
                    attributes: ["id",'instituteName', 'degree','specialization','graduationYear','gradeType','grade']
                },
                {
                    model: models.user_experience,
                    attributes: ["id",'jobTitle', 'industry','company','currentCompany','experience']
                },
                {
                    model: models.user_address,
                    attributes: ["id","firstName","lastName","addressLine","street", "locality", "city", "state", "country", "zipCode"]

                }
            ],
            attributes: ['fullName', 'email','verified','phone','phoneVerified','status','gender','dob','city','country','profilePicture','resumeFile']
        })
        if(user.resumeFile)
        {
            try {
                user.resumeFile = JSON.parse(user.resumeFile)

            } catch (error) {

                user.resumeFile ={
                    filename:user.resumeFile,
                    filepath:user.resumeFile,
                    uploadDate:null,
                    size:null
                } 
            }
        }
        if(user.phone){
            let countryCode = user.phone.split(" ")[0];
            if (countryCode != '+91') {
                user.phoneVerified = true
            }
        }

        //set desgination
        if(user.user_experiences && user.user_experiences.length > 0)
        {
            for (let experience of user.user_experiences )
            {
                if(experience.jobTitle)
                {
                   
                    user.setDataValue('designation', experience.jobTitle);                    
                }
            }
        }
        else{
            user.setDataValue('designation', null); 
        }

        // Get key skills
        let keyskill =  await getKeySkills(req); 
        user.setDataValue('keyskill', keyskill);

        // Get goals

        let goals = await getGoals(req)
        user.setDataValue('goals', goals);

        if(goals != null && goals.length)
            user.setDataValue('isGoals', true);
        else
            user.setDataValue('isGoals', false);

        // get user profileProgress
        let pendingActions = await  getUserPendingActions(req)

        user.setDataValue('pendingActions', pendingActions);
        user.setDataValue('profileProgress', pendingActions.profileProgress);
        user.setDataValue('id', req.user.userId);
        user.setDataValue('encryptedUserId', await encryptUserId(req.user.userId));
        res.status(200).send({
            message: "User Profile fetched successfully",
            success: true,
            data: user             
        })
    } catch (error) {
        console.log('getUserProfile err ',error);
        res.status(200).send({
            message: "Error fetching Education",
            success: false
        })
    }
}

const getSkills = async (req, res) => {    
    try {        
        
        const userData = await models.user_topic.findAll({
            where: {
                userId:req.user.userId
            },
            include: [
                {
                    model: models.user_skill,
                    attributes: ['skill','isPrimary']
                }
            ],
            attributes: ['topic']

        })
        res.status(200).send({
            message: "User Skills fetched successfully",
            success: true,
            data: userData             
        })
    } catch (error) {
        console.log('getSkills err ',error);
        res.status(200).send({
            message: "Error fetching Skill",
            success: false
        })
    }
}

const getKeySkills = async (req, res=null) => {    
    try {        
        let keySkill = []
        const userData = await models.user_topic.findAll({
            where: {
                userId:req.user.userId
            },
            include: [
                {
                    model: models.user_skill,
                    attributes: ['skill','isPrimary'],
                    where: { isPrimary: true }
                }
            ],
            attributes: ['topic']

        })

        if(userData && userData.length > 0)
        {
            for(let data of userData)
            {
                for(let user_skill of data.user_skills)
                {
                    keySkill.push(user_skill.skill)
                }   
            }
         }
        if (res) {
            res.status(200).send({
                message: "User Key skills fetched successfully",
                success: true,
                data: keySkill
            })
        }
        else {
            return keySkill
        }
    } catch (error) {
        console.log('getKeySkills err ',error);
        if (res) {
            res.status(200).send({
                message: "Error fetching KeySkills",
                success: false
            })
        } else {
            return null
        }
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

const addArticleToRecentlyViewed = async (req, res) => {
    try {

        const { user } = req;
        const { articleId } = req.body;
        if (!articleId) {
            return res.status(400).json({
                success: false,
                "message": "article id is mandatory"

            });
        }
        const unique_data = { userId: user.userId, articleId: articleId };
        const SAVE_RECENTLY_VIEWED_ARTICLE_COUNT = process.env.SAVE_RECENTLY_VIEWED_ARTICLE_COUNT || 20;

        //check if article exists for the user
        const exists = await models.recently_viewed_articles.findOne({ where: unique_data });
        if (exists) {
            //if exists change updated at
            await models.recently_viewed_articles.update({ userId: unique_data.userId, articleId: unique_data.articleId }, { where: unique_data });
        } else {

            const { count, rows } = await models.recently_viewed_articles.findAndCountAll(
                {
                    limit: 1,
                    where: { userId: user.userId },
                    order: [['createdAt', 'ASC']],
                    attributes: {
                        include: ['id']
                    }
                });

            if (count >= SAVE_RECENTLY_VIEWED_ARTICLE_COUNT) {
                //remove first entry
                await models.recently_viewed_articles.destroy(
                    { where: { id: rows[0].id } }
                );
            }

            await models.recently_viewed_articles.create(unique_data);

        }
        return res.status(200).json({
            success: true,
            message: "Article added to recently viewed"

        });

    } catch (error) {

        console.log("Error occured while adding article to recently viewed : ", error);
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

            const sort = [{ "activity_count.all_time.popularity_score": "desc" }, { "ratings": "desc" }];
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

const addInstituteToWishList = async (req, res) => {
    try {
        const { user } = req;
        const userId = user.userId
        let instituteIdsFromClient = validators.validateIds(req.body)
        if (!instituteIdsFromClient) {

            return res.status(200).json({
                success: false,
                message: "invalid request sent"
            })
        }

        let response = {
            success: true,
            data: {
                wishlist: []
            }
        }
        //check if provided instituteIdsFromClient are valid/exits in elastic
        await validateIdsFromElastic("provider", instituteIdsFromClient).then(validIds => {instituteIdsFromClient = validIds})

        if(!instituteIdsFromClient.length)
            return res.status(200).json(response)

        let existingIds = await models.user_meta.findAll({
            attributes: ["value"], where: {
                userId: userId,
                key: 'institute_wishlist',
                value: instituteIdsFromClient
            }
        });
        let instituteIds = []
        existingIds = existingIds.map((institute) => institute.value)
        instituteIdsFromClient.forEach((instituteId) => {
            if (!existingIds.includes(instituteId)) instituteIds.push(instituteId)
        });

        if (instituteIds.length) {

            const dataToSave = instituteIds.map((instituteId) => {
                return {
                    key: "institute_wishlist",
                    value: instituteId,
                    userId: userId,
                }
            });
            response.data.wishlist = await models.user_meta.bulkCreate(dataToSave)
            await logActvity("INSTITUTE_WISHLIST", userId, instituteIds);

            return res.status(200).json(response)

        }
        else
            return res.status(200).json(response)

    } catch (error) {
      
        console.log(error)
        return res.status(500).json({
            success: false,
            message:"internal server error"
        })
    }
}


const fetchInstituteWishList = async (req, res) => {
    try {
        const { user } = req
        const { page, limit } = validators.validatePaginationParams({ page: req.query.page, limit: req.query.limit })

        const offset = (page - 1) * limit
        let totalCount = 0

        let where = {
            userId: user.userId,
            key: { [Op.in]: ['institute_wishlist'] },
        }

        const wishlistedInstitute = await models.user_meta.findAll({
            attributes: ['value'],
            where,
            order: [["id", "DESC"]]
        })

        let  totalWishedListIds = wishlistedInstitute.map((rec) => rec.value)
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

        const result = await elasticService.plainSearch('provider', queryBody);
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
                institutes: activeWishListIds
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

const removeInstituteFromWishList = async (req, res) => {

    const { user} = req;
    const { id } = req.body
    const resMeta = await models.user_meta.destroy({ where: { key:"institute_wishlist", value: id, userId:user.userId}})
    return res.status(200).json({
        success:true,
        data: {
            wishlist:resMeta
        }
    })
}

const calcAge = (dob) => {

    let today = new Date();
    let birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    let m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate()))
        age--;

    return age;
}

const addAddress = async (req, res) => {
    let {firstName,lastName,addressLine,street, locality, city, state, country, zipCode } = req.body
    try {        
        
        const user_address = await models.user_address.create({
            userId: req.user.userId,
            firstName,
            lastName,
            addressLine,
            street,
            locality,
            city,
            state,
            country,
            zipCode
        })

        res.status(200).send({
            message: "Address added successfully",
            success: true,
            data: {
                id: user_address.id,
                firstName,
                lastName,
                addressLine,
                street,
                locality,
                city,
                state,
                country,
                zipCode
            }
        })
    } catch (error) {
        console.log('addAddress err ',error);
        res.status(200).send({
            message: "Error adding Address",
            success: false,
            data: {}
        })
    }
}

const editAddress = async (req, res) => {
    let {firstName,lastName,addressLine,street, locality, city, state, country, zipCode } = req.body
    try {        
        const user_address = await models.user_address.update(
            {     
                firstName,
                lastName,       
                addressLine,
                street,
                locality,
                city,
                state,
                country,
                zipCode
            },
            {
                where: {userId:req.user.userId}
            }
        )

        res.status(200).send({
            message: "Address updated successfully",
            success: true,
            data: {
                id: user_address.id,
                firstName,
                lastName,
                addressLine,
                street,
                locality,
                city,
                state,
                country,
                zipCode

            }
        })

    } catch (error) {
        console.log('editAddress  err ',error);
        res.status(200).send({
            message: "Error updating Address ",
            success: false,
            data: {}
        })
    }
}

const getAddress = async (req, res) => {    
    try {        
        
        const user_address = await models.user_address.findOne({
            where: {
                userId:req.user.userId
            },
            attributes: ["id","firstName","lastName","addressLine","street", "locality", "city", "state", "country", "zipCode"]         
        })

        res.status(200).send({
            message: "Address fetched successfully",
            success: true,
            data: user_address             
        })
    } catch (error) {
        console.log('getAddress err ',error);
        res.status(200).send({
            message: "Error fetching Address",
            success: false
        })
    }
}


module.exports = {
    login,
    verifyOtp,
    sendOtp,
    verifyUserToken,
    socialSignIn,
    signUp,
    isUserEmailExist,
    resendVerificationLink,
    resendEmailVerificationOPT,
    verifyAccount,
    resetPassword,
    forgotPassword,
    getProfileProgress,
    getCourseWishlist,
    addCourseToWishList,
    addInstituteToWishList,
    fetchInstituteWishList,
    removeInstituteFromWishList,
    addGoals,
    getGoals,
    removeGoal,
    editGoal,
    addLearnPathToWishList,
    addCourseToRecentlyViewed,
    getRecentlyViewedCourses,
    removeCourseFromWishList,
    removeLearnPathFromWishList,
    fetchWishListIds,
    fetchLearnPathWishListIds,
    addCourseToShare,
    addLearnPathToShare,
    addArticleToShare,
    wishListCourseData,
    wishListLearnPathData,
    getEnquiryList,
    getLearnPathEnquiryList,
    uploadProfilePic,
    uploadResumeFile,
    deleteResumeFile,
    removeProfilePic,
    addSkills,
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
    getPersonalDetails,
    editPersonalDetails,
    addEducation,
    editEducation,    
    deleteEducation,
    getEducations,
    addAddress,
    editAddress,
    getAddress,
    addWorkExperience,
    editWorkExperience,
    deleteWorkExperience,
    getWorkExperiences,
    getUserProfile,
    getSkills,
    getKeySkills,    
    recentlyViewedCourses,
    getUserLastSearch,
    recentlySearchedCourses,
    peopleAreAlsoViewing,
    addCategoryToRecentlyViewed,
    addArticleToRecentlyViewed ,
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

            if (search.type == 'learn-content'|| search.type == 'article') {
                if (suggestionList[search.type].length == (process.env.LAST_COURSE_ARTICLE_SEARCH_LIMIT||20)) {
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