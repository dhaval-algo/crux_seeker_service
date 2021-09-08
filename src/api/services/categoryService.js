const fetch = require("node-fetch");
const redisConnection = require('../../services/v1/redis');

const RedisConnection = new redisConnection();

const apiBackendUrl = process.env.API_BACKEND_URL;

const getCategoryTree = async () => {
    let category_tree = [];
    let response = await fetch(`${apiBackendUrl}/category-tree`);
    if (response.ok) {
        let json = await response.json();
        if(json && json.final_tree){
            //category_tree = json.final_tree;
            category_tree = parseCategoryTree(json.final_tree);
        }
    }
    return category_tree;
};


const parseCategoryTree = (categoryTree) => {
    let categories = [];
    let other_categories = null;
    for(const category of categoryTree){
        if(category.count == 0){
            continue;
        }
        let sub_categories = [];
        let other_sub_categories = null;
        for(const sub_category of category.child){
            if(sub_category.count == 0){
                continue;
            }     

            let topics = [];
            let other_topics = null;
            for(const topic of sub_category.child){
                if(topic.count == 0){
                    continue;
                }

                if(topic.slug == 'others'){
                    other_topics = topic;
                }else{
                    topics.push(topic);
                }
            }
            if(other_topics){
                topics.push(other_topics);
            }
            sub_category.child = topics;
            
            if(sub_category.slug == 'others'){
                other_sub_categories = sub_category;
            }else{
                sub_categories.push(sub_category);
            }

        }
        if(other_sub_categories){
            sub_categories.push(other_sub_categories);
        }
        category.child = sub_categories;

        if(category.slug == 'others'){
            other_categories = category;
            //Removing sub categories for 'Others
            other_categories.child = [];
        }else{
            categories.push(category);
        }
    }
    if(other_categories){
        categories.push(other_categories);
    }
    return categories;
};



module.exports = class categoryService {

    async getTree(req, callback, skipCache){
        try{
            let cacheName = `category-tree`
            let useCache = false
            if(skipCache !=true) {
                let cacheData = await RedisConnection.getValuesSync(cacheName);
                if(cacheData.noCacheData != true) {
                    callback(null, {status: 'success', message: 'Fetched successfully!', data: cacheData});
                    useCache = true
                }            
            }
            if(useCache !=true)
            {
                let data = await getCategoryTree();
                RedisConnection.set(cacheName, data);
                callback(null, {status: 'success', message: 'Fetched successfully!', data: data});
            }
        }catch(err){
            console.log("err", err)
            callback(null, {status: 'success', message: 'No records found!', data: []});
        }        
    }   


}