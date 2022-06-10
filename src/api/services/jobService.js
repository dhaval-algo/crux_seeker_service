const { getFileBuffer } = require("../../utils/helper");
const elasticService = require("./elasticService");
const { uploadResumeToS3 } = require("../../services/v1/AWS")
const models = require("../../../models");
const getJobListing = async (req, callback) => {

    try {

        const esQuery = {
            from: 0,
            size: 100,
            query: { "match_all": {} },
            _source: ["job_department", "job_title", "id"]
        }

        const jobs = {};


        const result = await elasticService.plainSearch('job-opening', esQuery);
        if (result && result.hits && result.hits.hits && result.hits.hits.length) {
            for (const jobData of result.hits.hits) {
                const job = jobData._source;
                if (job.job_department in jobs) {

                    jobs[job.job_department].push({ id: jobData._id, job_title: job.job_title });

                } else {
                    jobs[job.job_department] = [{ id: jobData._id, job_title: job.job_title }];

                }
            }
        }

        callback(null, { success: true, message: "list fetched successfully", data: jobs });


    } catch (error) {

        console.log("Error Ocurred while fetching job listing", error);
        callback(null, { success: false, message: "error occured while fetching list", data: {} });
    }

}

const getJobData = async (req, callback) => {
    try {

        const { jobId } = req.query;
        const esQuery = {
            bool: {
                must: [

                    {
                        ids: {
                            values: jobId
                        }
                    }
                ]
            }
        }

        let jobData = {};
        const result = await elasticService.search('job-opening', esQuery);
        if (result && result.hits && result.hits.length) {

            jobData = result.hits[0]._source;
        }
        callback(null, { success: true, message: "data fetched successfully", data: jobData });

    }

    catch (error) {

        console.log("Error Ocurred while fetching job data", error);
        callback(null, { success: false, message: "error occured while fetching job data", data: {} });
    }

}


const saveJobApplication = async (req, callback) => {
    try {

        const { buffer, fileName, jobId, firstName, lastName, email } = req.body;
        const resumeBuffer =  getFileBuffer(buffer);
        const resumeName = (new Date().getTime()) + fileName;
        const path = `job-resume/${resumeName}`;
        const s3Path = await uploadResumeToS3(path,resumeBuffer);

        await models.job_applications.create({ firstName: firstName, lastName: lastName, email: email, jobId: jobId, resume: s3Path });
        callback(null, { success: true, message: "job application is saved successfully" });

    } catch (error) {
        console.log("Error Ocurred while saving job application",error);
        callback(null, { success: false, message: "error occured while saving job application"});
    }

}
module.exports = {

    getJobListing,
    getJobData,
    saveJobApplication

}