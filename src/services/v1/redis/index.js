let client = require('redis');

let config = {
    url: process.env.REDIS_URL
}
    //define is Production variable 
const isNotProd = (process.env.NODE_ENV == 'production') ? false : true;
let redis;

module.exports = class REDIS {
    connect() {
        if (!redis) {
            redis = client.createClient(config);
        }
    }

    getAllKey(callback, customKey = false){
        this.connect(); 
        if(customKey){
            redis.keys('*',callback);
        }else{
            redis.keys('apiData-*',callback);
        }
    }

    async getAllKeysByType(key, customKey = false){
        let that = this;
        return new Promise(function(resolve,reject){
            that.connect();
            if(!customKey){
                key='apiData-'+key+'-*';
            }
            if(isNotProd)
                console.log("key",key)
            redis.keys(key,(err,data)=>{
                if(isNotProd)
                    console.log("data",data,err)
                if(err){
                    resolve({noCacheKeys:true});
                }
                else{
                    if(data == null){
                        if(isNotProd)
                            console.log('REDIS:: No key = ',key);
                        resolve({noCacheKeys:true})
                    }
                    else{
                        if(isNotProd)
                            console.log('REDIS:: Cache available key = ',key);
                        let allKeys =[]
                         for(let i=0; i<data.length; i++){
                            let replaceTxt;
                            if(!customKey){
                                replaceTxt = data[i].replace('apiData-','')
                            }
                            allKeys.push(replaceTxt)
                         }
                        resolve(allKeys);
                    }
                }
            }); 
        })
    }

    get(key,callback, customKey=false){
        this.connect(); 
        if(!customKey){
            key='apiData-'+key;
        }
        redis.get(key,callback);
    }

    getValues(key,callback, customKey=false){
        this.connect();
        if(!customKey){
            key='apiData-'+key;
        }
        redis.get(key,(err,data)=>{
            if(err){
                callback(err,null);
            }
            else{
                if(data == null){
                    if(isNotProd)
                        console.log('REDIS:: No cache available for key = ',key);
                    callback(null,{noCacheData:true})
                }
                else{
                    if(isNotProd)
                        console.log('REDIS:: Cache available for key = ',key);
                    callback(null,JSON.parse(data));
                }
            }
        });
    }

    async getValuesSync(key, customKey=false){
        let that = this;
        return new Promise(function(resolve,reject){
            that.connect();
            if(!customKey){
                key='apiData-'+key;
            }
            redis.get(key,(err,data)=>{
                if(err){
                    resolve({noCacheData:true});
                }
                else{
                    if(data == null){
                        if(isNotProd)
                            console.log('REDIS:: No cache available for key = ',key);
                        resolve({noCacheData:true})
                    }
                    else{
                        if(isNotProd)
                            console.log('REDIS:: Cache available for key = ',key);
                        resolve(JSON.parse(data));
                    }
                }
            }); 
        })
    }

    async set(key,value, expirySeconds = null, customKey=false){
        this.connect();
        if(!customKey){
            key='apiData-'+key;
        }
        redis.set(key,JSON.stringify(value),function(err,response){
            if(response){
                if(expirySeconds) redis.expire(key, expirySeconds);
                if(isNotProd)
                    console.log("Redis object added for key = ",key);
            }
            else{
                console.log("Error while setting object for key = "+key+" error = "+err);
            }
        });
    }

    delete(key, customKey=false){
        this.connect(); 
        if(!customKey){
            key='apiData-'+key;
        }
        console.log("REDIS::Delete key for  "+key);
        redis.del(key);
    }

    expire(key, time, customKey=false){
        this.connect(); 
        if(!customKey){
            key='apiData-'+key;
        }
        redis.expire(key,time);
    }
}