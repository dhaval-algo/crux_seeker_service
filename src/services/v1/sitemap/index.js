const SitemapStream = require('sitemap').SitemapStream
const streamToPromise = require('sitemap').streamToPromise
const { default: Axios } = require('axios');
const { uploadFileToS3 } = require('../AWS');

const iterate = (obj,smStream) => {
    Object.keys(obj).forEach(key => {

    // console.log('key: '+ key + ', value: '+obj[key]);
    switch (obj[key]) {
        case 'category':
        case 'sub-category':
            console.log(obj[key]);
            smStream.write({
                url: `/courses/${obj.slug}`,
            })
            break;
        case 'topic':
            console.log(obj[key]);
            smStream.write({
                url: `/topic/${obj.slug}`,
            })
            break; 
        default:
            break;
    }
    if (typeof obj[key] === 'object') {

            iterate(obj[key],smStream)
        }
    })
    return smStream
}
module.exports = {
    createSiteMap: () => {
        return new Promise(async (resolve) => {
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
                let {final_tree} = categoryTreeRes.data
                smStream = iterate(final_tree, smStream)
                
                //generate course url 

                smStream.end();
                // generate a sitemap and add the XML feed to a url which will be used later on.
                const sitemap = await streamToPromise(smStream).then((sm) => sm.toString());
                //write to aws 
                let path ='sitemap.xml'
                let contentType= 'text/xml'
                const res = await uploadFileToS3(path, sitemap, contentType)
                console.log(res);
                resolve(sitemap)
            } catch (error) {
                console.log(error);
                resolve(true)
                
            }
        })
    }
}