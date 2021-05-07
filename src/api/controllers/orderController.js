const orderService = new (require("../services/OrderService"));

module.exports = {
    getOrderStatus: async (req, res) => {
        try {
            let { orderId } = req.query;

            if(!orderId) {
                return res.status(200).send({
                    code: "params_missing",
                    success: false,
                    message: "Order id not passed."
                });
            }

            /** Fetch the order */
            let order = await orderService.fetchOrderByOrderId(orderId);
            if(!order) {
                return res.status(200).send({
                    code: "order_not_found",
                    success: false,
                    message: "Order not found"
                });
            }

            let data = {};
            if(["success"].includes(order.status)) {
                data.orderStatus = "success";
            } else if(["failed", "payment_failed"].includes(order.status)) {
                data.orderStatus = "failed";
            } else {
                data.orderStatus = "pending";
            }

            return res.status(200).send({
                code: "success",
                success: true,
                message: "Order status returned.",
                data: data
            });
        } catch(err) {
            console.log("Exception in the order status api: ", err);
            return res.status(200).send({
                code: "error",
                success: false,
                message: "Error"
            });
        }
    }
}