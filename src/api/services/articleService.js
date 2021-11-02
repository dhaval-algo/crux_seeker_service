const elasticService = require("./elasticService");
const fetch = require("node-fetch");
const models = require("../../../models");

const { 
    getFilterConfigs, 
    parseQueryFilters,
    getPaginationQuery,
    getMediaurl,
    getFilterAttributeName,
    updateSelectedFilters,
    generateMetaInfo,
    compareRule
} = require('../utils/general');
const apiBackendUrl = process.env.API_BACKEND_URL;

const MAX_RESULT = 10000;
const keywordFields = ['title', 'slug'];
const filterFields = ['title','section_name','categories','levels','tags', 'slug','author_slug'];
const allowZeroCountFields = ['section_name','categories','levels','tags', 'author_slug'];

const CheckArticleRewards = async (user, premium) => {  
    let rewards = [];
    let facts = {
        is_loggedin: (user)? true: false,
        "article.premium": premium
    }            
    let engineEvent = {  // define the event to fire when the conditions evaluate truthy
        type: 'success',
        params: {
        message: 'success'
        }
    }
    let rules = await models.rule.findAll({ where: { action_type: 'article_access', status:true } })

    for (let rule of rules){        
        let compareResult =  await compareRule(rule.action_rule.self_rules,engineEvent,facts) 
        if(compareResult)
        {
            rewards.push(rule.action_reward)
        }
    }
    return rewards;
};

module.exports = class articleService {

    async getArticleList(req, callback){
        const filterConfigs = await getFilterConfigs('Article');
        
        let esFilters = {}

        let publishedFilter = {term: { "status.keyword": 'published' }};
        esFilters['published'] = publishedFilter;

        const query = { 
            "bool": {
                "must": [
                    publishedFilter                
                ],
            }
        };

        if(req.articleIds)
        {
            let filterObject = { 
                "ids": {
                    "values": req.articleIds
                }}

            query.bool.must.push(filterObject);
        }

        let queryPayload = {};
        let paginationQuery = await getPaginationQuery(req.query);
        queryPayload.from = paginationQuery.from;
        queryPayload.size = paginationQuery.size;
        

        if(!req.query['sort'] && !req.query['q']){
            req.query['sort'] = "published_date:desc";
        }

        if(req.query['sort']){
            
            let sort = req.query['sort'];
            let splitSort = sort.split(":");
            if(splitSort[0] == 'title'){
                splitSort[0] = 'slug';
            }
            if(keywordFields.includes(splitSort[0])){
                sort = `${splitSort[0]}.keyword:${splitSort[1]}`;
            }
            queryPayload.sort = [sort];
        }

        let parsedFilters = [];
        let parsedRangeFilters = [];

        let filters = [];

        if(req.query['f']){
            parsedFilters = parseQueryFilters(req.query['f']);
            
            for(let parsedFilter of parsedFilters)
            {
                if(parsedFilter.key =="Author Type")
                {
                    parsedFilter.key ="Tag";
                }
            }
           
            for(const filter of parsedFilters){
                
                let elasticAttribute = filterConfigs.find(o => o.label === filter.key);

                if(elasticAttribute){
                    let attribute_name = getFilterAttributeName(elasticAttribute.elastic_attribute_name, filterFields);

                    let filterObject = {
                        "terms": {[attribute_name == "author_first_name" ? "author_slug.keyword" : attribute_name ]: filter.value}
                    }

                    query.bool.must.push(filterObject);
                    esFilters[elasticAttribute.elastic_attribute_name] = filterObject;

                }
            }
        }
        
        let queryString = null;
        if(req.query['q']){

            let filterObject = {                    
                "bool": {
                    "should": [
                        {
                            "query_string" : {
                                "query" : `*${decodeURIComponent(req.query['q']).trim()}*`,
                                "fields" : (req.searchField) ?(req.searchField): ['title^4', 'section_name^3', 'author_first_name^2', 'author_last_name'],
                                "analyze_wildcard" : true,
                                "allow_leading_wildcard": true
                            }
                        },
                        {
                            "multi_match": {

                                "fields":  (req.searchField) ?(req.searchField): ['title^4', 'section_name^3', 'author_first_name^2', 'author_last_name'],

                                "query": decodeURIComponent(req.query['q']).trim(),
                                "fuzziness": "AUTO",
                                "prefix_length": 0                              
                            }
                        }           
                    ]
                    }                    
                }

            query.bool.must.push(filterObject);
            esFilters['q'] = filterObject;         
        }

         //FILTER FACET AGGREGATIONS
         let aggs = {
            all_filters: {
                global: {},
                aggs: {

                }
            }
        }
        const topHitsSize = 200;   


        for(let filter of filterConfigs) {

            let exemted_filters = esFilters;

            if(esFilters.hasOwnProperty(filter.elastic_attribute_name)){
                let {[filter.elastic_attribute_name]: ignored_filter, ...all_filters } = esFilters 
                exemted_filters = all_filters;
            }

            exemted_filters = Object.keys(exemted_filters).map(key=>exemted_filters[key]);

            let aggs_object = {
                filter: { bool: { filter: exemted_filters } },
                aggs: {}
            }

            switch(filter.filter_type){
                case "Checkboxes":
                    if(filter.elastic_attribute_name == "author_first_name"){
                        aggs_object.aggs['filtered'] = { terms: {script: "doc['author_first_name.keyword'].value + '::' + doc['author_last_name.keyword'].value + '::' + doc['author_slug.keyword'].value", size: topHitsSize}}
                    }
                    else { 
                        aggs_object.aggs['filtered'] = { terms: { field: `${filter.elastic_attribute_name}.keyword`, size: topHitsSize } }
                    }
                    break;
                case "RangeSlider":
                    aggs_object.aggs['min'] = { min: {field: filter.elastic_attribute_name}}
                    aggs_object.aggs['max'] = { max: {field: filter.elastic_attribute_name}} 
                    break;
            }
            aggs.all_filters.aggs[filter.elastic_attribute_name] = aggs_object;
        }

        queryPayload.aggs = aggs;
        
        let result = await elasticService.searchWithAggregate('article', query, queryPayload, queryString);
        let aggs_result = result.aggregations;
        result = result.hits;

        for (let filter of filterConfigs) {

            let facet = aggs_result.all_filters[filter.elastic_attribute_name];

            let formatedFilters = {
                label: filter.label,
                field: filter.elastic_attribute_name == "author_first_name" ? "author_slug" : filter.elastic_attribute_name,
                filterable: filter.filterable,
                sortable: filter.sortable,
                order: filter.order,
                is_singleton: filter.is_singleton,
                is_collapsed: filter.is_collapsed,
                display_count: filter.display_count,
                disable_at_zero_count: filter.disable_at_zero_count,
                is_attribute_param: filter.is_attribute_param,
                filter_type: filter.filter_type,
                is_essential: filter.is_essential,
                sort_on: filter.sort_on,
                sort_order: filter.sort_order,
                false_facet_value: filter.false_facet_value,
                implicit_filter_skip: filter.implicit_filter_skip,
                implicit_filter_default_value: filter.implicit_filter_default_value,
            };

            if(filter.filter_type == "RangeSlider"){

                if(filter.elastic_attribute_name === "basePriceRound"){
                    facet.min.value = facet.min.value > 0 ? getCurrencyAmount(facet.min.value, currencies,'USD',req.query['currency']): facet.min.value;
                    facet.max.value = facet.max.value > 0 ? getCurrencyAmount(facet.max.value, currencies, 'USD',req.query['currency']): facet.max.value;
                }

                formatedFilters.min = facet.min.value;
                formatedFilters.max = facet.max.value;
                formatedFilters.minValue = facet.min.value;
                formatedFilters.maxValue = facet.max.value;
            } else {
                formatedFilters.options = facet.filtered.buckets.map(item => {
                    let option = {
                    label: item.key,
                    count: item.doc_count,
                    selected: false, //Todo need to updated selected.
                    disabled: false,
                    }

                    if(filter.elastic_attribute_name == 'author_first_name')
                    {
                       let [fname, lname, slug] = item.key.split("::");
                       option.label = `${fname}${(lname != 'null' && lname !== ''? " "+lname : '')}`.trim()
                       option.author_slug = slug
                    }

                    if(filter.filter_type == "RangeOptions") {
                        option.start = item.from ? item.from : "MIN"
                        option.end = item.to ? item.to : "MAX"
                    }

                    return option;
                });
            }

            filters.push(formatedFilters);

        }


        let formatCategory = true;
        if(parsedFilters)
        {
            for (let parsedFilter of parsedFilters)
            {
                if (parsedFilter.key =="Industry")
                {
                    formatCategory = false;
                }
            }
        }

        if(formatCategory)
        {
           let category_tree =[];
           let categoryFiletrOption =[];
           let categorykey = 0;
           let response = await fetch(`${apiBackendUrl}/category-tree`);
            if (response.ok) {
               let json = await response.json();
               if(json && json.final_tree){
                   category_tree = json.final_tree;
                }
            }
            if(category_tree && category_tree.length)
            {
                for(let category of category_tree )
                {
                    let i= 0;
                    for(let filter of filters)
                    {
                        if(filter.field =="categories")
                        {
                            for(let option of filter.options)
                            {
                                if(category.label == option.label)
                                {
                                    categoryFiletrOption.push(option);
                                }
                            }
                            categorykey = i;
                            
                        }
                        i++;
                    }
                }
            }
            filters[categorykey].options = categoryFiletrOption;

        }


        if(parsedFilters.length > 0){
            //filters = await calculateFilterCount(filters, parsedFilters, filterConfigs, 'article', result.hits, filterResponse.total, query, allowZeroCountFields, parsedRangeFilters);
            filters = updateSelectedFilters(filters, parsedFilters, parsedRangeFilters);
        }

        let pagination = {
            page: paginationQuery.page,
            count: result.hits.length,
            perPage: paginationQuery.size,
            totalCount: result.total.value,
            total: result.total.value
        }
        
        let list = [];
        if(result.total && result.total.value > 0){
            list = await this.generateListViewData(result.hits, req);
        }

        for (let filter of filters)
        {
            if(filter.label =="Tag")
            {
                filter.label ="Author Type";
            }
        }

          let data = {
            list: list,
            filters: filters,
            pagination: pagination,
            sort: req.query['sort']
          };

          let meta_information = await generateMetaInfo  ('article-list', result.hits);
          if(meta_information)
          {
              data.meta_information  = meta_information;
          }    
        
        callback(null, {status: 'success', message: 'Fetched successfully!', data: data});

    }

    async getArticle( slug, req, callback){
        const query = { "bool": {
            "must": [
              {term: { "slug.keyword": slug }},
              {term: { "status.keyword": 'published' }}
            ]
        }};
        const result = await elasticService.search('article', query);
        if(result.hits && result.hits.length > 0){
            const data = await this.generateSingleViewData(result.hits[0]._source, false, req);
            callback(null, {status: 'success', message: 'Fetched successfully!', data: data});
        }else{
            callback({status: 'failed', message: 'Not found!'}, null);
        }        
    }


    async generateListViewData( rows, req){
        let datas = [];
        for(let row of rows){
            const data = await this.generateSingleViewData(row._source, true, req);
            datas.push(data);
        }
        return datas;
    }

    async generateSingleViewData(result, isList = false, req){
        try{
        /*Rule check for article access*/
        let article_full_access = false;
        let rewards = [];
        if (!isList && req)
        {
            let premium = (result.premium)? result.premium:false
            rewards = await CheckArticleRewards(req.user, premium);
        }
        //let coverImageSize = 'large';
        //if(isList){
            //coverImageSize = 'thumbnail';
       // }
        
        // let cover_image = null;
        // if(result.cover_image){
        //     if(result.cover_image[coverImageSize]){
        //         cover_image = getMediaurl(result.cover_image[coverImageSize]);
        //     }else{
        //         cover_image = getMediaurl(result.cover_image['thumbnail']);
        //     }
        // }
        // if(!cover_image){
        //     cover_image = getMediaurl(result.cover_image['url']);
        // }
        
        let author = (!isList) ? await this.getAuthor(result.author_id) : null;
         
        let auth = await this.getAuthor(result.author_id);
         
        
        // if(!author){
        //     console.log("Author not found...");
            // author = {
            //     id: result.author_id,
            //     username: result.author_username,
            //     firstname: result.author_first_name,
            //     lastname: result.last_name ? result.author_last_name:"",
            //     designation: result.author_designation,
            //     bio: result.author_bio,
            //     slug: result.author_slug
            // };
        // }else{
        //     console.log("Author found..."); 
        // }
        let co_authors =  [];

        if(result.partners)
        {
            author = []
            if(result.co_authors && result.co_authors.length > 0)
            {
                for( let co_author of result.co_authors)
                {
                    author.push({
                        id: co_author.id,
                        username: co_author.username,
                        firstname:co_author.first_name,
                        lastname: co_author.last_name ? co_author.last_name:"",
                        designation: co_author.designation,
                        bio: co_author.bio,
                        slug: co_author.slug,
                        image: (co_author.image) ?( (co_author.image.large) ? getMediaurl(co_author.image.large):  getMediaurl(co_author.image.thumbnail)): null
                    });
                }
             }
        }
        else
        {
            if(auth){
                author = [{
                    id: auth.author_id,
                    username: auth.username,
                    firstname: auth.firstname,
                    lastname: auth.lastname ? auth.lastname:"",
                    designation: auth.designation,
                    bio: auth.bio,
                    slug: auth.slug,
                    image:auth.image
                }];
            }else{
                author = [{
                    id: result.author_id,
                    username: result.author_username,
                    firstname: result.author_first_name,
                    lastname: result.last_name ? result.author_last_name:"",
                    designation: result.author_designation,
                    bio: result.author_bio,
                    slug: result.author_slug
                }];
            }
            
            if(result.co_authors && result.co_authors.length > 0)
            {
                for( let co_author of result.co_authors)
                {
                    co_authors.push({
                        id: co_author.id,
                        username: result.username,
                        firstname:co_author.first_name,
                        lastname: co_author.last_name ? co_author.last_name:"",
                        designation: co_author.designation,
                        bio: co_author.bio,
                        slug: co_author.slug,
                        image: (co_author.image) ?( (co_author.image.large) ? getMediaurl(co_author.image.large):  getMediaurl(co_author.image.thumbnail)): null
                    });
                }
             }
        }
        

        let data = {
            title: result.title,
            premium: (result.premium)? result.premium:false,
            slug: result.slug,
            id: `ARTCL_PUB_${result.id}`,          
            cover_image: (result.cover_image)? result.cover_image : null,
            short_description: result.short_description,
            author: author,
            co_authors: (co_authors)? co_authors : null,
            comments: (result.comments && !isList) ? result.comments : [],
            social_links: {
                facebook: result.facebook_link,
                linkedin: result.linkedin_link,
                twitter: result.twitter_link
            },
            published_date: result.published_date,
            categories: (result.categories) ? result.categories : [],
            levels: (result.levels) ? result.levels : [],
            tags: (result.tags) ? result.tags : [],            
            section_name: result.section_name,
            section_slug: result.section_slug,
            related_articles: (result.related_articles && !isList) ? await this.getArticleByIds(result.related_articles) : [],
            recommended_articles: (result.recommended_articles && !isList) ? await this.getArticleByIds(result.recommended_articles) : [],
            ads_keywords:result.ads_keywords
        };

        if(!isList){
            let meta_information = await generateMetaInfo  ('article', result);
            if(meta_information)
            {
                data.meta_information  = meta_information;
            }
        }

        data.content = null;
        if(!isList){
            data.full_access = false;
            if(rewards && rewards.length > 0)
            {
                if(rewards[0].access_type == 'full_access')
                {
                    data.full_access= true;
                    data.content = result.content;
                }
                else if(rewards[0].access_type == 'partial_access')
                {
                    let content = result.content.replace(/<(.|\n)*?>/g, '');
                    content = content.replace(/&nbsp;/g, ' ');
                    data.content = content.split(' ').slice(0, 70).join(' ');
                }
            }           
        }

        if(result.custom_ads_keywords) {
            data.ads_keywords +=`,${result.custom_ads_keywords}` 
        }
        return data;
        }
        catch(err){
            console.log("ERROR: ",err)
        }
    }


    async getArticleByIds(articleIds, isListing = true, returnSlugs){
        let articles = [];
        let articleOrdered = [];
        let articleSlugs = [];
        /* let ids = [];
        const idPrefix = "ARTCL_PUB_";
        if(articleIds){
            ids = articleIds.map(e => idPrefix+e.toString());
        } */
        if(articleIds.length > 0){
            const queryBody = {
                "query": {
                  /* "ids": {
                      "values": ids
                  }, */
                  "bool": {
                    "must": [
                      {term: { "status.keyword": 'published' }},
                      {terms: { "id": articleIds }}
                    ]
                 }
                }
            };

            const result = await elasticService.plainSearch('article', queryBody);
            if(result.hits){
                if(result.hits.hits && result.hits.hits.length > 0){
                    for(const hit of result.hits.hits){
                        const article = await this.generateSingleViewData(hit._source, isListing);
                        
                        articles.push(article);
                    }
                    
                    for(const id of articleIds){
                        let article = articles.find(o => o.id === "ARTCL_PUB_"+id);
                        if(typeof article !='undefined')
                        {
                            articleSlugs.push(article.slug);
                            articleOrdered.push(article);
                        }
                    }
                }
            }            
        }
        if(returnSlugs) {
            return {articles:articleOrdered, articleSlugs:articleSlugs}
        }
        return articleOrdered;
    }


    async generateAuthorData(result, fetch_articles = false){
        let data = {
            id: result.id,
            user_id: result.user_id,
            username: result.username,
            firstname: result.first_name,
            lastname: result.last_name,
            designation: result.designation,
            bio: result.bio,
            image: (result.image) ?( (result.image.large) ? getMediaurl(result.image.large):  getMediaurl(result.image.thumbnail)): null,
            slug: result.slug,
            email: result.email,
            twitter_url: result.twitter_url,
            linkedin_url: result.linkedin_url,
            facebook_url: result.facebook_url,
            city: result.city
        };
        if(!data.image && !data.image==null){
            data.image = getMediaurl(result.image['url']);
        }

        if(fetch_articles){
            data.articles = await this.getArticleByAuthor(result.user_id);
        }

        return data;
    }

    async getAuthor(id){
        let author = null;
        const query = { "bool": {
            "must": [
              {term: { "user_id": id }}
            ]
        }};
        const result = await elasticService.search('author', query);
        if(result.hits && result.hits.length > 0){
            author = await this.generateAuthorData(result.hits[0]._source);
        }
        return author;     
    }

    async getAuthorBySlug(slug, callback){
        let author = null;
        const query = { "bool": {
            "must": [
              {term: { "slug.keyword": slug }}
            ]
        }};
        const result = await elasticService.search('author', query);
        if(result.hits && result.hits.length > 0){
            author = await this.generateAuthorData(result.hits[0]._source, true);
        }
        if(callback){
            if(author){
                callback(null, {status: 'success', message: 'Fetched successfully!', data: author});
            }else{
                callback(null, {status: 'failed', message: 'Not found!', data: author});
            }            
        }else{
            return author;  
        }           
    }


    async getArticleByAuthor(author_id, isListing = true){
        let articles = [];
        const queryBody = {
            "query": {
              "bool": {
                "must": [
                  {term: { "status.keyword": 'published' }},
                  {
                      "bool": {
                        "should": [
                            {term: { "author_id": author_id }},
                            {term: {"co_authors.user_id": author_id}}
                        ]
                    }
                }
                ]
             }
            }
        };

            const result = await elasticService.plainSearch('article', queryBody);
            if(result.hits){
                if(result.hits.hits && result.hits.hits.length > 0){
                    for(const hit of result.hits.hits){
                        const article = await this.generateSingleViewData(hit._source, isListing);
                        articles.push(article);
                    }
                }
            } 
        return articles;
    }


}