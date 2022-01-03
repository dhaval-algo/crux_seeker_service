const learnPathService = require("../services/learnPathService");
let LearnPathService = new learnPathService();

module.exports = {

    getLearnPathList: async (req, res) => {
        LearnPathService.getLearnPathList(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
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
                res.status(200).send(data);
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