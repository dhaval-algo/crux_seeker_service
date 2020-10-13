const axios = require("axios");
const path = require('path');
const fs = require("fs");
const handlebars = require("handlebars");

module.exports = {

 
    activiationLink: function(messagData){
        let templatesPath = path.join(__dirname, './templates/verification-email.hbs');

        let source = fs.readFileSync(templatesPath, 'utf8');
        let template = handlebars.compile(source);
        let emailTemplate = template({ full_name: messagData.full_name,account_email: messagData.account_email,verification_link: messagData.verification_link, resource_link:process.env.SERVER_URL });
         
        let templateData = {subject:'Verify your crux account',message:emailTemplate};
 
        return templateData 
         
    },
   
    welcomeEmail: function(messagData){
        let templatesPath = path.join(__dirname, './templates/welcome-mail.hbs');

        let source = fs.readFileSync(templatesPath, 'utf8');
        let template = handlebars.compile(source);
        let emailTemplate = template({resource_link:process.env.SERVER_URL });
         
        let templateData = {subject:'Welcome To Crux',message:emailTemplate};
 
        return templateData 
         
    },

}

 