const authenticate  = require("./authenticate");

const recommendationTypes = ["top-picks-for-you","recently-viewed-courses","recently-searched-courses","people-are-also-viewing","recently-viewed-articles","recently-searched-articles"];

module.exports =  async (req, res, next) =>{

    const {type} = req.query;
    if(recommendationTypes.includes(type)) authenticate(req,res,next);
    else next();
}