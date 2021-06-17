const SitemapStream = require('sitemap').SitemapStream
const streamToPromise = require('sitemap').streamToPromise
const { default: Axios } = require('axios');
const elasticService = require('../../../api/services/elasticService');
const { uploadFileToS3 } = require('../AWS');
let slugs = []
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

            let queryBody = {

                "_source": ["slug", "updated_at"],
                "query": {
                    "match_all": {}
                }

            }

            const result = await elasticService.plainSearch('learn-content', queryBody);
            let smStream = new SitemapStream({
                hostname: process.env.FRONTEND_URL,
            });
            if (result.hits) {
                if (result.hits.hits && result.hits.hits.length > 0) {
                    for (const hit of result.hits.hits) {
                        smStream.write({
                            url: `/course/${hit._source.slug}`,
                            lastmod: hit._source.updated_at
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

            let queryBody = {
                "_source": ["slug", "updated_at"],
                "query": {
                    "match_all": {}
                }

            }

            const result = await elasticService.plainSearch('provider', queryBody);
            let smStream = new SitemapStream({
                hostname: process.env.FRONTEND_URL,
            });
            if (result.hits) {
                if (result.hits.hits && result.hits.hits.length > 0) {
                    for (const hit of result.hits.hits) {
                        smStream.write({
                            url: `/institute/${hit._source.slug}`,
                            lastmod: hit._source.updated_at
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

            let queryBody = {
                "_source": ["slug", "updated_at"],
                "query": {
                    "match_all": {}
                }
            }

            const result = await elasticService.plainSearch('partner', queryBody);
            let smStream = new SitemapStream({
                hostname: process.env.FRONTEND_URL,
            });
            if (result.hits) {
                if (result.hits.hits && result.hits.hits.length > 0) {
                    for (const hit of result.hits.hits) {
                        smStream.write({
                            url: `/partner/${hit._source.slug}`,
                            lastmod: hit._source.updated_at
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

            let queryBody = {
                "_source": ["slug", "updated_at"],
                "query": {
                    "match_all": {}
                }
            }
            
            const result = await elasticService.plainSearch('in_the_news', queryBody);
            let smStream = new SitemapStream({
                hostname: process.env.FRONTEND_URL,
            });
            if (result.hits) {
                if (result.hits.hits && result.hits.hits.length > 0) {
                    for (const hit of result.hits.hits) {
                        smStream.write({
                            url: `${process.env.FRONTEND_URL}/news/${hit._source.slug}`,
                            lastmod: hit._source.updated_at
                        });
                    }
                }


                // fetch category tree

                //generate course url 

                smStream.end();
                console.log('Url',process.env.FRONTEND_URL,smStream.toString())
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
            });
            // Add a static url to ex: about page
            smStream.write({
                url: "/about",
            });

            // fetch category tree
            const backEndUrl = `${process.env.API_BACKEND_URL}/category-tree`;
            const categoryTreeRes = await Axios.get('https://crux-backend.ajency.in/category-tree')
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
            const categoryTreeRes = await Axios.get('https://crux-backend.ajency.in/category-tree')
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