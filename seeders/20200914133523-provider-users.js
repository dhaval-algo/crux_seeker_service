'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    /*
      Add altering commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.bulkInsert('People', [{
        name: 'John Doe',
        isBetaMember: false
      }], {});
    */
   return await queryInterface.bulkInsert('user_logins', [{
      userId:1,
      email:'latesh@ajency.in',
      phone:'',
      provider:'google',
      providerId:'107083360479601848678', 
      createdAt: new Date(),
      updatedAt: new Date() 
   },
   {
    userId:2,
    email:'hazel@ajency.in',
    phone:'',
    provider:'google',
    providerId:'107083360479601848671',
    createdAt: new Date(),
    updatedAt: new Date() 
 },
 {
  userId:2,
  email:'nutan@ajency.in',
  phone:'',
  provider:'google',
  providerId:'107083360479601848674',
   createdAt: new Date(),
  updatedAt: new Date() 
},
  ])
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
