const mongoose = require("mongoose"); 

const userSchema = new mongoose.Schema(
{
    _id: {
      type:  String,
      default: "auth"
    },
    adminPasswordHash: {
      type: String,
      required: true
    },
    warehousePasswordHash:{
      type: String,
      required: true
    },
    warehouseDisabled:{
      type: Boolean,
      required: true,
      default: false
    }
},
{
    versionKey: false
});

module.exports = mongoose.model("User", userSchema);