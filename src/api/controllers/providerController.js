const providerService = require("../services/providerService");
let ProviderService = new providerService();
const {formatResponseField } = require("../utils/general");

module.exports = {

    getProviderList: async (req, res) => {
        ProviderService.getProviderList(req, (err, data) => {
            if (data) {
                let finalData = {}
                if(req.query['fields']){ 
                    if (req.query['fields'].includes("search_filters")) {
                        data.data["search_filters"] = {}
                        for (let filter of data.data.filters) {
                            if (filter.field == "programs") {
                                data.data["search_filters"]["programs"] = filter.options.map(item => { return { label: item.label } })
                            }
                            if (filter.field == "study_modes") {
                                data.data["search_filters"]["study_modes"] = filter.options.map(item => { return { label: item.label } })
                            }
                            if (filter.field == "institute_types") {
                                data.data["search_filters"]["institute_types"] = filter.options.map(item => { return { label: item.label } })
                            }
                            if (filter.field == "region") {
                                data.data["search_filters"]["region"] = filter.options.map(item => { return { label: item.label } })
                            }
                        }
                    }          
                    finalData =  formatResponseField(req.query['fields'], data.data )                    
                    res.status(200).send({status: 'success', message: 'Fetched successfully!', data: finalData});
                }
                if(fields.includes("ranking"))
                {
                    for (let filter of data.data.filters)
                    {
                        if(label.field =="Ranking")
                        {
                            data.data["ranking"] = filter.options.map(item => {return {label:item.label, image:item.image, count:item.count, slug:item.slug}})
                        }
                    }
                }
                else
                {
                    res.status(200).send(data);
                }
            } else {
                res.status(200).send(err);
            }
        });        
    },

    getSingleProvider: async (req, res) => {        
        ProviderService.getProvider(req, (err, data) => {
            if (data) {
                let finalData = {}
              if(req.query['fields']){                    
                  finalData =  formatResponseField(req.query['fields'], data.data )                    
                  res.status(200).send({status: 'success', message: 'Fetched successfully!', data: finalData});
              }
              else
              {
                  res.status(200).send(data);
              }
            } else {
                res.status(200).send(err);
            }
        });        
    },

    getInstituteLandingPage: async (req, res) => {
        let result = await ProviderService.getInstituteLandingPage(req);
        if (req.query['fields']) {
            let finalData = formatResponseField(req.query['fields'], result.data)
            res.status(200).send({ success: true, message: 'Fetched successfully!', data: finalData });
        } else {
            res.status(200).send(result);
        }
    },

};