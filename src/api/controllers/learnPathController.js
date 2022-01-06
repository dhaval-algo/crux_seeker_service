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
}