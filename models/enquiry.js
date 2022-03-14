'use strict';
module.exports = (sequelize, DataTypes) => {
  const enquiry = sequelize.define('enquiry', {
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
      type: DataTypes.STRING(512)
  },
  
  courseName : {
      type: DataTypes.STRING,
      allowNull: false,
      notEmpty:true,
      validate: {
        notNull:{ msg: "courseName cannot be null" },
        notEmpty: { msg: "courseName cannot be empty" }
      }
    },

  courseId : {
      type: DataTypes.STRING,
      allowNull: false,
      notEmpty:true,
      validate: {
        notNull:{ msg: "courseId cannot be null" },
        notEmpty: { msg: "courseId cannot be empty" }
      }
    },

  userId : {
      type: DataTypes.INTEGER,
      isInt:true,
      validate: {
        isInt: { msg: "userId should be integer" }
      }
    },
  
  partnerId : {
    type: DataTypes.INTEGER,
    allowNull: false,
    isInt:true,
    validate: {
      notNull: { msg: "partnerId cannot be null" },
      isInt: { msg: "partnerId should be integer" }
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
  return enquiry;
};