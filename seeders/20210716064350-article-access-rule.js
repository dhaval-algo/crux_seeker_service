'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    /*
      Add altering commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.bulkInsert('People', [{
        name: 'John Doe',
        isBetaMember: false
      }], {});
    */

      return queryInterface.bulkInsert('rules', [{
        action_type: "article_access",
        action_rule :JSON.stringify( {
          "self_rules": {
            "any": [
              {
                "all": [
                  {
                    "fact": "is_loggedin",
                    "operator": "equal",
                    "value": true
                  },
                  {
                    "fact": "article.premium",
                    "operator": "equal",
                    "value": true
                  }
                ]
              },
              {
                "all": [
                  {
                    "fact": "article.premium",
                    "operator": "equal",
                    "value": false
                  }
                ]
              }
            ]
          },
          "similar_activity_rules": null
        }),
        action_reward : JSON.stringify({
          "access_type": "full_access"
        }),
        status: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }]);
  },

  down: (queryInterface, Sequelize) => {
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.bulkDelete('People', null, {});
    */
      return queryInterface.bulkDelete('rules', null, {});
  }
};
