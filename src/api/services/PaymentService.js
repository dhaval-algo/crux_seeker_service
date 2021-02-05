const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

module.exports = class PaymentService {
    async createPaymentIntent(amount, currency, description) {
        let paymentIntent = await stripe.paymentIntents.create({
            amount: amount * 100,
            currency: currency,
            description: description,
        });

        /** Add the customer */
        await stripe.customers.create({
            name: userObj.first_name + " " + userObj.last_name,
            address: {
                line1: 'Goa',
                postal_code: '403001',
                city: 'Panaji',
                state: 'GOA',
                country: 'IN',
            }
        });

        if(paymentIntent) {
            return paymentIntent.client_secret;
        } else {
            console.log("Payment intent not created");
            return null;
        }
    }
}