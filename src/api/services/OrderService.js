const models = require("../../../models");
const axios = require("axios");

module.exports = class OrderService {
    async fetchOrderByOrderId(orderId) {
        try {
            /** Make an api call to backend to fetch the order details */
            let res = await axios.post(process.env.API_BACKEND_URL + "/orders/getByOrderId", { orderId: orderId });
            return res.data.order;
        } catch(err) {
            console.log("Error while fetching the order from backend: ", err);
            return null;
        }
    }
}