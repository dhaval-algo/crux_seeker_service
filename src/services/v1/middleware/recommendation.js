const authenticate  = require("./authenticate");


module.exports =  async (req, res, next) =>{

    const {type} = req.query;
    if(type=='top-picks-for-you') authenticate(req,res,next);
    else next();
}