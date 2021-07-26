const elasticService = require("./elasticService");
const fetch = require("node-fetch");

const { 
    getFilterConfigs, 
    parseQueryFilters,
    getPaginationQuery,
    getMediaurl,
    updateFilterCount,
    calculateFilterCount,
    getFilterAttributeName,
    updateSelectedFilters,
    sortFilterOptions,
    generateMetaInfo
} = require('../utils/general');
const apiBackendUrl = process.env.API_BACKEND_URL;

const MAX_RESULT = 10000;
const keywordFields = ['title', 'slug'];
const filterFields = ['title','section_name','categories','levels','tags', 'slug'];
const allowZeroCountFields = ['section_name','categories','levels','tags'];

const getAllFilters = async (query, queryPayload, filterConfigs) => {
    if(queryPayload.from !== null && queryPayload.size !== null){
        delete queryPayload['from'];
        delete queryPayload['size'];
    }
    const result = await elasticService.search('article', query, {from: 0, size: MAX_RESULT});
    if(result.total && result.total.value > 0){
        return {
            filters: await formatFilters(result.hits, filterConfigs, query),
            total: result.total.value
        };
    }else{
        return {
            filters: [],
            total: result.total.value
        };
    }
};


const formatFilters = async (data, filterData, query) => {
    let filters = [];
    let emptyOptions = [];
    for(const filter of filterData){

        let formatedFilters = {
            label: filter.label,
            field: filter.elastic_attribute_name,
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
            options: (filter.filter_type == "Checkboxes") ? getFilterOption(data, filter)  : [],
        };
        
        if(filter.filter_type !== 'RangeSlider'){
            if(formatedFilters.options.length <= 0){
                emptyOptions.push(filter.label);
            }
        }

        filters.push(formatedFilters);
    }

    if(emptyOptions.length > 0){
        filters = filters.filter(function( obj ) {
            return !emptyOptions.includes(obj.label);
          });
    }

    return filters;    
};


const getFilterOption = (data, filter) => {
    let options = [];
    for(const esData of data){
        const entity = esData._source;
        let entityData = entity[filter.elastic_attribute_name];
        if(entityData){
            if(Array.isArray(entityData)){
                for(const entry of entityData){
                    let existing = options.find(o => o.label === entry);
                    if(existing){
                        existing.count++;
                    }else{
                        options.push({
                            label: entry,
                            count: 1,
                            selected: false,
                            disabled: false
                        });
                    }
                }
            }else{
                let existing = options.find(o => o.label === entityData);
                if(existing){
                    existing.count++;
                }else{
                    options.push({
                        label: entityData,
                        count: 1,
                        selected: false,
                        disabled: false
                    });
                }
            }
        }
    }
    options = sortFilterOptions(options);
    return options;
};


module.exports = class articleService {

    async getArticleList(req, callback){
        const filterConfigs = await getFilterConfigs('Article');
        const query = { 
            "bool": {
                "must": [
                    {term: { "status.keyword": 'published' }}                
                ],
                //"filter": []
            }
        };

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

        let filterQuery = JSON.parse(JSON.stringify(query));
        let filterQueryPayload = JSON.parse(JSON.stringify(queryPayload));
        let filterResponse = await getAllFilters(filterQuery, filterQueryPayload, filterConfigs);
        let filters = filterResponse.filters;

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
                    const attribute_name = getFilterAttributeName(elasticAttribute.elastic_attribute_name, filterFields);
                    /* query.bool.filter.push({
                        "terms": {[attribute_name]: filter.value}
                    }); */
                    /* query.bool.must.push({
                        "terms": {[attribute_name]: filter.value}
                    }); */
                    for(const fieldValue of filter.value){
                        query.bool.must.push({
                            "term": {[attribute_name]: fieldValue}
                        });
                    }
                }
            }
        }
        
        let queryString = null;
        if(req.query['q']){
            query.bool.must.push(
                {                    
                    "bool": {
                        "should": [
                            {
                                "query_string" : {
                                    "query" : `*${decodeURIComponent(req.query['q']).trim()}*`,
                                    "fields" : ['title^4', 'section_name^3', 'author_first_name^2', 'author_last_name'],
                                    "analyze_wildcard" : true,
                                    "allow_leading_wildcard": true
                                }
                            },
                            {
                                "multi_match": {
                                    "fields":  ['title^4', 'section_name^3', 'author_first_name^2', 'author_last_name'],
                                    "query": decodeURIComponent(req.query['q']).trim(),
                                    "fuzziness": "AUTO",
                                    "prefix_length": 0                              
                                }
                            }           
                        ]
                        }                    
                    }
                
            );         
        }

         /*Ordering as per category tree*/
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

        const result = await elasticService.search('article', query, queryPayload, queryString);
        if(result.total && result.total.value > 0){

            const list = await this.generateListViewData(result.hits);

            let pagination = {
                page: paginationQuery.page,
                count: list.length,
                perPage: paginationQuery.size,
                totalCount: result.total.value,
                total: filterResponse.total
            }

            //let filters = await getAllFilters(query, queryPayload, filterConfigs, result.total.value);
            //filters = updateFilterCount(filters, parsedFilters, filterConfigs, result.hits);

            //update selected flags
            if(parsedFilters.length > 0){
                //filters = updateSelectedFilters(filters, parsedFilters, parsedRangeFilters);
                //filters = updateFilterCount(filters, parsedFilters, filterConfigs, result.hits, allowZeroCountFields);
               // filters = await updateFilterCount(filters, parsedFilters, filterConfigs, result.hits, result.hits, filterResponse.total, query, allowZeroCountFields);

                filters = await calculateFilterCount(filters, parsedFilters, filterConfigs, 'article', result.hits, filterResponse.total, query, allowZeroCountFields, parsedRangeFilters);
                filters = updateSelectedFilters(filters, parsedFilters, parsedRangeFilters);
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
        }else{
            if(parsedFilters.length > 0){
                //filters = updateFilterCount(filters, parsedFilters, filterConfigs, result.hits, allowZeroCountFields);
                filters = await calculateFilterCount(filters, parsedFilters, filterConfigs, 'article', result.hits, filterResponse.total, query, allowZeroCountFields, parsedRangeFilters);
             //   filters = await updateFilterCount(filters, parsedFilters, filterConfigs, 'article', result.hits, filterResponse.total, query, allowZeroCountFields);
                filters = updateSelectedFilters(filters, parsedFilters, parsedRangeFilters);
            }
            callback(null, {status: 'success', message: 'No records found!', data: {list: [], pagination: {total: filterResponse.total}, filters: filters}});
        }        
    }

    async getArticle(slug, callback){
        const query = { "bool": {
            "must": [
              {term: { "slug.keyword": slug }},
              {term: { "status.keyword": 'published' }}
            ]
        }};
        const result = await elasticService.search('article', query);
        if(result.hits && result.hits.length > 0){
            const data = await this.generateSingleViewData(result.hits[0]._source);
            callback(null, {status: 'success', message: 'Fetched successfully!', data: data});
        }else{
            callback({status: 'failed', message: 'Not found!'}, null);
        }        
    }


    async generateListViewData(rows){
        let datas = [];
        for(let row of rows){
            const data = await this.generateSingleViewData(row._source, true);
            datas.push(data);
        }
        return datas;
    }



    async generateSingleViewData(result, isList = false){
        try{
        let coverImageSize = 'large';
        //if(isList){
            //coverImageSize = 'thumbnail';
       // }
        
        let cover_image = null;
        if(result.cover_image){
            if(result.cover_image[coverImageSize]){
                cover_image = getMediaurl(result.cover_image[coverImageSize]);
            }else{
                cover_image = getMediaurl(result.cover_image['thumbnail']);
            }
        }
        if(!cover_image){
            cover_image = getMediaurl(result.cover_image['url']);
        }
        
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

        if(auth){
            author = {
                id: auth.author_id,
                username: auth.username,
                firstname: auth.firstname,
                lastname: auth.lastname ? auth.lastname:"",
                designation: auth.designation,
                bio: auth.bio,
                slug: auth.slug,
                image:auth.image
            };
        }else{
            author = {
                id: result.author_id,
                username: result.author_username,
                firstname: result.author_first_name,
                lastname: result.last_name ? result.author_last_name:"",
                designation: result.author_designation,
                bio: result.author_bio,
                slug: result.author_slug
            };
        }

        let data = {
            title: result.title,
            slug: result.slug,
            id: `ARTCL_PUB_${result.id}`,
            cover_image: cover_image,
            short_description: result.short_description,
            content: (!isList) ? result.content : null,
            author: author,
            co_authors: (result.co_authors)? result.co_authors : null,
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
                      {term: { "author_id": author_id }}
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