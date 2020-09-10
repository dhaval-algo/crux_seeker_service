'use strict';

const fs   = require('fs');
const jwt  = require('jsonwebtoken');

let privateKEY  = fs.readFileSync('../../../keys/private.key', 'utf8');
let publicKEY  = fs.readFileSync('../../../keys/public.key', 'utf8'); 

const signToken = (payload,options) => {
    let signOptions = {
        issuer: '',
        audience: '',
        expiresIn: '2d',
        algorithm:  "RS256",
        ...options
    }
    return jwt.sign(payload, privateKEY, signOptions);
}

const verifyToken = (token, options) => {
    let verifyOptions = {
        issuer: '',
        audience: '',
        algorithm:  "RS256",
        ...options
    }
    try{
        return jwt.verify(token, publicKEY, verifyOptions);
    } catch (err){
        return false;
    }
}

const decodeToken = (token) => {
    return jwt.decode(token, {complete: true});
}

module.exports = { signToken, verifyToken, decodeToken };