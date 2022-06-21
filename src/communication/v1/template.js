const axios = require("axios");
const path = require('path');
const fs = require("fs");
const handlebars = require("handlebars");

/*Create partials for Email header and footer*/
let emailHeaderTemplatesPath = path.join(__dirname, './templates/emailHeader.hbs');
let emailHeaderTemplatSource = fs.readFileSync(emailHeaderTemplatesPath, 'utf8');
let emailHeaderTemplate = handlebars.compile(emailHeaderTemplatSource);
handlebars.registerPartial('emailHeader', emailHeaderTemplate);
let emailFooterTemplatesPath = path.join(__dirname, './templates/emailFooter.hbs');
let emailFooterTemplatSource = fs.readFileSync(emailFooterTemplatesPath, 'utf8');
let emailFooterTemplate = handlebars.compile(emailFooterTemplatSource);
handlebars.registerPartial('emailFooter', emailFooterTemplate);


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

    resetEmailToNew: function(messagData){
        let templatesPath = path.join(__dirname, './templates/reset-email-to-new.hbs');

        let source = fs.readFileSync(templatesPath, 'utf8');
        let template = handlebars.compile(source);
        let emailTemplate = template({otp:messagData.otp, resource_link:process.env.SERVER_URL });
         
        let templateData = {subject:'Careervira- Reset Email',message:emailTemplate};
        return templateData 
         
    },
    
    enquiryEmailToPartner: function(messagData){
        let templatesPath = path.join(__dirname, './templates/enquiryEmailToPartner.hbs');

        let source = fs.readFileSync(templatesPath, 'utf8');
        let template = handlebars.compile(source);
        let emailTemplate = template({
            student:messagData.student,
            highestDegree:messagData.highestDegree,
            experience: messagData.experience,
            enquiryMessage: messagData.enquiryMessage,
            courseImgUrl:messagData.courseImgUrl,
            course_name:messagData.course_name,
            provider:messagData.provider,
            full_name:messagData.full_name,
            email:messagData.email,
            phone:messagData.phone,
            city:messagData.city
        });
         
        let templateData = {subject:'New Enquiry',message:emailTemplate};
 
        return templateData 
         
    },

    resetEmailToOld: function(messagData){
        let templatesPath = path.join(__dirname, './templates/reset-email-to-old.hbs');

        let source = fs.readFileSync(templatesPath, 'utf8');
        let template = handlebars.compile(source);
        let emailTemplate = template({old_email:messagData.old_email, new_email:messagData.new_email, resource_link:process.env.SERVER_URL });
         
        let templateData = {subject:'Careervira- Reset Email',message:emailTemplate};
 
        return templateData 
         
    }


    

}

 