let AWS = require('aws-sdk');      


const {AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_IMAGE_BUCKET} = process.env
const S3Url = `https://crux-dev.s3.ap-south-1.amazonaws.com`
AWS.config.update({
    accessKeyId:AWS_ACCESS_KEY_ID,
    secretAccessKey:AWS_SECRET_ACCESS_KEY,
    region: AWS_REGION
})
const s3Bucket = new AWS.S3({params: {Bucket: AWS_IMAGE_BUCKET}});



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
            console.log("imageUrl uploaded photo.");
            resolve(true);
          },
          function(err) {resolve(err.message);
          }
        );
  })
}

module.exports = { 
    uploadImageToS3,
    uploadFileToS3
}