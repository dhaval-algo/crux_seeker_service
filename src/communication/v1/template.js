const axios = require("axios");
const path = require('path');
const fs = require("fs");
const handlebars = require("handlebars");

module.exports = {

 
    activiationLink: function(messagData){
        let templatesPath = path.join(__dirname, './templates/activation-mail.hbs');

        let source = fs.readFileSync(templatesPath, 'utf8');
        let template = handlebars.compile(source);
        let emailTemplate = template({ full_name: messagData.full_name,account_email: messagData.account_email,verification_link: messagData.verification_link });
         
        let templateData = {subject:'Welcome To TMC',message:emailTemplate};
 
        return templateData 
         
    },
   

}

 