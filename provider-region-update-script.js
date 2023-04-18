const Sequelize = require("sequelize");
const { QueryTypes } = Sequelize;
const { Client } = require("@elastic/elasticsearch");
const fs = require("fs");

const sequelize = new Sequelize("strapi", "postgres", "UPAXGsWM4zKZJrzn", {
  host: "3.110.145.80",
  dialect: "postgres",
});

let clientProperties = {
  node: "http://65.1.108.192:9200",
  auth: {
    username: "backend",
    password: "soL7hGxtDgo3XcVH",
  },
  maxRetries: 5,
  requestTimeout: 60000,
};

const client = new Client(clientProperties);

const changeRegion = {
  India: "Asia",
  USA: "North America",
  UK: "Europe",
  Asia: "Asia",
  Europe: "Europe",
  "North America": "North America",
  Australia: "Australia",
  Africa: "Africa",
  "South America": "South America",
};

const perfectRegion = {
  Europe: 1,
  Africa: 5,
  Asia: 6,
  Australia: 7,
  "North America": 8,
  "South America": 9,
};

const UPDATE_QUERY = (regionId, whereId) =>
  `UPDATE public.providers SET region=${regionId} WHERE id=${whereId};`;

let problematicData = [];
async function updateIndex(index, id, data) {
  try {
    return await client.update({
      index: index,
      id: id,
      // routing: id,
      // refresh:'wait_for',
      // type:'_doc',
      refresh:true,
      body: {
        doc: data,
      },
    });
  } catch (error) {
    console.log("error in update :>> ", error.meta.body);
    problematicData.push(id);
    return undefined;
  }
}

const getIndexData = async (indexName, ids) => {
  try {
    return await client.search({
      index: indexName,
      size: 10000,
    });
  } catch (error) {
    console.log("error :>> ", error);
    return undefined;
  }
};

(async () => {
  try {
    let providerData = require("/home/algo/Downloads/InstituteTagging-Staging.json");

    const providerIds = providerData.map((ele) => ele.id);
    console.log("providerIds :>> ", providerIds);
    let indexData = await getIndexData("provider");
    indexData = indexData.body.hits.hits
    // map((ele) => ele._source);
    console.log("indexData :>> ", indexData.length);
    let indexObj = null;
    for (let i = 0; i < providerData.length; i++) {
      const ele = providerData[i];
      indexObj = indexData.find((indx) => indx._source.id == ele.id);

      const update = await sequelize.query(
        UPDATE_QUERY(perfectRegion[changeRegion[ele.region]], ele.id),
        QueryTypes.UPDATE
      );
      console.log("update :>> ", update);

      if (indexObj) {
        console.log('indexObj :>> ', indexObj._id);
        await updateIndex("provider", indexObj._id, {
          region: changeRegion[ele.region],
        });
      }
    }
  } catch (error) {
    console.log("error in main function:>> ", error.message || error);
  }
})();
