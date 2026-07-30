const mongoose = require("mongoose"); 

const visitSchema = new mongoose.Schema(
{
    _id: String,

    cat_id: {
        type: String,
        ref: "Category",
        required: true
    },

    at: Number,

    dwell_ms: Number
},
{
    versionKey: false
});


visitSchema.virtual("id").get(function () {
    return this._id;
});

visitSchema.set("toJSON", {
  virtuals: true,
});

visitSchema.set("toObject", {
  virtuals: true,
});
module.exports = mongoose.model("Visit", visitSchema);