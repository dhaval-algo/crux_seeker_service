const axios = require("axios");
const path = require('path');
const fs = require("fs");
const handlebars = require("handlebars");

module.exports = {

 
    activiationLink: function(messagData){
        let templatesPath = path.join(__dirname, './templates/verifyemail2.hbs');

        let source = fs.readFileSync(templatesPath, 'utf8');
        let template = handlebars.compile(source);
        let emailTemplate = template({ full_name: messagData.full_name,account_email: messagData.account_email,verification_link: messagData.verification_link, resource_link:process.env.SERVER_URL });
         
        let templateData = {subject:'Verify Your Careervira Account',message:emailTemplate};
 
        return templateData 
         
    },
   
    welcomeEmail: function(messagData){
        let templatesPath = path.join(__dirname, './templates/welcome2.hbs');

        let source = fs.readFileSync(templatesPath, 'utf8');
        let template = handlebars.compile(source);
        let emailTemplate = template({resource_link:process.env.SERVER_URL });
         
        let templateData = {subject:'Welcome to Careervira',message:emailTemplate};
 
        return templateData 
         
    },

    resetPasswordEmail: function(messagData){
        let templatesPath = path.join(__dirname, './templates/resetpassword-email2.hbs');

        let source = fs.readFileSync(templatesPath, 'utf8');
        let template = handlebars.compile(source);
        let emailTemplate = template({reset_link:messagData.reset_link, resource_link:process.env.SERVER_URL });
         
        let templateData = {subject:'Careervira- Reset Password',message:emailTemplate};
 
        return templateData 
         
    },

    contactEmail: function(messagData){
        let templatesPath = path.join(__dirname, './templates/contact-email.hbs');

        let source = fs.readFileSync(templatesPath, 'utf8');
        let template = handlebars.compile(source);
        let emailTemplate = template({name: messagData.name,email: messagData.email,phone: messagData.phone,comment: messagData.comment, resource_link:process.env.SERVER_URL });
         
        let templateData = {subject:'Careervira- Contact Us',message:emailTemplate};
 
        return templateData 
         
    }, 

    feedbackEmail: function(messagData){
        let templatesPath = path.join(__dirname, './templates/feedback-email.hbs');

        let source = fs.readFileSync(templatesPath, 'utf8');
        let template = handlebars.compile(source);
        let emailTemplate = template({name: messagData.name,email: messagData.email,phone: messagData.phone,comment: messagData.comment, resource_link:process.env.SERVER_URL });
         
        let templateData = {subject:'Careervira- Feedback',message:emailTemplate};
 
        return templateData 
         
    },

    suspendedEmail: function(messagData){
        let templatesPath = path.join(__dirname, './templates/suspended-mail.hbs');

        let source = fs.readFileSync(templatesPath, 'utf8');
        let template = handlebars.compile(source);
        let emailTemplate = template({resource_link:process.env.SERVER_URL });
         
        let templateData = {subject:'Your Account is Suspended',message:emailTemplate};
 
        return templateData 
         
    },

    reactivatedEmail: function(messagData){
        let templatesPath = path.join(__dirname, './templates/reactivated-mail.hbs');

        let source = fs.readFileSync(templatesPath, 'utf8');
        let template = handlebars.compile(source);
        let emailTemplate = template({resource_link:process.env.SERVER_URL });
         
        let templateData = {subject:'Your Account is Reactivated',message:emailTemplate};
 
        return templateData 
         
    },


    

}

 