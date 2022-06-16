const fetch = require("node-fetch");
const redisConnection = require('../../services/v1/redis');
const RedisConnection = new redisConnection();

const apiBackendUrl = process.env.API_BACKEND_URL;


module.exports = class graphService {

    async getBarGraph(req) {
        const id = req.params.id;
        let cacheName = `bar_graph_${id}`;
        let cacheData = await RedisConnection.getValuesSync(cacheName);
        if (!cacheData.noCacheData) {
            return { success: true, message: 'Fetched successfully!', data: cacheData };
        }
        else {
            let response = await fetch(`${apiBackendUrl}/bar-graphs/${id}`);
            if (response.ok) {
                let data = await response.json();
                if (data) {
                    delete data.id
                    delete data.created_by
                    delete data.updated_by
                    delete data.created_at
                    delete data.updated_at
                    RedisConnection.set(cacheName, data);
                    return { success: true, message: 'Fetched successfully!', data: data };
                    
                }
            }
        }
    }
    async getlineGraph(req) {
        const id = req.params.id;
        let cacheName = `line_graph_${id}`;
        let cacheData = await RedisConnection.getValuesSync(cacheName);
        if (!cacheData.noCacheData) {
            return { success: true, message: 'Fetched successfully!', data: cacheData };
        }
        else {
            let response = await fetch(`${apiBackendUrl}/line-graphs/${id}`);
            if (response.ok) {
                let data = await response.json();
                if (data) {
                    delete data.id
                    delete data.created_by
                    delete data.updated_by
                    delete data.created_at
                    delete data.updated_at
                    RedisConnection.set(cacheName, data);
                    return { success: true, message: 'Fetched successfully!', data: data };
                    
                }
            }
        }

    }
    async getPieChart(req) {
        const id = req.params.id;
        let cacheName = `pie_chart_${id}`;
        let cacheData = await RedisConnection.getValuesSync(cacheName);
        if (!cacheData.noCacheData) {
            return { success: true, message: 'Fetched successfully!', data: cacheData };
        }
        else {
            let response = await fetch(`${apiBackendUrl}/pie-charts/${id}`);
            if (response.ok) {
                let data = await response.json();
                if (data) {
                    delete data.id
                    delete data.created_by
                    delete data.updated_by
                    delete data.created_at
                    delete data.updated_at
                    RedisConnection.set(cacheName, data);
                    return { success: true, message: 'Fetched successfully!', data: data };
                    
                }
            }
        }

    }
    async getDonutChart(req) {
        const id = req.params.id;
        let cacheName = `donut_chart_${id}`;
        let cacheData = await RedisConnection.getValuesSync(cacheName);
        if (!cacheData.noCacheData) {
            return { success: true, message: 'Fetched successfully!', data: cacheData };
        }
        else {
            let response = await fetch(`${apiBackendUrl}/donut-charts/${id}`);
            if (response.ok) {
                let data = await response.json();
                if (data) {
                    delete data.id
                    delete data.created_by
                    delete data.updated_by
                    delete data.created_at
                    delete data.updated_at
                    RedisConnection.set(cacheName, data);
                    return { success: true, message: 'Fetched successfully!', data: data };
                    
                }
            }
        }

    }
    async getDataTable(req) {
        const id = req.params.id;
        let cacheName = `data_table_${id}`;
        let cacheData = await RedisConnection.getValuesSync(cacheName);
        if (!cacheData.noCacheData) {
            return { success: true, message: 'Fetched successfully!', data: cacheData };
        }
        else {
            let response = await fetch(`${apiBackendUrl}/data-tables/${id}`);
            if (response.ok) {
                let data = await response.json();
                if (data) {
                    delete data.id
                    delete data.created_by
                    delete data.updated_by
                    delete data.created_at
                    delete data.updated_at
                    RedisConnection.set(cacheName, data);
                    return { success: true, message: 'Fetched successfully!', data: data };
                    
                }
            }
        }

    }
}