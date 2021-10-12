'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('activities', [
      { type: "COURSE_VIEW",createdAt: new Date(),updatedAt: new Date() },
      { type: "COURSE_WISHLIST",createdAt: new Date(),updatedAt: new Date() },
      { type: "COURSE_ENQUIRED",createdAt: new Date(),updatedAt: new Date() },
      { type: "COURSE_PURCHASED",createdAt: new Date(),updatedAt: new Date() } 
    ], {});
  },

  down: (queryInterface, Sequelize) => {
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.bulkDelete('People', null, {});
    */
  }
};
