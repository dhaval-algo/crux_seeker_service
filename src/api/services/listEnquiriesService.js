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
            where = { [Op.or] : {fullName:{[Op.iLike]: "%"+search+"%"}, enquiryMessage:{[Op.iLike]: "%"+search+"%"},
                    courseName:{[Op.iLike]: search+"%"}, email:{[Op.iLike]: "%"+search+"%"}, phone:{[Op.iLike]: search+"%"},
                highestDegree:{[Op.iLike]: '%'+search+'%'}}}
        }
    
        //if not search, then filter, but not both at a time 
        else if(filters.length > 0 ){
            //whitelist: allow only this attributes to filter;
            const filterList = ["id","fullName", "email", "phone", "student","experience","courseName","courseId",
            "userId","partnerId","updatedAt", "createdAt","loggedIn"]
    
            for (var filter of filters) {
                if(filterList.includes(filter.key)){
                    if(filter.key == "createdAt" || filter.key =="updatedAt" || filter.key == "experience")
                        where[filter.key] = {[Op.between]: [filter.lower, filter.upper]}
                    else if(filter.key == "loggedIn")
                        filter.value ? where.userId = {[Op.not] : null} : where.userId = null
                    else
                        where[filter.key] = filter.value
                }
                else
                    return {err:{message:"Filters: unsupported key "}}
                    
            }
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

const buildConfigLearnpath = (req)=> {

    try{
        const { page = 1, limit = 10 } = validators.validatePaginationParams({ page: req.body.page, limit: req.body.limit })
        let { sort = "", filters = [], search = ""} = req.body
        let offset = (page-1) * limit, where = {}, order = sequelize.literal('"updatedAt" DESC')
    
    
        search = search.trim()
        if(search != ""){
            where = { [Op.or] : {fullName:{[Op.iLike]: "%"+search+"%"}, enquiryMessage:{[Op.iLike]: "%"+search+"%"},
                    learnpathName:{[Op.iLike]: search+"%"}, email:{[Op.iLike]: "%"+search+"%"}, phone:{[Op.iLike]: search+"%"},
                highestDegree:{[Op.iLike]: '%'+search+'%'}}}
        }
    
        //if not search, then filter, but not both at a time 
        else if(filters.length > 0 ){
            //whitelist: allow only this attributes to filter;
            const filterList = ["id","fullName", "email", "phone", "student","experience","learnpathName","learnpathId",
            "userId","updatedAt", "createdAt","loggedIn"]
    
            for (var filter of filters) {
                if(filterList.includes(filter.key)){
                    if(filter.key == "createdAt" || filter.key =="updatedAt" || filter.key == "experience")
                        where[filter.key] = {[Op.between]: [filter.lower, filter.upper]}
                    else if(filter.key == "loggedIn")
                        filter.value ? where.userId = {[Op.not] : null} : where.userId = null
                    else
                        where[filter.key] = filter.value
                }
                else
                    return {err:{message:"Filters: unsupported key "}}
                    
            }
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
    buildConfigLearnpath,
}