const learnPathService = require("../services/learnPathService");
let LearnPathService = new learnPathService();
const {formatResponseField } = require("../utils/general");

module.exports = {

    getLearnPathList: async (req, res) => {
        LearnPathService.getLearnPathList(req, (err, data) => {
          if (data) {
            let finalData = {}
            if(req.query['fields']){
                
                fields = req.query['fields'].split(",");
                if(fields.includes("learn_types") || fields.includes("topics"))
                {
                    for (let filter of data.data.filters)
                    {
                        if(fields.includes("learn_types")  && filter.field =="learn_type")
                        {
                            data.data["learn_types"] = filter.options.map(item => {return {label:item.label, image:item.image}})
                        }

                        if(fields.includes("topics") && filter.field =="topics")
                        {
                            data.data["topics"] = filter.options.map(item => item.label)
                        }
                    }
                
                }
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

    getLearnPathByIds: async (req, res) => {
      LearnPathService.getLearnpathByIds(req, (err, data) => {
          if (data) {
              res.status(200).send(data);
          } else {
              res.status(200).send(err);
          }
      });        
    },

    getSingleLearnPath: async (req, res) => {
        const slug = req.params.slug;
        LearnPathService.getLearnPath(req, (err, data) => {
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

    getReviews: async (req, res) => {
        LearnPathService.getReviews(req, (err, data) => {
          if (data) {
            res.status(200).send(data);
          } else {
            res.status(200).send(err);
          }
        });
      },
    
    exploreLearnPath: async (req, res) => {
        LearnPathService.exploreLearnPath(req, (err, data) => {
          if (data) {
            res.status(200).send(data);
          } else {
            res.status(200).send(err);
          }
        });
      },
    
    getPopularLearnPaths: async (req,res) => {
      LearnPathService.getPopularLearnPaths(req,(err, data)=>{
        if (data) {
            if(process.env.API_CACHE_CONTROL_HEADER)
            {
                res.set('Cache-control', process.env.API_CACHE_CONTROL_HEADER)
            }
            res.status(200).send(data);
        } else {
            res.status(200).send(err);
        }
    })
    },
}