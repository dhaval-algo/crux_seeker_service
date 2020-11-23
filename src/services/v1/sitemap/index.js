const SitemapStream = require('sitemap').SitemapStream
const streamToPromise = require('sitemap').streamToPromise
const { default: Axios } = require('axios');
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

    return true
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
                slugs = []
                const result = await createCategories()
                slugs = [] // before calling clear sllugs array 
                await createTopic()
                slugs = []
                await createCourse()
                resolve(result)
            } catch (error) {
                console.log(error);
                resolve(false)

            }
        })
    }
}