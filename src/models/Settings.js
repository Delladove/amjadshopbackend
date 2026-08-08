const mongoose = require("mongoose"); 

const settingSchema = new mongoose.Schema(
{
    key: {
        type: String,
        unique: true
    },

    value: mongoose.Schema.Types.Mixed
},
{
    versionKey: false
});

settingSchema.virtual("id").get(function () {
    return this._id;
});

settingSchema.set("toJSON", {
  virtuals: true,
});

settingSchema.set("toObject", {
  virtuals: true,
});
module.exports = mongoose.model("Setting", settingSchema);