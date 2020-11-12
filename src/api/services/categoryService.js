const fetch = require("node-fetch");

const apiBackendUrl = process.env.API_BACKEND_URL;

const getCategoryTree = async () => {
    let category_tree = [];
    let response = await fetch(`${apiBackendUrl}/category-tree`);
    if (response.ok) {
        let json = await response.json();
        if(json && json.final_tree){
            category_tree = json.final_tree;
        }
    }
    return category_tree;
};

module.exports = class categoryService {

    async getTree(req, callback){
        try{
            let data = await getCategoryTree();
            callback(null, {status: 'success', message: 'Fetched successfully!', data: data});
        }catch(err){
            callback(null, {status: 'success', message: 'No records found!', data: []});
        }        
    }   


}