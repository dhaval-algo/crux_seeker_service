const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

module.exports = class PaymentService {
    async createPaymentIntent(amount, currency, description) {
        let paymentIntent = await stripe.paymentIntents.create({
            amount: amount * 100,
            currency: currency,
            description: description
        });
        if(paymentIntent) {
            return paymentIntent.client_secret;
        } else {
            console.log("Payment intent not created");
            return null;
        }
    }
}