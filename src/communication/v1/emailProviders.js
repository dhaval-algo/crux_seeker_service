// const nodemailer = require("nodemailer");
const api_key = process.env.MAILGUN_APIKEY;
const domain = process.env.MAILGUN_DOMAIN;
const mailgun = require('mailgun-js')({apiKey: api_key, domain: domain});


module.exports = {
   
   mailGunEmail: function(subject,message,fromemail,toemail,ccaddress=[],bccaddress=[],replytoaddress=[]){
        return new Promise(async (resolve, reject) => {
            try{
                
                let data = {
                  from: fromemail,
                  to: toemail,
                  subject: subject,
                  text: message
                };
                 
                mailgun.messages().send(data, function (error, body) {
                   console.log(body);
                  return resolve(body)
                });
            }
            catch(err)
            {
              console.log("err",err)
                return resolve(err)
            }
        })
         
    },

    sendEmailSES: function(subject,message,fromemail,toemail,ccaddress=[],bccaddress=[],replytoaddress=[]){
        return new Promise(async (resolve, reject) => {
            var AWS = require('aws-sdk');      
            let app_env = process.env.ENV

            // Create sendEmail params 
            let params = {
                Destination: { /* required */
                    CcAddresses: ccaddress,
                    ToAddresses: [toemail]
                },
                Message: { /* required */
                    Body: { /* required */
                        Html: {
                            Charset: "UTF-8",
                            Data: message
                        },
                        Text: {
                            Charset: "UTF-8",
                            Data: "TEXT_FORMAT_BODY"
                        }
                    },
                    Subject: {
                        Charset: 'UTF-8',
                        Data: subject
                    }
                },
                Source: fromemail, /* required */
                ReplyToAddresses: replytoaddress,
            };

            // Create the promise and SES service object
            var sendPromise = new AWS.SES({region: process.env.AWS_REGION, accessKeyId: process.env.AWS_ACCESS_KEY, secretAccessKey: process.env.AWS_SECRET_KEY}).sendEmail(params).promise();

            // Handle promise's fulfilled/rejected states
            sendPromise.then(
              function(data) {
                console.log(data);
                return resolve(data);
              }).catch(
                function(err) {
                console.error(err, err.stack);
                return reject(err, err.stack);
              });
        });
    },

        
}

 