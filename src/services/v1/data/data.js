const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const csv =require("csvtojson/v2");
const axios = require('axios')
const models = require("../../../../models");

const fetchSuggestions = async (req,res) => {
    const {searchType, searchQuery } = req.query
    console.log( searchQuery,searchType);
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

const insertDegree = async (req, res) => {

    const jsonArray=await csv().fromFile(`${global.appRoot}/data_files/default_select_options.csv`);
    res.status(200).json(jsonArray)
    for(let i=0; i<jsonArray.length;i++){
        console.log(jsonArray[i]);
        await models.default_select_options.create(jsonArray[i])
    }
}
//AIzaSyCoLXhU722mcOyhVlyHKrCuOhxE3WsQa1M

const placesAutoComplete = async (req, res) => {
    let resResult = []
    let url = "https://maps.googleapis.com/maps/api/place/autocomplete/json?types=(cities)&input="+ req.query.input +"&key=AIzaSyCoLXhU722mcOyhVlyHKrCuOhxE3WsQa1M"
  
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

module.exports = { fetchSuggestions, insertDegree, placesAutoComplete}                  