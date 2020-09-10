import { verifyToken } from "../auth/auth";
import { ERROR_CODE } from "../../utils/errorCode";

export const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const audience = req.headers.host;
    let options = {
        issuer: process.env.HOST,
        audience: audience,
        algorithm:  ["RS256"],
    }
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        const verifiedToken = verifyToken(token, options);
        if(verifiedToken) {
            req.user = verifyToken.user
            next();
        } else {
            return res.status(200).send({
                code:ERROR_CODE.INVALID_TOKEN.code,
                success:false,
                message: ERROR_CODE.INVALID_TOKEN.message,
                data: {}
            })   
        }
    } else {
        return res.status(200).send({
            code:ERROR_CODE.INVALID_TOKEN.code,
            success:false,
            message: ERROR_CODE.INVALID_TOKEN.message,
            data: {}
        })   
    }
};

