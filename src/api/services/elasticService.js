'use strict';

const { Client } = require('@elastic/elasticsearch');
const AWS = require('aws-sdk')
const createAwsElasticsearchConnector = require('aws-elasticsearch-connector');


const elasticClient = () => {
  if(process.env.ELASTIC_CONNECTION_TYPE == 'server'){
    let clientProperties = {
      node: process.env.ELASTIC_NODE_URL,
      maxRetries: 5,
      requestTimeout: 60000,
      sniffOnStart: true
    };
    return new Client(clientProperties) 
  }else{
    const config = new AWS.Config({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    });
    return new Client({
      ...createAwsElasticsearchConnector(config),
      node: process.env.ELASTIC_NODE_URL
    });
  }    
}

module.exports = {

  search: async (index, query, payload={}, q) => {
    const client = elasticClient();
    let finalQuery = {
      index: index,
      body: {
        query: query
      }
    };
    //if(q){
      //finalQuery.q = q;
    //}
    console.log('sorttttt valueee',payload);
    if(payload.from !== null){
      finalQuery.from = payload.from;
    }else{
      finalQuery.from = 0;
    }

    if(payload.size !== null){
      finalQuery.size = payload.size;
    }else{
      finalQuery.size = 10000;
    }

    if(payload.sort !== null){
      finalQuery.sort = payload.sort;
    } 

    // if(payload.aggs !== null){
    //   finalQuery.body.aggs = payload.aggs;
    // }

    const resultqry = await client.sql.query({
                                                body: {
                                                  query: "SELECT COUNT(*) FROM \"learn-content\" "
                                                }
                                              });

    console.log("resultqry",resultqry)

    const result = await client.search(finalQuery);
    if(result && result.body){
        //return result.body.hits.hits;
        return result.body.hits;
    }else{
        return [];
    } 
  }, 


  plainSearch: async (index, queryBody) => {
    const client = elasticClient();
    let finalQuery = {
      index: index,
      body: queryBody
    };

    const result = await client.search(finalQuery);
    if(result && result.body){
        return result.body;
    }else{
        return null;
    } 
  }, 

  count: async (index, queryBody) => {
    const client = elasticClient();
    let finalQuery = {
      index: index,
      body: queryBody
    };

    const result = await client.count(finalQuery);
    if(result && result.body){
        return result.body;
    }else{
        return 0;
    } 
  }, 

};
