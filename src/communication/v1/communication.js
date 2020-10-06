const emalTemplate = require("./template.js");
const awsService = require("../aws/awsService");
const emailConfig = require("../../../config/email");
const emailProviders = require("./emailProviders");
const SEND_USER_EMAIL = (process.env.SEND_USER_EMAIL == 'true');

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

    sendEmail:function(payload){
        console.log("payload",payload)
        let thatObj = this
        return new Promise(async (resolve, reject) => { 
            try{            
                let getTemplate = thatObj.getTemplateData(payload.email_type,payload.email_data)
                if(!getTemplate){
                    return resolve(false);
                }
                let fromemail = payload.fromemail
                let toemail = payload.toemail
                let ccaddress = payload.ccaddress
                let bccaddress = payload.bccaddress
                let subject = getTemplate.subject
                let message = getTemplate.message

                console.log(SEND_USER_EMAIL)
                //test mail mode
                if(!SEND_USER_EMAIL){
                    fromemail = emailConfig.test.fromemail
                    toemail = emailConfig.test.toemail
                    ccaddress = emailConfig.test.ccaddress
                    bccaddress = emailConfig.test.bccaddress
                }
                console.log("fromemail",fromemail)
                console.log("toemail",toemail)
                console.log("ccaddress",ccaddress)

                if(process.env.MAIL_PROVIDER == 'MAILGUN'){
                    emailProviders.mailGunEmail(subject,message,fromemail,toemail,ccaddress,bccaddress)
                }
                else if(process.env.MAIL_PROVIDER == 'SES'){
                    emailProviders.sendEmailSES(subject,message,fromemail,toemail,ccaddress,bccaddress)
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

    getTemplateData: (type,templateData) => {
        let template = false
        if(type == 'activiation_mail'){
            template =  emalTemplate.activiationLink(templateData)
        }
        
        return template;

    },

 
  



}

 