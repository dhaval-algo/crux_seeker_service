const elasticService = require("./elasticService");
const fetch = require("node-fetch");
const models = require("../../../models");
const helperService = require("../../utils/helper");

const categoryService = require("./categoryService");
const CategoryService = new categoryService();
const redisConnection = require('../../services/v1/redis');

const RedisConnection = new redisConnection();

const { 
    getFilterConfigs, 
    parseQueryFilters,
    getPaginationQuery,
    getMediaurl,
    getFilterAttributeName,
    updateSelectedFilters,
    generateMetaInfo,
    compareRule,
    getCurrencies,
    getCurrencyAmount,
    formatImageResponse
} = require('../utils/general');
const apiBackendUrl = process.env.API_BACKEND_URL;

const MAX_RESULT = 10000;
const keywordFields = ['title', 'slug'];
const filterFields = ['title','section_name','categories','levels','tags', 'slug','author_slug','article_sub_categories','article_job_roles','article_skills','article_topics'];
const allowZeroCountFields = ['section_name','categories','levels','tags', 'author_slug'];
const {getSearchTemplate} = require("../../utils/searchTemplates");
const sortOptions = {
    'Newest' :["created_at:desc"],
    'A-Z': ["title:asc"],
    'Z-A' :["title:desc"],
}

const currencyToRegion = {
    "INR" : "India",
    "EUR": "Europe",
    "GBP" : "UK",
    "USD" : "USA"
  }
  

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

const getEmiBaseCurrency = (result) => {
    return result.emi_currency? result.emi_currency.iso_code:null;
};

module.exports = class articleService {

    async getArticleList(req, callback){
        let userCurrency= (req && req.query && req.query['currency'] )? req.query['currency']: process.env.DEFAULT_CURRENCY 
        let region = currencyToRegion[userCurrency]

        const filterConfigs = await getFilterConfigs('Article');
        let searchTemplate = null;
        const userId = (req.user && req.user.userId) ? req.user.userId : req.segmentId;
        let esFilters = {}

        let publishedFilter = {term: { "status.keyword": 'published' }};
        esFilters['published'] = publishedFilter;

        let query = null;
        if (req.query['q']) {

            searchTemplate = await getSearchTemplate('article', decodeURIComponent(req.query['q']).replace("+", "//+").trim(), userId);
            query = searchTemplate.function_score.query;
            esFilters['q'] = searchTemplate.function_score.query.bool.must[1];

        } else {
            query = {
                "bool": {
                    "must": [
                        publishedFilter
                    ],
                }
            };
        }

        query.bool.must.push({
            "bool": {
              "should": [
                {
                  "bool": {
                    "filter": [
                      {
                        "terms": {
                          "template.keyword": [
                            "ARTICLE",
                            "LEARN_GUIDE",
                            "LEARN_ADVICE"
                          ]
                        }
                      }
                    ]
                  }
                },
                {
                  "bool": {
                    "filter": [
                      {
                        "term": {
                          "template.keyword": "CAREER_GUIDE"
                        }
                      },
                      {
                        "term": {
                          "career_level.keyword": "Level 1"
                        }
                      } ,
                      {
                        "term": {
                          "region.keyword": region
                        }
                      }
                    ]
                  }
                }
              ]
            }
          })

        if(req.query.articleIds)
        {
            let filterObject = { 
                "ids": {
                    "values": req.query.articleIds
                }}

            query.bool.must.push(filterObject);
        }

        let queryPayload = {};
        let paginationQuery = await getPaginationQuery(req.query);
        queryPayload.from = paginationQuery.from;
        queryPayload.size = paginationQuery.size;
        

        if(!req.query['sort'] && !req.query['q']){
            req.query['sort'] = 'Newest';
        }
        if (req.query['sort']) {
            queryPayload.sort = []
            const keywordFields = ['title'];
            let sort = sortOptions[req.query['sort']];
            for(let field of sort){
        
                let splitSort = field.split(":");
                if(keywordFields.includes(splitSort[0])){
                    field = `${splitSort[0]}.keyword:${splitSort[1]}`;
                }
                queryPayload.sort.push(field)
            }                

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
        
        let result = await elasticService.searchWithAggregate('article', searchTemplate ? searchTemplate : query, queryPayload, queryString);
        let aggs_result = result.aggregations;
        result = result.hits;

        for (let filter of filterConfigs) {

            let facet = aggs_result.all_filters[filter.elastic_attribute_name];

            let formatedFilters = {
                label: filter.label,
                field: filter.elastic_attribute_name == "author_first_name" ? "author_slug" : filter.elastic_attribute_name,
                filterable: filter.filterable,
                sortable: filter.sortable,
                filter_postion: filter.filter_postion || 'vertical',                
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
                if(facet.filtered){
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
           let category_tree = await CategoryService.getTreeV2(false) || [];
           let categoryFiletrOption =[];
           let categorykey = 0;
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
            sort: req.query['sort'],
            sortOptions: Object.keys(sortOptions)
          };

          let meta_information = await generateMetaInfo  ('article-list', result.hits);
          if(meta_information)
          {
              data.meta_information  = meta_information;
          }    
        
        callback(null, {success: true, message: 'Fetched successfully!', data: data});

    }

    async addActivity(req, callback){
        try {
             const {user} = req;
             const {articleId} = req.body	
             const activity_log =  await helperService.logActvity("ARTICLE_VIEW",(user)? user.userId : null, articleId);
             callback(null, {success: true, message: 'Added successfully!', data: null});
        } catch (error) {
            console.log("Article view activity error",  error)
            callback(null, {success: false, message: 'Failed to Add', data: null});
        }
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
            callback(null, {success: true, message: 'Fetched successfully!', data: data});
            req.body = {articleId: data.id}
            this.addActivity(req, (err, data) => {})
        }else{
            let redirectUrl = await helperService.getRedirectUrl(req);
            if (redirectUrl) {
                return callback(null, { success: false, redirectUrl: redirectUrl, message: 'Redirect' });
            }
            return callback(null, { success: false, message: 'Not found!' });
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
        let author = null
        if (!isList && req)
        {
            let premium = (result.premium)? result.premium:false
            rewards = await CheckArticleRewards(req.user, premium);
        }

        if(!result.created_by_role) result.created_by_role='author'
        if(!result.template ) result.template='ARTICLE'

        if(result.created_by_role=='author' && result.template== "ARTICLE" )
        {            
            let auth = await this.getAuthor(result.author_id);         
            if(auth){
                author = [{
                    id: auth.author_id,
                    username: auth.username,
                    firstname: auth.firstname.trim(),
                    lastname: auth.lastname ? auth.lastname.trim():"",
                    designation: auth.designation,
                    bio: auth.bio,
                    slug: auth.slug,
                    image:auth.image
                }];
            }else{
                author = [{
                    id: result.author_id,
                    username: result.author_username,
                    firstname: result.author_first_name.trim(),
                    lastname: result.last_name ? result.author_last_name.trim():"",
                    designation: result.author_designation,
                    bio: result.author_bio,
                    slug: result.author_slug
                }];
            }
        }
        else
        {
            author = []
        }
        if(result.co_authors && result.co_authors.length > 0)
        {
            for( let co_author of result.co_authors)
            {
                author.push({
                    id: co_author.id,
                    username: co_author.username,
                    firstname:co_author.first_name.trim(),
                    lastname: co_author.last_name ? co_author.last_name.trim():"",
                    designation: co_author.designation,
                    bio: co_author.bio,
                    slug: co_author.slug,
                    image: (co_author.image) ? formatImageResponse(co_author.image) :  null
                });
            }
        }

        if(result.partners && result.partners.length > 0 )
        {
            const partnerQuery = { 
                "bool": {
                    "should": [
                      {
                        "match": {
                         "id": {"boost": 2, "query": result.partners[0] }
                          
                        }
                        
                      },
                       {
                        "terms": {
                          "id": result.partners 
                        }
                      }
                    ]
                  }
            };
            const partnerResult = await elasticService.search('partner', partnerQuery, {}, null);
            let partners = []
            if(partnerResult.total && partnerResult.total.value > 0){
                for(let hit of partnerResult.hits){
                    partners.push({
                        name: hit._source.name.trim(),
                        id: hit._source.id,
                        slug: hit._source.slug,
                        image:  (hit._source.cover_image)? formatImageResponse(hit._source.cover_image) : null
                    })
                }
            }
            result.partners = partners
        }                

        let data = {
            title: result.title,
            premium: (result.premium)? result.premium:false,
            display_author: (result.display_author)? result.display_author:true,
            slug: result.slug,
            id: `ARTCL_PUB_${result.id}`,          
            cover_image: (result.cover_image)? formatImageResponse(result.cover_image) : null,            
            listing_image: (result.listing_image)? formatImageResponse(result.listing_image) : ((result.cover_image)? formatImageResponse(result.cover_image) : null),            
            short_description: result.short_description,
            author: (author)? author: [],
            partners: (result.partners)? result.partners : [],
            created_by_role: (result.created_by_role)? result.created_by_role:'author',
            published_date: result.published_date,
            categories: (result.categories) ? result.categories : [],
            topics: (result.article_topics) ? result.article_topics : [],
            sub_categories: (result.article_sub_categories) ? result.article_sub_categories : [],
            levels: (result.levels) ? result.levels : [],
            duration:(result.duration) ? result.duration : null,
            tags: (result.tags) ? result.tags : [],            
            section_name: result.section_name,
            section_slug: result.section_slug,
            ads_keywords:result.ads_keywords,
            template:result.template
        };

        data.emiInUserCurrency = null
        if(result.emi_amount){       
            let userCurrency= (req && req.query && req.query['currency'] )? req.query['currency']: process.env.DEFAULT_CURRENCY    
            let currencies = await getCurrencies();           
            const emiBaseCurrency = getEmiBaseCurrency(result);
            let emiInUserCurrency = parseFloat(getCurrencyAmount(result.emi_amount, currencies, emiBaseCurrency, userCurrency));
            data.emiInUserCurrency = emiInUserCurrency
        }

        data.brochure = null
        if(result.brochure){       
            data.brochure = {
                name: result.brochure.name,
                ext: result.brochure.ext,
                mime: result.brochure.mime,
                url: result.brochure.url
            }
        }

        if(!isList){
            let meta_information = await generateMetaInfo  ('article', result);
            if(meta_information)
            {
                data.meta_information  = meta_information;
            }
        }
       
        if(!isList){
            data.full_access = false;
            
            if(rewards && rewards.length > 0)
            {
                if(rewards[0].access_type == 'full_access')
                {
                    data.content = {}
                    data.full_access= true;
                    if(result.template== "ARTICLE"){
                        data.content.description = result.content;
                        data.content.content_section = result.content_section || null
                        data.content.level_info = result.level_info || null
                        if(data.content.level_info){
                            data.content.level_info.levels_beginner = result.article_level_beginner || null
                            data.content.level_info.levels_intermediate = result.article_level_intermediate || null
                            data.content.level_info.levels_advance = result.article_level_advance || null
                        }else{
                            data.content.level_info = {}
                            data.content.level_info.levels_beginner = result.article_level_beginner || null
                            data.content.level_info.levels_intermediate = result.article_level_intermediate || null
                            data.content.level_info.levels_advance = result.article_level_advance || null
                        }
                        data.content.course_recommendation = result.course_recommendation || null;
                        data.content.conclusion = result.conclusion || null;
                        if(result.summary_title && result.summary_content)
                        {
                            data.content.summary = {
                                title: result.summary_title,
                                content: result.summary_content
                            }
                        }
                    }
                    if(result.template== "LEARN_GUIDE"){
                        data.content.description = result.description || null;
                        data.content.introduction  = result.introduction || null;
                        data.content.specialization  = result.specialization || null;
                        data.content.prerequisites   = result.prerequisites|| null;
                        data.content.path_to_take   = result.path_to_take || null;
                        data.content.soft_skills   =  null
                        if(result.soft_skills_title)
                        {
                            data.content.soft_skills   = {
                                title:  result.soft_skills_title,
                                description:  result.soft_skills_description,
                                skills:  result.soft_skills_skills
                            }
                            if(data.content.soft_skills.skills && data.content.soft_skills.skills.length > 0)
                            {
                                data.content.soft_skills.skills.map(async (skill, index) => {
                                    let skill_info = await RedisConnection.getValuesSync(`skill_${skill.default_display_label }`)
                                    data.content.soft_skills.skills[index].logo =  skill_info.logo ? formatImageResponse(skill_info.logo) : null;
                                    data.content.soft_skills.skills[index].description =  skill_info.description || null;
                                })
                            }                            
                        }
                        data.content.technical_skills   =  null
                        if(result.soft_skills_title)
                        {
                            data.content.technical_skills    = {
                                title:  result.technical_skills_title,
                                description:  result.technical_skills_description,
                                beginner_skills:  result.technical_skills_beginner_skills,
                                intermediate_skills:  result.technical_skills_intermediate_skills,
                                advanced_skills:  result.technical_skills_advanced_skills
                            }
                            if(data.content.technical_skills.beginner_skills && data.content.technical_skills.beginner_skills.length > 0)
                            {
                                data.content.technical_skills.beginner_skills.map(async (skill, index) => {
                                    let skill_info = await RedisConnection.getValuesSync(`skill_${skill.default_display_label }`)
                                    data.content.technical_skills.beginner_skills[index].logo =  skill_info.logo ? formatImageResponse(skill_info.logo) : null;
                                    data.content.technical_skills.beginner_skills[index].image =  skill_info.image ? formatImageResponse(skill_info.image) : null;
                                    data.content.technical_skills.beginner_skills[index].description =  skill_info.beginner_description || null;
                                })
                            }
                            if(data.content.technical_skills.intermediate_skills && data.content.technical_skills.intermediate_skills.length > 0)
                            {
                                data.content.technical_skills.intermediate_skills.map(async (skill, index) => {
                                    let skill_info = await RedisConnection.getValuesSync(`skill_${skill.default_display_label }`)
                                    data.content.technical_skills.intermediate_skills[index].logo =  skill_info.logo ? formatImageResponse(skill_info.logo) : null;
                                    data.content.technical_skills.intermediate_skills[index].image =  skill_info.image ? formatImageResponse(skill_info.image) : null;
                                    data.content.technical_skills.intermediate_skills[index].description =  skill_info.intermediate_description || null;
                                })
                            }
                            if(data.content.technical_skills.advanced_skills && data.content.technical_skills.advanced_skills.length > 0)
                            {
                                data.content.technical_skills.advanced_skills.map(async (skill, index) => {
                                    let skill_info = await RedisConnection.getValuesSync(`skill_${skill.default_display_label }`)
                                    data.content.technical_skills.advanced_skills[index].logo =  skill_info.logo ? formatImageResponse(skill_info.logo) : null;
                                    data.content.technical_skills.advanced_skills[index].image =  skill_info.image ? formatImageResponse(skill_info.image) : null;
                                    data.content.technical_skills.advanced_skills[index].description =  skill_info.advanced_description || null;
                                })
                            }
                            data.content.level_beginner   = result.level_beginner || null;
                            data.content.level_intermediate    = result.level_intermediate  || null;
                            data.content.level_advanced   = result.level_advanced || null;
                            data.content.job_prospects   = result.job_prospects || null;
                            data.content.advantages   = result.advantages || null;
                            data.content.faq     = result.faq || null;
                            data.content.conclusion    = result.conclusion || null;                             
                        }                        
                    }
                    if(result.template== "CAREER_GUIDE"){
                        data.content.region = result.region || null;
                        data.content.career_level = result.career_level || null;
                        data.content.description = result.description || null;
                        data.content.role_duties  = result.role_duties || null;                        
                        data.content.prerequisites   = result.prerequisites|| null;
                        data.content.required_skills  = result.required_skills || null;
                        data.content.soft_skills   =  null
                        if(result.soft_skills_title)
                        {
                            data.content.soft_skills   = {
                                title:  result.soft_skills_title,
                                description:  result.soft_skills_description,
                                skills:  result.soft_skills_skills
                            }
                            if(data.content.soft_skills.skills && data.content.soft_skills.skills.length > 0)
                            {
                                data.content.soft_skills.skills.map(async (skill, index) => {
                                    let skill_info = await RedisConnection.getValuesSync(`skill_${skill.default_display_label }`)
                                    data.content.soft_skills.skills[index].logo =  skill_info.logo ? formatImageResponse(skill_info.logo) : null;
                                    data.content.soft_skills.skills[index].description =  skill_info.description || null;
                                })
                            }                            
                        }
                        data.content.technical_skills   =  null
                        if(result.soft_skills_title)
                        {
                            data.content.technical_skills    = {
                                title:  result.technical_skills_title,
                                description:  result.technical_skills_description,
                                beginner_skills:  result.technical_skills_beginner_skills,
                                intermediate_skills:  result.technical_skills_intermediate_skills,
                                advanced_skills:  result.technical_skills_advanced_skills
                            }
                            if(data.content.technical_skills.beginner_skills && data.content.technical_skills.beginner_skills.length > 0)
                            {
                                data.content.technical_skills.beginner_skills.map( async  (skill, index) => {
                                    let skill_info = await RedisConnection.getValuesSync(`skill_${skill.default_display_label }`)
                                    data.content.technical_skills.beginner_skills[index].logo =   skill_info.logo ? formatImageResponse(skill_info.logo) : null;
                                    data.content.technical_skills.beginner_skills[index].image =  skill_info.image ? formatImageResponse(skill_info.image) : null;
                                    data.content.technical_skills.beginner_skills[index].description =  skill_info.beginner_description || null;
                                })
                            }
                            if(data.content.technical_skills.intermediate_skills && data.content.technical_skills.intermediate_skills.length > 0)
                            {
                                data.content.technical_skills.intermediate_skills.map( async (skill, index) => {
                                    let skill_info = await RedisConnection.getValuesSync(`skill_${skill.default_display_label }`)
                                    data.content.technical_skills.intermediate_skills[index].logo =  skill_info.logo ? formatImageResponse(skill_info.logo) : null;
                                    data.content.technical_skills.intermediate_skills[index].image = skill_info.image ? formatImageResponse(skill_info.image) : null;
                                    data.content.technical_skills.intermediate_skills[index].description =  skill_info.intermediate_description || null; 
                                })
                            }
                            if(data.content.technical_skills.advanced_skills && data.content.technical_skills.advanced_skills.length > 0)
                            {
                                data.content.technical_skills.advanced_skills.map(async  (skill, index) => {
                                    let skill_info = await RedisConnection.getValuesSync(`skill_${skill.default_display_label }`)
                                    data.content.technical_skills.advanced_skills[index].logo =   skill_info.logo ? formatImageResponse(skill_info.logo) : null;
                                    data.content.technical_skills.advanced_skills[index].image =  skill_info.image ? formatImageResponse(skill_info.image) : null;
                                    data.content.technical_skills.advanced_skills[index].description =  skill_info.advanced_description || null;
                                })
                            }                            
                            data.content.skill_acquisition   = result.skill_acquisition || null;
                            data.content.insights    = result.insights  || null;
                            data.content.summary   = result.summary || null;
                            data.content.reviews   = result.reviews || null;
                            if(data.content.reviews && data.content.reviews.length > 0)
                            {
                                data.content.reviews.map((review, index) => {
                                    data.content.reviews[index].image =  review.image ? formatImageResponse(review.image) : null;
                                })
                            }
                            data.content.top_hiring_companies   = result.top_hiring_companies || null;
                            if(data.content.top_hiring_companies && data.content.top_hiring_companies.length > 0)
                            {
                                data.content.top_hiring_companies.map((top_hiring_company, index) => {
                                    data.content.top_hiring_companies[index].image =  top_hiring_company.image ? formatImageResponse(top_hiring_company.image) : null;
                                })
                            }
                            data.content.faq     = result.faq || null;                            
                        }
                        const queryBody = {              
                              "bool": {
                                "filter": [
                                  {term: { "group_id.keyword": result.group_id }}
                                ]
                            }
                        };
                        
                        const groupResult = await elasticService.search('article', queryBody, { _source: ['region','career_level','slug']});
                        
                        let variations = {
                            regions: [],
                            levels: [],
                            slugs:{}
                        }
                        if(groupResult.hits){
                            if(groupResult.hits && groupResult.hits.length > 0){
                                for(const hit of groupResult.hits){                                   
                                    variations.regions.push(hit._source.region)
                                    variations.levels.push(hit._source.career_level)
                                    if(!variations.slugs[hit._source.region]) variations.slugs[hit._source.region] = []
                                    variations.slugs[hit._source.region].push ({label:hit._source.career_level, slug:hit._source.slug})
                                }
                            }
                        }
                        
                        variations.regions = variations.regions.filter((x, i, a) => a.indexOf(x) == i)                       
                        
                        data.variations = []
                        for(let region of variations.regions)
                        {
                            data.variations.push({
                                label: region,
                                levels: variations.slugs[region]
                            })
                        }                       
                    }
                    if(result.template== "LEARN_ADVICE"){
                        data.content.banner = result.banner || null;
                        if(data.content.banner)
                        {
                            data.content.banner.partner_logo = data.content.banner.partner_logo ? formatImageResponse (data.content.banner.partner_logo) : null
                            data.content.banner.banner_image = data.content.banner.banner_image ? formatImageResponse (data.content.banner.banner_image) : null
                        }
                        data.content.overview = result.overview || null;
                        data.content.quote  = result.quote || null;                        
                        data.content.course_structure   = result.course_structure|| null;
                        data.content.final_take  = result.final_take || null;
                        data.content.insider_tips  = result.insider_tips || null;                         
                        data.content.takeaways  = result.takeaways || null;
                        
                    }
                   
                }              
            }     
        }

        if(result.custom_ads_keywords) {
            data.ads_keywords +=`,${result.custom_ads_keywords}` 
        }

        //SET popular and trending keys
        const ARTICLE_POPULARITY_SCORE_THRESHOLD = await RedisConnection.getValuesSync("ARTICLE_POPULARITY_SCORE_THRESHOLD");

        data.isPopular  = false
        if(ARTICLE_POPULARITY_SCORE_THRESHOLD && result.activity_count && (result.activity_count.all_time.popularity_score > parseInt(ARTICLE_POPULARITY_SCORE_THRESHOLD)))
        {
            data.isPopular  = true
        }

        const ARTICLE_TRENDING_SCORE_THRESHOLD = await RedisConnection.getValuesSync("ARTICLE_TRENDING_SCORE_THRESHOLD");
        
        data.isTrending  = false
        if(ARTICLE_TRENDING_SCORE_THRESHOLD && result.activity_count && (result.activity_count.last_x_days.trending_score > parseInt(ARTICLE_TRENDING_SCORE_THRESHOLD)))
        {
            data.isTrending  = true
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
            image: (result.image) ? formatImageResponse (result.image) : null,
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

    async getAuthorBySlug(req, callback){
        const slug = req.params.slug;
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
                callback(null, {success: true, message: 'Fetched successfully!', data: author});
            }else{
                let redirectUrl = await helperService.getRedirectUrl(req);
                if (redirectUrl) {
                    return callback(null, { success: false, redirectUrl: redirectUrl, message: 'Redirect' });
                }
                return callback(null, { success: false, message: 'Not found!' });
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