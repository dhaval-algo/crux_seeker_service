'use strict';

const { Client } = require('@elastic/elasticsearch');
const AWS = require('aws-sdk')
const createAwsElasticsearchConnector = require('aws-elasticsearch-connector');

const LEARN_CONTENT_VERSION = process.env.LEARN_CONTENT_VERSION || "";

const elasticClient = () => {
  if(process.env.ELASTIC_CONNECTION_TYPE == 'server'){
    let clientProperties = {
      node: process.env.ELASTIC_NODE_URL,
      auth:{
        username:process.env.ELASTIC_USERNAME,
        password :process.env.ELASTIC_PASSWORD
      },
      maxRetries: 5,
      requestTimeout: 60000
     
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

  search: async (index, query, payload={}, fields = null,suggest = null) => {
    if(index === "learn-content") index += LEARN_CONTENT_VERSION;
    const client = elasticClient();
    let finalQuery = {
      index: index,
      body: {
        query: query
      }
    };

    if(suggest)
    {
      finalQuery = {
        index: index,
        body: {
          suggest: suggest
        }
      };
    }

    if(fields) {
      finalQuery.body._source = fields;
    }

    //if(q){
      //finalQuery.q = q;
    //}

    
    if(payload.search_after !== null){
      finalQuery.body.search_after = payload.search_after;
    }
    
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
    if(payload.sortObject !== null){
      finalQuery.body.sort = payload.sortObject;
    } 

    if(payload._source !== null){
      finalQuery._source = payload._source;
    } 
    finalQuery.track_total_hits = true
    const result = await client.search(finalQuery);
    if(result && result.body){
        //return result.body.hits.hits;
        if(suggest)
        {
          return result.body.suggest;
        }else{
          return result.body.hits;
        }
    }else{
        return [];
    } 
  }, 

  searchWithAggregate: async (index, query, payload={}, q) => {
    if(index === "learn-content") index += LEARN_CONTENT_VERSION;
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

    if(payload.aggs !== null){
      finalQuery.body.aggs = payload.aggs;
    }

    if(payload._source !== null){
      finalQuery._source = payload._source;
    }
    finalQuery.track_total_hits = true
    const result = await client.search(finalQuery);
    if(result && result.body){
        //return result.body.hits.hits;
        return result.body;
    }else{
        return [];
    } 
  }, 


  plainSearch: async (index, queryBody) => {
    if(index === "learn-content") index += LEARN_CONTENT_VERSION;
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
    if(index === "learn-content") index += LEARN_CONTENT_VERSION;
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

  // each query in queries should be a complete query like :
  //{ _source: ["field1", "field2", "fieldn"], size: size, query: query }
  // the index and query must have same position in their respective array
  multiSearch: async (indices, queries) => {

    const searches = [];
    indices.forEach((index, i) => {

      searches.push({ index: index });
      searches.push(queries[i]);

    });

    const client = elasticClient();
    const { body } = await client.msearch({ body: searches });
    return body.responses;

  }

};
