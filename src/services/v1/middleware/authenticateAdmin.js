
const DEFAULT_CODES = require("../../../utils/defaultCode").DEFAULT_CODES;
const fs   = require('fs');
const jwt  = require('jsonwebtoken');
require('dotenv').config();
let publicKEY = process.env.ACCESS_KEY_ADMIN_JWT_TOKEN
module.exports  = async (req, res, next) => {
    try {       
        const authHeader = req.headers.authorization;
        let options = {
            issuer: process.env.API_BACKEND_URL,
            audience: ""
        }
        if (authHeader) {
            const token = authHeader;
            let authTokenRes =  await jwt.verify(token, publicKEY, options);            
            if(!authTokenRes) {
                return res.status(200).send({
                    code:DEFAULT_CODES.INVALID_TOKEN.code,
                    success:false,
                    message: DEFAULT_CODES.INVALID_TOKEN.message,
                    data: {}
                })   
            } else {                
                next();           
            }
        } else {
            return res.status(200).send({
                code:DEFAULT_CODES.INVALID_TOKEN.code,
                success:false,
                message: DEFAULT_CODES.INVALID_TOKEN.message,
                data: {}
            })   
        }
    } catch (error) {
        console.log("token verification  erorr", error)
        return res.status(500).json({
            'code': 'SERVER_ERROR',
            'description': 'something went wrong, Please try again'
        });
    }

    
};

