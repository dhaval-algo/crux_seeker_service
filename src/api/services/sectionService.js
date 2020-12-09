const elasticService = require("./elasticService");


module.exports = class sectionService {
    async getCategoryTree(req, callback) {
        try {
    // label": "Development",
    // "slug": "development",
    // "type": "category",
    // "count": 56,
    // "child": []
            const aggregateQ ={
                "query": {
                    "bool": {
                      "must": [
                        {
                          "term": {
                            "status.keyword": "published"
                          }
                        }
                      ]
                    }
                  },
                "size": 0, 
                "aggs": {
                  "distinct_title": {
                    "terms": {
                      "field": "section_slug.keyword",
                      "size": 1000
                    }
                  }
                }
              }
            const query = {
                "query": {
                    "match_all": {}
                },
                "_source": ["default_display_label","slug","location_display_labels"]
            }
            console.log('here1');
            const result = await elasticService.plainSearch('section', query);
            console.log('here2');

            const {hits} = result.hits
            
            if(!hits.length){
                return callback(null, {success:true, data:[]})
            }
            console.log('here3');
            const aggrResult = await elasticService.plainSearch('article', aggregateQ);
            console.log('here4');

            const { buckets } = aggrResult.aggregations.distinct_title;
            let data = []
            if(buckets.length) {
                for (let index = 0; index < hits.length; index++) {
                    const hit = hits[index];
                    console.log(hit);
                    let section = buckets.find(bucket => bucket.key == hit._source.slug);
                    if(section && section.doc_count) {
                        let secR = {
                            label: hit._source.default_display_label,
                            slug: hit._source.slug,
                            type: "category",
                            count: section.doc_count,
                            child: []
                        }
                        data.push(secR)
                    }
                }
                return callback(null, {success:true, data})
            } else {
                return callback(null, {success:true, data:[]})
            }
        } catch (error) {
            console.log(error,"errror");
            return callback(null, {success:true, data:[] })
        }
    }
}