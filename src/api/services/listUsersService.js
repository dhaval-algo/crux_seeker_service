'use strict';

const validators = require("../../utils/validators")
const { parseQueryFilters } = require('../utils/general');
const { sequelize, Sequelize:{ Op } } = require("../../../models")
const models = require("../../../models")

//whitelist: allow only this attributes to filter;
const filterList = ["id","gender", "verified", "city", "country", "status", "phoneVerified","userType",
"updatedAt", "createdAt", "fullName", "email", "phone", "lastLogin", "dob"]

const buildConfigUsersById = (req)=> {

    try{
        const { page, limit } = validators.validatePaginationParams({ page: req.query.page, limit: req.query.limit })
        let { id = ""} = req.query;
        let offset = (page-1) * limit, where = {}, order;
    
        id = id.trim();
        if(id != ''){
            id = id.split(',');
            where.id = { [Op.or]:  id };
        }

        let sort = { key:'updatedAt', order: "desc" };
        order = sequelize.literal(`"${sort.key}" ${sort.order}`);
        let attributes = ['id', 'fullName','email', 'phone'];

        return { where: {where, attributes, order, offset, limit, page}, sort };
    }
    catch(err){
        console.log(err)
        return err.message;
    }
}



const buildConfig = (req)=> {

        try{
            const { page, limit } = validators.validatePaginationParams({ page: req.query.page, limit: req.query.limit })
            let { sort = "", f = "", q = ""} = req.query;
            let offset = (page-1) * limit, where = {}, order;
        
            sort = sort.trim()
            if(!sort)
                sort = {key:'updatedAt', order:"desc"}
            else
            {
                sort = sort.trim().split(':')
                sort = {key : sort[0], order: sort[1]}
            }

            f = f.trim();
            if(f != "")
                f = parseQueryFilters(f);

            q = q.trim();
            if(q != ""){
                where = { [Op.or] : {fullName:{[Op.iLike]: "%"+q+"%"}, city:{[Op.iLike]: "%"+q+"%"},
                        country:{[Op.iLike]: q+"%"}, email:{[Op.iLike]: "%"+q+"%"}, phone:{[Op.iLike]: q+"%"}} }
            }
        
            //if not search then filter, but not both at a time 
            else if( f.length ){

                for (var filter of f) {
                    if(filterList.includes(filter.key))
                    {
                        if(filter.key == "createdAt" || filter.key =="updatedAt" || filter.key =="lastLogin" || filter.key == "dob")
                            where[filter.key] = {[Op.between]: [filter.value[0], filter.value[1] ? filter.value[1] : new Date()]}
                        else
                            where[filter.key] = {[Op.or]: filter.value }
                    }
                    else
                        return {err:{message:"Filters: unsupported key "}}
                }
            }

            order = sequelize.literal(`"${sort.key}" ${sort.order}`)
            return {where: {where, order, offset, limit, page}, sort }
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
    buildConfigUsersById,
    buildConfig,
    queryUser,
}