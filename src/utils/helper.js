const OAuth2Client = require('google-auth-library').OAuth2Client;
const Cryptr = require('cryptr');
const { resolve } = require('path');
const { DEFAULT_CODES, LOGIN_TYPES } = require('./defaultCode');
const { default: Axios } = require('axios');
const Linkedin = require('node-linkedin');
const { stringify } = require('querystring');
const models = require("../../models");
crypt = new Cryptr(process.env.CRYPT_SALT);
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
                    console.log(verificationLink, "dddddddddddddddddd");
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
            if(!userProfileRes.data.localizedLastname) {
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
            let fullName = userProfileRes.data.localizedFirstName +" "+ userProfileRes.data.localizedLastname

            return resolve({
                code: DEFAULT_CODES.VALID_TOKEN.code,
                message: DEFAULT_CODES.VALID_TOKEN.message,
                success: true,
                data: {
                    email: userEmailRes.data.elements[0]['handle~'].emailAddress || "",
                    username: userEmailRes.data.elements[0]['handle~'].emailAddress,
                    fullName:fullName,
                    phone:'',
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
            phone:"",
            fullName: payload.name,
            provider: LOGIN_TYPES.GOOGLE
        }
    }
}

const createUser = async (userObj) => {
    return new Promise(async (resolve, reject) => {
        try {

            let colName = "phone";
            if (isEmail(userObj.username)) {
                colName = "email";
            }
            const user = await models.user.findOne({
                where: {
                    [colName]: userObj.username
                }
            })
            if (user == null) {
                try {
                    const newUser = await models.user.create({
                        email: userObj.email || "",
                        phone: userObj.phone || "",
                        fullName: userObj.fullName || "",
                    })
                    console.log(newUser);
                    if(userObj.provider != LOGIN_TYPES.LOCAL) {
                          await models.user_login.create({
                            userId:newUser.id,
                            email: userObj.email || "",
                            password:"",
                            phone: userObj.phone || "",
                            provider:LOGIN_TYPES.LOCAL,
                            providerId: "",
                            providerData:{},
                        })
                    }
                    const userLogin =  await models.user_login.create({
                        userId:newUser.id,
                        email: userObj.email || "",
                        password:userObj.password || "",
                        phone: userObj.phone || "",
                        provider: userObj.provider || "",
                        providerId:  userObj.providerId || "",
                        providerData: userObj.providerData || {},
                    })
                            return resolve({
                                success:true,
                                code: DEFAULT_CODES.USER_CREATED.code,
                                message: DEFAULT_CODES.USER_CREATED.message,
                                data: {
                                    user: {
                                        username:userObj.username,
                                        userId: newUser.id,
                                        email: newUser.email,
                                        phone: newUser.phone,
                                        provider: userObj.provider
                                    }
                                }
                            })
                    
                } catch (error) {
                    console.log(error);
                }

            } else {
                const userLogin =  await models.user_login.create({
                    userId:user.id,
                    email: userObj.email || "",
                    phone: userObj.phone || "",
                    provider: userObj.provider || "",
                    providerId:  userObj.providerId || "",
                    providerData: userObj.providerData || {},
                })
                return resolve({
                    success:true,
                    code: DEFAULT_CODES.USER_CREATED.code,
                    message: DEFAULT_CODES.USER_CREATED.message,
                    data: {
                        user: {
                            username:userObj.username,
                            userId: user.id,
                            email: user.email,
                            phone: user.phone,
                            provider: userObj.provider
                        }
                    }
                })
            }
        } catch (error) {
            console.log(error);
            return resolve({
                success:false,
                code: DEFAULT_CODES.SYSTEM_ERROR.code,
                message: DEFAULT_CODES.SYSTEM_ERROR.message,
                data: {
                }
            })
        }

    })
}
module.exports = {
    encryptStr,
    decryptStr,
    isEmail,
    getOtp,
    verifySocialToken,
    createUser
}