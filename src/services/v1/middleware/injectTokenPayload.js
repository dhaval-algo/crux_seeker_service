/* 
* Middleware to used for forms submission to check if token present,
 * inject decode and inject payload into req
*/
module.exports = async (req, res, next) => {

    const authHeader = req.headers.authorization;
    const audience = req.headers.origin || "";
    let options = {
        issuer: process.env.HOST,
        audience: audience || "",
        algorithm: ["RS256"],
    }
    let verifiedToken = null;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        verifiedToken = await require("../auth/auth").verifyToken(token, options);
        if (verifiedToken) {
            req.user = verifiedToken.user

        }
    } else {

        const segmentId = req.headers.segmentId;
        if (!req.user) {
            req.user = {};
        }

        req.user.segmentId = 'seg_uid_123456';
        //req.user.userId = segmentId;
    }
    next();
}