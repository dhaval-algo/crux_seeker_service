const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const csv =require("csvtojson/v2");
const axios = require('axios')
const models = require("../../../../models");

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
            if(searchType!="institute" || searchType !="company") {
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

module.exports = { fetchSuggestions, insertDefaultOption, placesAutoComplete}                  