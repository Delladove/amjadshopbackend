const mongoose = require("mongoose"); 

const categorySchema = new mongoose.Schema(
{
    _id: String,              // nanoid
    name: {
        type: String,
        required: true
    },
    link_slug: {
        type: String,
        unique: true,
        sparse: true
    },
    created_at: Number
},
{
    versionKey: false
});

// categorySchema.virtual("id").get(function () {
//     return this._id;
// });

// categorySchema.set("toJSON", {
//   virtuals: true,
// });

// categorySchema.set("toObject", {
//   virtuals: true,
// });
module.exports = mongoose.model("Category", categorySchema);