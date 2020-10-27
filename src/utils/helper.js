const OAuth2Client = require('google-auth-library').OAuth2Client;
const Cryptr = require('cryptr');
const { resolve } = require('path');
const { DEFAULT_CODES, LOGIN_TYPES, USER_STATUS, USER_TYPE, TOKEN_TYPES } = require('./defaultCode');
const { default: Axios } = require('axios');
const Linkedin = require('node-linkedin');
const { stringify } = require('querystring');
const models = require("../../models");
const defaults = require('../services/v1/defaults/defaults');
const communication = require('../communication/v1/communication');
const { signToken } = require('../services/v1/auth/auth');
crypt = new Cryptr(process.env.CRYPT_SALT);
const moment = require("moment");
const Sequelize = require('sequelize');
const Op = Sequelize.Op;

const encryptStr = (str) => {
    return crypt.encrypt(str);
};

const decryptStr = (str) => {
    return crypt.decrypt(str);
};

const isEmail = (email) => {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

const getOtp = (n) => {
    var add = 1, max = 12 - add;
    max = Math.pow(10, n + add);
    var min = max / 10;
    var number = Math.floor(Math.random() * (max - min + 1)) + min;
    return ("" + number).substring(add);
}


const verifySocialToken = (resData) => {
    return new Promise(async (resolve, reject) => {

        try {
            switch (resData.provider) {
                case LOGIN_TYPES.GOOGLE:
                    const varification = await verifyGoogleToken(resData.tokenId);
                    return resolve(varification)
                    break;
                case LOGIN_TYPES.LINKEDIN:
                    const verificationLink = await verifyLinkedInToken(resData)
                    return resolve(verificationLink)
                    break;
                default:
                    break;
            }

        } catch (error) {
            console.log(error)
            resolve({
                code: DEFAULT_CODES.SYSTEM_ERROR.code,
                message: DEFAULT_CODES.SYSTEM_ERROR.message,
                success: false,
                data: { provider: resData.provider }
            })
        }
    })

}

const verifyLinkedInToken = async (resData) => {
    return new Promise(async (resolve, reject) => {
        try {

            const resp = await Axios.post('https://www.linkedin.com/oauth/v2/accessToken', stringify({
                grant_type: "authorization_code",
                code: resData.tokenId,
                redirect_uri: resData.redirectUri,
                client_id: process.env.LINKED_IN_CLIENT_ID,
                client_secret: process.env.LINKED_IN_CLIENT_SECRET
            }), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                }
            })

            // get user profile
            const userProfileRes = await Axios.get('https://api.linkedin.com/v2/me', {
                headers: {
                    'Authorization': 'Bearer ' + resp.data.access_token
                }
            })
            //email address
            const userEmailRes = await Axios.get('https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))', {
                headers: {
                    'Authorization': 'Bearer ' + resp.data.access_token
                }
            })
            console.log(userProfileRes);
            if (!userProfileRes.data.localizedLastName) {
                console.log("ffffffff");
                return resolve({
                    code: DEFAULT_CODES.SYSTEM_ERROR.code,
                    message: DEFAULT_CODES.SYSTEM_ERROR.message,
                    success: false,
                    data: { provider: resData.provider }
                })
            }
            if (!userEmailRes.data.elements.length) {
                return resolve({
                    code: DEFAULT_CODES.SYSTEM_ERROR.code,
                    message: DEFAULT_CODES.SYSTEM_ERROR.message,
                    success: false,
                    data: { provider: resData.provider }
                })
            }
            let fullName = userProfileRes.data.localizedFirstName + " " + userProfileRes.data.localizedLastName

            return resolve({
                code: DEFAULT_CODES.VALID_TOKEN.code,
                message: DEFAULT_CODES.VALID_TOKEN.message,
                success: true,
                data: {
                    email: userEmailRes.data.elements[0]['handle~'].emailAddress || "",
                    username: userEmailRes.data.elements[0]['handle~'].emailAddress,
                    fullName: fullName,
                    phone: '',
                    provider: LOGIN_TYPES.LINKEDIN
                }
            })
        } catch (error) {
            console.log(error);
            return resolve({
                code: DEFAULT_CODES.SYSTEM_ERROR.code,
                message: DEFAULT_CODES.SYSTEM_ERROR.message,
                success: false,
                data: { provider: resData.provider }
            })
        }

    })

}

const verifyGoogleToken = async (tokenId) => {
    const client = new OAuth2Client(process.env.GOOGLE_APP_ID);
    const ticket = await client.verifyIdToken({
        idToken: tokenId,
        audience: process.env.GOOGLE_APP_ID,
    });
    const payload = ticket.getPayload();
    const userid = payload['sub'];
    return {
        code: DEFAULT_CODES.VALID_TOKEN.code,
        message: DEFAULT_CODES.VALID_TOKEN.message,
        success: true,
        data: {
            email: payload.email || "",
            username: payload.email,
            phone: "",
            fullName: payload.name,
            provider: LOGIN_TYPES.GOOGLE
        }
    }
}

const createUser = async (userObj) => {
    return new Promise(async (resolve, reject) => {
        try {
            switch (userObj.provider) {
                case LOGIN_TYPES.LOCAL:
                    return resolve(await handleLocalSignUP(userObj))
                    break;

                case LOGIN_TYPES.GOOGLE:
                case LOGIN_TYPES.LINKEDIN:
                    return resolve(await handleSocialSignUp(userObj))
                    break;
                default:
                    break;
            }

            // if (tokenPayload) {
            //     if (tokenPayload.userType == USER_TYPE.GUEST) {
            //         const { userId } = tokenPayload;
            //         const user = await models.user.update(
            //             {
            //                 userType: USER_TYPE.REGISTERED,
            //                 status: USER_STATUS.ACTIVE
            //             },
            //             {
            //                 where: { id: userId }
            //             }
            //         )
            //     }
            // } else {

            // }

            // if (user == null) {
            //     try {
            //         const newUser = await models.user.create({
            //             status: USER_STATUS.ACTIVE,
            //             userType: USER_TYPE.REGISTERED,
            //             verified: userObj.verified || false
            //             // email: userObj.email || "",
            //             // phone: userObj.phone || "",
            //             // fullName: userObj.fullName || "",
            //         })
            //         await models.user_login.create({
            //             userId: newUser.id,
            //             email: userObj.username || "",
            //             password: userObj.password || "",
            //             phone: userObj.phone || "",
            //             provider: LOGIN_TYPES.LOCAL,
            //             providerId: "",
            //             providerData: {},
            //         })
            //         console.log(userObj.provider, [LOGIN_TYPES.GOOGLE, LOGIN_TYPES.LINKEDIN].includes(userObj.provider));
            //         // return false
            //         if ([LOGIN_TYPES.GOOGLE, LOGIN_TYPES.LINKEDIN].includes(userObj.provider)) {
            //             const userLogin = await models.user_login.create({
            //                 userId: newUser.id,
            //                 email: userObj.email || "",
            //                 password: null,
            //                 phone: userObj.phone || "",
            //                 provider: userObj.provider || "",
            //                 providerId: userObj.providerId || "",
            //                 providerData: userObj.providerData || {},
            //             })
            //         }
            //         //make entry in user meta
            //         const userMeta = userObj.userMeta.filter((f) => { return f['userId'] = newUser.id })
            //         await createUserMeta(userMeta)
            //         return resolve({
            //             success: true,
            //             code: DEFAULT_CODES.USER_CREATED.code,
            //             message: DEFAULT_CODES.USER_CREATED.message,
            //             data: {
            //                 user: {
            //                     username: userObj.username,
            //                     userId: newUser.id,
            //                     email: newUser.email,
            //                     phone: newUser.phone,
            //                     userType: newUser.userType,
            //                     provider: userObj.provider
            //                 }
            //             }
            //         })

            //     } catch (error) {
            //         console.log(error);
            //     }

            // } else {
            //     const userLogin = await models.user_login.create({
            //         userId: user.userId,
            //         email: userObj.email || "",
            //         phone: userObj.phone || "",
            //         provider: userObj.provider || "",
            //         providerId: userObj.providerId || "",
            //         providerData: userObj.providerData || {},
            //     })
            //     const userRec = await models.user.findOne({ where: { id: user.userId } })
            //     return resolve({
            //         success: true,
            //         code: DEFAULT_CODES.USER_CREATED.code,
            //         message: DEFAULT_CODES.USER_CREATED.message,
            //         data: {
            //             user: {
            //                 username: userObj.username,
            //                 userId: user.userId,
            //                 email: userObj.email || "",
            //                 phone: userObj.phone || "",
            //                 provider: userObj.provider || "",
            //                 userType: userRec.userType
            //             }
            //         }
            //     })
            // }
        } catch (error) {
            console.log(error);
            return resolve({
                success: false,
                code: DEFAULT_CODES.SYSTEM_ERROR.code,
                message: DEFAULT_CODES.SYSTEM_ERROR.message,
                data: {
                }
            })
        }

    })
}
const handleLocalSignUP = async (userObj) => {
    const { tokenPayload = {} } = userObj
    // return ({success:false})
    return new Promise(async (resolve, reject) => {
        let { userId, userType } = tokenPayload;
        try {
            // return resolve({success:false})
            if (userId && userType) {
                if (userType == USER_TYPE.GUEST) {
                    await models.user.update(
                        {
                            userType: USER_TYPE.REGISTERED,
                            status: USER_STATUS.ACTIVE
                        },
                        {
                            where: { id: userId }
                        }
                    )
                }

            } else {
                const newUser = await models.user.create({
                    status: USER_STATUS.ACTIVE,
                    userType: USER_TYPE.REGISTERED,
                    verified: userObj.verified || false
                })
                userId = newUser.id
            }
            const userMeta = userObj.userMeta.filter((f) => {
                f['userId'] = userId
                f['metaType'] = "primary"
                return f
            })
            await createUserMeta(userMeta)
            const encryptedPWD = encryptStr(userObj.password);
            await createUserLogin([{
                userId,
                email: userObj.username || "",
                password: encryptedPWD || null,
                phone: userObj.phone || null,
                provider: LOGIN_TYPES.LOCAL,
                providerId: null,
                providerData: {},
            }])
            let reducedObj = userMeta.filter(t => {
                if (t.key == "firstName" || t.key == "lastName") {
                    return t
                }

            }).map((t) => {return {[t.key]:t.value}}).reduce(function(acc, x) {
                for (var key in x) acc[key] = x[key];
                return acc;
            }, {});
            await sendVerifcationLink({
                username: userObj.username,
                userId,
                email: userObj.username,
                phone: userObj.phone,
                userType: USER_TYPE.REGISTERED,
                provider: LOGIN_TYPES.LOCAL,
                ...reducedObj,
                ...userObj
            })

            return resolve({
                success: true,
                code: DEFAULT_CODES.USER_CREATED.code,
                message: DEFAULT_CODES.USER_CREATED.message,
                data: {
                    user: {
                        username: userObj.username,
                        userId,
                        email: userObj.username,
                        phone: userObj.phone,
                        userType: USER_TYPE.REGISTERED,
                        provider: LOGIN_TYPES.LOCAL,
                        verified:userObj.verified || false
                    }
                }
            })

        } catch (error) {
            console.log(error);
            return resolve({
                success: false,
                code: DEFAULT_CODES.SYSTEM_ERROR.code,
                message: DEFAULT_CODES.SYSTEM_ERROR.message,
                data: {
                }
            })
        }

    })
}

const handleSocialSignUp = (userObj) => {
    return new Promise(async (resolve, reject) => {
        let userId
        try {
            let colName = "email";
            if (!isEmail(userObj.username)) {
                colName = "phone";
            }
            const user = await models.user_login.findOne({
                where: {
                    [colName]: userObj.username
                }
            })
            // if (tokenPayload) {
            //     if (tokenPayload.userType == USER_TYPE.GUEST) {
            //         userId = tokenPayload.userId;
            //         await models.user.update(
            //             {
            //                 userType: USER_TYPE.REGISTERED,
            //                 status: USER_STATUS.ACTIVE
            //             },
            //             {
            //                 where: { id: userId }
            //             }
            //         )
            //     }

            // } else {
            //     const newUser = await models.user.create({
            //         status: USER_STATUS.ACTIVE,
            //         userType: USER_TYPE.REGISTERED,
            //         verified: userObj.verified || false
            //     })
            //     userId = newUser.id
            // }
            // const userMeta = userObj.userMeta.filter((f) => { return f['userId'] = userId })
            // await createUserMeta(userMeta)
            await createUserLogin([
                {
                    userId: user.id,
                    email: userObj.username || userObj.email || "",
                    password: userObj.password || null,
                    phone: userObj.phone || null,
                    provider: userObj.provider,
                    providerId: userObj.providerId || null,
                    providerData: userObj.providerData || {},
                },
                // {
                //     userId,
                //     email: userObj.username || userObj.email || "",
                //     password: userObj.password || null,
                //     phone: userObj.phone || null,
                //     provider: LOGIN_TYPES.LOCAL,
                //     providerId: null,
                //     providerData: {},
                // }
            ])

            return resolve({
                success: true,
                code: DEFAULT_CODES.USER_CREATED.code,
                message: DEFAULT_CODES.USER_CREATED.message,
                data: {
                    user: {
                        username: userObj.username,
                        userId,
                        email: userObj.email,
                        phone: userObj.phone,
                        userType: USER_TYPE.REGISTERED,
                        provider: userObj.provider
                    }
                }
            })
        } catch (error) {
            return resolve({
                success: false,
                code: DEFAULT_CODES.SYSTEM_ERROR.code,
                message: DEFAULT_CODES.SYSTEM_ERROR.message,
                data: {
                }
            })
        }

    })
}

const createUserMeta = (userMeta) => {
    return new Promise(async (resolve, reject) => {
        models.user_meta.bulkCreate(userMeta)
            .then((res) => {
                resolve(res)
            }).catch(err => {
                console.log(err);
                resolve(false)
            })
    })
}

const createUserLogin = (userObject) => {
    return new Promise(async (resolve, reject) => {
        models.user_login.bulkCreate(userObject).then(() => {
            resolve(true)
        }).catch(err => {
            console.log(err);
            resolve(false)
        })
    })
}

const createToken = async (userObj, tokenType) => {
    try {
        let tokenExpiry = 86400
        switch (tokenType) {
            case TOKEN_TYPES.VERIFICATION:
                tokenExpiry = parseInt(defaults.getValue('verificaitonTokenExpiry'))
                break;
            case TOKEN_TYPES.RESETPASSWORD:
                tokenExpiry = parseInt(defaults.getValue('resetPasswordTokenExpiry'))
                break;
            default:
                tokenExpiry = 86400
                break;
        }
        const signOptions = {
            audience: userObj.audience,
            issuer: process.env.HOST,
            expiresIn: tokenExpiry
        }
        const payload = {
            user: {
                email: userObj.email || "",
                userId: userObj.userId
            }
        }


        const token = signToken(payload, signOptions);
        //
        let validTill = moment().format("YYYY/MM/DD HH:mm:ss");
        validTill = moment().add(tokenExpiry, "seconds").format("YYYY/MM/DD HH:mm:ss");

        let userAuthToken = {
            tokenId: token,
            userId: userObj.userId,
            tokenType: tokenType || TOKEN_TYPES.VERIFICATION,
            inValid: false,
            validTill: validTill
        };
        await models.auth_token.create(userAuthToken);

        return {
            code: DEFAULT_CODES.LOGIN_SUCCESS.code,
            message: DEFAULT_CODES.LOGIN_SUCCESS.message,
            success: true,
            data: {
                x_token: token
            }
        }
    } catch (error) {
        console.log(error);
    }
}

const sendVerifcationLink = (userObj, useQueue = false) => {
    return new Promise(async (resolve, reject) => {
        try {
            let tokenRes = await createToken(userObj, TOKEN_TYPES.VERIFICATION)
            let params = {
                redirect_url: '/',
                verification_token: tokenRes.data.x_token
            }
            let link = `${defaults.getValue('verificationUrl')}?${stringify(params)}`
            let emailPayload = {
                fromemail: "latesh@ajency.in",
                toemail: userObj.email,
                email_type: "activiation_mail",
                email_data: {
                    verification_link: link,
                    account_email: userObj.email,
                    full_name: userObj.firstName + ' ' + userObj.lastName,
                }
            }
            await communication.sendEmail(emailPayload, useQueue)
            resolve(true)
        } catch (error) {
            console.log(error);
        }
    })

}
/* 
    * Generate Token for login session
    input => audience- origin(client), provider-> (google facebook or linked in or local)    
    {
        code:'',
        success:true/false,
        message:'',
        data:{
            x_token:""
        }
    }
*/

const getLoginToken = async (userObj) => {
    try {
        const signOptions = {
            audience: userObj.audience,
            issuer: process.env.HOST,
            expiresIn: parseInt(defaults.getValue('tokenExpiry'))
        }
        const payload = {
            user: {
                email: userObj.email || "",
                // phone: userObj.phone || "",
                userId: userObj.userId,
                provider: userObj.provider || "",
                userType: userObj.userType,
                isVerified: userObj.verified || false,
            }
        }
        const token = signToken(payload, signOptions);
        let validTill = moment().format("YYYY/MM/DD HH:mm:ss");
        validTill = moment().add(defaults.getValue('tokenExpiry'), "seconds").format("YYYY/MM/DD HH:mm:ss");
        let userAuthToken = {
            tokenId: token,
            userId: userObj.userId,
            tokenType: TOKEN_TYPES.SIGNIN,
            inValid: false,
            validTill: validTill
        };
        await models.auth_token.create(userAuthToken);
        await models.user.update({
            lastLogin: new Date(),
        }, {
            where: {
                id: userObj.userId
            }
        });

        return {
            code: DEFAULT_CODES.LOGIN_SUCCESS.code,
            message: DEFAULT_CODES.LOGIN_SUCCESS.message,
            success: true,
            data: {
                x_token: token,
                user:payload.user
            }
        }

    } catch (error) {
        console.log(error);
        return {
            code: DEFAULT_CODES.SYSTEM_ERROR.code,
            message: DEFAULT_CODES.SYSTEM_ERROR.message,
            success: false,
            data: {}
        }
    }
}

const invalidateTokens = (userObj) => {
    return new Promise(async (resolve,reject) => {

        await models.auth_token.destroy({
            where: {
               userId:userObj.userId
            }
        });
        resolve(true)
    })
}

const sendWelcomeEmail  = (userObj) => {
    return new Promise(async(resolve,reject) => {
        try {
            console.log(userObj);
            let emailPayload = {
                fromemail: "latesh@ajency.in",
                toemail: userObj.email,
                email_type: "welcome_mail",
            }
            await communication.sendEmail(emailPayload)
            resolve(true)
        } catch (error) {
            console.log(error);
            resolve(true)
        }
    })
}

const sendResetPassowrdLink = (userObj, useQueue) => {
    return new Promise(async (resolve, reject) => {
        try {
            let tokenRes = await createToken(userObj, TOKEN_TYPES.RESETPASSWORD)
            console.log(tokenRes);
            let params = {
                redirect_url: '/',
                reset_token: tokenRes.data.x_token
            }
            let link = `${defaults.getValue('resetPasswordUrl')}?${stringify(params)}`
            let emailPayload = {
                fromemail: "latesh@ajency.in",
                toemail: userObj.email,
                email_type: "resetpassword_mail",
                email_data: {
                    reset_link: link,
                    account_email: userObj.email,
                    full_name: userObj.firstName + ' ' + userObj.lastName,
                }
            }
            await communication.sendEmail(emailPayload, useQueue)
            resolve(true)
        } catch (error) {
            console.log(error);
        }
    })
}

const calculateProfileCompletion =  (userObj) => {
    return new Promise(async (resolve) => {
        try {
            const sections = {
                "profile_picture": {
                    weightage: 25,
                    fieldCount: 1,
                    fields: ["profilePicture"]
                },
                "education": {
                    weightage:25,
                    fieldCount:5,
                    fields: ["institute","degree", "specialization", "graduationYear", "grade"]
                },
                "work_experience":{
                    weightage:25,
                    fieldCount:4,
                    fields: ["experience","jobTitle", "industry", "company"]
                },
                "basic_information":{
                    weightage:25,
                    fieldCount:7,
                    fields: ["firstName","lastName", 'gender', "dob", "phone","city", "email"]
                }
            }
            let profileCompleted = 0
        
            for (const key in sections) {
                const element = sections[key];
                const meta = await models.user_meta.findAll({
                    where:{
                        metaType:"primary",
                        key:{[Op.in]:sections[key].fields},
                        userId:userObj.userId || userObj.id
                    },
                    order: [
                        ['createdAt', 'DESC']
                    ]
                })
                if(meta.length) {
                    const formValues = meta.map((t) => {return {[t.key]:t.value}}).reduce(function(acc, x) {
                        
                        for (var key in x) {
                            if(!acc[key])
                                acc[key] = x[key]
                        };
                        return acc;
                    }, {});
                    let fieldEntered = 0
                    sections[key].fields.forEach( field => {
                        console.log(formValues[field],'==>', field);
                       if(formValues[field]) {
                           fieldEntered++
                       }
                    });
                    const secComltd = (sections[key].weightage/sections[key].fieldCount) * fieldEntered
                    console.log(key,'=------',fieldEntered);
                    profileCompleted = profileCompleted + secComltd;
                } else {
                    profileCompleted = profileCompleted + 0
                }
                    
            }
            resolve(Math.ceil(profileCompleted))
            
        } catch (error) {
            console.log(error);
            resolve(0)
        }
    })
}

module.exports = {
    encryptStr,
    decryptStr,
    isEmail,
    getOtp,
    verifySocialToken,
    createUser,
    createToken,
    sendVerifcationLink,
    getLoginToken,
    invalidateTokens,
    sendWelcomeEmail,
    sendResetPassowrdLink,
    calculateProfileCompletion
}