const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const csv =require("csvtojson/v2");
const axios = require('axios')
const models = require("../../../../models");
const redisConnection = require('../redis');
const RedisConnection = new redisConnection();

const fetchSuggestGoals = async (req, res, skipCache) => {
    const {searchType} = req.query
    let useCache = false
    let data = []
    try {
        if(searchType){
            if(searchType != 'current_role' && searchType != 'preferred_role' && searchType != 'industry_choice' && searchType != 'preferred_skill' && searchType != 'highest_degree' && searchType != 'specialization'){
                throw "Invalid Search Query"
            }
            if(searchType == "current_role"){
                const currentRoleCacheKey = "current-role";
                if(skipCache !=true) {
                    let cacheData = await RedisConnection.getValuesSync(currentRoleCacheKey);
                    if(cacheData.noCacheData != true) {
                        return res.status(200).send({success: true, message: 'Fetched successfully!', options: cacheData})
                        useCache = true
                    }            
                }
                if(useCache !=true)
                {
                    const dataObj =  await models.goal.findAll({
                        attributes: [[Sequelize.fn('count', Sequelize.col('id')), "count"], "currentRole"],         
                        group: ['currentRole'],
                        where: {
                            "currentRole": {
                              [Op.ne]: ""
                            }
                        },
                        limit:10,
                        raw:true,
                        order: Sequelize.literal('count DESC')
                    })
                    for(let key of dataObj){
                        data.push(key["currentRole"])
                    }
                    
                    if(data)
                    {
                        RedisConnection.set(currentRoleCacheKey, data);
                    }
                    return res.status(200).send({success: true, message: 'Fetched successfully!', options: data})
                }
                
            }else if(searchType == "preferred_role"){
                const preferredRoleCacheKey = "preferred-role";
                if(skipCache !=true) {
                    let cacheData = await RedisConnection.getValuesSync(preferredRoleCacheKey);
                    if(cacheData.noCacheData != true) {
                        return res.status(200).send({success: true, message: 'Fetched successfully!', options: cacheData})
                        useCache = true
                    }            
                }
                if(useCache !=true)
                {
                    const dataObj =  await models.goal.findAll({
                        attributes: [[Sequelize.fn('count', Sequelize.col('id')), "count"], "preferredRole"],         
                        group: ['preferredRole'],
                        where: {
                            "preferredRole": {
                              [Op.ne]: ""
                            }
                        },
                        limit:10,
                        raw:true,
                        order: Sequelize.literal('count DESC')
                    })
                    for(let key of dataObj){
                        data.push(key["preferredRole"])
                    }
                    
                    if(data)
                    {
                        RedisConnection.set(preferredRoleCacheKey, data);
                    }
                    return res.status(200).send({success: true, message: 'Fetched successfully!', options: data})
                }

            }else if(searchType == "industry_choice"){
                const industryChoiceCacheKey = "industry-choice";
                if(skipCache !=true) {
                    let cacheData = await RedisConnection.getValuesSync(industryChoiceCacheKey);
                    if(cacheData.noCacheData != true) {
                        return res.status(200).send({success: true, message: 'Fetched successfully!', options: cacheData})
                        useCache = true
                    }            
                }
                if(useCache !=true)
                {
                    const dataObj =  await models.goal.findAll({
                        attributes: [[Sequelize.fn('count', Sequelize.col('id')), "count"], "industryChoice"],         
                        group: ['industryChoice'],
                        where: {
                            "industryChoice": {
                              [Op.ne]: ""
                            }
                        },
                        limit:10,
                        raw:true,
                        order: Sequelize.literal('count DESC')
                    })
                    for(let key of dataObj){
                        data.push(key["industryChoice"])
                    }
                    
                    if(data)
                    {
                        RedisConnection.set(industryChoiceCacheKey, data);
                    }
                    return res.status(200).send({success: true, message: 'Fetched successfully!', options: data})
                }

            }else if(searchType == "highest_degree"){
                const degreeCacheKey = "degree";
                if(skipCache !=true) {
                    let cacheData = await RedisConnection.getValuesSync(degreeCacheKey);
                    if(cacheData.noCacheData != true) {
                        return res.status(200).send({success: true, message: 'Fetched successfully!', options: cacheData})
                        useCache = true
                    }            
                }
                if(useCache !=true)
                {
                    const dataObj =  await models.goal.findAll({
                        attributes: [[Sequelize.fn('count', Sequelize.col('id')), "count"], "highestDegree"],         
                        group: ['highestDegree'],
                        where: {
                            "highestDegree": {
                              [Op.ne]: ""
                            }
                        },
                        limit:10,
                        raw:true,
                        order: Sequelize.literal('count DESC')
                    })
                    for(let key of dataObj){
                        data.push(key["highestDegree"])
                    }
                    
                    if(data)
                    {
                        RedisConnection.set(degreeCacheKey, data);
                    }
                    return res.status(200).send({success: true, message: 'Fetched successfully!', options: data})
                }

            }else if(searchType == "specialization"){
                const specializationCacheKey = "specialization";
                if(skipCache !=true) {
                    let cacheData = await RedisConnection.getValuesSync(specializationCacheKey);
                    if(cacheData.noCacheData != true) {
                        return res.status(200).send({success: true, message: 'Fetched successfully!', options: cacheData})
                        useCache = true
                    }            
                }
                if(useCache !=true)
                {
                    const dataObj =  await models.goal.findAll({
                        attributes: [[Sequelize.fn('count', Sequelize.col('id')), "count"], "specialization"],         
                        group: ['specialization'],
                        where: {
                            "specialization": {
                              [Op.ne]: ""
                            }
                        },
                        limit:10,
                        raw:true,
                        order: Sequelize.literal('count DESC')
                    })
                    for(let key of dataObj){
                        data.push(key["specialization"])
                    }
                    
                    if(data)
                    {
                        RedisConnection.set(specializationCacheKey, data);
                    }
                    return res.status(200).send({success: true, message: 'Fetched successfully!', options: data})
                }

            }
            else{
                const preferredSkillCacheKey = "preferred-skill";
                if(skipCache !=true) {
                    let cacheData = await RedisConnection.getValuesSync(preferredSkillCacheKey);
                    if(cacheData.noCacheData != true) {
                        return res.status(200).send({success: true, message: 'Fetched successfully!', options: cacheData})
                        useCache = true
                    }            
                }
                if(useCache !=true)
                {
                    const dataObj =  await models.skill.findAll({
                        attributes: [[Sequelize.fn('count', Sequelize.col('id')), "count"], "name"],         
                        group: ['name'],
                        where: {
                            "name": {
                              [Op.ne]: ""
                            }
                        },
                        limit:10,
                        raw:true,
                        order: Sequelize.literal('count DESC')
                    })
                    for(let key of dataObj){
                        data.push(key["name"])
                    }
                    
                    if(data)
                    {
                        RedisConnection.set(preferredSkillCacheKey, data);
                    }
                    return res.status(200).send({success: true, message: 'Fetched successfully!', options: data})
                }

            }
        }
    } catch (error) {
        console.log(error);
        return res.status(200).send({success: 'success',options:[]})
    }

}

const fetchSuggestions = async (req,res) => {
    const {searchType, searchQuery } = req.query
    try {
        
        if(searchQuery) {
            const dataRecs = await models.default_select_options.findAll({ 
                where: {
                    label:{[Op.iLike]:`%${searchQuery}%`},
                    optionType:searchType
                }
            })

            if(searchType!="institute" && searchType !="company" && searchType !="degree" && searchType !="specialization" && searchType !="job_title" && searchType !="industry") {

                dataRecs.push({value:"Other",label:"Other"})
            }
            return res.status(200).send({success:true,options:dataRecs})
        } else {
             throw "Search query is empty"
        }
    } catch (error) {
        console.log(error);
        return res.status(200).send({success:true,options:[]})
    }

}

const insertDefaultOption = async (req, res) => {
    let filename = 'default_select_options.csv';
    if(req.params.slug)
    {
        const entity = req.params.slug;
        filename = `${entity}.csv`;
    }   
    const jsonArray=await csv().fromFile(`${global.appRoot}/data_files/${filename}`);
    res.status(200).json(jsonArray)
    for(let i=0; i<jsonArray.length;i++){
        let config = {
            where: jsonArray[i],
            raw: true
        }
         let option = await models.default_select_options.findAll(config)
         if(!option || option.length == 0)
         {
            await models.default_select_options.create(jsonArray[i])
            console.log("imported record number "+i);
         }         
    }
}

const placesAutoComplete = async (req, res) => {
    let resResult = []
    let url = "https://maps.googleapis.com/maps/api/place/autocomplete/json?types=(cities)&input="+ req.query.input +"&key="+process.env.GOOGLE_API_KEY
  
    axios.get(url)
      .then(function (response) {
          response.data.predictions.map((p) => {
            let city = {
                value:'',
                label:'',
                city:'',
                state:'',
                country:'',
                description:""
            }
            city.value = city.label = p.description
            const citySplit = p.description.split(',')
            if(citySplit.length >= 3) {
               city.country = citySplit[citySplit.length-1].trim();
               city.value =  city.city = citySplit[0].trim();
               city.state = citySplit[1].trim();
            } else {
                city.country = citySplit[citySplit.length-1].trim();
                city.value = city.city = citySplit[0].trim();
            }
            resResult.push(city)
        })
        return res.status(200).send(resResult);
      })
      .catch(function (error) {
            console.log(error);
            return res.status(200).send(resResult);
      })
}

module.exports = { fetchSuggestions, fetchSuggestGoals, insertDefaultOption, placesAutoComplete}                  