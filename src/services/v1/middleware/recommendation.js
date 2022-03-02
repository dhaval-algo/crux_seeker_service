const authenticate  = require("./authenticate");

const recommendationTypes = ["top-picks-for-you","recently-viewed-courses","recently-searched-courses"]

module.exports =  async (req, res, next) =>{

    const {type} = req.query;
    if(recommendationTypes.includes(type)) authenticate(req,res,next);
    else next();
}