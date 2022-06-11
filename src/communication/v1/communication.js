const emailTemplate = require("./template.js");
// const emailConfig = require("../../../config/email");
const emailProviders = require("./emailProviders");
// const SEND_USER_EMAIL = (process.env.SEND_USER_EMAIL == 'true');
var request = require("request");
const crypto = require('crypto');

function getEncryptedData(data){
    let queryString = "";
    for(const [key, value] of Object.entries(data)){
        queryString = queryString + key + "=" + value + "&";
    }
    queryString = queryString.slice(0,-1);
    queryString = Buffer.from(queryString, 'utf-8').toString();
    /**
     * Querystring is the data that is encrypted.
     * It is making sure password is also encrypted.
     */
    const GCM_IV_LENGTH = 12;
    const GCM_TAG_LENGTH_BYTES = 16;
    const GIVEN_KEY = process.env.SMS_GUPSHUP_HASH_KEY;//32 byte key
    const ALGO = "aes-256-gcm";

    //initialization vector
    const iv = Buffer.from(crypto.randomBytes(GCM_IV_LENGTH), 'utf8');

    //key decoding
    let decodedKey = Buffer.from(GIVEN_KEY, 'base64');

    //initializing the cipher
    const cipher = crypto.createCipheriv(ALGO, decodedKey, iv, { authTagLength: GCM_TAG_LENGTH_BYTES })
    cipher.setAutoPadding(false);

    //running encryption
    const encrypted = Buffer.concat([cipher.update(queryString, 'utf8')]);
    cipher.final()

    //Obtaining auth tag
    tag = cipher.getAuthTag();
    const finalBuffer = Buffer.concat([iv, encrypted, tag]);

    //converting string to base64
    const finalString = finalBuffer.toString('base64');

    //making the string url safe
    const urlSafeString = finalString.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    return urlSafeString;
}

module.exports = {

    /****
    payload {
        fromemail : ''
        toemail : ''
        ccaddress: []
        bccaddress : []
        email_data : {name:  , mobile:   }
        email_type: 
    }
    *///

    sendEmail:function(payload,useQueue=false){
        let thatObj = this
        return new Promise(async (resolve, reject) => { 
            try{            
                let getTemplate = module.exports.getTemplateData(payload.email_type, payload.email_data)
                if(!getTemplate){
                    return resolve(false);
                }
                let fromemail = payload.fromemail
                let toemail = payload.toemail
                let ccaddress = payload.ccaddress
                let bccaddress = payload.bccaddress
                let subject = getTemplate.subject
                let message = getTemplate.message

                // console.log(SEND_USER_EMAIL)
                //test mail mode
                // if(!SEND_USER_EMAIL){
                //     fromemail = emailConfig.test.fromemail
                //     toemail = emailConfig.test.toemail
                //     ccaddress = emailConfig.test.ccaddress
                //     bccaddress = emailConfig.test.bccaddress
                // }


                if(process.env.MAIL_PROVIDER == 'MAILGUN'){
                    // emailProviders.mailGunEmail(subject,message,fromemail,toemail,ccaddress,bccaddress)
                }
                else if(process.env.MAIL_PROVIDER == 'SES'){
                    await emailProviders.sendEmailSES(subject,message,fromemail,toemail,ccaddress,bccaddress)
                }
                else if(process.env.MAIL_PROVIDER == 'SANDGRID'){
                    
                }
                else if(process.env.MAIL_PROVIDER == 'MAILCHIMP'){
                    
                }
                return resolve(true);
            }
            catch(err){
                console.log("sendEmail:",err)
                return resolve(err);
            }
            

        })
          
        
    },

    getTemplateData: (type, templateData) => {
        let template = false
        switch (type) {
            case 'activiation_mail':
                return emailTemplate.activiationLink(templateData)
            case 'welcome_mail':
                return emailTemplate.welcomeEmail(templateData);
            case 'resetpassword_mail':
                return emailTemplate.resetPasswordEmail(templateData)
            case 'contact_email':
                return emailTemplate.contactEmail(templateData)
            case 'feedback_email':
                return emailTemplate.feedbackEmail(templateData)
            case 'suspended_mail':
                    return emailTemplate.suspendedEmail(templateData)
            case 'reactivated_mail':
                        return emailTemplate.reactivatedEmail(templateData)
            case 'reset_email_to_new':
                return emailTemplate.resetEmailToNew(templateData)
            case 'reset_email_to_old':
                return emailTemplate.resetEmailToOld(templateData)
            case 'enquiry_email_to_partner':
                return emailTemplate.enquiryEmailToPartner(templateData)
            case 'enquiry_email_to_admins':
                return emailTemplate.enquiryEmailToAdmins(templateData)
            default:
                return false
                break;
        }


    },

    sendSMS:function(phone, message, dltTemplateId){

        let thatObj = this
        return new Promise(async (resolve, reject) => { 
            try{
                if(process.env.SENDSMS == "true"){            
                    switch ( process.env.SMS_PROVIDER) {
                        case "smsgupshup":
                            var data=
                            {
                                method: 'SendMessage',// "Here SendMessage is different that unencrypted sendMessage code"
                                send_to: phone,
                                msg: message,
                                msg_type: 'TEXT',
                                auth_scheme: 'PLAIN',
                                password: process.env.SMS_GUPSHUP_PASSOWRD,
                                format: 'JSON',
                                v:1.1
                            }
                            var options = { method: 'POST',
                            url: process.env.SMS_GUPSHUP_URL,
                            form: 
                            {
                                userid: process.env.SMS_GUPSHUP_USERID,
                                encrdata: getEncryptedData(data),
                                principalEntityId:process.env.SMS_GUPSHUP_PE_ID,
                                dltTemplateId: dltTemplateId,
                                mask: 'CVIOTP'
                            } 
                            };
                                request(options, function (error, response, body) {
                                if (error) throw new Error(error);
                                console.log(body);
                            });


                            
                            break;
                    
                        default:
                            break;
                    }
                }
                return resolve(true);
            }
            catch(err){
                console.log("sendSMS:",err)
                return resolve(err);
            }
            

        })
          
        
    },

 
  



}

 