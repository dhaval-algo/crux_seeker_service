let client = require('redis');
const AWS = require('aws-sdk');
const { Consumer } = require('sqs-consumer');

let config = {
    url: process.env.REDIS_URL
}

let redis;
const awsService = require("../AWS/index");

const learnContentService = require('../../../api/services/learnContentService');
const learnContent = new learnContentService();

const redisConnection = require('./index');
const RedisConnection = new redisConnection();

module.exports = class LearnContentListService {

    learnContentListSQSConsumer(){
        let that =this
        return new Promise(async (resolve, reject) => {
            try{
                let queueName = process.env.LEARNCONTENT_LIST_QUEUE
                let queueURL =  awsService.getUrl('sqs',process.env.AWS_REGION,process.env.AWS_OWNER,queueName)
 
                AWS.config.update({region: process.env.AWS_REGION, accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY});
                const app = Consumer.create({
                    queueUrl: queueURL,
                    attributeNames:['All', 'ApproximateFirstReceiveTimestamp', 'ApproximateReceiveCount'],
                    handleMessage: async (message) => {
                        let message_body = JSON.parse(message.Body)
                        let subject = message_body.subject
                        let message_data = message_body.Message
                        let queueData = message_data

                        // /*****delete from queue ****/
                        let approximateReceiveCount = message.Attributes.ApproximateReceiveCount
                        let delete_params = {
                                              QueueUrl: queueURL,
                                              ReceiptHandle: message.ReceiptHandle
                                            };
                        await awsService.deleteFailedQueue(subject,queueURL,message_data,approximateReceiveCount,delete_params)  
                        // /*******************/
                        // console.log("SQSConsumer->",subject)
                        that.recacheCouseList(JSON.parse(queueData))
                         
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

    mergeArrayValues(arr1,arr2){
        let array3 = [...new Set([...arr1,...arr2])]
        return array3;
    }

    async recacheCouseList(queueData){
        // let queueData =  {
        //       course_slug: 'ethical-hacking-for-beginners',
        //       categories: [ 'cloud-and-security',""],
        //       sub_categories: [ 'cybersecurity' ],
        //       topics: [ 'ethical-hacking' ],
        //       currencies: [ 'EUR', 'GBP', 'USD', 'INR' ]
        // }

        // let cacheData =  {
        //       course_slug: 'ethical-hacking-for-beginners',
        //       categories: [ 'cloud-and-security'],
        //       sub_categories: [ 'cybersecurity' ],
        //       topics: [ 'ethical-hacking' ]
        // }

        let courseRedisSlug = 'listing-course-'+queueData.course_slug
        let cacheData = await RedisConnection.getValuesSync(courseRedisSlug);
        console.log("cacheData",cacheData)
        let mergeCollection = {}
        if(cacheData.noCacheData != true) {
 
            mergeCollection = {
                categories: this.mergeArrayValues(queueData.categories,cacheData.categories),
                sub_categories: this.mergeArrayValues(queueData.sub_categories,cacheData.sub_categories),
                topics: this.mergeArrayValues(queueData.topics,cacheData.topics)
            }

        }
        else{
 
            mergeCollection = {
                categories: queueData.categories,
                sub_categories: queueData.sub_categories,
                topics: queueData.topics
            }
        }
     
        //update search

        for (var i = 0; i < queueData.currencies.length; i++) {
            let currency = queueData.currencies[i]
            console.log("currency=================>", currency)
            //search
            let querysearchPayload = {query:{ pageType: 'search', q: '', currency: currency }}
            await learnContent.getLearnContentList(querysearchPayload , (err, data) => {},true)

            //category

            for (var t = 0; t < mergeCollection.topics.length; t++) {
                let topic = mergeCollection.topics[t]
                let querytopicPayload = {
                                            query: {
                                              pageType: 'topic',
                                              slug: topic,
                                              currency: currency
                                            }
                                        }
                    await learnContent.getLearnContentList(querytopicPayload , (err, data) => {},true)
            }

            for (var c = 0; c < mergeCollection.categories.length; c++) {
                let category = mergeCollection.categories[c]
                let querysearchPayload = {
                                            query:{
                                              pageType: 'category',
                                              slug: category,
                                              currency: currency
                                            }
                                        }
                await learnContent.getLearnContentList(querysearchPayload , (err, data) => {},true)

                for (var sc = 0; sc < mergeCollection.categories.length; sc++) {
                    let subcategory = mergeCollection.categories[sc]
                    let querysearchPayload = {
                                                query:{
                                                  pageType: 'category',
                                                  slug: category+','+subcategory,
                                                  currency: currency
                                                }
                                            }
                    await learnContent.getLearnContentList(querysearchPayload , (err, data) => {},true)

                    
                }

            }


           
            
        }

        return true;

    }

}