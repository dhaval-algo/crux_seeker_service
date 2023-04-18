const Sequelize = require("sequelize");
const { QueryTypes } = Sequelize;
const { Client } = require("@elastic/elasticsearch");
const fs = require("fs");

const sequelize = new Sequelize("strapi", "postgres", "UPAXGsWM4zKZJrzn", {
  host: "3.110.145.80",
  dialect: "postgres",
});

let clientProperties = {
  node: "http://host:9200",
  auth: {
    username: "username",
    password: "password",
  },
  maxRetries: 5,
  requestTimeout: 60000,
};

const client = new Client(clientProperties);

const IMAGE_KEYS = {
  article: [
    "cover_image",
    "brochure",
    "card_image",
    "card_image_mobile",
    "listing_image",
  ],
};

const UPDATE_QUERY = (topic_type, whereId) =>
  `UPDATE public.topics SET topic_type='${topic_type}' WHERE id=${whereId};`;

(async () => {
  try {
    let topicData = require("/home/algo/Downloads/TopicTagiing-Topic.json");

    // console.log("topicData :>> ", topicData);

    for (let i = 0; i < topicData.length; i++) {
      const ele = topicData[i];
      const update = await sequelize.query(
        UPDATE_QUERY(ele.Topic_type, ele.id),
        QueryTypes.UPDATE
      );
      console.log("update :>> ", update);
    }
  } catch (error) {
    console.log("error in main function:>> ", error.message || error);
  }
})();
