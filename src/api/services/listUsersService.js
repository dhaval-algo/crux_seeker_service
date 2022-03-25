'use strict';

const validators = require("../../utils/validators")
const { sequelize, Sequelize:{ Op } } = require("../../../models")
const models = require("../../../models")

const buildConfig = (req)=> {

        try{
            const { page = 1, limit = 10 } = validators.validatePaginationParams({ page: req.body.page, limit: req.body.limit })
            let { sort = "", filters = [], search = ""} = req.body
            let offset = (page-1) * limit, where = {}, order = sequelize.literal('"updatedAt" DESC')
        
        
            search = search.trim()
            if(search != ""){
                where = { [Op.or] : {fullName:{[Op.iLike]: "%"+search+"%"}, city:{[Op.iLike]: "%"+search+"%"},
                        country:{[Op.iLike]: search+"%"}, email:{[Op.iLike]: "%"+search+"%"}, phone:{[Op.iLike]: search+"%"}} }
            }
        
            //if not search then filter, but not both at a time 
            else if(filters.length > 0 ){
                //whitelist: allow only this attributes to filter;
                const filterList = ["gender", "verified", "city", "country", "status", "phoneVerified","userType",
                                    "updatedAt", "createdAt", "fullName", "email", "phone", "lastLogin"]
        
                filters.forEach(filter => {
                    if(filterList.includes(filter.key))
                        if(filter.key == "createdAt" || filter.key =="updatedAt" || filter.key =="lastLogin")
                            where[filter.key] = {[Op.between]: [filter.lower, filter.upper]}
                        else
                            where[filter.key] = filter.value
                })
            }
        
            if(sort != "")
                order = sequelize.literal(`"${sort.key}" ${sort.order}`)
            return {where, order, offset, limit}
        }
        catch(err){
            console.log(err)
            return err.message
        }
}

const queryUser = (id) =>{
    return new Promise(async (resolve, reject) => {
        const personal = await models.user.findOne({ where:{id} })
        if(personal == null)
            return reject({error:true, message:"No user with provided id"})
        const education = await models.user_education.findAll({ where:{userId:id} })
        const experience = await models.user_experience.findAll({ where:{userId:id} })
        const goals = await models.goal.findAll({where:{userId:id}})
        const courseWishlist = await models.user_meta.findAll({where:{userId:id, key:"course_wishlist"}})
        const learnpathWishlist = await models.user_meta.findAll({where:{userId:id, key:"learnpath_wishlist"}})
        const courseEnquiries = await models.enquiry.findAll({where:{userId:id}})
        const learnpathEnquiries = await models.learnpath_enquiry.findAll({where:{userId:id}})
        return resolve({success:true, user:{personal, education, experience,
            goals, courseWishlist, learnpathWishlist, courseEnquiries,learnpathEnquiries}})
    })
}
module.exports = {
    buildConfig,
    queryUser,
}