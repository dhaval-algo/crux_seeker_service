let client = require('redis');
const AWS = require('aws-sdk');
const { Consumer } = require('sqs-consumer');

let config = {
    url: process.env.REDIS_URL
}

let redis;
const awsService = require("../AWS/index");

const categoryService = require('../../../api/services/categoryService');
const CategoryService = new categoryService();

module.exports = class CategoryTreeService {

    categoryTreeSQSConsumer(){
        return new Promise(async (resolve, reject) => {
            try{
                let queueName =  process.env.REDIS_CATEGORY_TREE_QUEUE
                let queueURL =  awsService.getUrl('sqs',process.env.AWS_REGION,process.env.AWS_OWNER,queueName)               
                AWS.config.update({region: process.env.AWS_REGION, accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY});
                const app = Consumer.create({
                    queueUrl: queueURL,
                    attributeNames:['All', 'ApproximateFirstReceiveTimestamp', 'ApproximateReceiveCount'],
                    handleMessage: async (message) => {
                        let message_body = JSON.parse(message.Body)
                        let subject = message_body.subject
                        let message_data = message_body.message

                        // /*****delete from queue ****/
                        let approximateReceiveCount = message.Attributes.ApproximateReceiveCount
                        let delete_params = {
                                              QueueUrl: queueURL,
                                              ReceiptHandle: message.ReceiptHandle
                                            };
                        await awsService.deleteFailedQueue(subject,queueURL,message_data,approximateReceiveCount,delete_params)  
                       
                        console.log("categoryTreeSQSConsumer->",subject);
                        CategoryService.getTree({query:{}}, (err, data) => {}, true); 
                         
                    },
                    sqs: new AWS.SQS()
                });
                 
                app.on('error', (err) => {
                  console.error("consumeSQSMessage-error",err.message);
                });
                 
                app.on('processing_error', (err) => {
                  console.error("consumeSQSMessage-processing_error",err.message);
                });
                 
                app.on('timeout_error', (err) => {
                 console.error("consumeSQSMessage-timeout_error",err.message);
                });
                 
                app.start();
                
            }
            catch(err){
                console.log("ERROR:: SQSConsumer",err)
                return reject(err);
            }
        
        })
    }

}