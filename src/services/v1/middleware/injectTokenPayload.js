/* 
* Middleware to used for forms submission to check if token present,
 * inject decode and inject payload into req
*/
module.exports = (req, res, next) => {
    //
    const authHeader = req.headers.authorization;
    const audience = req.headers.origin;
    let options = {
        issuer: process.env.HOST,
        audience: audience,
        algorithm:  ["RS256"],
    }
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        const verifiedToken = require("../auth/auth").verifyToken(token, options);
        if(verifiedToken) {
            req.user = verifiedToken.user
            next();
        } else {
            return res.status(200).send({
                code:DEFAULT_CODES.INVALID_TOKEN.code,
                success:false,
                message: DEFAULT_CODES.INVALID_TOKEN.message,
                data: {}
            })   
        }
    } else {
        next();
    }
}