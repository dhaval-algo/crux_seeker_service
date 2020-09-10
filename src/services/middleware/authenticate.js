import { verifyToken } from "../auth/auth";

export const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const audience = req.headers.host;
    let options = {
        issuer: process.env.HOST,
        audience: audience,
        algorithm:  "RS256",
    }
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        const verifiedToken = verifyToken(token, options);
        jwt.verify(token, accessTokenSecret, (err, user) => {
            if (err) {
                return res.sendStatus(403);
            }

            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401);
    }
};

