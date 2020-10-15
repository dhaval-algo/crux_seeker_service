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

    await queryInterface.bulkInsert('default_select_options', [

      { value: "IT Manager", label: "IT Manager", slug:"IT Manager", optionType:"jobTitle",createdAt: new Date(),updatedAt: new Date() },
      { value: "Sales coordinator", label: "Sales coordinator", slug:"Sales coordinator", optionType:"jobTitle",createdAt: new Date(),updatedAt: new Date() },
      { value: "Finance", label: "Finance", slug:"Finance", optionType:"jobTitle",createdAt: new Date(),updatedAt: new Date() },
      { value: "Financial services Manager", label: "Financial services Manager", slug:"Financial services Manager", optionType:"jobTitle",createdAt: new Date(),updatedAt: new Date() },
      { value: "Senior Buyer", label: "Senior Buyer", slug:"IT Manager", optionType:"jobTitle",createdAt: new Date(),updatedAt: new Date() },
      { value: "Software account executive", label: "Software account executive", slug:"Software account executive", optionType:"jobTitle",createdAt: new Date(),updatedAt: new Date() },

      { value: "TCS", label: "TCS", slug:"TCS", optionType:"company",createdAt: new Date(),updatedAt: new Date() },
      { value: "IBM", label: "IBM", slug:"IBM", optionType:"company",createdAt: new Date(),updatedAt: new Date() },
      { value: "Uber", label: "Uber", slug:"Uber", optionType:"company",createdAt: new Date(),updatedAt: new Date() },
      { value: "Microsoft", label: "Microsoft", slug:"Microsoft", optionType:"company",createdAt: new Date(),updatedAt: new Date() },

      { value: "Information technology", label: "Information technology", slug:"Information technology", optionType:"industry",createdAt: new Date(),updatedAt: new Date() },
      { value: "Finance", label: "Finance", slug:"Finance", optionType:"industry",createdAt: new Date(),updatedAt: new Date() },
      { value: "Hospality", label: "Hospality", slug:"Hospality", optionType:"industry",createdAt: new Date(),updatedAt: new Date() },


      { value: "Standford University", label: "Standford University", slug:"Standford University", optionType:"institue",createdAt: new Date(),updatedAt: new Date() },
      { value: "Princeton University", label: "Princeton University", slug:"Princeton University", optionType:"institue",createdAt: new Date(),updatedAt: new Date() },
      { value: "Columbia", label: "Columbia", slug:"Columbia", optionType:"institue",createdAt: new Date(),updatedAt: new Date() },

      { value: "B.Tech", label: "B.Tech", slug:"B.Tech", optionType:"degree",createdAt: new Date(),updatedAt: new Date() },
      { value: "BBA", label: "BBA", slug:"BBA", optionType:"degree",createdAt: new Date(),updatedAt: new Date() },
      { value: "Phd", label: "Phd", slug:"Phd", optionType:"degree",createdAt: new Date(),updatedAt: new Date() },
      { value: "Msc", label: "Msc", slug:"Msc", optionType:"degree",createdAt: new Date(),updatedAt: new Date() },


      { value: "Computers", label: "Computers", slug:"Computers", optionType:"specialization",createdAt: new Date(),updatedAt: new Date() },
      { value: "Business", label: "Business", slug:"Business", optionType:"specialization",createdAt: new Date(),updatedAt: new Date() },
      { value: "Chemical", label: "Chemical", slug:"Chemical", optionType:"specialization",createdAt: new Date(),updatedAt: new Date() },
      { value: "Marketing", label: "Marketing", slug:"Marketing", optionType:"specialization",createdAt: new Date(),updatedAt: new Date() },
      { value: "Operations", label: "Operations", slug:"Operations", optionType:"specialization",createdAt: new Date(),updatedAt: new Date() },
      { value: "Finance", label: "Finance", slug:"Finance", optionType:"specialization",createdAt: new Date(),updatedAt: new Date() },
      
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
