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

  search: async (index, query) => {
    const client = elasticClient();
    const result = await client.search({
        index: index,
        body: {
          query: query
        }
    })
    if(result && result.body){
        return result.body.hits.hits;
    }else{
        return [];
    } 
  }, 

};
