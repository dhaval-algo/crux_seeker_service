const OAuth2Client = require('google-auth-library').OAuth2Client;
const Cryptr = require('cryptr');
const { resolve } = require('path');
const { rejects } = require('assert');
const { DEFAULT_CODES, LOGIN_TYPES } = require('./defaultCode');
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


const verifySocialToken = ({ provider, tokenId }) => {
    return new Promise(async (resolve,rejects) => {

        try {
            switch (provider) {
                case LOGIN_TYPES.GOOGLE:
                   const varification = await verifyGoogleToken(tokenId);
                   return resolve(varification)
                    break;
                case LOGIN_TYPES.LINKEDID:
                
                    break;
                default:
                    break;
            }
           
        } catch (error) {
            console.log(error)
            resolve({
                code:DEFAULT_CODES.SYSTEM_ERROR.code,
                message:DEFAULT_CODES.SYSTEM_ERROR.message,
                success:false,
                data:{ provider}
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
        code:DEFAULT_CODES.VALID_TOKEN.code,
        message:DEFAULT_CODES.VALID_TOKEN.message,
        success: true,
        data: {
            email:payload.email || "",
            username:payload.email,
            phone:payload.email||"",
            name:payload.name,
            provider:LOGIN_TYPES.GOOGLE
        }
    }
}
module.exports = {
    encryptStr,
    decryptStr,
    isEmail,
    getOtp,
    verifySocialToken
}