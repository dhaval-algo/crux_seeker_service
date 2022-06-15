const authenticate  = require("./authenticate");

const recommendationTypes = ["top-picks-for-you","recently-viewed-courses","recently-searched-courses","people-are-also-viewing","recently-viewed-articles","recently-searched-articles","enquiry-based-recommendation","wishlist-based-recommendation","learn-paths-recommendations","courses-recommendation","article-recommendation"];

module.exports =  async (req, res, next) =>{

    const {type} = req.query;
    if(recommendationTypes.includes(type)) authenticate(req,res,next);
    else next();
}