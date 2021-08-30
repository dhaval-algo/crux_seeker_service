const AWS = require('aws-sdk');

AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const publishToSNS =  (topicArn, payload, subject) => {

    var params = {
      Message: JSON.stringify(payload),
      Subject: subject,
      TopicArn: topicArn
    };

    // Create promise and SNS service object
    var publishTextPromise = new AWS.SNS({ apiVersion: '2010-03-31' }).publish(params).promise();

    // Handle promise's fulfilled/rejected states
    publishTextPromise.then(
      function (data) {
        
      }).catch(
        function (err) {
          console.error(err, err.stack);
        });


    return "test";
  }

  module.exports = {
    publishToSNS
}