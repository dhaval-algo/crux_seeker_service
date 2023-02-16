require('dotenv').config();
const SitemapStream = require('sitemap').SitemapStream
const streamToPromise = require('sitemap').streamToPromise
const RSS = require('rss');
const { default: Axios } = require('axios');
const elasticService = require('../../../api/services/elasticService');
const { uploadFileToS3 } = require('../AWS');
const { exec } = require('child_process');
let slugs = []
const MAX_RESULT = 10000;
const iterate = (obj, smStream, route) => {
    Object.keys(obj).forEach(key => {

        switch (route) {
            case "courses":
                switch (obj[key]) {
                    case 'category':
                    case 'sub-category':
                        // if (slugs.includes(obj.slug)){
                        //     console.log(obj.slug, "includesss");
                        //     break;
                        // }
                        smStream.write({
                            url: `/courses/${obj.slug}`,
                            changefreq: 'daily', 
                            priority: 0.9
                        })
                        break;
                    default:
                        break;
                }
                break;
            case "topic":
                // if (slugs.includes(obj.slug))
                //     break;
                switch (obj[key]) {
                    case 'topic':
                        smStream.write({
                            url: `/topic/${obj.slug}`,
                        })
                        break;
                    default:
                        break;
                }
                break;

            default:
                break;
        }
        // if(!slugs.includes(obj.slug)){
        //     slugs.push(obj.slug)
        // }
        if (typeof obj[key] === 'object') {
            iterate(obj[key], smStream, route)
        }
    })
    return smStream;

}

function createCourse() {
    return new Promise(async (resolve) => {
        try {

            let query = { 
                "bool": {                   
                    "must": [
                        {term: { "status.keyword": 'published' }}                
                    ]
                }
            };
            let payload= {sortObject: [{"id": {"order": "asc"}}], size: MAX_RESULT,_source:["slug", "updated_at"] }
            let result = await elasticService.search('learn-content', query, payload );
            let smStream = new SitemapStream({
                hostname: process.env.FRONTEND_URL,
            });
              //link for course  listing page
              smStream.write({
                url: `/courses/search`,
                changefreq: 'daily', 
                priority: 0.8
            });

             //link for comapre listing page
             smStream.write({
                url: `/compare`,
                changefreq: 'daily', 
                priority: 0.8
            });
            
            if (result.hits) {
                let last_sort_val;
                if (result.hits && result.hits.length > 0) {
                    for (const hit of result.hits) {
                        smStream.write({
                            url: `/course/${hit._source.slug}`,
                            lastmod: hit._source.updated_at,
                            changefreq: 'daily', 
                            priority: 0.9
                        });
                        last_sort_val = hit.sort
                    }
                }
                //generate course url 

               // generate url after 10000 
                if(result.total.value > MAX_RESULT )
                {
                    for (let i=1; i < Math.ceil(result.total.value/MAX_RESULT) ; i++)
                    {
                        payload= {sortObject: [{"id": {"order": "asc"}}], search_after:last_sort_val, size: MAX_RESULT,_source:["slug", "updated_at"] }
                        result = await elasticService.search('learn-content', query, payload );
                        if (result.hits && result.hits.length > 0) {
                            for (const hit of result.hits) {
                                smStream.write({
                                    url: `/course/${hit._source.slug}`,
                                    lastmod: hit._source.updated_at,
                                    changefreq: 'daily', 
                                    priority: 0.9
                                });
                                last_sort_val = hit.sort
                            }
                        }
                    }
                }

                smStream.end();                
                // generate a sitemap and add the XML feed to a url which will be used later on.
                const sitemap = await streamToPromise(smStream).then((sm) => sm.toString());
                //write to aws 
                let path = 'sitemaps/course.xml'
                let contentType = 'text/xml'
                const res = await uploadFileToS3(path, sitemap, contentType)
                resolve(sitemap)
            }

        } catch (error) {
            console.log(error);
        }

        resolve(true)
    })
}

function createProvider() {
    return new Promise(async (resolve) => {
        try {
            let query = { 
                "bool": {                   
                    "must": [
                        {term: { "status.keyword": 'approved' }}                
                    ]
                }
            };
            const  payload= {from: 0, size: MAX_RESULT,_source:["slug", "updated_at"] }
            const result = await elasticService.search('provider', query, payload);
            let smStream = new SitemapStream({
                hostname: process.env.FRONTEND_URL,
            });

             //link for institute listing page
             smStream.write({
                url: `/institutes`,
                changefreq: 'daily', 
                priority: 0.8
            });
           
            if (result.hits) {
                if (result.hits && result.hits.length > 0) {
                    for (const hit of result.hits) {
                        smStream.write({
                            url: `/institute/${hit._source.slug}`,
                            lastmod: hit._source.updated_at,
                            changefreq: 'weekly', 
                            priority: 0.8
                        });
                    }
                }

                smStream.end();
                // generate a sitemap and add the XML feed to a url which will be used later on.
                const sitemap = await streamToPromise(smStream).then((sm) => sm.toString());
                //write to aws 
                let path = 'sitemaps/institute.xml'
                let contentType = 'text/xml'
                const res = await uploadFileToS3(path, sitemap, contentType)
                resolve(sitemap)
            }

        } catch (error) {
            console.log(error);
        }

        resolve(true)
    })
}

function createPartner() {
    return new Promise(async (resolve) => {
        try {

            const query = { 
                "match_all": {}
            };
            const  payload= {from: 0, size: MAX_RESULT,_source:["slug", "updated_at"] }

            const result = await elasticService.search('partner', query, payload);
            let smStream = new SitemapStream({
                hostname: process.env.FRONTEND_URL,
            });
            if (result.hits) {
                if (result.hits && result.hits.length > 0) {
                    for (const hit of result.hits) {
                        smStream.write({
                            url: `/partner/${hit._source.slug}`,
                            lastmod: hit._source.updated_at,
                            changefreq: 'weekly', 
                            priority: 0.8
                        });
                    }
                }


                // fetch category tree

                //generate course url 

                smStream.end();
                // generate a sitemap and add the XML feed to a url which will be used later on.
                const sitemap = await streamToPromise(smStream).then((sm) => sm.toString());
                //write to aws 
                let path = 'sitemaps/partner.xml'
                let contentType = 'text/xml'
                const res = await uploadFileToS3(path, sitemap, contentType)
                resolve(sitemap)
            }

        } catch (error) {
            console.log(error);
        }

        resolve(true)
    })
}

function createNews() {
    return new Promise(async (resolve) => {
        try {

            let query = { 
                "bool": {                   
                    "must": [
                        {term: { "status.keyword": 'approved' }} ,
                        {
                            "range": {
                                "updated_at": {
                                    "gte": "now-2d/d",
                                    "lt": "now/d"
                                }
                            }
                        }
                    ]
                }
            };
            const  payload= {from: 0, size: MAX_RESULT,_source:["slug", "created_at","updated_at","title","summary","contents","author_names"] }
            
            const result = await elasticService.search('news', query, payload);
            //start SiteMap Steram
            let smStream = new SitemapStream({
                hostname: process.env.FRONTEND_URL,
                xmlns: {
                    news: true
                }
            });

            const today = new Date()
            // RSS Feed
            var feed = new RSS({
                title: 'Carervira News',
                description: 'This is the test description',
                feed_url: 'https://www.careervira.com/rss.xml',
                site_url: 'https://www.careervira.com/',
                image_url: 'https://www.careervira.com/ogImage.png',
                managingEditor: 'Careervira',
                webMaster: 'Careervira',
                copyright:today.getFullYear()+' Careervira',
                language: 'en',
               //categories: ['News'],
                pubDate: today,
                ttl: '60'                
            });

            if (result.hits) {
                if (result.hits && result.hits.length > 0) {
                    for (const hit of result.hits) {
                        hit._source.updated_at =  hit._source.updated_at.split("T")[0];
                        smStream.write({
                            url: `/news/${hit._source.slug}`,
                            news: {
                            publication: {
                                name: `Careervira`,
                                language: 'en'
                            },
                            publication_date:  hit._source.updated_at,
                            title: hit._source.title
                            }
                        });

                        // get author 
                        feed.item({
                            title:  hit._source.title,
                            description:  (hit._source.summary && hit._source.summary.description)? hit._source.summary.description : ((hit._source.contents && hit._source.contents.length > 0 && hit._source.contents[0].description)? hit._source.contents[0].description: "" ),
                            url: `${process.env.FRONTEND_URL}/news/${hit._source.slug}`,
                            author: (hit._source.author_names && hit._source.author_names.length)?  hit._source.author_names[0] :'Careervira',
                            date:hit._source.updated_at                             
                           
                        });
                    }
                }
                smStream.end();
                
                // generate a sitemap and add the XML feed to a url which will be used later on.
                const sitemap = await streamToPromise(smStream).then((sm) => sm.toString());
                //write to aws 
                let path = 'sitemaps/news.xml'
                let contentType = 'text/xml'
                const res = await uploadFileToS3(path, sitemap, contentType)

                //generate RSS file
                var rssXml = feed.xml();
                path = 'sitemaps/rss.xml'
                contentType = 'text/xml'
                await uploadFileToS3(path, rssXml, contentType)
                resolve(sitemap)
            }

        } catch (error) {
            console.log(error);
        }

        resolve(true)
    })
}

function createCategories() {
    return new Promise(async resolve => {
        try {
           
            // fetch category tree
            const backEndUrl = `${process.env.API_BACKEND_URL}/category-tree`;
            const categoryTreeRes = await Axios.get(backEndUrl)
            let { final_tree } = categoryTreeRes.data
            let sub_category_parent = []
            for (let category of final_tree)
            {
                for(let subcategory of category.child)
                {
                    sub_category_parent[subcategory.slug] = category.slug;
                }
            }            
            let query = {
                "bool": {     
                    "must": [
                        {term: { "status.keyword": 'published' }}
                    ]
                }
            };
            const  payload= {from: 0, size: MAX_RESULT,_source:["categories_list","sub_categories_list"] }
            const result = await elasticService.search('learn-content', query, payload );
            let smStream = new SitemapStream({
                hostname: process.env.FRONTEND_URL,
            });
            let categories_slug =[];
            let sub_categories_slug =[];
            if (result.hits) {
                if (result.hits && result.hits.length > 0) {
                    for (const hit of result.hits) {
                        for(const category of hit._source.categories_list)
                        {
                            categories_slug.push(category.slug)
                        }
                        for(const sub_category of hit._source.sub_categories_list)
                        {
                            sub_categories_slug.push(sub_category.slug)
                        }

                    }
                    let unique_categories_slug = categories_slug.filter((x, i, a) => a.indexOf(x) == i)
                    let unique_sub_categories_slug = sub_categories_slug.filter((x, i, a) => a.indexOf(x) == i)
                    for(const category of unique_categories_slug)
                    {
                        smStream.write({
                            url: `/courses/${category}`,
                            changefreq: 'daily', 
                            priority: 1,
                        });
                    }
                    for(const sub_category of unique_sub_categories_slug)
                    {
                        smStream.write({
                            url: `/courses/${sub_category_parent[sub_category]}/${sub_category}`,
                            changefreq: 'daily', 
                            priority: 1,
                        }); 

                    }        
                }
                smStream.end();

                // generate a sitemap and add the XML feed to a url which will be used later on.
                const sitemap = await streamToPromise(smStream).then((sm) => sm.toString());
                //write to aws 
                let path = 'sitemaps/categories-subcategories.xml'
                let contentType = 'text/xml'
                const res = await uploadFileToS3(path, sitemap, contentType)
                resolve(sitemap)
            }
        } catch (error) {
            console.log(error);

            resolve(true)
        }
    })
}

function createTopic(obj, smsStream) {
    return new Promise(async resolve => {
        try {
            let query = {
                "bool": {     
                    "must": [
                        {term: { "status.keyword": 'published' }}
                    ]
                }
            };
            const  payload= {from: 0, size: MAX_RESULT,_source:["topics_list"] }
            const result = await elasticService.search('learn-content', query, payload );
            let smStream = new SitemapStream({
                hostname: process.env.FRONTEND_URL,
            });
            let topic_slug =[];
            if (result.hits) {
                if (result.hits && result.hits.length > 0) {
                    for (const hit of result.hits) {
                        for(const topic of hit._source.topics_list)
                        {
                            topic_slug.push(topic.slug)
                        }
                    }
                    let unique_topic_slug = topic_slug.filter((x, i, a) => a.indexOf(x) == i)
                    for(const topic of unique_topic_slug)
                    {
                        smStream.write({
                            url: `/topic/${topic}`,
                            changefreq: 'daily', 
                            priority: 0.8
                        });
                    }       
                }

                smStream.end();
                // generate a sitemap and add the XML feed to a url which will be used later on.
                const sitemap = await streamToPromise(smStream).then((sm) => sm.toString());
                //write to aws 
                let path = 'sitemaps/topic.xml'
                let contentType = 'text/xml'
                const res = await uploadFileToS3(path, sitemap, contentType)
                resolve(sitemap)
            }
        } catch (error) {
            console.log(error);
            resolve(true)
        }
    })
}

function createAdvice() {
    return new Promise(async (resolve) => {
        try {

            let query = { 
                "match_all": {}
            };
            let  payload= {from: 0, size: MAX_RESULT,_source:["slug"] }

            const result = await elasticService.search('section', query, payload);
            let smStream = new SitemapStream({
                hostname: process.env.FRONTEND_URL,
            });
            if (result.hits) {
                if (result.hits && result.hits.length > 0) {
                    for (const hit of result.hits) {                        
                        smStream.write({
                            url: `/advice/${hit._source.slug}`,
                            changefreq: 'daily', 
                            priority: 0.8
                        });
                    }
                }
                //link for advice page
                smStream.write({
                    url: `/advice`,
                    changefreq: 'daily', 
                    priority: 0.8
                });
                //link for article search page
                smStream.write({
                    url: `/advice/search`,
                    changefreq: 'daily', 
                    priority: 0.8
                });
                //fetch articles
                let query = { 
                    "bool": {                   
                        "must": [
                            {term: { "status.keyword": 'published' }}                
                        ]
                    }
                };
                payload= {from: 0, size: MAX_RESULT,_source:["slug","section_slug","updated_at"] }
                const articleResult = await elasticService.search('article', query, payload);
                if (articleResult.hits) {
                    if (articleResult.hits && articleResult.hits.length > 0) {
                        for (const hit of articleResult.hits) {
                            smStream.write({
                                url: `/advice/${hit._source.section_slug}/${hit._source.slug}`,
                                lastmod: hit._source.updated_at,
                                changefreq: 'daily', 
                                priority: 0.9
                            });
                        }
                    }
                }

                //fetch Authors
                query = { 
                    "match_all": {}
                };
                payload= {from: 0, size: MAX_RESULT,_source:["slug"] }
                const authorResult = await elasticService.search('author', query, payload);
                if (authorResult.hits) {
                    if (authorResult.hits && authorResult.hits.length > 0) {
                        for (const hit of authorResult.hits) {
                            smStream.write({
                                url: `/author/${hit._source.slug}`,
                                changefreq: 'daily', 
                                priority: 0.9
                            });
                        }
                    }
                }
                smStream.end();
                // generate a sitemap and add the XML feed to a url which will be used later on.
                const sitemap = await streamToPromise(smStream).then((sm) => sm.toString());
                //write to aws 
                let path = 'sitemaps/advice.xml'
                let contentType = 'text/xml'
                const res = await uploadFileToS3(path, sitemap, contentType)
                resolve(sitemap)
            }

        } catch (error) {
            console.log(error);
        }

        resolve(true)
    })
}

function createRanking() {
    return new Promise(async (resolve) => {
        try {
          
            let smStream = new SitemapStream({
                hostname: process.env.FRONTEND_URL,
            });
            smStream.write({
                url: `/ranking`,
                changefreq: 'daily', 
                priority: 0.8
            });
            
            const query = { 
                "match_all": {}
            };
            const  payload= {from: 0, size: MAX_RESULT,_source:["ranks"] }
            const result = await elasticService.search('provider', query, payload);
            let ranking_slug =[]
            if (result.hits) {
                if (result.hits && result.hits.length > 0) {
                    for (const hit of result.hits) {  
                        for(const rank of hit._source.ranks)
                        {
                            ranking_slug.push(rank.slug)
                        }
                    }
                    let unique_ranking_slug = ranking_slug.filter((x, i, a) => a.indexOf(x) == i)
                    for(const rank of unique_ranking_slug)
                    {
                        smStream.write({
                            url: `/institute-ranking/${rank}`,
                            changefreq: 'daily', 
                            priority: 0.8
                        });
                    } 
                }               
            }
            
            smStream.end();
            // generate a sitemap and add the XML feed to a url which will be used later on.
            const sitemap = await streamToPromise(smStream).then((sm) => sm.toString());
            //write to aws 
            let path = 'sitemaps/ranking.xml'
            let contentType = 'text/xml'
            const res = await uploadFileToS3(path, sitemap, contentType)
            resolve(sitemap)

        } catch (error) {
            console.log(error);
        }

        resolve(true)
    })
}

function createTrendingNow() {
    return new Promise(async (resolve) => {
        try {
          
            let smStream = new SitemapStream({
                hostname: process.env.FRONTEND_URL,
            });          
            
            const query = { 
                "match_all": {}
            };
            const  payload= {from: 0, size: MAX_RESULT,_source:["trending_now"] }
            const result = await elasticService.search('home-page', query, payload);
            let trending_now_slug =[]
            if (result.hits) {
                if (result.hits && result.hits.length > 0) {
                    for (const hit of result.hits) { 
                        if(hit._source.trending_now && hit._source.trending_now.length>0)
                        {
                            for(const trending_now of hit._source.trending_now)
                            {
                                 trending_now_slug.push(trending_now.slug )
                                
                            }
                        }
                    }
                    let unique_trending_now_slug = trending_now_slug.filter((x, i, a) => a.indexOf(x) == i)
                    for(const slug of unique_trending_now_slug)
                    {
                        smStream.write({
                            url: `/collection/${slug}`,
                            changefreq: 'daily', 
                            priority: 0.8
                        });
                    }          

                }               
            }
            
            smStream.end();
            // generate a sitemap and add the XML feed to a url which will be used later on.
            const sitemap = await streamToPromise(smStream).then((sm) => sm.toString());
            //write to aws 
            let path = 'sitemaps/trending-now.xml'
            let contentType = 'text/xml'
            const res = await uploadFileToS3(path, sitemap, contentType)
            resolve(sitemap)

        } catch (error) {
            console.log(error);
        }

        resolve(true)
    })
}

function createLearnPath() {
    return new Promise(async (resolve) => {
        try {
            let query = {
                "bool": {              
                    "must": [
                        {term: { "status.keyword": 'approved' }}
                    ]
                }
            };
            const  payload= {from: 0, size: MAX_RESULT,_source:["slug", "updated_at"] }
            const result = await elasticService.search('learn-path', query, payload);
            let smStream = new SitemapStream({
                hostname: process.env.FRONTEND_URL,
            });

             //link for learnpath listing page
             smStream.write({
                url: `/learnpath`,
                changefreq: 'daily',
                priority: 0.8
            });

            if (result.hits) {
                if (result.hits && result.hits.length > 0) {
                    for (const hit of result.hits) {
                        smStream.write({
                            url: `/learnpath/${hit._source.slug}`,
                            lastmod: hit._source.updated_at,
                            changefreq: 'daily',
                            priority: 0.8
                        });
                    }
                }

                smStream.end();
                // generate a sitemap and add the XML feed to a url which will be used later on.
                const sitemap = await streamToPromise(smStream).then((sm) => sm.toString());
                //write to aws 
                let path = 'sitemaps/learn-paths.xml'
                let contentType = 'text/xml'
                const res = await uploadFileToS3(path, sitemap, contentType)
                resolve(sitemap)
            }

        } catch (error) {
            console.log(error);
        }

        resolve(true)
    })
}


module.exports = {
    createSiteMap: () => {
        return new Promise(async (resolve) => {
            try {
                const result = await createCategories()
                await createTopic()
                await createCourse()
                await createPartner()
                await createProvider()
                await createAdvice()
                // await createRanking()
                // await createTrendingNow()
                await createLearnPath()
                resolve(result)
            } catch (error) {
                console.log(error);
                resolve(false)

            }
        })
    },
    createNewsSiteMap: () => {
        return new Promise(async (resolve) => {
            try {
                const result = await createNews()
            } catch (error) {
                console.log(error);
                resolve(false)

            }
        })
    },

    copySiteMapS3ToFolder : async (file) => {
        let sitemaps = []
        if(file){
            sitemaps = [file]
        }
        else{
            sitemaps = ['advice.xml', 'course.xml','categories-subcategories.xml','institute.xml','partner.xml','ranking.xml', 'topic.xml','trending-now.xml','learn-paths.xml'];
        }

        const AWS_CDN_BUCKET = process.env.AWS_CDN_BUCKET || "crux-assets-dev";
        const FRONTEND_PUBLIC_DIR = process.env.FRONTEND_PUBLIC_DIR || "/home/ubuntu/apps/crux-frontend/public";
        for (const sitemap of sitemaps)
        {
            exec(`aws s3 cp s3://${AWS_CDN_BUCKET}/sitemaps/${sitemap} ${FRONTEND_PUBLIC_DIR}/${sitemap}`,( err, stdout, stderr) => {
                if (err) {
                    // node couldn't execute the command
                    console.log("Error in copying",err )
                    return;
                }           
            });
        }        
    }    
}