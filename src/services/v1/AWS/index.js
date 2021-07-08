let AWS = require('aws-sdk');      


const {AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_IMAGE_BUCKET, ASW_S3_URL} = process.env
const S3Url = ASW_S3_URL
AWS.config.update({
    accessKeyId:AWS_ACCESS_KEY_ID,
    secretAccessKey:AWS_SECRET_ACCESS_KEY,
    region: AWS_REGION
})
const s3Bucket = new AWS.S3({params: {Bucket: AWS_IMAGE_BUCKET}});


const deleteObject = (path) => {
  return new Promise( resolve => {
    var params = {  
      Bucket: AWS_IMAGE_BUCKET, 
      Key: path 
    };

    let remove = new AWS.S3.deleteObject({params:params});

    let promise = remove.promise();

    promise.then(
      function(data) {
        resolve(true);
      },
      function(err) {resolve(err.message);
      }
    );
  })
}


const uploadImageToS3 = (path, image) => {
    return new Promise( resolve => {
        let imageUrl = `${S3Url}/${path}`;
        let upload = new AWS.S3.ManagedUpload({
            params: {
              Bucket: AWS_IMAGE_BUCKET,
              Key: path,
              Body: image,
              ACL: "public-read"
            }
          });
          let promise = upload.promise();

          promise.then(
            function(data) {
            //   alert("imageUrl uploaded photo.");
              resolve(imageUrl);
            },
            function(err) {resolve(err.message);
            }
          );
    })
}


const uploadResumeToS3 = (path, image) => {
  return new Promise( resolve => {
      let imageUrl = `${S3Url}/${path}`;
      let upload = new AWS.S3.ManagedUpload({
          params: {
            Bucket: AWS_IMAGE_BUCKET,
            Key: path,
            Body: image,
            ACL: "public-read"
          }
        });
        let promise = upload.promise();

        promise.then(
          function(data) {
          //   alert("imageUrl uploaded photo.");
            resolve(imageUrl);
          },
          function(err) {resolve(err.message);
          }
        );
  })
}

const uploadFileToS3 = (path, file, contentType) => {
  return new Promise( resolve => {
      let upload = new AWS.S3.ManagedUpload({
          params: {
            Bucket: process.env.AWS_CDN_BUCKET,
            Key: path,
            Body: file,
            ContentType:contentType,
            // ACL: "public-read"
          }
        });
        let promise = upload.promise();

        promise.then(
          function(data) {
            resolve(true);
          },
          function(err) {resolve(err.message);
          }
        );
  })
}

module.exports = { 
    uploadImageToS3,
    uploadFileToS3,
    uploadResumeToS3,
    deleteObject,

    getArn: function(type,region,owner,name){
        let arn = 'arn:aws:'+type+':'+region+':'+owner+':'+name
        return arn;
    },
    getUrl: function(type,region,owner,name){
        let url = 'https://'+type+'.'+region+'.amazonaws.com/'+owner+'/'+name
        return url;
    },

    deleteQueue: function(deleteParams){
        let this_obj = this;
        return new Promise(async (resolve, reject) => {    
            var sqs = new AWS.SQS({ region: process.env.AWS_REGION, accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY });

            sqs.deleteMessage(deleteParams, function(err, data) {
              if (err) {
                return reject(err);
              } else {
                console.log("Queue delete sucess")
                return resolve(data);
              }
            });
            
        })
    },

    deleteFailedQueue: function(subject,queueURL,messageData,approximateReceiveCount,delete_params){
        let this_obj = this;
        return new Promise(async (resolve, reject) => {   
            if(parseInt(approximateReceiveCount) >= parseInt(process.env.AWS_SQS_RECIEVE_LIMIT)) {

                // let failedQueuesData = {
                //     name :subject,
                //     payload:JSON.stringify(messageData) 
                // }
                // let failedQueuesFields= ['name','payload']
                // await models.failed_queues.create(failedQueuesData,  { fields: failedQueuesFields })

                await this_obj.deleteQueue(delete_params) 
                return resolve(delete_params)
            }
            else{
                return resolve(false)
            }
            
        })
    },
}