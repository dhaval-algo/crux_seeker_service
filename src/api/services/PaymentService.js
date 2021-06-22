const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

module.exports = class PaymentService {
    async createPaymentIntent(amount, currency, description, userObj) {
        // Kept commented. Will be required for international payments.
        // /** Add the customer */
        // let customer = null;
        // if(currency !== "INR") {
        //     customer = await stripe.customers.create({
        //         name: userObj.firstName + " " + userObj.lastName,
        //         address: {
        //             line1: 'Goa',
        //             postal_code: '403001',
        //             city: 'Panaji',
        //             state: 'GOA',
        //             country: 'IN',
        //         }
        //     });
        // }
        
        /** Create the payment intent */
        let paymentIntentPayload = {
            amount: amount * 100,
            currency: currency,
            description: description,
        }

        // Kept commented. Will be required for international payments.
        // if(customer) {
        //     paymentIntentPayload.customer = customer.id;
        // }

        let paymentIntent = await stripe.paymentIntents.create(paymentIntentPayload);

        if(paymentIntent) {
            return paymentIntent.client_secret;
        } else {
            return null;
        }
    }
}