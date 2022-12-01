const jobService = require("../services/jobService");


module.exports = {


    getJobListing: async (req, res) => {


        jobService.getJobListing(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });

    },

    getJobData: async (req, res) => {


        jobService.getJobData(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });

    },
    saveJobApplication: async (req, res) => {

        jobService.saveJobApplication(req, (err, data) => {
            if (data) {
                res.status(200).send(data);
            } else {
                res.status(200).send(err);
            }
        });
    }



}