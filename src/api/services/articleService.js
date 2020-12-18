const elasticService = require("./elasticService");
const fetch = require("node-fetch");

const apiBackendUrl = process.env.API_BACKEND_URL;
const rangeFilterTypes = ['RangeSlider','RangeOptions'];
const MAX_RESULT = 10000;
const keywordFields = ['title'];

const getFilterConfigs = async () => {
    let response = await fetch(`${apiBackendUrl}/entity-facet-configs?entity_type=Article&filterable_eq=true&_sort=order:ASC`);
    if (response.ok) {
    let json = await response.json();
    return json;
    } else {
        return [];
    }
};

const parseQueryFilters = (filter) => {
    const parsedFilterString = decodeURIComponent(filter);
    console.log("parsedFilterString <> ", parsedFilterString);
    let query_filters = [];
    const filterArray = parsedFilterString.split("::");
    for(const qf of filterArray){
        const qfilters = qf.split(":");
        query_filters.push({
            key: qfilters[0],
            value: qfilters[1].split(",")
        });
    }
    console.log("query_filters <> ", query_filters);
    return query_filters;
};

const getFilterAttributeName = (attribute_name) => {
    const keywordFields = ['title','section_name','categories','levels','tags'];
    if(keywordFields.includes(attribute_name)){
        return `${attribute_name}.keyword`;
    }else{
        return attribute_name;
    }
};

const round = (value, step) => {
    step || (step = 1.0);
    var inv = 1.0 / step;
    return Math.round(value * inv) / inv;
};

const getPaginationQuery = (query) => {
    let page = 1;
    let size = 25;
    let from = 0;
    if(query['page']){
      page = parseInt(query['page']);
    }
    if(query['size']){
      size = parseInt(query['size']);
    }      
    if(page > 1){
      from = (page-1)*size;
    }
    return {
      from,
      size,
      page
    };
};

const getMediaurl = (mediaUrl) => {
    if(mediaUrl !== null && mediaUrl !== undefined){
        const isRelative = !mediaUrl.match(/(\:|\/\\*\/)/);
        if(isRelative){
            mediaUrl = process.env.ASSET_URL+mediaUrl;
        }
    }    
    return mediaUrl;
};


const getAllFilters = async (query, queryPayload, filterConfigs) => {
    if(queryPayload.from !== null && queryPayload.size !== null){
        delete queryPayload['from'];
        delete queryPayload['size'];
    }
    console.log("Query payload for filters data <> ",queryPayload);
    console.log("query for filters data <> ",query);
    const result = await elasticService.search('article', query, {from: 0, size: MAX_RESULT});
    if(result.total && result.total.value > 0){
        console.log("Main data length <> ", result.total.value);
        console.log("Result data length <> ", result.hits.length);
        return formatFilters(result.hits, filterConfigs, query);
    }else{
        return [];
    }
};


const formatFilters = async (data, filterData, query) => {
    console.log("applying filter with total data count <> ", data.length);
    let filters = [];
    let emptyOptions = [];
    for(const filter of filterData){

        let formatedFilters = {
            label: filter.label,
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
        console.log("Empty options <> ", emptyOptions);
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
    return options;
};

const updateSelectedFilters = (filters, parsedFilters, parsedRangeFilters) => {
    for(let filter of filters){
        if(filter.filter_type == "Checkboxes"){
            let seleteddFilter = parsedFilters.find(o => o.key === filter.label);
            console.log("Selected filter for <> "+filter.label+" <> ", seleteddFilter);
            if(seleteddFilter && filter.options){
                for(let option of filter.options){
                    if(seleteddFilter.value.includes(option.label)){
                        option.selected = true;
                    }
                }
            }
        }
        if(filter.filter_type == "RangeOptions"){
            let seleteddFilter = parsedRangeFilters.find(o => o.key === filter.label);
            console.log("Selected filter for <> "+filter.label+" <> ", seleteddFilter);
            if(seleteddFilter && filter.options){
                for(let option of filter.options){
                    if((option.start ==  seleteddFilter.start) && (option.end ==  seleteddFilter.end)){
                        option.selected = true;
                    }
                }
            }
        }
        if(filter.filter_type == "RangeSlider"){
            let seleteddFilter = parsedRangeFilters.find(o => o.key === filter.label);
            console.log("Selected filter for <> "+filter.label+" <> ", seleteddFilter);
            if(seleteddFilter){
                filter.min = seleteddFilter.start;
                filter.max = seleteddFilter.end;
            }
        }
    }
    console.log("parsedRangedFilters <> ", parsedRangeFilters);

    return filters;
};


const updateFilterCount = (filters, parsedFilters, filterConfigs, data) => {
    if(parsedFilters.length <= 0){
        return filters;
    }
    for(let filter of filters){
        if(filter.filter_type !== 'Checkboxes'){
            continue;
        }
        let parsedFilter = parsedFilters.find(o => o.key === filter.label);
        if(!parsedFilter){
            for(let option of filter.options){
                option.count = 0;
                let elasticAttribute = filterConfigs.find(o => o.label === filter.label);
                    if(!elasticAttribute){
                        continue;
                    }
                for(const esData of data){
                    
                    const entity = esData._source; 
                    let entityData = entity[elasticAttribute.elastic_attribute_name];
                    if(entityData){
                        if(Array.isArray(entityData)){
                            if(entityData.includes(option.label)){
                                option.count++;
                            }
                        }else{
                            if(entityData == option.label){
                                option.count++;
                            }
                        }
                    }
                }
                if(option.count == 0){
                    option.disabled = true;
                }
            }
        }

        filter.options = filter.options.filter(function( obj ) {
            return !obj.disabled;
          });
    }
    return filters;
};


module.exports = class articleService {

    async getArticleList(req, callback){
        const filterConfigs = await getFilterConfigs();
        //console.log("filterConfigs <> ", filterConfigs);
        const query = { 
            "bool": {
                //"should": [],
                "must": [
                    {term: { "status.keyword": 'published' }}                
                ],
                "filter": []
            }
        };

        let queryPayload = {};
        let paginationQuery = await getPaginationQuery(req.query);
        queryPayload.from = paginationQuery.from;
        queryPayload.size = paginationQuery.size;
        console.log("paginationQuery <> ", paginationQuery);

        if(!req.query['sort']){
            req.query['sort'] = "published_date:desc";
        }

        if(req.query['sort']){
            console.log("Sort requested <> ", req.query['sort']);
            let sort = req.query['sort'];
            let splitSort = sort.split(":");
            if(keywordFields.includes(splitSort[0])){
                sort = `${splitSort[0]}.keyword:${splitSort[1]}`;
            }
            queryPayload.sort = [sort];
        }

        let parsedFilters = [];
        let parsedRangeFilters = [];

        let filterQuery = JSON.parse(JSON.stringify(query));
        let filterQueryPayload = JSON.parse(JSON.stringify(queryPayload));
        let filters = await getAllFilters(filterQuery, filterQueryPayload, filterConfigs);

        if(req.query['f']){
            parsedFilters = parseQueryFilters(req.query['f']);
            for(const filter of parsedFilters){
                let elasticAttribute = filterConfigs.find(o => o.label === filter.key);
                if(elasticAttribute){
                    const attribute_name  = getFilterAttributeName(elasticAttribute.elastic_attribute_name);
                    query.bool.filter.push({
                        "terms": {[attribute_name]: filter.value}
                    });
                }
            }
        }
        
        let queryString = null;
        if(req.query['q']){
            query.bool.must.push( 
                {
                    "query_string" : {
                        "query" : `*${decodeURIComponent(req.query['q'])}*`,
                        "fields" : ['title','slug','tags','section_name','levels','author_first_name','author_last_name','categories'],
                        "analyze_wildcard" : true,
                        "allow_leading_wildcard": true
                    }
                }
            );         
        }
        console.log("Final Query <> ", JSON.stringify(query));

        const result = await elasticService.search('article', query, queryPayload, queryString);
        if(result.total && result.total.value > 0){

            const list = await this.generateListViewData(result.hits);

            let pagination = {
                page: paginationQuery.page,
                count: list.length,
                perPage: paginationQuery.size,
                totalCount: result.total.value
            }

            //let filters = await getAllFilters(query, queryPayload, filterConfigs, result.total.value);
            filters = updateFilterCount(filters, parsedFilters, filterConfigs, result.hits);

            //update selected flags
            if(parsedFilters.length > 0){
                filters = updateSelectedFilters(filters, parsedFilters, parsedRangeFilters);
            }

              let data = {
                list: list,
                filters: filters,
                pagination: pagination,
                sort: req.query['sort']
              };

            
            callback(null, {status: 'success', message: 'Fetched successfully!', data: data});
        }else{
            callback(null, {status: 'success', message: 'No records found!', data: {list: [], pagination: {}, filters: []}});
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
        
        let coverImageSize = 'small';
        if(isList){
            coverImageSize = 'thumbnail';
        }

        let author = (!isList) ? await this.getAuthor(result.author_id) : null;
        if(!author){
            author = {
                id: result.author_id,
                username: result.author_username,
                firstname: result.author_first_name,
                lastname: result.author_last_name,
                designation: result.author_designation,
                bio: result.author_bio
            };
        }

        let data = {
            title: result.title,
            slug: result.slug,
            id: `ARTCL_PUB_${result.id}`,
            cover_image: (result.cover_image) ? getMediaurl(result.cover_image[coverImageSize]) : null,
            short_description: result.short_description,
            content: (!isList) ? result.content : null,
            author: author,
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
            recommended_articles: (result.recommended_articles && !isList) ? await this.getArticleByIds(result.recommended_articles) : []
        };

        if(!isList){
            data.meta_information = {
                meta_tile: result.meta_tile,
                meta_description: result.meta_description,
                meta_keywords: result.meta_keywords
            }
        }

        return data;
    }


    async getArticleByIds(articleIds){
        let articles = [];
        let articleOrdered = [];
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
                        const article = await this.generateSingleViewData(hit._source, true);
                        articles.push(article);
                    }
                    for(const id of articleIds){
                        let article = articles.find(o => o.id === "ARTCL_PUB_"+id);
                        articleOrdered.push(article);
                    }
                }
            }            
        }
        return articleOrdered;
    }


    async generateAuthorData(result){
        let data = {
            id: result.id,
            user_id: result.user_id,
            username: result.username,
            firstname: result.first_name,
            lastname: result.last_name,
            designation: result.designation,
            bio: result.bio,
            image: (result.image) ? getMediaurl(result.image.url) : null
        };
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


}