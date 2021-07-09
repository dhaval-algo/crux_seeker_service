let client = require('redis');

let config = {
    url: process.env.REDIS_URL
}

let redis;

module.exports = class REDIS {
    connect() {
        if (!redis) {
            redis = client.createClient(config);
        }
    }

    getAllKey(callback){
        this.connect(); 
        redis.keys('apiData-*',callback);
    }

    get(key,callback){
        this.connect(); 
        key='apiData-'+key;
        redis.get(key,callback);
    }

    getValues(key,callback){
        this.connect();
        key='apiData-'+key;
        redis.get(key,(err,data)=>{
            if(err){
                callback(err,null);
            }
            else{
                if(data == null){
                    console.log('REDIS:: No cache available for key = ',key);
                    callback(null,{noCacheData:true})
                }
                else{
                    console.log('REDIS:: Cache available for key = ',key);
                    callback(null,JSON.parse(data));
                }
            }
        });
    }

    async getValuesSync(key){
        let that = this;
        return new Promise(function(resolve,reject){
            that.connect();
            key='apiData-'+key;
            redis.get(key,(err,data)=>{
                if(err){
                    resolve({noCacheData:true});
                }
                else{
                    if(data == null){
                        console.log('REDIS:: No cache available for key = ',key);
                        resolve({noCacheData:true})
                    }
                    else{
                        console.log('REDIS:: Cache available for key = ',key);
                        resolve(JSON.parse(data));
                    }
                }
            }); 
        })
    }

    async set(key,value){
        this.connect();
        key='apiData-'+key;
        redis.set(key,JSON.stringify(value),function(err,response){
            if(response){
                console.log("Redis object added for key = ",key);
            }
            else{
                console.log("Error while setting object for key = "+key+" error = "+err);
            }
        });
    }

    delete(key){
        this.connect(); 
        key='apiData-'+key;
        console.log("REDIS::Delete key for  "+key);
        redis.del(key);
    }
}