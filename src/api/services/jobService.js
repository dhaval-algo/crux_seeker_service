const { getFileBuffer } = require("../../utils/helper");
const elasticService = require("./elasticService");
const { uploadResumeToS3 } = require("../../services/v1/AWS")
const models = require("../../../models");
const communication = require('../../communication/v1/communication');
const getJobListing = async (req, callback) => {

    try {

        const esQuery = {
            from: 0,
            size: 100,
            query: { "match_all": {} },
            _source: ["job_department", "job_title", "id","city","country"]
        }

        const jobs = {};


        const result = await elasticService.plainSearch('job-opening', esQuery);
        if (result && result.hits && result.hits.hits && result.hits.hits.length) {
            for (const jobData of result.hits.hits) {
                const job = jobData._source;
                if (job.job_department in jobs) {

                    jobs[job.job_department].push({ id: jobData._id, job_title: job.job_title, city:job.city, country:job.country});

                } else {
                    jobs[job.job_department] = [{ id: jobData._id, job_title: job.job_title, city:job.city, country:job.country }];

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

        const { buffer, fileName = '.pdf', jobId, firstName, lastName, email } = req.body;
        const resumeBuffer =  getFileBuffer(buffer);
        const resumeName =  firstName + (new Date().getTime()) + fileName;
        const path = `job-resume/${resumeName}`;
        const s3Path = await uploadResumeToS3(path,resumeBuffer);
        await models.job_applications.create({ firstName: firstName, lastName: lastName, email: email, jobId: jobId, resume: s3Path });
        
        let esQuery = {
            query:{ 'bool' : {'filter': {'term': {'id': jobId}}}},
            _source : ['job_title','job_type','job_department','job_department', 'city']
        }
        const result = await elasticService.plainSearch('job-opening', esQuery);
        const {job_title = "", job_department = "", job_type = "", city = ""} = result.hits.hits[0]._source;
        const data = {fullName : firstName + " " + lastName, email, jobId, resumeUrl: s3Path,
                    jobTitle: job_title, jobDepartment: job_department, jobType: job_type, jobCity: city};
        const emailPayload = {
            fromemail: process.env.FROM_EMAIL_CAREERS_APPLICATION,
            toemail:  process.env.TO_EMAIL_CAREERS_APPLICATION,
            email_type: "job_application_email",
            email_data: data 
        }

        await communication.sendEmail(emailPayload);
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