'use strict';
require('dotenv').config();
const { sequelize } = require("../models");
const crypto = require("crypto")


/*
this is one time run script to copy user data from old schema to new user schema
*/

const models = require("../models")
const Cryptr = require('cryptr');
const crypt = new Cryptr(process.env.CRYPT_SALT);
const decryptStr = (str) => {
    return crypt.decrypt(str);
};

const UpdateUserFields = async () => {
    try {
            
        
        const usersData =  await models.user_meta.findAll({
            attributes:['value', "key","userId"],    
            where:{
            key :['firstName', 'lastName', 'email', 'phone'],
                metaType:'primary'
            }    
        });
        let userFinalData ={}
        for (let user of usersData)
        {
            if(userFinalData[user.userId])
            {
                userFinalData[user.userId] =  {
                    ...userFinalData[user.userId], ...{
                        [user.key] : user.value
                    } 
                }
            }else{
                userFinalData[user.userId] = {
                        [user.key] : user.value
                } 
            }  
        }   

        for ( const [key, value] of Object.entries(userFinalData))
        {
            let userExist = await models.user.findOne({where:{ email: value.email}})
            let regexEmail = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
         
            if(!userExist && value.email.match(regexEmail))
            {
                await models.user.update(
                    {
                        fullName: value.firstName+ " "+ value.lastName,
                        email: value.email,
                        phone: value.phone
                    },
                    {
                        where :{
                            id: parseInt(key)
                        }
                    }
                )
            }
        
        
        }


        const userLogins = await models.user_login.findAll({where:{provider:'local'}})
        for(let userLogin of userLogins)
        {
            // if(userLogin.password != null)
            // {
            //     let password =  decryptStr (userLogin.password)
            //     const userSalt = crypto.randomBytes(16).toString('hex');
            //     const finalSalt = process.env.PASSWORD_SALT + userSalt
            //     const passwordHash = crypto.pbkdf2Sync(password, finalSalt, 
            //     parseInt(process.env.PASSWORD_HASH_ITERATION), 64, `sha512`).toString(`hex`);
            //     await models.user_login.update(
            //         {
            //             password: passwordHash,
            //             passwordSalt:userSalt

            //         },
            //         {where:{userId:userLogin.userId}}
            //     )
            // }
        }
    } catch (error) {
            console.log("error", error)
    }

}




UpdateUserFields()