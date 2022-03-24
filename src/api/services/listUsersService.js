'use strict';

const validators = require("../../utils/validators")
const { sequelize, Sequelize:{ Op } } = require("../../../models")

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
                        if(filter.key == "createdAt" || filter.key =="updatedAt")
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

module.exports = {
    buildConfig,
}