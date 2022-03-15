'use strict';
module.exports = (sequelize, DataTypes) => {
  const learnpath_enquiry = sequelize.define('learnpath_enquiry', {
    id : {
      type:DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    fullName: {
      type: DataTypes.STRING,
      allowNull: false,
      notEmpty:true,
      validate: {
          notNull:{ msg: "full name cannot be null" },
          notEmpty: { msg: "full name cannot be empty" }
    }
  },

  email : {
      type: DataTypes.STRING,
      allowNull: false,
      isEmail:true,
      notEmpty:true,
      validate: {
          notNull: { msg: "email cannot be null" },
          isEmail: { msg: "email is invalid"},
          notEmpty: { msg: "email cannot be empty" }
      }
  },

  phone : {
      type: DataTypes.STRING,
      allowNull: false,
      notEmpty:true,
      validate: {
        /*validatePhone(value){
          const re = /^\+?([0-9]{1,2})\)?[-. ]?([0-9]{5})[-. ]?([0-9]{5})$/;
          if(!re.test(value) )
            throw new Error("invalid phone number")
        },*/
        notNull: { msg: "phone cannot be null" },
        notEmpty: { msg: "phone cannot be empty" },
      }
  },

  student : {
      type:DataTypes.BOOLEAN
  },

  highestDegree : {
      type: DataTypes.STRING,
  },

  experience : {
      type: DataTypes.STRING,
  },

  enquiryMessage : {
      type: DataTypes.STRING(512),
  },
  
  learnpathName : {
      type: DataTypes.STRING,
      allowNull: false,
      notEmpty:true,
      validate: {
        notNull: { msg: "learnpathName cannot be null" },
        notEmpty: { msg: "learnpathName cannot be empty" }
    }
  },

  learnpathId : {
      type: DataTypes.STRING,
      allowNull: false,
      notEmpty:true,
      validate: {
        notNull: { msg: "learnpathId cannot be null" },
        notEmpty: { msg: "learnpathId cannot be empty"}
    }
  },

  userId : {
      type: DataTypes.INTEGER,
      isInt:true,
      validate: {
        isInt: { msg: "userId should be integer" }
  }
  },

  createdAt: {
    allowNull: false,
    type: DataTypes.DATE
  },
  
  updatedAt: {
    allowNull: false,
    type: DataTypes.DATE
  }
  }, {});
  learnpath_enquiry.associate = function(models) {
    // associations can be defined here
  };
  return learnpath_enquiry;
};