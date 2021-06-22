const SitemapStream = require('sitemap').SitemapStream
const streamToPromise = require('sitemap').streamToPromise
const { default: Axios } = require('axios');
const elasticService = require('../../../api/services/elasticService');
const { uploadFileToS3 } = require('../AWS');
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

            const query = { 
                "match_all": {}
            };
            const  payload= {from: 0, size: MAX_RESULT,_source:["slug", "updated_at"] }
            const result = await elasticService.search('learn-content', query, payload );
            let smStream = new SitemapStream({
                hostname: process.env.FRONTEND_URL,
            });
            if (result.hits) {
                if (result.hits && result.hits.length > 0) {
                    for (const hit of result.hits) {
                        smStream.write({
                            url: `/course/${hit._source.slug}`,
                            lastmod: hit._source.updated_at,
                            changefreq: 'daily', 
                            priority: 0.9
                        });
                    }
                }


                // fetch category tree

                //generate course url 

                smStream.end();
                // generate a sitemap and add the XML feed to a url which will be used later on.
                const sitemap = await streamToPromise(smStream).then((sm) => sm.toString());
                //write to aws 
                let path = 'course.xml'
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
            const query = { 
                "match_all": {}
            };
            const  payload= {from: 0, size: MAX_RESULT,_source:["slug", "updated_at"] }
            const result = await elasticService.search('provider', query, payload);
            let smStream = new SitemapStream({
                hostname: process.env.FRONTEND_URL,
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


                // fetch category tree

                //generate course url 

                smStream.end();
                // generate a sitemap and add the XML feed to a url which will be used later on.
                const sitemap = await streamToPromise(smStream).then((sm) => sm.toString());
                //write to aws 
                let path = 'institute.xml'
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
                let path = 'partner.xml'
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

            const query = { 
                "match_all": {}
            };
            const  payload= {from: 0, size: MAX_RESULT,_source:["slug", "updated_at"] }
            
            const result = await elasticService.search('in_the_news', query, payload);
            let smStream = new SitemapStream({
                hostname: process.env.FRONTEND_URL,
            });
            if (result.hits) {
                if (result.hits && result.hits.length > 0) {
                    for (const hit of result.hits) {
                        smStream.write({
                            url: `/news/${hit._source.slug}`,
                            lastmod: hit._source.updated_at,
                            changefreq: 'daily', 
                            priority: 0.9
                        });
                    }
                }


                // fetch category tree

                //generate course url 

                smStream.end();
                // generate a sitemap and add the XML feed to a url which will be used later on.
                const sitemap = await streamToPromise(smStream).then((sm) => sm.toString());
                //write to aws 
                let path = 'news.xml'
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

function createCategories() {
    return new Promise(async resolve => {
        try {
            let smStream = new SitemapStream({
                hostname: process.env.FRONTEND_URL,
            });
            smStream.write({
                url: "/",
                changefreq: 'daily', 
                priority: 1
            });
            // Add a static url to ex: about page
            smStream.write({
                url: "/about",
            });

            // fetch category tree
            const backEndUrl = `${process.env.API_BACKEND_URL}/category-tree`;
            const categoryTreeRes = await Axios.get(backEndUrl)
            let { final_tree } = categoryTreeRes.data
            smStream = iterate(final_tree, smStream, "courses")

            //generate course url 

            smStream.end();
            // generate a sitemap and add the XML feed to a url which will be used later on.
            const sitemap = await streamToPromise(smStream).then((sm) => sm.toString());
            //write to aws 
            let path = 'courses.xml'
            let contentType = 'text/xml'
            const res = await uploadFileToS3(path, sitemap, contentType)
            resolve(sitemap)
        } catch (error) {
            console.log(error);

            resolve(true)
        }
    })
}

function createTopic(obj, smsStream) {
    return new Promise(async resolve => {
        try {
            let smStream = new SitemapStream({
                hostname: process.env.FRONTEND_URL,
            });

            // fetch category tree
            const backEndUrl = `${process.env.API_BACKEND_URL}/category-tree`;
            const categoryTreeRes = await Axios.get(backEndUrl)
            let { final_tree } = categoryTreeRes.data
            smStream = iterate(final_tree, smStream, "topic")

            //generate course url 

            smStream.end();
            // generate a sitemap and add the XML feed to a url which will be used later on.
            const sitemap = await streamToPromise(smStream).then((sm) => sm.toString());
            //write to aws 
            let path = 'topic.xml'
            let contentType = 'text/xml'
            const res = await uploadFileToS3(path, sitemap, contentType)
            resolve(true)
        } catch (error) {
            console.log(error);
            resolve(true)
        }
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
                await createNews()
                resolve(result)
            } catch (error) {
                console.log(error);
                resolve(false)

            }
        })
    }
}