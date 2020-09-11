'use strict';


module.exports = {
  up: async (queryInterface, Sequelize) => {
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
    */

    await queryInterface.bulkInsert('users', [{
      fullName: 'latesh kudnekar',
      accountEmail: 'latesh@ajency.in',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      fullName: 'hazel colaco',
      phone: '7875077425',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      fullName: 'Nutan',
      accountEmail: 'nutan@ajency.in',
      phone: '8806458310',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});

    const users = await queryInterface.sequelize.query(`SELECT id from users;`);

    const usersRows = users[0];
    const password = 'fb4192676e78378b12ae0b2303075a68804cec8c9b7b6d223a8ab4b03710a471d493ae0e0f54c9810ba60dcac24ebf42c4461904074a5a09c794e913f10cc9ceec9df8c735903562cc9261c1ca74e70910e05beebc1ed3cc8373f8e93801fdd9300a01f72703';
    const provider = "local";
    return await queryInterface.bulkInsert('user_logins', [
      { email: 'latesh@ajency.in', provider, password, userId: usersRows[0].id,  createdAt: new Date(),
      updatedAt: new Date()},
      { phone: '7875077425', provider, password, userId: usersRows[1].id, createdAt: new Date(),
      updatedAt: new Date() },
      { email: 'nutan@ajency.in', phone: '8806458310', provider, password, userId: usersRows[2].id, createdAt: new Date(),
      updatedAt: new Date() }
    ], {});
   
  },

  down: async (queryInterface, Sequelize) => {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
  }
};
