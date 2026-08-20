const mongoose = require("mongoose"); 

const campaignSchema = new mongoose.Schema(
{
    _id: String,

    cat_id: {
        type: String,
        ref: "Category",
        required: true
    },

    created_at: Number
},
{
    versionKey: false
});

// campaignSchema.virtual("id").get(function () {
//     return this._id;
// });

// campaignSchema.set("toJSON", {
//   virtuals: true,
// });

// campaignSchema.set("toObject", {
//   virtuals: true,
// });
module.exports = mongoose.model("Campaign", campaignSchema);